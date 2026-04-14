/* global BJSpell, chrome */

// SpellcheckEngine is the single place where spellchecking behavior lives.

(function () {
  const PERSONAL_DICT_STORAGE_KEY = 'personal_dictionary';
  const PERSONAL_DICT_MAX_ENTRIES = 10000;
  const PERSONAL_WORD_MAX_LEN = 48;
  const PERSONAL_WORD_MIN_LEN = 1;
  const PERSONAL_DICT_SIZE_EXCEEDED_MSG =
    'Size limit of personal dictionary exceeded: limit 10,000 words.';

  function isValidPersonalWord(raw) {
    const s = String(raw).trim();
    if (s.length < PERSONAL_WORD_MIN_LEN || s.length > PERSONAL_WORD_MAX_LEN) return false;
    return /^[a-zA-Z]+$/.test(s);
  }

  function normalizePersonalWord(raw) {
    return String(raw).trim().toLowerCase();
  }

  function makePolicyCheck({ baseCheck, isDeniedWord, isAllowedWord }) {
    return function check(word) {
      if (isDeniedWord(word)) return false;
      if (isAllowedWord(word)) return true;
      return baseCheck(word);
    };
  }

  let personalDictionarySet = null;
  let personalDictionaryPromise = null;

  function ensurePersonalDictionary() {
    if (!personalDictionaryPromise) {
      personalDictionaryPromise = new Promise(function (resolve, reject) {
        chrome.storage.local.get([PERSONAL_DICT_STORAGE_KEY], function (result) {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          personalDictionarySet = new Set();
          const list = result[PERSONAL_DICT_STORAGE_KEY];
          if (Array.isArray(list)) {
            list.forEach(function (w) {
              if (typeof w === 'string' && isValidPersonalWord(w)) {
                personalDictionarySet.add(normalizePersonalWord(w));
              }
            });
          }
          if (personalDictionarySet.size > PERSONAL_DICT_MAX_ENTRIES) {
            const sorted = Array.from(personalDictionarySet).sort();
            const trimmed = sorted.slice(0, PERSONAL_DICT_MAX_ENTRIES);
            personalDictionarySet = new Set(trimmed);
            chrome.storage.local.set({ [PERSONAL_DICT_STORAGE_KEY]: trimmed }, function () {
              if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
                return;
              }
              resolve();
            });
            return;
          }
          resolve();
        });
      });
    }
    return personalDictionaryPromise;
  }

  function persistPersonalDictionary(callback) {
    let arr = Array.from(personalDictionarySet).sort();
    if (arr.length > PERSONAL_DICT_MAX_ENTRIES) {
      arr = arr.slice(0, PERSONAL_DICT_MAX_ENTRIES);
      personalDictionarySet = new Set(arr);
    }
    chrome.storage.local.set({ [PERSONAL_DICT_STORAGE_KEY]: arr }, function () {
      if (chrome.runtime.lastError) {
        callback(new Error(chrome.runtime.lastError.message));
        return;
      }
      callback(null);
    });
  }

  let allowlistSet = null;
  let allowlistPromise = null;

  function allowlistUrl() {
    return chrome.runtime.getURL('spell_allowlist.json');
  }

  function ensureAllowlist() {
    if (!allowlistPromise) {
      allowlistPromise = fetch(allowlistUrl())
        .then(function (r) {
          if (!r.ok) throw new Error('Allowlist HTTP ' + r.status);
          return r.json();
        })
        .then(function (data) {
          if (!Array.isArray(data)) {
            throw new Error('spell_allowlist.json must be a JSON array of strings');
          }
          allowlistSet = new Set(
            data.map(function (w) {
              return String(w).toLowerCase();
            })
          );
        });
    }
    return allowlistPromise;
  }

  let denylistSet = null;
  let denylistPromise = null;

  function denylistUrl() {
    return chrome.runtime.getURL('spell_denylist.json');
  }

  function ensureDenylist() {
    if (!denylistPromise) {
      denylistPromise = fetch(denylistUrl())
        .then(function (r) {
          if (!r.ok) throw new Error('Denylist HTTP ' + r.status);
          return r.json();
        })
        .then(function (data) {
          if (!Array.isArray(data)) {
            throw new Error('spell_denylist.json must be a JSON array of strings');
          }
          denylistSet = new Set(
            data.map(function (w) {
              return String(w).toLowerCase();
            })
          );
        });
    }
    return denylistPromise;
  }

  function isDeniedWord(word) {
    if (!denylistSet) return false;
    return denylistSet.has(String(word).toLowerCase());
  }

  function isAllowedWord(word) {
    const key = String(word).toLowerCase();
    if (allowlistSet && allowlistSet.has(key)) return true;
    if (personalDictionarySet && personalDictionarySet.has(key)) return true;
    return false;
  }

  let checkerPromise = null;

  function dictionaryUrl() {
    return chrome.runtime.getURL('dictionaries/en_US.js');
  }

  function ensureChecker() {
    if (!checkerPromise) {
      checkerPromise = new Promise(function (resolve, reject) {
        const timeout = setTimeout(function () {
          reject(new Error('Dictionary load timed out'));
        }, 120000);
        try {
          BJSpell(dictionaryUrl(), function () {
            clearTimeout(timeout);
            resolve(this);
          });
        } catch (e) {
          clearTimeout(timeout);
          reject(e);
        }
      });
    }
    return checkerPromise;
  }

  function filterDeniedSuggestions(suggestions) {
    return suggestions.filter(function (s) {
      return !isDeniedWord(s);
    });
  }

  function suggestFiltered(checker, badWord, want) {
    const raw = checker.suggest(badWord, Math.max(want * 12, 24));
    return filterDeniedSuggestions(raw).slice(0, want);
  }

  function collectSpellErrors(text, checker) {
    const seen = new Set();
    const errors = [];
    checker.replace(text, function (badWord) {
      const key = badWord.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        const suggestions = suggestFiltered(checker, badWord, 2);
        errors.push({ word: badWord, suggestions: suggestions });
      }
      return badWord;
    });
    return errors;
  }

  async function ensureReady() {
    const results = await Promise.all([
      ensureChecker(),
      ensureDenylist(),
      ensureAllowlist(),
      ensurePersonalDictionary(),
    ]);
    const checker = results[0];

    if (!checker._spellPolicyApplied) {
      checker._spellPolicyApplied = true;
      const baseCheck = checker.check.bind(checker);
      checker.check = makePolicyCheck({
        baseCheck,
        isDeniedWord,
        isAllowedWord,
      });
    }

    return checker;
  }

  async function checkText(text) {
    const checker = await ensureReady();
    return collectSpellErrors(String(text), checker);
  }

  function listPersonalWords() {
    if (!personalDictionarySet) return [];
    return Array.from(personalDictionarySet).sort();
  }

  function addPersonalWord(raw) {
    if (!personalDictionarySet) {
      throw new Error('Personal dictionary not loaded');
    }
    if (!isValidPersonalWord(raw)) {
      throw new Error(
        'Invalid word. Use only letters A–Z, length ' +
          PERSONAL_WORD_MIN_LEN +
          '–' +
          PERSONAL_WORD_MAX_LEN +
          '.'
      );
    }
    const key = normalizePersonalWord(raw);
    if (isDeniedWord(key)) {
      throw new Error('This word is on the blocked list and cannot be added.');
    }
    if (personalDictionarySet.has(key)) {
      throw new Error('That word is already in your personal dictionary.');
    }
    if (personalDictionarySet.size >= PERSONAL_DICT_MAX_ENTRIES) {
      throw new Error(PERSONAL_DICT_SIZE_EXCEEDED_MSG);
    }
    personalDictionarySet.add(key);
  }

  function removePersonalWord(key) {
    if (!personalDictionarySet) {
      throw new Error('Personal dictionary not loaded');
    }
    personalDictionarySet.delete(String(key).toLowerCase());
  }

  function savePersonalWords() {
    return new Promise(function (resolve, reject) {
      persistPersonalDictionary(function (err) {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      });
    });
  }

  globalThis.SpellcheckEngine = {
    // constants
    PERSONAL_DICT_SIZE_EXCEEDED_MSG,
    PERSONAL_WORD_MAX_LEN,
    PERSONAL_WORD_MIN_LEN,

    // pure policy helper (also used by unit tests)
    makePolicyCheck,

    // readiness + checking
    ensureReady,
    checkText,

    // personal dictionary
    ensurePersonalDictionary,
    listPersonalWords,
    addPersonalWord,
    removePersonalWord,
    savePersonalWords,
  };
})();


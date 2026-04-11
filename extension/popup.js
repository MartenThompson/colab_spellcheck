function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

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
  chrome.storage.local.set(
    { [PERSONAL_DICT_STORAGE_KEY]: arr },
    function () {
      if (chrome.runtime.lastError) {
        alert('Could not save: ' + chrome.runtime.lastError.message);
        return;
      }
      if (callback) callback();
    }
  );
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

function isProjectAllowedWord(word) {
  if (!allowlistSet) return false;
  return allowlistSet.has(String(word).toLowerCase());
}

function isPersonalAllowedWord(word) {
  if (!personalDictionarySet) return false;
  return personalDictionarySet.has(String(word).toLowerCase());
}

function isAllowedWord(word) {
  return isProjectAllowedWord(word) || isPersonalAllowedWord(word);
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

function filterDeniedSuggestions(suggestions) {
  return suggestions.filter(function (s) {
    return !isDeniedWord(s);
  });
}

function suggestFiltered(checker, badWord, want) {
  const raw = checker.suggest(badWord, Math.max(want * 12, 24));
  return filterDeniedSuggestions(raw).slice(0, want);
}

function applySpellWordlists(checker) {
  if (checker._spellWordlistsApplied) return;
  checker._spellWordlistsApplied = true;
  const baseCheck = checker.check.bind(checker);
  checker.check = function (word) {
    if (isDeniedWord(word)) return false;
    if (isAllowedWord(word)) return true;
    return baseCheck(word);
  };
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

function renderSpellResults(errors) {
  const container = document.querySelector('.spelling_suggestions_container');
  if (errors.length === 0) {
    container.innerHTML = '<p>No spelling errors in this cell. Good job!</p>';
    return;
  }
  let html = '';
  html += '<table class="results-table">';
  html += '<tr><th>word</th> <th>suggestions</th></tr>';
  errors.forEach(function (item) {
    html += '<tr>';
    html += '<td><button type="button" class="learn-word-btn" data-word="' + encodeURIComponent(item.word) + '">';
    html += escapeHtml(item.word);
    html += '</button></td><td>';
    html += item.suggestions.map(escapeHtml).join(', ');
    html += '</td></tr>';
  });
  html += '</table>';
  html += '<p class="settings-hint">Click a word if you would like to add it to your personal dictionary.</p>';
  container.innerHTML = html;
}

function spellCheckClick() {
  chrome.tabs.query({ currentWindow: true, active: true }, function (tabs) {
    chrome.tabs.sendMessage(tabs[0].id, 'please spell check', spellCheckResponseHandler);
  });
}

function spellCheckResponseHandler(response) {
  const container = document.querySelector('.spelling_suggestions_container');
  try {
    const text = response.text_content;
    if (text == null || String(text).trim() === '') {
      container.innerHTML = '<p>No text found in this cell.</p>';
      return;
    }

    container.innerHTML = '<p class="loading-msg">Working…</p>';

    Promise.all([
      ensureChecker(),
      ensureDenylist(),
      ensureAllowlist(),
      ensurePersonalDictionary(),
    ])
      .then(function (results) {
        const checker = results[0];
        applySpellWordlists(checker);
        const errors = collectSpellErrors(String(text), checker);
        renderSpellResults(errors);
      })
      .catch(function (err) {
        console.error(err);
        checkerPromise = null;
        denylistPromise = null;
        denylistSet = null;
        allowlistPromise = null;
        allowlistSet = null;
        personalDictionaryPromise = null;
        personalDictionarySet = null;
        container.innerHTML =
          '<p>Could not load the spell checker. Try reloading the extension at <code>chrome://extensions</code>.</p>';
      });
  } catch (error) {
    alert('Error. Please make a text/markdown cell active (not code).');
  }
}

function settingsGearImgHtml() {
  return (
    '<img src="images/settings_icon.png" alt="" class="settings-gear-img" width="32" height="32">'
  );
}

function setHeaderNavButton(showingSettings) {
  const btn = document.getElementById('settings_button');
  if (showingSettings) {
    btn.innerHTML =
      '<span class="settings-home-char" aria-hidden="true">\u2302</span>';
    btn.title = 'Home';
    btn.setAttribute('aria-label', 'Home');
  } else {
    btn.innerHTML = settingsGearImgHtml();
    btn.title = 'Settings';
    btn.setAttribute('aria-label', 'Settings');
  }
}

function settingsClick() {
  const settingsPane = document.querySelector('#settings_pane');
  const mainView = document.querySelector('#main_view');

  if (settingsPane.style.display === 'none') {
    mainView.style.display = 'none';
    settingsPane.style.display = 'block';
    setHeaderNavButton(true);
    Promise.all([ensurePersonalDictionary(), ensureDenylist()]).then(renderPersonalDictionaryList);
  } else {
    settingsPane.style.display = 'none';
    mainView.style.display = 'block';
    setHeaderNavButton(false);
  }
}

function renderPersonalDictionaryList() {
  const ul = document.querySelector('#personal_dictionary_list');
  if (!ul || !personalDictionarySet) return;
  ul.innerHTML = '';
  const words = Array.from(personalDictionarySet).sort();
  if (words.length === 0) {
    const li = document.createElement('li');
    li.className = 'personal-dict-empty';
    li.textContent = '(no words yet)';
    ul.appendChild(li);
    return;
  }
  words.forEach(function (w) {
    const li = document.createElement('li');
    li.className = 'personal-dict-item';
    const label = document.createElement('span');
    label.textContent = w;
    const rm = document.createElement('button');
    rm.type = 'button';
    rm.className = 'remove-word-btn';
    rm.textContent = 'Remove';
    rm.setAttribute('data-word', w);
    li.appendChild(label);
    li.appendChild(rm);
    ul.appendChild(li);
  });
}

function addPersonalWordFromInput(raw) {
  if (!isValidPersonalWord(raw)) {
    alert(
      'Invalid word. Use only letters A–Z, length ' +
        PERSONAL_WORD_MIN_LEN +
        '–' +
        PERSONAL_WORD_MAX_LEN +
        '.'
    );
    return;
  }
  const key = normalizePersonalWord(raw);
  if (isDeniedWord(key)) {
    alert('This word is on the blocked list and cannot be added.');
    return;
  }
  if (personalDictionarySet.has(key)) {
    alert('That word is already in your personal dictionary.');
    return;
  }
  if (personalDictionarySet.size >= PERSONAL_DICT_MAX_ENTRIES) {
    alert(PERSONAL_DICT_SIZE_EXCEEDED_MSG);
    return;
  }
  personalDictionarySet.add(key);
  persistPersonalDictionary(renderPersonalDictionaryList);
}

function removePersonalWord(key) {
  personalDictionarySet.delete(key);
  persistPersonalDictionary(renderPersonalDictionaryList);
}

function onSuggestionsContainerClick(event) {
  const btn = event.target.closest('.learn-word-btn');
  if (!btn) return;
  let word;
  try {
    word = decodeURIComponent(btn.getAttribute('data-word') || '');
  } catch (e) {
    return;
  }
  if (word === '') return;

  if (!confirm('Learn spelling for "' + word + '"?\nYou can manage your personal dictionary in the settings pane.')) return;

  if (!isValidPersonalWord(word)) {
    alert(
      'This word cannot be added. Only letters A–Z, up to ' + PERSONAL_WORD_MAX_LEN + ' characters.'
    );
    return;
  }
  if (isDeniedWord(word)) {
    alert('This word is on the blocked list and cannot be added.');
    return;
  }

  const key = normalizePersonalWord(word);
  if (personalDictionarySet.has(key)) {
    alert('That word is already in your personal dictionary.');
    return;
  }
  if (personalDictionarySet.size >= PERSONAL_DICT_MAX_ENTRIES) {
    alert(PERSONAL_DICT_SIZE_EXCEEDED_MSG);
    return;
  }

  personalDictionarySet.add(key);
  persistPersonalDictionary(function () {
    const tr = btn.closest('tr');
    const table = btn.closest('table');
    if (tr && table) {
      tr.remove();
      const remaining = table.querySelectorAll('tr').length;
      if (remaining <= 1) {
        document.querySelector('.spelling_suggestions_container').innerHTML =
          '<p>No spelling errors in this cell. Good job!</p>';
      }
    }
  });
}

function onPersonalDictionaryListClick(event) {
  const btn = event.target.closest('.remove-word-btn');
  if (!btn) return;
  const w = btn.getAttribute('data-word');
  if (w) removePersonalWord(w);
}

document.addEventListener('DOMContentLoaded', function () {
  setHeaderNavButton(false);
  document.getElementById('spell_check_button').addEventListener('click', spellCheckClick, false);
  document.getElementById('settings_button').addEventListener('click', settingsClick, false);

  document.querySelector('.spelling_suggestions_container').addEventListener('click', onSuggestionsContainerClick);

  document.getElementById('personal_dictionary_list').addEventListener('click', onPersonalDictionaryListClick);

  document.getElementById('add_personal_word_form').addEventListener('submit', function (event) {
    event.preventDefault();
    const input = document.getElementById('add_personal_word_input');
    const value = input.value;
    Promise.all([ensurePersonalDictionary(), ensureDenylist()]).then(function () {
      addPersonalWordFromInput(value);
      input.value = '';
    });
  });
});

import { describe, expect, test, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

function evalIntoGlobal(code, filename) {
  // Run scripts (BJSpell + dictionary) in the test global.
  // eslint-disable-next-line no-new-func
  const fn = new Function(code + '\n//# sourceURL=' + filename);
  fn.call(globalThis);
}

async function loadCheckerEnUS() {
  const repoRoot = path.resolve(__dirname, '..');

  const bjspellPath = path.join(repoRoot, 'extension', 'spelling_engine', 'BJSpell.js');
  const dictPath = path.join(repoRoot, 'extension', 'dictionaries', 'en_US.js');

  const bjspellCode = fs.readFileSync(bjspellPath, 'utf-8');
  const dictCode = fs.readFileSync(dictPath, 'utf-8');

  evalIntoGlobal(bjspellCode, 'BJSpell.js');
  evalIntoGlobal(dictCode, 'en_US.js');

  if (typeof globalThis.BJSpell !== 'function') {
    throw new Error('BJSpell did not load');
  }

  // If BJSpell.en_US is present, BJSpell() will initialize synchronously and invoke callback async.
  await new Promise((resolve) => {
    globalThis.BJSpell('en_US', function () {
      resolve();
    });
  });

  return globalThis.BJSpell('en_US');
}

let checker;
let checkWord;
let allowWords = [];
let denyWords = [];

beforeAll(async () => {
  const repoRoot = path.resolve(__dirname, '..');
  checker = await loadCheckerEnUS();

  denyWords = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, '..', 'extension', 'spell_denylist.json'), 'utf-8')
  ).map((w) => String(w));
  allowWords = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, '..', 'extension', 'spell_allowlist.json'), 'utf-8')
  ).map((w) => String(w));

  const deny = new Set(denyWords.map((w) => w.toLowerCase()));
  const allow = new Set(allowWords.map((w) => w.toLowerCase()));

  // Apply the same policy as the extension: denylist overrides allowlist, then fall back to dictionary.
  // This calls into the shared helper shipped with the extension's spelling engine.
  const spellModulePath = path.join(repoRoot, 'extension', 'spelling_engine', 'spellcheck.js');
  const spellModuleCode = fs.readFileSync(spellModulePath, 'utf-8');
  evalIntoGlobal(spellModuleCode, 'spellcheck.js');
  if (!globalThis.SpellcheckEngine || typeof globalThis.SpellcheckEngine.makePolicyCheck !== 'function') {
    throw new Error('SpellcheckEngine.makePolicyCheck did not load');
  }

  const baseCheck = checker.check.bind(checker);
  checkWord = globalThis.SpellcheckEngine.makePolicyCheck({
    baseCheck,
    isDeniedWord: (w) => deny.has(String(w).toLowerCase()),
    isAllowedWord: (w) => allow.has(String(w).toLowerCase()),
  });
});

describe('spellcheck: valid words', () => {

  test('valid words are considered correct', () => {
    const valid = [
      'the', 
      'and', 
      'cheese',
      'markdown', 
      'cell', 
      'dictionary', 
      'provide'
    ];
    
    const bad = valid.filter((w) => !checkWord(w));
    expect(bad).toEqual([]);
  });

  test('global allowlist is non-empty and contains sentinel entries', () => {
    expect(allowWords.length).toBeGreaterThan(0);
    const allowLower = new Set(allowWords.map((w) => String(w).toLowerCase()));
    expect(allowLower.has('colab')).toBe(true);
  });

  test('global allowlist words are considered correct (case-insensitive)', () => {
    // Assert the full allowlist behaves as intended.
    // (This does not require suggestions support.)
    for (const w of allowWords) {
      expect(checkWord(w), w).toBe(true);
      expect(checkWord(String(w).toUpperCase()), w).toBe(true);
    }
  });

  test('common contractions with straight apostrophe are correct', () => {
    const ok = [
      "didn't",
      "couldn't",
      "wouldn't",
      "shouldn't",
      "isn't",
      "aren't",
      "wasn't",
      "weren't",
      "haven't",
      "hasn't",
      "hadn't",
      "won't",
      "can't",
      "don't",
      "doesn't",
      "it's",
      "that's",
      "what's",
      "who's",
      "there's",
      "here's",
      "you're",
      "we're",
      "they're",
      "I've",
      "you've",
      "we've",
      "they've",
      "I'll",
      "you'll",
      "he'll",
      "she'll",
      "we'll",
      "they'll",
      "I'd",
      "you'd",
      "he'd",
      "she'd",
      "we'd",
      "they'd",
    ];
    const bad = ok.filter((w) => !checkWord(w));
    expect(bad).toEqual([]);
  });
});

describe('spellcheck: non-words', () => {

  test('non-words are considered incorrect', () => {
    const invalid = [
      'asdkfj', 
      'zzzzzz', 
      'qwxzqwxz',
      'providddde',
    ];
    
    for (const w of invalid) {
      expect(checkWord(w), w).toBe(false);
    }
  });

  test('global denylist is non-empty and contains sentinel entries', () => {
    expect(denyWords.length).toBeGreaterThan(0);
    const denyLower = new Set(denyWords.map((w) => String(w).toLowerCase()));
    expect(denyLower.has('mst')).toBe(true);
  });

  test('global denylisted tokens are considered incorrect', () => {
    // Assert the full denylist behaves as intended.
    for (const w of denyWords) {
      expect(checkWord(w), w).toBe(false);
      expect(checkWord(w.toUpperCase()), w).toBe(false);
    }
  });
});


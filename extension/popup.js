function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
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
      const suggestions = checker.suggest(badWord, 2).slice(0, 2);
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
  let html = '<table>';
  html += '<tr><th>word</th> <th>suggestions</th></tr>';
  errors.forEach(function (item) {
    html += '<tr>';
    html += '<td>' + escapeHtml(item.word) + '</td><td>';
    html += item.suggestions.map(escapeHtml).join(', ');
    html += '</td></tr>';
  });
  html += '</table>';
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

    ensureChecker()
      .then(function (checker) {
        const errors = collectSpellErrors(String(text), checker);
        renderSpellResults(errors);
      })
      .catch(function (err) {
        console.error(err);
        checkerPromise = null;
        container.innerHTML =
          '<p>Could not load the spell checker. Try reloading the extension at <code>chrome://extensions</code>.</p>';
      });
  } catch (error) {
    alert('Error. Please make a text/markdown cell active (not code).');
  }
}

document.addEventListener('DOMContentLoaded', function () {
  document.getElementById('spell_check_button').addEventListener('click', spellCheckClick, false);
});

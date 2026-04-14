function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
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

    SpellcheckEngine.checkText(String(text))
      .then(function (errors) {
        renderSpellResults(errors);
      })
      .catch(function (err) {
        console.error(err);
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
    SpellcheckEngine.ensurePersonalDictionary().then(renderPersonalDictionaryList);
  } else {
    settingsPane.style.display = 'none';
    mainView.style.display = 'block';
    setHeaderNavButton(false);
  }
}

function renderPersonalDictionaryList() {
  const ul = document.querySelector('#personal_dictionary_list');
  if (!ul) return;
  ul.innerHTML = '';
  const words = SpellcheckEngine.listPersonalWords();
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
  try {
    SpellcheckEngine.addPersonalWord(raw);
  } catch (e) {
    alert(e.message);
    return;
  }
  SpellcheckEngine.savePersonalWords()
    .then(function () {
      renderPersonalDictionaryList();
    })
    .catch(function (e) {
      alert('Could not save: ' + e.message);
    });
}

function removePersonalWord(key) {
  try {
    SpellcheckEngine.removePersonalWord(key);
  } catch (e) {
    alert(e.message);
    return;
  }
  SpellcheckEngine.savePersonalWords()
    .then(function () {
      renderPersonalDictionaryList();
    })
    .catch(function (e) {
      alert('Could not save: ' + e.message);
    });
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

  try {
    SpellcheckEngine.addPersonalWord(word);
  } catch (e) {
    alert(e.message);
    return;
  }

  SpellcheckEngine.savePersonalWords()
    .then(function () {
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
    })
    .catch(function (e) {
      alert('Could not save: ' + e.message);
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
    SpellcheckEngine.ensurePersonalDictionary().then(function () {
      addPersonalWordFromInput(value);
      input.value = '';
    });
  });
});

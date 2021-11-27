// show/hide settings div. hide/show the spell check button.
// don't do anything else in here; it is called elsewhere.
function settingsClick() {
  let settings_pane = document.querySelector('#settings_pane');
  let sc_button = document.querySelector('#spell_check_button');

  if (settings_pane.style.display === "none") {
    settings_pane.style.display = "block";
    sc_button.style.display = "none";
  } else {
    settings_pane.style.display = "none";
    sc_button.style.display = "block";
  }
}

function spellCheckClick() {
  chrome.tabs.query({currentWindow: true, active: true},
  function (tabs) {
    // tabs will be all matching query, hopefully just content
    chrome.tabs.sendMessage(tabs[0].id, 'please spell check', spellCheckButtonResponseHandler)
  })
}


function xmlhttp_request(user_phrase, api_key_value) {
  // for testing, uncomment this, remove rest of function
  // and add response = spell_check_api_response; to make_html()
  //resp = {"software":{"name":"GrammarBot","version":"4.3.1","apiVersion":1,"premium":true,"premiumHint":"Thanks for supporting GrammarBot!","status":""},"warnings":{"incompleteResults":false},"language":{"name":"English (US)","code":"en-US","detectedLanguage":{"name":"English (US)","code":"en-US"}},"matches":[{"message":"This sentence does not start with an uppercase letter","shortMessage":"","replacements":[{"value":"This"}],"offset":0,"length":4,"context":{"text":"this is a teest hey wordss spelling ","offset":0,"length":4},"sentence":"this is a teest hey wordss spelling","type":{"typeName":"Other"},"rule":{"id":"UPPERCASE_SENTENCE_START","description":"Checks that a sentence starts with an uppercase letter","issueType":"typographical","category":{"id":"CASING","name":"Capitalization"}}},{"message":"Possible spelling mistake found","shortMessage":"Spelling mistake","replacements":[{"value":"test"},{"value":"tees"},{"value":"weest"},{"value":"tee st"},{"value":"tees t"}],"offset":10,"length":5,"context":{"text":"this is a teest hey wordss spelling ","offset":10,"length":5},"sentence":"this is a teest hey wordss spelling","type":{"typeName":"Other"},"rule":{"id":"MORFOLOGIK_RULE_EN_US","description":"Possible spelling mistake","issueType":"misspelling","category":{"id":"TYPOS","name":"Possible Typo"}}},{"message":"Possible spelling mistake found","shortMessage":"Spelling mistake","replacements":[{"value":"words"},{"value":"words s"}],"offset":20,"length":6,"context":{"text":"this is a teest hey wordss spelling ","offset":20,"length":6},"sentence":"this is a teest hey wordss spelling","type":{"typeName":"Other"},"rule":{"id":"MORFOLOGIK_RULE_EN_US","description":"Possible spelling mistake","issueType":"misspelling","category":{"id":"TYPOS","name":"Possible Typo"}}}]}
  //make_html(resp);

  const data = "text="+user_phrase;

  const xhr = new XMLHttpRequest();
  xhr.withCredentials = true;

  xhr.addEventListener("readystatechange", function () {
    if (this.readyState === this.DONE) {
      make_html(this.responseText);
    }
  });

  xhr.open("POST", "https://grammarbot.p.rapidapi.com/check");
  xhr.setRequestHeader("content-type", "application/x-www-form-urlencoded");
  xhr.setRequestHeader("x-rapidapi-host", "grammarbot.p.rapidapi.com");
  xhr.setRequestHeader("x-rapidapi-key", api_key_value);

  xhr.send(data);
}

function make_html(spell_check_api_response) {
  response = JSON.parse(spell_check_api_response);
  console.log(response);
  let suggestions = response.matches;

  let html = '';
  html += `<table>`
  html += `<tr><th>word</th> <th>suggestions</th></tr>`
  suggestions.forEach((item, i) => {
    if (item.shortMessage == 'Spelling mistake') {
      let user_phrase = item.context.text;

      let word = user_phrase.slice(item.context.offset, item.context.offset+item.context.length);
      //console.log(word);

      html += `<tr>`;
      html += `<td>${word}</td> `;

      for (const [index, el] of item.replacements.entries()) {
        //console.log(el);
        if (index == 0) html += `<td>`;
        if (index > 0) html += `, `;

        html += `${el.value}`;

        if (index === 1) {
          html += `</td>`;
          break; // top 2 suggestions only
        }
      }
      html += `</tr>`;

    }; // else grammar suggestion
  });

  html += `</table>`;
  let container = document.querySelector('.spelling_suggestions_container');
  container.innerHTML = html;
}

function spellCheckButtonResponseHandler(response) {

  var regex_words = new RegExp('\\w+', 'g');
  //var phrase = 'testing tetadsf text # title $\alpha$ 1. hey 1. oh';
  var word_array = response.text_content.match(regex_words);
  phrase = ''
  word_array.forEach((item, i) => {
    phrase += item + ' '
  });

  // for debugging
  //const div = document.createElement('div')
  //div.textContent = phrase;
  //document.body.appendChild(div)

  chrome.storage.local.get(['api_key'], function(result) {
    //alert(result.api_key);
    xmlhttp_request(phrase, result.api_key);
  });

}

document.addEventListener('DOMContentLoaded', function() {
  //chrome.storage.local.set({api_key: 'potato'}, function() {
  //console.log('Value is set to ');
  //});

  //chrome.storage.local.get(['api_key'], function(result) {
    //console.log('Value currently is ' + result.api_key);
  //  alert(result.api_key);
  //});

  document.getElementById("settings_button").addEventListener('click', settingsClick, false)
  document.getElementById("spell_check_button").addEventListener('click', spellCheckClick, false)

  const form = document.querySelector("#settings_form");
  form.addEventListener("submit", function (event) {
  	// stop form submission
  	event.preventDefault();

    let new_api_key_value = form.elements["key"].value;
    // alert(new_api_key_value);
  	// validate the form
  	//let nameValid = hasValue(form.elements["name"], NAME_REQUIRED);

    chrome.storage.local.set({api_key: new_api_key_value}, function() {
      console.log('GrammarBot API Key value updated');
    });

    settingsClick();
  });

}, false)

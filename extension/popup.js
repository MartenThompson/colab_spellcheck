//import * as bj from './bjspell/BJSpell.js'

document.addEventListener('DOMContentLoaded', function() {

  //var dictionary = 'https://rawcdn.githack.com/maheshmurag/bjspell/master/dictionary.js/en_US.js';
  //var lang = bj.BJSpell(dictionary, function() { });

  document.getElementById("spell_check_button").addEventListener('click',
    onclick, false)

  function onclick () {
    chrome.tabs.query({currentWindow: true, active: true},
    function (tabs) {
      // tabs will be all matching query, hopefully just content
      chrome.tabs.sendMessage(tabs[0].id, 'please spell check', handleResponse)
    })
  }

function handleResponse(response) {
  const div = document.createElement('div')
  div.textContent = "Respones is: " + response.text_content
  // be careful w/ mult, only shows last div.textContent = 'Spelling Suggestions:'
  //div.textContent = 'to do'
  document.body.appendChild(div)


  var words = response.text_content.split(/(\s+)/).filter(
    function(word) { return word.trim().length > 0; } );

  const spellcheck_pane = document.createElement('div')
  spellcheck_pane.innerHTML = words.map(function(word) {
    return `<p> ${word} </p> `;
  }).join(' ')
  document.body.appendChild(spellcheck_pane)

  // from https://esstudio.site/2018/10/22/javascript-spellingchecker.html
  //div.innerHTML = words.map(function(word) {
  // var correct = lang.check(word);
  // var className = correct ? 'correct' : 'misspelled';
  // var title = correct
//    ? 'Correct spelling'
  //  : `Did you mean ${lang.suggest(word, 5).join(', ')}?`;
  // return `<span title="${title}" class="${className}">${word}</span>`;
 //}).join(' ');



}

}, false)

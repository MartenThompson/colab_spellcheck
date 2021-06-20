document.addEventListener('DOMContentLoaded', function() {
  document.getElementById("spell_check_button").addEventListener('click',
    onclick, false)

  function onclick () {
    chrome.tabs.query({currentWindow: true, active: true},
    function (tabs) {
      // tabs will be all matching query, hopefully just content
      chrome.tabs.sendMessage(tabs[0].id, 'go spell check', handleResponse)
    })
  }

function handleResponse(response) {
  const div = document.createElement('div')
  div.textContent = `Respones is: ${response.text_content}`
  //div.innerHTML = response.text_content

  document.body.appendChild(div)

}

}, false)

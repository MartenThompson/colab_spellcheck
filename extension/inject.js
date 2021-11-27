// This script is injected into every collab tab

// Listen for popup.js to send request
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {

  var whole_cell = document.querySelector(".cell.text.focused");
  let markdown = whole_cell.querySelector('.markdown');

  sendResponse({message: "responding with all content",
                text_content: markdown.textContent
              });
});

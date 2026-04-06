// This script is injected into every collab tab

// Listen for popup.js to send request
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {

  var whole_cell = document.querySelector(".cell.text.focused");
  if (!whole_cell) {
    sendResponse({ message: "no focused cell", text_content: null });
    return;
  }
  var markdown = whole_cell.querySelector('.markdown');
  if (!markdown) {
    sendResponse({ message: "no markdown", text_content: null });
    return;
  }

  sendResponse({
    message: "responding with all content",
    text_content: markdown.textContent
  });
});

// This script is injected into every collab tab

// Listen for popup.js to send request
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {

  var whole_cell = document.querySelector(".cell.text.focused");
  let markdown = whole_cell.querySelector('.markdown');

  //Recursive function to parse markdown cell currently in focus
  //count implemented for testing purpses
  //let count = 0;
  //let traverseMarkdown = (node, func) => {
  //  func(node);
  //  node = node.firstChild;
  //  while (node) {
  //    traverseMarkdown(node, func);
  //    node = node.nextSibling;
  //    count++;
  //    if (count > 50) {
  //      break;
  //    }
  //  }
  //}

  // used when debugging to confirm extension contents reloaded
  //alert('req received 5')

  //recursion function implemented
  //the node.textContent.length != 1 portion is because there were numerous text cells with length 1.
  //not sure where these were coming from.
  //traverseMarkdown(markdown, node => {
  //  if ((node.nodeType == Node.TEXT_NODE) && (node.textContent.length != 1)){
  //    console.log(node.textContent);
  //  }
  //});


  //var main_content = whole_cell.querySelector('.main-content');
  //var editor_content = main_content.querySelector('.editor-container');
  //var text_div = editor_content.querySelector('.text-top-div');
  //var markdown = text_div.querySelector('.markdown');

  //var i;
  //var text_content = x.getElementsByClassName("mtk1");
  //for (i = 0; i < x.length; i++) {
  //  x[i].style.backgroundColor = "red";
  //}
  sendResponse({message: "responding with all content",
                text_content: markdown.textContent
              });

});

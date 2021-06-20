// This script is injected into every collab tab

// Listen for popup.js to send request
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  //alert(request)
  var whole_cell = document.getElementsByClassName("cell text focused");
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
                text_content: whole_cell
              })
})

// Content script for Colab: spellcheck text extraction + rendered-markdown highlights.

(function () {
  var HIGHLIGHT_CLASS = 'colab-spell-err';
  var highlightObserver = null;
  var observedCell = null;

  function isElementVisible(el) {
    if (!el || !el.getClientRects) return false;
    var style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) {
      return false;
    }
    var rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  /**
   * When a text cell is in markdown *edit* mode, Colab shows a Monaco (or similar) surface.
   * Rendered mode shows the .markdown HTML preview without a visible editor on top.
   */
  function isEditingMarkdownCell(cell) {
    var monaco = cell.querySelector('.monaco-editor');
    if (monaco && isElementVisible(monaco)) return true;
    var inputarea = cell.querySelector('textarea.inputarea');
    if (inputarea && isElementVisible(inputarea)) return true;
    var cm = cell.querySelector('.CodeMirror');
    if (cm && isElementVisible(cm)) return true;
    return false;
  }

  function isRenderedMarkdownCell(cell) {
    var md = cell.querySelector('.markdown');
    if (!md || !isElementVisible(md)) return false;
    if (isEditingMarkdownCell(cell)) return false;
    return true;
  }

  function unwrapMark(mark) {
    var parent = mark.parentNode;
    if (!parent) return;
    while (mark.firstChild) {
      parent.insertBefore(mark.firstChild, mark);
    }
    parent.removeChild(mark);
    try {
      parent.normalize();
    } catch (e) {
      /* ignore */
    }
  }

  function clearHighlightsInMarkdown(cell) {
    var md = cell.querySelector('.markdown');
    if (!md) return;
    var marks = md.querySelectorAll('mark.' + HIGHLIGHT_CLASS);
    for (var i = 0; i < marks.length; i++) {
      unwrapMark(marks[i]);
    }
  }

  function clearAllExtensionHighlights() {
    var marks = document.querySelectorAll('mark.' + HIGHLIGHT_CLASS);
    for (var i = 0; i < marks.length; i++) {
      unwrapMark(marks[i]);
    }
  }

  function detachHighlightObserver() {
    if (highlightObserver) {
      highlightObserver.disconnect();
      highlightObserver = null;
    }
    observedCell = null;
  }

  function attachHighlightObserver(cell) {
    detachHighlightObserver();
    observedCell = cell;
    highlightObserver = new MutationObserver(function () {
      if (!document.contains(cell)) {
        detachHighlightObserver();
        return;
      }
      if (!isRenderedMarkdownCell(cell)) {
        clearHighlightsInMarkdown(cell);
        detachHighlightObserver();
      }
    });
    highlightObserver.observe(cell, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['class', 'style', 'hidden'],
    });
  }

  function escapeRegExp(s) {
    return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function shouldHighlightTextNode(textNode) {
    if (!textNode.nodeValue || !String(textNode.nodeValue).trim()) return false;
    var el = textNode.parentElement;
    if (!el) return false;
    if (
      el.closest(
        'md-icon-button, .cell-toolbar, colab-cell-toolbar, script, style, svg, math'
      )
    ) {
      return false;
    }
    return true;
  }

  function wrapMatchesInTextNode(textNode, re) {
    var text = textNode.nodeValue;
    var parent = textNode.parentNode;
    if (!parent) return false;
    re.lastIndex = 0;
    var lastIndex = 0;
    var frag = document.createDocumentFragment();
    var m;
    var changed = false;
    while ((m = re.exec(text)) !== null) {
      if (m.index > lastIndex) {
        frag.appendChild(document.createTextNode(text.slice(lastIndex, m.index)));
      }
      var mark = document.createElement('mark');
      mark.className = HIGHLIGHT_CLASS;
      mark.setAttribute('data-word', m[0]);
      mark.setAttribute('title', 'Possible misspelling');
      mark.textContent = m[0];
      frag.appendChild(mark);
      lastIndex = m.index + m[0].length;
      changed = true;
    }
    if (!changed) return false;
    if (lastIndex < text.length) {
      frag.appendChild(document.createTextNode(text.slice(lastIndex)));
    }
    parent.replaceChild(frag, textNode);
    return true;
  }

  function buildMisspellRegex(errors) {
    var words = [];
    var seen = {};
    for (var i = 0; i < errors.length; i++) {
      var w = errors[i] && errors[i].word;
      if (!w || typeof w !== 'string') continue;
      var k = w.toLowerCase();
      if (seen[k]) continue;
      seen[k] = true;
      words.push(w);
    }
    if (!words.length) return null;
    words.sort(function (a, b) {
      return b.length - a.length;
    });
    var inner = words.map(escapeRegExp).join('|');
    return new RegExp('\\b(' + inner + ')\\b', 'gi');
  }

  function applyHighlights(errors) {
    detachHighlightObserver();
    clearAllExtensionHighlights();

    var cell = document.querySelector('.cell.text.focused');
    if (!cell) return;

    if (!errors || !errors.length) return;

    if (!isRenderedMarkdownCell(cell)) return;

    var markdown = cell.querySelector('.markdown');
    if (!markdown) return;

    var re = buildMisspellRegex(errors);
    if (!re) return;

    var textNodes = [];
    var walker = document.createTreeWalker(markdown, NodeFilter.SHOW_TEXT, null);
    var tn;
    while ((tn = walker.nextNode())) {
      if (shouldHighlightTextNode(tn)) {
        textNodes.push(tn);
      }
    }

    for (var j = 0; j < textNodes.length; j++) {
      var node = textNodes[j];
      if (!node.parentNode || !document.contains(node)) continue;
      wrapMatchesInTextNode(node, re);
    }

    attachHighlightObserver(cell);
  }

  function handleSpellCheckRequest(sendResponse) {
    var whole_cell = document.querySelector('.cell.text.focused');
    if (!whole_cell) {
      sendResponse({ message: 'no focused cell', text_content: null });
      return;
    }
    var markdown = whole_cell.querySelector('.markdown');
    if (!markdown) {
      sendResponse({ message: 'no markdown', text_content: null });
      return;
    }

    sendResponse({
      message: 'responding with all content',
      text_content: markdown.textContent,
    });
  }

  chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    if (request && request.type === 'COLAB_SPELLCHECK_CLEAR') {
      detachHighlightObserver();
      clearAllExtensionHighlights();
      sendResponse({ ok: true });
      return;
    }

    if (request && request.type === 'COLAB_SPELLCHECK_HIGHLIGHT') {
      try {
        applyHighlights(request.errors);
      } catch (e) {
        console.error('Colab Spellcheck highlight:', e);
      }
      sendResponse({ ok: true });
      return;
    }

    if (request === 'please spell check') {
      handleSpellCheckRequest(sendResponse);
      return;
    }
  });
})();

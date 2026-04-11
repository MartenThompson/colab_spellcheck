# Google Colab Spellcheck Extension

This repo contains the code for a Chrome extension that spellchecks markdown cells in Google Colab. It is available for free on [Chrome Web Store](https://chrome.google.com/webstore/detail/colab-spellcheck/ibnfomklkmoocmbmjlddagkippmndioc).

No API key or network access is required to function. Spellchecking runs **offline** in the extension popup using [BJSpell](https://github.com/maheshmurag/bjspell) with a bundled English (US) Hunspell-derived dictionary. This approach is lightweight enough for an extension, but imperfect. Please use the personal dictionary feature to store any valid words this extension initially considers non-words. 

## Set Up

Install the extension from the [Chrome Web Store](https://chrome.google.com/webstore/detail/colab-spellcheck/ibnfomklkmoocmbmjlddagkippmndioc). That is it! No login, no network, all local.

## Usage 

Open a Colab notebook, click a markdown cell, and click **Check Active Cell** in the extension popup. The extension will create a table of misspelled words (if present) and suggestions. 

If the extension registers a real word as misspelled, you may click the word in the extension and add it to your personal dictionary. Manage your personal dictionary within settings <img width="16" height="16" alt="settings_icon" src="https://github.com/user-attachments/assets/325b9db9-5e01-4a02-a551-f153ef84e1e1" />. 

## Development Notes

The following notes pertain to the development of this extension and are not required for its use.

### Publishing Notes

https://chrome.google.com/webstore/devconsole/

### Local Dev

Load the extension from source at `chrome://extensions` (Developer mode > Load unpacked > choose the `extension/` folder of this repo).

Then, use the dashboard at `chrome://extensions/` to reload the extension while developing.

Logs from `popup.js` appear in the extension's DevTools (right-click inside the popup > Inspect), not in the page console (F12 on Colab). 

You can also inspect the extension's local files via the extension's DevTools by running 

```
chrome.storage.local.get(null, console.log);
```

Other usefule commands

```
chrome.storage.local.set({ personalDictionary: ['colab', 'myname'] }, () => console.log('ok'));
chrome.storage.local.remove('personalDictionary');
chrome.storage.local.clear(); // wipes all keys for this extension only
```

Note that reloading the unpacked extension does not wipe Chrome storage. 

Also, the extension is registered to run only on domains like
```
"matches": ["https://colab.research.google.com/*"] # see manifest.json
```



### BJSpell

Upstream mirror: https://github.com/maheshmurag/bjspell

The vendored `BJSpell.js` states Lesser GPL in its file header.

### Future Work

The dictionary contains non-words as a result of being built from ordinary words, stems, and abbreviations. This is less then ideal when we use the dictionary to check spelling. To remediate, we could 

1. denylist non-words,
2. modify dictionary in place, or
3. modify dictionary complilation such that it no longer creates non-words.

We chose 1, figuring 2 was risky (could break giant json blog) and 3 was a lot of work. But, the denylist is a crutch: we define a set of non-words to always flag when checking spelling and to remove from suggestions. 

### TODO

Pin old version and provide instructions so people can keep using it if they have a GrammarBot key (paid).

Make feedback templates or GitHub issues to organize the improvement of non-words being deny listed and real words allowed.

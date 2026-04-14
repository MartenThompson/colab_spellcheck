
## Development Notes

The following notes pertain to the development of this extension and are not required for its use.

### Publishing Notes

Follow [semver](https://semver.org/).


Publishing steps

1. Go to the [Chrome webstore](https://chrome.google.com/webstore/devconsole/).
1. Update "Store listing" with descirption and screenshots 
    1. Take `640x400` screenshots of the extension. I find it easiest to use `cmd+shft+5` to set a consistent window.
1. Update Permissions and Distribution if necessary.
1. Update the Package
    1. Zip the `extension/` directory: open `extension`, select everything inside, compress into `colab-spellcheck-0.0.0.zip` updating semver accordingly.
1. Submit for review.

Also, create release in GitHub of the codebase at the time of zipping. 

Then, as you develop, you can view the most recent release > click "x commits to main since this release" > inspect the files that have changed. Any changes to the contents of `extension/` should warrent a new release.


### Local Dev

Note to self: you're using your secondary gmail account for publishing and dev testing. Your primary email instead is a typical user, getting the extension from the Chrome webstore.

Load the extension from source at `chrome://extensions` (Developer mode > Load unpacked > choose the `extension/` folder of this repo).

Then, use the dashboard at `chrome://extensions/` to reload the extension while developing.

Logs from `popup.js` appear in the extension's DevTools (right-click inside the popup > Inspect), not in the page console (F12 on Colab). 

You can also inspect the extension's local files via the extension's DevTools by running 

```
chrome.storage.local.get(null, console.log);
```

Other useful commands

```
chrome.storage.local.set({ personal_dictionary: ['colab', 'myname'] }, () => console.log('ok'));
chrome.storage.local.remove('personal_dictionary');
chrome.storage.local.clear(); // wipes all keys for this extension only
```

Note that reloading the unpacked extension does not wipe Chrome storage. 

Also, the extension is registered to run only on domains like
```
"matches": ["https://colab.research.google.com/*"] # see manifest.json
```

If you want to see if a specific word will be considered correctly/incorrectly spelled, run

```
Promise.all([
  (async () => {
    const u = chrome.runtime.getURL('dictionaries/en_US.js');
    return new Promise((res) => BJSpell(u, function(){ res(this); }));
  })(),
]).then(([checker]) => {
  console.log('Checking myword', checker.check('myword'));
  console.log('Checking otherword', checker.check('otherword'));
});
```

#### Testing 

Tests run push as well as on pull requests. 

To run tests locally

```
npm ci      <-- NOT npm install -g
npm test

```


Speed Testing: I copied the entire text of [Huckleberry Finn](https://gutenberg.org/files/76/76-0.txt) (~100k words) as well as [The Narrative of the Life of Frederick Douglass](https://gutenberg.org/files/23/23-0.txt) (~225k) into a markdown cell and the extension was able to spell check each in ~3 seconds. That seems sufficiently quick! TODO: add as test? 

### Future Work

The dictionary contains non-words as a result of being built from ordinary words, stems, and abbreviations. This is less than ideal when we use the dictionary to check spelling. To remediate, we could 

1. denylist non-words,
2. modify dictionary in place, or
3. modify dictionary compilation such that it no longer creates non-words.

We chose 1, figuring 2 was risky (could break a giant JSON blob) and 3 was a lot of work. The denylist is a crutch: we define a set of non-words to always flag when checking spelling and to remove from suggestions. We should make feedback templates or GitHub issues to organize the improvement of which non-words belong on the denylist and which real words are allowed.

Pin old version and provide instructions so people can keep using it if they have a GrammarBot key (paid).

Add memory meter/value?

### External Links

Manifest v3 updates [here](https://developer.chrome.com/docs/extensions/mv3/intro/)

BJSpell upstream mirror: https://github.com/maheshmurag/bjspell. The vendored `BJSpell.js` states Lesser GPL in its file header.


### Things I have learned

The Colab HTML is a mess

* we want cells with classes `"cell text"` and `"cell text focused"`
* They are absolutely buried. 

Shouldn't we be able to target these elements with querySelector or querySelectorAll?

* cells with only “cell” and “text” classes: `let celltext = document.querySelectorAll(‘.cell.text:not(focused)’)`
* cells with “cell”, “text”, and “focused” classes: `let celltextfocused = document.querySelectorAll(‘.cell.text.focused’)`
    
Might be worth only looking at the 'cell text focused' cell only initially. That way user-defined names are repeatedly being flagged. We should catch the exception that is thrown whenever the user does not have a text cell active.

Seems like we are going to need DOM access for text cells. From my cursory review of this, it seems like content scripts may be the way to do this?

https://developer.chrome.com/docs/extensions/mv3/content_scripts/
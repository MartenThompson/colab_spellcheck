
### Things I have learned

The colab html is a mess

* we want cells with classes `"cell text"` and `"cell text focused"`
* They are absolutely burried. 

++ houldn't we be able to target these elements with querySelector or querySelectorAll?
  cells with only “cell” and “text” classes:
		let celltext = document.querySelectorAll(‘.cell.text:not(focused)’)
	cells with “cell”, “text”, and “focused” classes”:
		let celltextfocused = document.querySelectorAll(‘.cell.text.focused’)
    
++ Might be worth only looking at the 'cell text focused' cell only initially. That way user-defined names are repeatedly being flagged

### Approach

++ Seems like we are going to need DOM access for text cells. From my cursory review of this, it seems like content scripts may be the way to do this?
++ https://developer.chrome.com/docs/extensions/mv3/content_scripts/

### Local Testing in Chrome

1. Go to `chrome://extensions`
1. Make sure "Developer Mode" is turned on
1. Select "Load unpacked extensions" and then our "extension" folder

The extension should automatically refresh on file updates.



### Documentation

1. Manifest v3 updates [here](https://developer.chrome.com/docs/extensions/mv3/intro/)
1. To deploy, go to the [chrome web store docs](https://developer.chrome.com/docs/webstore/publish/)
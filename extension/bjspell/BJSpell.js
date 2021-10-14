/*!
 * BJSpell JavaScript Library v0.0.1
 * http://code.google.com/p/bjspell/
 *
 * Copyright (c) 2009 Andrea Giammarchi
 * Licensed under the Lesser GPL licenses.
 *
 * Date: 2009-02-05 23:50:01 +0000 (Wed, 05 Feb 2009)
 * Revision: 1
 * ToDo: better suggestion (at least one that make more sense)
 */
 BJSpell = function(){
 
    /**
     * Every BJSpell call is a dictionary based singleton.
     * new BJSpell("en_US") === BJSpell("en_US")
     * var en = BJSpell("en_US", function(){
     *     this === new BJSpell("en_US") === en
     * });
     * It is possible to create many languages instances without problems
     * but every instance will be cached in the browser after its download.
     * Every BJSpell instance uses a big amount of RAM due to the
     * JavaScript "pre-compiled" dictionary and caching optimizations.
     * @param   String a dictionary file to load. It has to contain the standard name of the language (e.g. en_US, en_EN, it_IT ...)
     * @param   Function a callback to execute asyncronously on dictionary ready
     * @return  BJSpell even invoked as regular callback returns the singletone instance for specified dictionary
     * @constructor
     */
    function BJSpell(dic, callback){
        if(this instanceof BJSpell){
            var lang = /^.*?([a-zA-Z]{2}_[a-zA-Z]{2}).*$/.exec(dic)[1],
                self = this;
            if(!callback)
                callback = empty;
            if(BJSpell[lang]){
                if(BJSpell[lang] instanceof BJSpell)
                    self = BJSpell[lang]
                else
                    BJSpell[lang] = sync(self, BJSpell[lang]);
                self.checked = {};
                var keys = self.keys = [],
                    words = self.words,
                    i = 0,
                    key;
                for(key in words)
                    keys[i++] = key;
                keys.indexOf = indexOf;
                setTimeout(function(){callback.call(self)}, 1);
            } else {
                var script = document.createElement("script");
                BJSpell[lang] = self;
                script.src = dic;
                script.type = "text/javascript";
                script.onload = function(){
                    script.onload = script.onreadystatechange = empty;
                    script.parentNode.removeChild(script);
                    BJSpell.call(self, dic, callback);
                };
                script.onreadystatechange = function(){
                    if(/loaded|completed/i.test(script.readyState))
                        script.onload();
                };
                (document.getElementsByTagName("head")[0] || document.documentElement).appendChild(script);
            };
            return self;
        } else
            return new BJSpell(dic, callback);
    };

    /** check a word, case insensitive
     * @param  String a word to check if it is correct or not
     * @return Boolean false if the word does not exist
     */
    BJSpell.prototype.check = function(word){
        var checked = this.checked[word = word.toLowerCase()];
        return typeof checked === "boolean" ? checked : this.parse(word);
    };

    /** check a "lowercased" word in the dictionary
     * @param  String a lowercase word to search in the dictionary
     * @return Boolean false if the word does not exist
     */
    BJSpell.prototype.parse = function(word){
        if(/^[0-9]+$/.test(word))
            return this.checked[word] = true;
        var result = !!this.words[word];
        if(!result){
            for(var
                parsed = word,
                rules = this.rules.PFX,
                length = rules.length,
                i = 0,
                rule, str, seek, re, add;
                i < length;
                i++
            ){
                rule = rules[i]; add = rule[0]; seek = rule[1]; re = rule[2];
                str = word.substr(0, seek.length);
                if(str === seek){
                    parsed = word.substring(str.length);
                    if(add !== "0")
                        parsed = add + parsed;
                    result = !!this.words[parsed];
                    break;
                }
            };
            if(!result && parsed.length){
                for(var
                    rules = this.rules.SFX,
                    len = parsed.length,
                    length = rules.length,
                    i = 0;
                    i < length;
                    i++
                ){
                    rule = rules[i]; add = rule[0]; seek = rule[1]; re = rule[2];
                    str = parsed.substring(len - seek.length);
                    if(str === seek){
                        seek = parsed.substring(0, len - str.length);
                        if(add !== "0")
                            seek += add;
                        if((re === "." || new RegExp(re + "$").test(seek)) && this.words[seek]){
                            result = true;
                            break;
                        }
                    }
                }
            }
        };
        return this.checked[word] = result;
    };

    /** invoke a specific callback for each word that is not valid
     * @param  String a string with zero or more words to check
     * @param  Function a callback to use as replace. Only wrong words will be passed to the callback.
     * @return Boolean false if the word does not exist
     */
    BJSpell.prototype.replace = function(String, callback){
        var self = this;
        return String.replace(self.alphabet, function(word){
            return self.check(word) ? word : callback(word);
        });
    };

    /** basic/silly implementation of a suggestion - I will write something more interesting one day
     * @param  String a word, generally bad, to look for a suggestion
     * @param  Number an optional unsigned integer to retrieve N suggestions.
     * @return Array a list of possibilities/suggestions
     */
    BJSpell.prototype.suggest = function(word, many){
        if(typeof this.words[word] === "string"){
            // not implemented yet, requires word classes parser
            var words = [word];
        } else {
            var keys = this.keys,
                length = keys.length,
                i = Math.abs(many) || 1,
                ceil, indexOf, words;
            word = word.toLowerCase();
            if(-1 === keys.indexOf(word))
                keys[length] = word;
            keys.sort();
            indexOf = keys.indexOf(word);
            many = indexOf - ((i / 2) >> 0);
            ceil = indexOf + 1 + Math.ceil(i / 2);
            words = keys.slice(many, indexOf).concat(keys.slice(indexOf + 1, ceil));
            while(words.length < i && ++ceil < keys.length)
                words[words.length] = keys[ceil];
            if(length !== keys.length)
                keys.splice(indexOf, 1);
        };
        return words;
    };
    
    /** private scope functions
     * empty, as empty callback
     * indexOf, as Array.prototype.indexOf, normalized for IE or other browsers
     * sync, to copy over two objects keys/values
     */
    var empty = function(){},
        indexOf = Array.prototype.indexOf || function(word){for(var i=0,length=this.length;i<length&&this[i]!==word;i++);return i==length?-1:i},
        sync = function(a,b){for(var k in b)a[k]=b[k];return a};

    return BJSpell;
}();
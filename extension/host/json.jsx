/* A deliberately small JSON codec for ExtendScript. Never evaluates source text. MIT. */
var AEAIJSON = (function () {
    var own = Object.prototype.hasOwnProperty;
    function parse(text) {
        var at = 0, length, depth = 0;
        if (typeof text !== "string" || text.length > 400000) { throw new Error("JSON input must be text under 400000 characters"); }
        length = text.length;
        function error() { throw new Error("Invalid JSON at character " + at); }
        function space() { while (at < length && /[\x20\t\r\n]/.test(text.charAt(at))) { at += 1; } }
        function string() {
            var result = "", c, h, escaped;
            at += 1;
            while (at < length) {
                c = text.charAt(at); at += 1;
                if (c === '"') { return result; }
                if (c === "\\") {
                    c = text.charAt(at); at += 1;
                    if (c === "u") {
                        h = text.substr(at, 4); if (!/^[0-9a-fA-F]{4}$/.test(h)) { error(); }
                        result += String.fromCharCode(parseInt(h, 16)); at += 4;
                    } else {
                        escaped = { '"': '"', "\\": "\\", "/": "/", b: "\b", f: "\f", n: "\n", r: "\r", t: "\t" };
                        if (!own.call(escaped, c)) { error(); }
                        result += escaped[c];
                    }
                } else {
                    if (c.charCodeAt(0) < 32) { error(); }
                    result += c;
                }
            }
            error();
        }
        function value() {
            var c, result, k, n, match;
            space(); c = text.charAt(at);
            depth += 1; if (depth > 32) { error(); }
            if (c === '"') { result = string(); }
            else if (c === "{") {
                result = {}; at += 1; space();
                if (text.charAt(at) === "}") { at += 1; }
                else {
                    while (at < length) {
                        space(); if (text.charAt(at) !== '"') { error(); }
                        k = string();
                        if (k === "__proto__" || k === "constructor" || k === "prototype" || own.call(result, k)) { error(); }
                        space(); if (text.charAt(at) !== ":") { error(); } at += 1;
                        result[k] = value(); space(); c = text.charAt(at); at += 1;
                        if (c === "}") { break; } if (c !== ",") { error(); }
                    }
                    if (c !== "}") { error(); }
                }
            } else if (c === "[") {
                result = []; at += 1; space();
                if (text.charAt(at) === "]") { at += 1; }
                else {
                    while (at < length) {
                        result.push(value()); space(); c = text.charAt(at); at += 1;
                        if (c === "]") { break; } if (c !== ",") { error(); }
                    }
                    if (c !== "]") { error(); }
                }
            } else if (text.substr(at, 4) === "true") { result = true; at += 4; }
            else if (text.substr(at, 5) === "false") { result = false; at += 5; }
            else if (text.substr(at, 4) === "null") { result = null; at += 4; }
            else {
                match = /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?/.exec(text.substring(at));
                if (!match) { error(); }
                n = Number(match[0]); if (!isFinite(n)) { error(); }
                at += match[0].length; result = n;
            }
            depth -= 1; return result;
        }
        var result = value(); space(); if (at !== length) { error(); } return result;
    }
    function stringify(value) {
        function quote(s) {
            return '"' + s.replace(/["\\\x00-\x1f\u2028\u2029]/g, function (c) {
                var n = c.charCodeAt(0).toString(16);
                if (c === '"' || c === "\\") { return "\\" + c; }
                return "\\u" + ("0000" + n).slice(-4);
            }) + '"';
        }
        function encode(v, depth) {
            var parts = [], k, i;
            if (depth > 32) { throw new Error("JSON nesting too deep"); }
            if (v === null) { return "null"; }
            if (typeof v === "string") { return quote(v); }
            if (typeof v === "number") { return isFinite(v) ? String(v) : "null"; }
            if (typeof v === "boolean") { return v ? "true" : "false"; }
            if (Object.prototype.toString.call(v) === "[object Array]") {
                for (i = 0; i < v.length; i += 1) { parts.push(encode(v[i], depth + 1)); }
                return "[" + parts.join(",") + "]";
            }
            if (typeof v === "object") {
                for (k in v) { if (own.call(v, k) && typeof v[k] !== "undefined" && typeof v[k] !== "function") { parts.push(quote(k) + ":" + encode(v[k], depth + 1)); } }
                return "{" + parts.join(",") + "}";
            }
            return "null";
        }
        return encode(value, 0);
    }
    return { parse: parse, stringify: stringify };
}());
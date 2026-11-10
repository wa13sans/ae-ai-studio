"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const Plan = require("../extension/shared/plan.js");
const Locale = require("../extension/js/i18n.js");
const panelSource = fs.readFileSync(path.join(__dirname, "../extension/js/panel.js"), "utf8");
const html = fs.readFileSync(path.join(__dirname, "../extension/index.html"), "utf8");

class Element {
    constructor(attributes) {
        this.attributes = attributes || {}; this.value = this.attributes.value || "";
        this.disabled = Object.hasOwn(this.attributes, "disabled"); this.hidden = Object.hasOwn(this.attributes, "hidden"); this.checked = Object.hasOwn(this.attributes, "checked");
        this.className = ""; this.children = []; this.events = {}; this._text = "";
    }
    get textContent() { return this._text; }
    set textContent(value) { this._text = String(value); this.children = []; }
    getAttribute(name) { return Object.hasOwn(this.attributes, name) ? this.attributes[name] : null; }
    addEventListener(type, handler) { (this.events[type] || (this.events[type] = [])).push(handler); }
    appendChild(child) { this.children.push(child); }
    focus() { this.focused = true; }
    fire(type, event) { if (type === "click" && this.disabled) { return; } for (const handler of this.events[type] || []) { handler.call(this, event || {}); } }
}

function harness(options = {}) {
    const elements = [], ids = {}, pendingHost = [], providerCalls = [], storageWrites = [], windowEvents = {}, timers = new Map();
    for (const match of html.matchAll(/<[a-z][a-z0-9-]*\b([^>]+)>/gi)) {
        const attrs = {};
        for (const attr of match[1].matchAll(/([a-zA-Z][a-zA-Z0-9-]*)(?:="([^"]*)")?/g)) { attrs[attr[1]] = attr[2] === undefined ? "" : attr[2]; }
        const element = new Element(attrs); elements.push(element); if (attrs.id) { ids[attrs.id] = element; }
    }
    const context = { comp: { id: 1, name: "PRIVATE_COMPOSITION_NAME", width: 1920, height: 1080, duration: 10, frameRate: 30, time: 0 }, selectedLayers: [{ name: "PRIVATE_LAYER" }], contextToken: "private-context-token" };
    const storage = new Map(options.saved ? [["aeai.settings.v1", JSON.stringify(options.saved)]] : []);
    const window = { addEventListener(type, fn) { windowEvents[type] = fn; } };
    if (options.host) {
        window.__adobe_cep__ = { evalScript(command, callback) {
            const request = { command, callback, answered: false };
            pendingHost.push(request);
            if (command === "AEAI.getContext()" && options.autoContext !== false) { request.answered = true; callback(JSON.stringify({ ok: true, context })); }
        } };
    }
    const providers = { generate(generationOptions, callback) {
        const request = { options: generationOptions, callback, cancelled: 0 };
        providerCalls.push(request);
        if (options.syncProvider) { callback(null, { version: 1, summary: "Null", actions: [{ type: "create_null", id: "control", name: "Control" }] }); }
        return { cancel() { request.cancelled += 1; callback({ code: "CANCELLED", message: "cancel" }); } };
    } };
    let nextTimer = 0;
    const sandbox = {
        document: { documentElement: {}, getElementById(id) { assert.ok(ids[id], "unknown element " + id); return ids[id]; }, createElement() { return new Element(); }, querySelectorAll(selector) { const name = selector.slice(1, -1); return elements.filter(element => Object.hasOwn(element.attributes, name)); } },
        window, AEAIPlan: Plan, AEAILocale: Locale, AEAIProviders: providers,
        localStorage: { getItem(key) { return storage.get(key) || null; }, setItem(key, value) { storageWrites.push({ key, value }); storage.set(key, value); } },
        setTimeout(fn, delay) { const id = ++nextTimer; timers.set(id, { fn, delay }); return id; }, clearTimeout(id) { timers.delete(id); }
    };
    vm.runInNewContext(panelSource, sandbox, { filename: "panel.js" });
    return {
        ids, context, pendingHost, providerCalls, storageWrites, timers,
        click(id) { ids[id].fire("click"); },
        input(id, value) { ids[id].value = value; ids[id].fire("input"); },
        change(id, value) { if (typeof value === "boolean") { ids[id].checked = value; } else { ids[id].value = value; } ids[id].fire("change"); },
        respond(request, result) { request.answered = true; request.callback(JSON.stringify(result || { ok: true, context })); },
        unload() { windowEvents.beforeunload(); }
    };
}

const plan = () => ({ version: 1, summary: "한글 테스트", actions: [{ type: "create_null", id: "control", name: "Control" }] });

test("Browser preview can show the offline demo but cannot apply host changes", () => {
    const h = harness(); h.click("demo");
    assert.ok(Number(h.ids["action-count"].textContent) > 0);
    assert.equal(h.ids.apply.disabled, true);
    assert.equal(h.providerCalls.length, 0);
    assert.equal(h.pendingHost.length, 0);
    assert.equal(h.ids["plan-preview"].hidden, false);
});

test("Host demo applies once and cannot be replayed after success", () => {
    const h = harness({ host: true }); h.click("demo");
    assert.equal(h.ids.apply.disabled, false); h.click("apply"); h.click("apply");
    const applies = h.pendingHost.filter(item => item.command.startsWith("AEAI.applyPlan("));
    assert.equal(applies.length, 1); assert.equal(h.providerCalls.length, 0);
    h.respond(applies[0], { ok: true, result: { createdLayers: 3 } });
    assert.equal(h.ids.apply.disabled, true); h.click("apply");
    assert.equal(h.pendingHost.filter(item => item.command.startsWith("AEAI.applyPlan(")).length, 1);
    assert.match(h.ids.status.textContent, /3/);
});

test("Losing a previously connected host leaves fallback demo in preview mode", () => {
    const h = harness({ host: true, autoContext: false });
    h.respond(h.pendingHost[0]);
    h.click("demo");
    h.respond(h.pendingHost[h.pendingHost.length - 1], { ok: false, error: "Host unavailable" });
    assert.ok(Number(h.ids["action-count"].textContent) > 0);
    assert.equal(h.ids.apply.disabled, true);
    h.click("apply");
    assert.equal(h.pendingHost.filter(item => item.command.startsWith("AEAI.applyPlan(")).length, 0);
});

test("Cancel during AI generation ignores late results and keeps Apply disabled", () => {
    const h = harness({ host: true }); h.input("prompt", "Create a null"); h.click("generate");
    assert.equal(h.providerCalls.length, 1); assert.equal(h.ids.generate.disabled, true);
    h.click("cancel"); assert.equal(h.providerCalls[0].cancelled, 1);
    h.providerCalls[0].callback(null, plan());
    assert.equal(h.ids["action-count"].textContent, "0"); assert.equal(h.ids.apply.disabled, true);
    assert.equal(h.ids.generate.disabled, false);
});

test("Cancel while reading AE context prevents a later context callback from sending a request", () => {
    const h = harness({ host: true, autoContext: false });
    h.respond(h.pendingHost[0]); h.input("prompt", "Create a null"); h.click("generate");
    const read = h.pendingHost[h.pendingHost.length - 1]; h.click("cancel"); h.respond(read);
    assert.equal(h.providerCalls.length, 0); assert.equal(h.ids.apply.disabled, true);
});

test("Editing a prompt invalidates an already generated plan", () => {
    const h = harness({ host: true }); h.input("prompt", "Create a null"); h.click("generate");
    h.providerCalls[0].callback(null, plan()); assert.equal(h.ids.apply.disabled, false);
    h.input("prompt", "Create text instead");
    assert.equal(h.ids.apply.disabled, true); assert.equal(h.ids["action-count"].textContent, "0");
});

test("API keys and prompt content are never persisted; provider switch and unload clear keys", () => {
    const h = harness({ host: true });
    h.change("provider", "openai"); h.input("model", "test-model"); h.input("api-key", "TOP_SECRET_KEY"); h.input("prompt", "TOP_SECRET_PROMPT"); h.change("language", "en");
    assert.doesNotMatch(JSON.stringify(h.storageWrites), /TOP_SECRET_KEY|TOP_SECRET_PROMPT/);
    for (const entry of h.storageWrites) { assert.deepEqual(Object.keys(JSON.parse(entry.value)).sort(), ["locale", "models", "provider"]); }
    h.change("provider", "anthropic"); assert.equal(h.ids["api-key"].value, "");
    h.input("api-key", "ANOTHER_SECRET"); h.unload(); assert.equal(h.ids["api-key"].value, "");
});

test("AI context sends only opted-in metrics, never composition names, layers or context tokens", () => {
    const h = harness({ host: true }); h.input("prompt", "Create a null"); h.click("generate");
    const first = h.providerCalls[0];
    assert.doesNotMatch(JSON.stringify(first.options.context), /PRIVATE|private-context-token/);
    assert.equal(first.options.context.comp.width, 1920);
    first.callback(null, plan()); h.change("share-context", false); h.click("generate");
    assert.equal(h.providerCalls[1].options.context, null);
});

test("Generation errors reset the busy state and do not enable stale Apply", () => {
    const h = harness({ host: true }); h.input("prompt", "Create a null"); h.click("generate");
    h.providerCalls[0].callback({ code: "AUTH", message: "Rejected secret" });
    assert.equal(h.ids.generate.disabled, false); assert.equal(h.ids.apply.disabled, true);
    assert.doesNotMatch(h.ids.status.textContent, /Rejected secret/);
});

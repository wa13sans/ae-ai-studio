'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const hostPath = path.join(__dirname, '../extension/host');
const source = fs.readFileSync(path.join(hostPath, 'json.jsx'), 'utf8') + '\n' +
    fs.readFileSync(path.join(hostPath, '../shared/plan.js'), 'utf8') + '\n' +
    fs.readFileSync(path.join(hostPath, 'bridge.jsx'), 'utf8').replace(/^#include.*$/gm, '');

function harness(options = {}) {
    const calls = { begin: 0, end: 0, removals: 0, created: [], sourcesRemoved: 0 };
    let nextID = 10;
    class Property {
        constructor(name, value = 0) { this.name = name; this.value = value; this.keys = []; this.props = {}; this.easings = []; this.interpolations = []; }
        get numKeys() { return this.keys.length; }
        property(name) { return this.props[name] || (this.props[name] = new Property(name)); }
        addProperty(name) { return this.property(name); }
        setValue(value) { if (options.failText && this.name === 'ADBE Text Document') throw new Error('Text write failed'); this.value = value; }
        setValueAtTime(time, value) { const existing = this.keys.find(k => k.time === time); if (existing) existing.value = value; else this.keys.push({ time, value }); this.keys.sort((a, b) => a.time - b.time); }
        nearestKeyIndex(time) { let best = 0; for (let i = 1; i < this.keys.length; i++) if (Math.abs(this.keys[i].time - time) < Math.abs(this.keys[best].time - time)) best = i; return best + 1; }
        keyTime(index) { return this.keys[index - 1].time; }
        removeKey(index) { this.keys.splice(index - 1, 1); }
        setInterpolationTypeAtKey(index, a, b) { this.interpolations.push([index, a, b]); }
        setTemporalEaseAtKey(index, a, b) { this.easings.push([index, a, b]); }
    }
    class Layer {
        constructor(comp, type, name) {
            this.id = nextID++; this.name = name; this.comp = comp; this.type = type; this.props = {}; this.threeDLayer = false; this.locked = false;
            if (type === 'text') this.property('ADBE Text Properties').property('ADBE Text Document').value = {};
            if (type === 'solid' || type === 'null') {
                const self = this;
                this.source = { get usedIn() { return comp._layers.includes(self) && !comp.removed ? [comp] : []; }, remove() { calls.sourcesRemoved++; } };
            }
        }
        property(name) { return this.props[name] || (this.props[name] = new Property(name)); }
        remove() { if (options.failCleanup) throw new Error('Cannot remove'); this.comp._layers.splice(this.comp._layers.indexOf(this), 1); calls.removals++; }
    }
    class CompItem {
        constructor(name = '테스트 中文', width = 1920, height = 1080, duration = 5, frameRate = 30) {
            this.id = nextID++; this.name = name; this.width = width; this.height = height; this.duration = duration; this.frameRate = frameRate; this.time = 0; this.pixelAspect = 1; this.selectedLayers = []; this._layers = []; this.markerProperty = new Property('marker');
            const add = (type, name) => { const layer = new Layer(this, type, name); this._layers.unshift(layer); calls.created.push(layer); return layer; };
            this.layers = { addNull: () => add('null', 'Null'), addText: text => add('text', text), addSolid: (color, name) => add('solid', name), addShape: () => add('shape', 'Shape') };
        }
        get numLayers() { return this._layers.length; }
        remove() { if (options.failCleanup) throw new Error('Cannot remove comp'); this.removed = true; }
        openInViewer() { app.project.activeItem = this; }
    }
    const comp = options.noComp ? null : new CompItem();
    const app = { project: { activeItem: comp, items: { addComp(name, w, h, pa, duration, fps) { return new CompItem(name, w, h, duration, fps); } } }, beginUndoGroup() { calls.begin++; }, endUndoGroup() { calls.end++; } };
    const sandbox = { app, CompItem, ParagraphJustification: { CENTER_JUSTIFY: 'center' }, KeyframeInterpolationType: { LINEAR: 'linear', BEZIER: 'bezier' }, KeyframeEase: function(speed, influence) { this.speed = speed; this.influence = influence; }, MarkerValue: function(comment) { this.comment = comment; } };
    vm.createContext(sandbox); vm.runInContext(source, sandbox);
    const getContext = () => JSON.parse(sandbox.AEAI.getContext()).context;
    const apply = (actions, token = getContext().contextToken) => JSON.parse(sandbox.AEAI.applyPlan(encodeURIComponent(JSON.stringify({ plan: { version: 1, summary: '한글 中文 "quoted" \\ end', actions }, contextToken: token }))));
    return { sandbox, comp, app, calls, getContext, apply };
}
const nullAction = { type: 'create_null', id: 'ctrl', name: '널 Null 空对象' };

test('host JSON codec round-trips Unicode and rejects malformed or executable input', () => {
    const h = harness(); const codec = h.sandbox.AEAIJSON;
    const text = JSON.stringify({ a: '가나다 中文 😀 " \\ \n \t', b: [true, false, null, -2.4e3] });
    assert.deepEqual(JSON.parse(codec.stringify(codec.parse(text))), JSON.parse(text));
    for (const invalid of ['{a:1}', '[1,]', '01', '{"a":1,"a":2}', '{"__proto__":{}}', '(function(){})()', '{"a":1}x', '{"a":1', '[1', '"bad\nstring"', '1e999']) assert.throws(() => codec.parse(invalid));
});
test('context returns bounded metadata and rejects stale plans before mutation', () => {
    const h = harness(); const token = h.getContext().contextToken;
    assert.equal(h.getContext().comp.width, 1920);
    h.comp.time = 1;
    assert.equal(h.apply([nullAction], token).ok, false);
    assert.equal(h.calls.begin, 0); assert.equal(h.calls.created.length, 0);
});
test('invalid references and out-of-composition times fail before Undo begins', () => {
    const h = harness();
    assert.equal(h.apply([{ type: 'set_parent', target: 'missing', parent: 'other' }]).ok, false);
    assert.equal(h.apply([nullAction, { type: 'animate', target: 'ctrl', property: 'opacity', easing: 'linear', keys: [{ time: 0, value: 0 }, { time: 6, value: 100 }] }]).ok, false);
    assert.equal(h.apply([]).ok, false); assert.equal(h.calls.begin, 0);
});
test('new layers, shape contents, parents and keyframe ease use host APIs in one Undo', () => {
    const h = harness();
    const result = h.apply([
        nullAction,
        { type: 'create_text', id: 'title', name: '제목', text: 'HELLO 한글 中文', fontSize: 100, color: [1, 0.5, 0.2] },
        { type: 'create_shape', id: 'shape', name: '원', shape: 'ellipse', size: [200, 200], color: [1, 1, 1] },
        { type: 'create_adjustment', id: 'adj', name: 'Adjustment' },
        { type: 'set_transform', target: 'title', property: 'position', value: [960, 540] },
        { type: 'animate', target: 'title', property: 'scale', easing: 'ease', keys: [{ time: 0, value: [0, 0] }, { time: 1, value: [100, 100] }] },
        { type: 'animate', target: 'title', property: 'anchorPoint', easing: 'ease', keys: [{ time: 0, value: [0, 0] }, { time: 1, value: [100, 100] }] },
        { type: 'set_parent', target: 'title', parent: 'ctrl' },
        { type: 'add_marker', time: 2, comment: '후렴 Chorus' }
    ]);
    assert.equal(result.ok, true); assert.equal(result.result.createdLayers, 4);
    assert.equal(h.calls.begin, 1); assert.equal(h.calls.end, 1);
    const [ctrl, title, shape, adj] = h.calls.created;
    assert.equal(title.parent, ctrl); assert.equal(adj.adjustmentLayer, true);
    assert.deepEqual(Array.from(title.property('ADBE Transform Group').property('ADBE Position').value), [960, 540]);
    assert.equal(title.property('ADBE Transform Group').property('ADBE Scale').easings[0][1].length, 2);
    assert.equal(title.property('ADBE Transform Group').property('ADBE Anchor Point').easings[0][1].length, 1);
    assert.equal(title.property('ADBE Text Properties').property('ADBE Text Document').value.justification, 'center');
    assert.equal(shape.property('ADBE Root Vectors Group').property('ADBE Vector Group').property('ADBE Vectors Group').property('ADBE Vector Shape - Ellipse').property('ADBE Vector Ellipse Size').value[0], 200);
    assert.equal(h.comp.markerProperty.keys[0].value.comment, '후렴 Chorus');
});
test('runtime failure removes created layers and closes Undo; failed cleanup is reported', () => {
    const action = { type: 'create_text', id: 'title', name: '제목', text: 'TEST', fontSize: 100, color: [1, 1, 1] };
    const h = harness({ failText: true }); const result = h.apply([nullAction, action]);
    assert.equal(result.ok, false); assert.equal(result.partial, false);
    assert.equal(h.comp.numLayers, 0); assert.equal(h.calls.sourcesRemoved, 1); assert.equal(h.calls.end, 1);
    const bad = harness({ failText: true, failCleanup: true });
    assert.equal(bad.apply([nullAction, action]).partial, true); assert.equal(bad.calls.end, 1);
});
test('creates comp when none is active and preserves existing markers', () => {
    const h = harness({ noComp: true });
    const action = { type: 'create_comp', id: 'comp', name: 'BGA 例', width: 1280, height: 720, duration: 5, frameRate: 60, bgColor: [0.1, 0, 0.2] };
    const result = h.apply([action, nullAction]);
    assert.equal(result.ok, true); assert.equal(result.result.createdComp, 'BGA 例'); assert.equal(h.app.project.activeItem.width, 1280);
    const p = harness(); p.comp.markerProperty.setValueAtTime(1, { comment: 'keep' });
    assert.equal(p.apply([{ type: 'add_marker', time: 1, comment: 'overwrite' }]).ok, false); assert.equal(p.calls.begin, 0);
    assert.equal(p.comp.markerProperty.keys[0].value.comment, 'keep');
});
test('empty layer references are rejected before any mutation or Undo group', () => {
    const h = harness();
    for (const action of [
        { type: 'set_transform', target: '', property: 'opacity', value: 50 },
        { type: 'animate', target: '', property: 'opacity', easing: 'linear', keys: [{ time: 0, value: 0 }, { time: 1, value: 100 }] },
        { type: 'set_parent', target: '', parent: 'ctrl' },
        { type: 'set_parent', target: 'ctrl', parent: '' }
    ]) assert.equal(h.apply([nullAction, action]).ok, false);
    assert.equal(h.calls.begin, 0); assert.equal(h.calls.created.length, 0);
});

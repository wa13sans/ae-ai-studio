'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const planAPI = require('../extension/shared/plan');
const create = (id = 'ctrl') => ({ type: 'create_null', id, name: '컨트롤 空对象' });
const wrap = actions => ({ version: 1, summary: '테스트 / 測試 / Test', actions });

test('empty unsupported plan and Unicode are accepted without executing anything', () => {
    assert.equal(planAPI.validate(wrap([])).actions.length, 0);
    assert.equal(planAPI.validate(wrap([create()])).actions[0].name, '컨트롤 空对象');
});
test('schema is strict at every object boundary and matches all action fields', () => {
    const visit = node => {
        if (!node || typeof node !== 'object') return;
        if (node.type === 'object') {
            assert.equal(node.additionalProperties, false);
            assert.deepEqual(node.required.sort(), Object.keys(node.properties).sort());
        }
        Object.values(node).forEach(value => Array.isArray(value) ? value.forEach(visit) : visit(value));
    };
    visit(planAPI.schema);
});
test('rejects arbitrary code, extra keys, prototype keys and inherited action fields', () => {
    assert.throws(() => planAPI.validate(wrap([{ type: 'eval', code: 'app.quit()' }])));
    assert.throws(() => planAPI.validate(wrap([{ ...create(), expression: 'alert(1)' }])));
    assert.throws(() => planAPI.validate(JSON.parse('{"version":1,"summary":"x","actions":[],"__proto__":{}}')));
    assert.throws(() => planAPI.validate(wrap([Object.create(create())])));
});
test('rejects IDs, references, parent cycles and out-of-order comp creation', () => {
    assert.throws(() => planAPI.validate(wrap([create(), create()])));
    assert.throws(() => planAPI.validate(wrap([create('constructor')])));
    assert.throws(() => planAPI.validate(wrap([{ type: 'set_transform', target: 'absent', property: 'opacity', value: 50 }])));
    assert.throws(() => planAPI.validate(wrap([create('a'), create('b'), { type: 'set_parent', target: 'a', parent: 'b' }, { type: 'set_parent', target: 'b', parent: 'a' }])));
    assert.throws(() => planAPI.validate(wrap([create(), { type: 'create_comp', id: 'comp', name: 'c', width: 1920, height: 1080, duration: 5, frameRate: 30, bgColor: [0, 0, 0] }])));
});
test('rejects invalid vector dimensions, opacity, non-finite values, time order and key limits', () => {
    for (const value of [[1, 2, 3], NaN, Infinity, 0]) {
        assert.throws(() => planAPI.validate(wrap([create(), { type: 'set_transform', target: 'ctrl', property: 'position', value }])));
    }
    assert.throws(() => planAPI.validate(wrap([create(), { type: 'set_transform', target: 'ctrl', property: 'opacity', value: 101 }])));
    const animation = { type: 'animate', target: 'ctrl', property: 'opacity', easing: 'ease', keys: [{ time: 1, value: 0 }, { time: 1, value: 100 }] };
    assert.throws(() => planAPI.validate(wrap([create(), animation])));
    animation.keys = Array.from({ length: 101 }, (_, i) => ({ time: i, value: i % 100 }));
    assert.throws(() => planAPI.validate(wrap([create(), animation, animation])));
    assert.throws(() => planAPI.validate(wrap(Array.from({ length: 41 }, (_, i) => create('n' + i)))));
});
test('accepts all supported action variants and checks declared composition duration', () => {
    const actions = [
        { type: 'create_comp', id: 'comp', name: 'MV', width: 1920, height: 1080, duration: 5, frameRate: 30, bgColor: [0, 0, 0] },
        create(),
        { type: 'create_text', id: 'title', name: '제목', text: 'HELLO 한글 中文', fontSize: 120, color: [1, 1, 1] },
        { type: 'create_solid', id: 'bg', name: '배경', color: [0.1, 0.1, 0.2] },
        { type: 'create_shape', id: 'circle', name: '원', shape: 'ellipse', size: [200, 200], color: [1, 0.5, 0] },
        { type: 'create_adjustment', id: 'adj', name: 'Adjustment' },
        { type: 'set_transform', target: 'title', property: 'position', value: [960, 540] },
        { type: 'animate', target: 'title', property: 'opacity', easing: 'ease', keys: [{ time: 0, value: 0 }, { time: 1, value: 100 }] },
        { type: 'set_parent', target: 'title', parent: 'ctrl' },
        { type: 'add_marker', time: 3, comment: '후렴 Chorus' }
    ];
    assert.equal(planAPI.validate(wrap(actions)).actions.length, 10);
    actions[7].keys[1].time = 6;
    assert.throws(() => planAPI.validate(wrap(actions)), /duration/);
});
test('prevents static setters after a property becomes animated', () => {
    assert.throws(() => planAPI.validate(wrap([create(), { type: 'animate', target: 'ctrl', property: 'opacity', easing: 'linear', keys: [{ time: 0, value: 0 }, { time: 1, value: 100 }] }, { type: 'set_transform', target: 'ctrl', property: 'opacity', value: 30 }])), /before animate/);
});
test('empty target and parent IDs cannot bypass reference validation', () => {
    for (const action of [
        { type: 'set_transform', target: '', property: 'opacity', value: 50 },
        { type: 'animate', target: '', property: 'opacity', easing: 'linear', keys: [{ time: 0, value: 0 }, { time: 1, value: 100 }] },
        { type: 'set_parent', target: '', parent: 'ctrl' },
        { type: 'set_parent', target: 'ctrl', parent: '' }
    ]) assert.throws(() => planAPI.validate(wrap([create(), action])));
});

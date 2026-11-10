/* AE AI Studio plan protocol. MIT. Shared ES3/ES5 implementation. */
(function (root, factory) {
    var api = factory();
    if (typeof module !== "undefined" && module.exports) { module.exports = api; }
    root.AEAIPlan = api;
}(this, function () {
    var own = Object.prototype.hasOwnProperty;
    var limits = { actions: 40, keyframes: 200, width: 4096, height: 4096, duration: 300, frameRate: 120 };
    var properties = ["position", "scale", "rotation", "opacity", "anchorPoint"];
    function number(min, max) { return { type: "number", minimum: min, maximum: max }; }
    function array(item, count) { return { type: "array", items: item, minItems: count, maxItems: count }; }
    function object(p) {
        var required = [], k;
        for (k in p) { if (own.call(p, k)) { required.push(k); } }
        return { type: "object", properties: p, required: required, additionalProperties: false };
    }
    var str = { type: "string" };
    var color = array(number(0, 1), 3);
    var vector = array(number(-100000, 100000), 2);
    var value = { anyOf: [number(-100000, 100000), vector] };
    var schemas = [];
    function action(type, p) {
        var data = { type: { type: "string", enum: [type] } }, k;
        for (k in p) { if (own.call(p, k)) { data[k] = p[k]; } }
        schemas.push(object(data));
    }
    action("create_comp", { id: str, name: str, width: { type: "integer", minimum: 4, maximum: 4096 }, height: { type: "integer", minimum: 4, maximum: 4096 }, duration: number(0.1, 300), frameRate: number(1, 120), bgColor: color });
    action("create_null", { id: str, name: str });
    action("create_text", { id: str, name: str, text: str, fontSize: number(1, 1000), color: color });
    action("create_solid", { id: str, name: str, color: color });
    action("create_shape", { id: str, name: str, shape: { type: "string", enum: ["rectangle", "ellipse"] }, size: array(number(1, 4096), 2), color: color });
    action("create_adjustment", { id: str, name: str });
    action("set_transform", { target: str, property: { type: "string", enum: properties }, value: value });
    action("animate", { target: str, property: { type: "string", enum: properties }, keys: { type: "array", items: object({ time: number(0, 300), value: value }), minItems: 2, maxItems: 200 }, easing: { type: "string", enum: ["linear", "ease"] } });
    action("set_parent", { target: str, parent: str });
    action("add_marker", { time: number(0, 300), comment: str });
    var schema = object({ version: { type: "integer", enum: [1] }, summary: str, actions: { type: "array", items: { anyOf: schemas }, minItems: 0, maxItems: 40 } });
    function fail(message) { throw new Error("Invalid plan: " + message); }
    function isArray(v) { return Object.prototype.toString.call(v) === "[object Array]"; }
    function isObject(v) { return v && typeof v === "object" && !isArray(v); }
    function has(a, v) { var i; for (i = 0; i < a.length; i += 1) { if (a[i] === v) { return true; } } return false; }
    function shapeCheck(v, spec, path) {
        var k, i, valid = false;
        if (spec.anyOf) {
            for (i = 0; i < spec.anyOf.length; i += 1) {
                try { shapeCheck(v, spec.anyOf[i], path); valid = true; break; } catch (ignored) { }
            }
            if (!valid) { fail(path + " has an unsupported value or action structure"); }
            return;
        }
        if (spec.type === "object") {
            if (!isObject(v)) { fail(path + " must be an object"); }
            for (k in v) {
                if (own.call(v, k) && !own.call(spec.properties, k)) { fail(path + "." + k + " is not allowed"); }
                if (!own.call(v, k)) { fail(path + " inherited properties are not allowed"); }
            }
            for (i = 0; i < spec.required.length; i += 1) {
                k = spec.required[i]; if (!own.call(v, k)) { fail(path + "." + k + " is required"); }
                shapeCheck(v[k], spec.properties[k], path + "." + k);
            }
        } else if (spec.type === "array") {
            if (!isArray(v) || v.length < spec.minItems || v.length > spec.maxItems) { fail(path + " has an invalid array size"); }
            for (i = 0; i < v.length; i += 1) { shapeCheck(v[i], spec.items, path + "[" + i + "]"); }
        } else if (spec.type === "string") {
            if (typeof v !== "string" || v.length > 6000 || v.indexOf("\u0000") !== -1) { fail(path + " must be text (max 6000 characters, no NUL)"); }
        } else {
            if (typeof v !== "number" || !isFinite(v) || (spec.type === "integer" && Math.floor(v) !== v)) { fail(path + " must be a finite " + spec.type); }
            if (typeof spec.minimum === "number" && (v < spec.minimum || v > spec.maximum)) { fail(path + " is outside its allowed range"); }
        }
        if (spec.enum && !has(spec.enum, v)) { fail(path + " is not supported"); }
    }
    function checkValue(property, v, path) {
        if (property === "position" || property === "scale" || property === "anchorPoint") {
            if (!isArray(v) || v.length !== 2) { fail(path + " requires a 2D vector"); }
            if (property === "scale" && (v[0] < -10000 || v[0] > 10000 || v[1] < -10000 || v[1] > 10000)) { fail(path + " scale exceeds 10000%"); }
        } else {
            if (typeof v !== "number") { fail(path + " requires a number"); }
            if (property === "opacity" && (v < 0 || v > 100)) { fail(path + " opacity must be 0..100"); }
        }
    }
    function validate(plan) {
        var ids = {}, parents = {}, keyCount = 0, i, j, a, key, p, duration = 300, animated = {};
        shapeCheck(plan, schema, "plan");
        if (!plan.summary.length || plan.summary.length > 2000) { fail("summary must contain 1..2000 characters"); }
        for (i = 0; i < plan.actions.length; i += 1) {
            a = plan.actions[i];
            if (a.type.indexOf("create_") === 0) {
                if (!/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(a.id) || a.id === "constructor" || a.id === "prototype" || a.id === "__proto__") { fail("IDs must be simple identifiers"); }
                key = "$" + a.id;
                if (own.call(ids, key)) { fail("duplicate ID " + a.id); }
                if (!a.name.length || a.name.length > 200) { fail("layer/comp names must contain 1..200 characters"); }
                if (a.type === "create_comp") {
                    if (i !== 0) { fail("create_comp must be the first action and occur once"); }
                    duration = a.duration;
                    ids[key] = "comp";
                } else { ids[key] = "layer"; }
            }
            if ((a.type === "set_transform" || a.type === "animate" || a.type === "set_parent") && ids["$" + a.target] !== "layer") { fail("target must refer to a previously created layer: " + a.target); }
            if (a.type === "set_transform") {
                checkValue(a.property, a.value, "action " + (i + 1));
                if (animated["$" + a.target + ":" + a.property]) { fail("set_transform must occur before animate on the same property"); }
            }
            if (a.type === "animate") {
                keyCount += a.keys.length;
                animated["$" + a.target + ":" + a.property] = true;
                for (j = 0; j < a.keys.length; j += 1) {
                    if (j && a.keys[j].time <= a.keys[j - 1].time) { fail("keyframe times must be strictly increasing"); }
                    if (a.keys[j].time > duration) { fail("keyframe time exceeds composition duration"); }
                    checkValue(a.property, a.keys[j].value, "keyframe " + (j + 1));
                }
            }
            if (a.type === "set_parent") {
                if (ids["$" + a.parent] !== "layer") { fail("parent must refer to a previously created layer"); }
                p = a.parent;
                while (p) { if (p === a.target) { fail("parent cycle detected"); } p = parents["$" + p]; }
                parents["$" + a.target] = a.parent;
            }
            if (a.type === "add_marker" && a.time > duration) { fail("marker time exceeds composition duration"); }
        }
        if (keyCount > limits.keyframes) { fail("keyframe limit exceeded"); }
        return plan;
    }
    return { schema: schema, validate: validate, limits: limits };
}));
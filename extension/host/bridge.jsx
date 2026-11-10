#include "json.jsx"
#include "../shared/plan.js"
/* All host changes are allowlisted, bounded and grouped into one Undo. Use-only license; see LICENSE. */
var AEAI = (function () {
    var own = Object.prototype.hasOwnProperty;
    var names = { position: "ADBE Position", scale: "ADBE Scale", rotation: "ADBE Rotate Z", opacity: "ADBE Opacity", anchorPoint: "ADBE Anchor Point" };
    function activeComp() { return app.project && app.project.activeItem instanceof CompItem ? app.project.activeItem : null; }
    function context() {
        var comp = activeComp(), selected = [], i, layers, snapshot, token;
        if (comp) {
            layers = comp.selectedLayers;
            for (i = 0; i < layers.length && i < 20; i += 1) { selected.push({ id: layers[i].id, index: layers[i].index, name: layers[i].name, threeD: layers[i].threeDLayer === true, locked: layers[i].locked === true }); }
            snapshot = { id: comp.id, name: comp.name, width: comp.width, height: comp.height, duration: comp.duration, frameRate: comp.frameRate, time: comp.time };
            token = AEAIJSON.stringify({ comp: snapshot, layers: comp.numLayers, markers: comp.markerProperty ? comp.markerProperty.numKeys : 0, selected: selected });
        } else { snapshot = null; token = "no-active-composition"; }
        return { comp: snapshot, selectedLayers: selected, contextToken: token };
    }
    function getContext() {
        try { return AEAIJSON.stringify({ ok: true, context: context() }); }
        catch (e) { return AEAIJSON.stringify({ ok: false, error: String(e.message || e) }); }
    }
    function transform(layer, property) { return layer.property("ADBE Transform Group").property(names[property]); }
    function prepare(plan, comp) {
        var i, j, a, duration, markerTimes = {}, key;
        if (!plan.actions.length) { throw new Error("This request has no supported actions to apply."); }
        if (!app.project) { throw new Error("Open or create an After Effects project first."); }
        if (plan.actions[0].type === "create_comp") { duration = plan.actions[0].duration; }
        else {
            if (!comp) { throw new Error("Open a composition or ask the AI to create a composition."); }
            duration = comp.duration;
        }
        for (i = 0; i < plan.actions.length; i += 1) {
            a = plan.actions[i];
            if (a.type === "animate") { for (j = 0; j < a.keys.length; j += 1) { if (a.keys[j].time > duration) { throw new Error("Keyframe time exceeds the target composition duration."); } } }
            if (a.type === "add_marker") {
                if (a.time > duration) { throw new Error("Marker time exceeds the target composition duration."); }
                key = "$" + a.time;
                if (own.call(markerTimes, key)) { throw new Error("Duplicate marker times are not allowed."); }
                markerTimes[key] = true;
                if (plan.actions[0].type !== "create_comp" && comp.markerProperty) {
                    for (j = 1; j <= comp.markerProperty.numKeys; j += 1) {
                        if (Math.abs(comp.markerProperty.keyTime(j) - a.time) < 0.00001) { throw new Error("A composition marker already exists at " + a.time + " seconds. Existing markers are preserved."); }
                    }
                }
            }
        }
    }
    function applyPlan(encoded) {
        var payload, plan, before, comp, newComp = null, created = [], sources = [], markers = [], layers = {}, began = false, changed = false, result, a, layer, property, doc, contents, group, path, fill, i, j, count, ease, easeValues, keyIndex, cleanupFailed = false;
        try {
            if (typeof encoded !== "string" || encoded.length > 1200000) { throw new Error("Plan payload is too large."); }
            payload = AEAIJSON.parse(decodeURIComponent(encoded));
            if (!payload || typeof payload.contextToken !== "string" || !payload.plan) { throw new Error("Missing plan or composition context."); }
            plan = AEAIPlan.validate(payload.plan);
            before = context();
            if (payload.contextToken !== before.contextToken) { throw new Error("Composition context changed. Generate a new plan before applying."); }
            comp = activeComp(); prepare(plan, comp);
            app.beginUndoGroup("AE AI Studio - " + plan.summary.substring(0, 80)); began = true;
            for (i = 0; i < plan.actions.length; i += 1) {
                a = plan.actions[i]; layer = null;
                if (a.type === "create_comp") {
                    newComp = app.project.items.addComp(a.name, a.width, a.height, 1, a.duration, a.frameRate);
                    changed = true; comp = newComp; comp.bgColor = a.bgColor;
                } else if (a.type === "create_null") { layer = comp.layers.addNull(comp.duration); }
                else if (a.type === "create_text") { layer = comp.layers.addText(a.text); }
                else if (a.type === "create_solid") { layer = comp.layers.addSolid(a.color, a.name, comp.width, comp.height, comp.pixelAspect, comp.duration); }
                else if (a.type === "create_adjustment") { layer = comp.layers.addSolid([1, 1, 1], a.name, comp.width, comp.height, comp.pixelAspect, comp.duration); }
                else if (a.type === "create_shape") { layer = comp.layers.addShape(); }
                if (layer) {
                    created.push(layer); changed = true; layers["$" + a.id] = layer;
                    if ((a.type === "create_null" || a.type === "create_solid" || a.type === "create_adjustment") && layer.source) { sources.push(layer.source); }
                    layer.name = a.name; layer.threeDLayer = false; layer.startTime = 0; layer.inPoint = 0; layer.outPoint = comp.duration;
                    if (a.type === "create_adjustment") { layer.adjustmentLayer = true; }
                    if (a.type === "create_text") {
                        property = layer.property("ADBE Text Properties").property("ADBE Text Document"); doc = property.value;
                        doc.fontSize = a.fontSize; doc.applyFill = true; doc.fillColor = a.color;
                        doc.justification = ParagraphJustification.CENTER_JUSTIFY; property.setValue(doc);
                    }
                    if (a.type === "create_shape") {
                        contents = layer.property("ADBE Root Vectors Group"); group = contents.addProperty("ADBE Vector Group");
                        contents = group.property("ADBE Vectors Group");
                        path = contents.addProperty(a.shape === "rectangle" ? "ADBE Vector Shape - Rect" : "ADBE Vector Shape - Ellipse");
                        path.property(a.shape === "rectangle" ? "ADBE Vector Rect Size" : "ADBE Vector Ellipse Size").setValue(a.size);
                        fill = contents.addProperty("ADBE Vector Graphic - Fill"); fill.property("ADBE Vector Fill Color").setValue(a.color);
                    }
                }
                if (a.type === "set_transform") { transform(layers["$" + a.target], a.property).setValue(a.value); }
                else if (a.type === "set_parent") { layers["$" + a.target].parent = layers["$" + a.parent]; }
                else if (a.type === "animate") {
                    property = transform(layers["$" + a.target], a.property);
                    for (j = 0; j < a.keys.length; j += 1) { property.setValueAtTime(a.keys[j].time, a.keys[j].value); }
                    count = a.property === "scale" ? 2 : 1;
                    for (j = 0; j < a.keys.length; j += 1) {
                        keyIndex = property.nearestKeyIndex(a.keys[j].time);
                        if (a.easing === "ease") {
                            property.setInterpolationTypeAtKey(keyIndex, KeyframeInterpolationType.BEZIER, KeyframeInterpolationType.BEZIER);
                            ease = new KeyframeEase(0, 33.333); easeValues = count === 2 ? [ease, ease] : [ease];
                            property.setTemporalEaseAtKey(keyIndex, easeValues, easeValues);
                        } else { property.setInterpolationTypeAtKey(keyIndex, KeyframeInterpolationType.LINEAR, KeyframeInterpolationType.LINEAR); }
                    }
                } else if (a.type === "add_marker") {
                    comp.markerProperty.setValueAtTime(a.time, new MarkerValue(a.comment)); markers.push(a.time); changed = true;
                }
            }
            if (newComp) { newComp.openInViewer(); }
            result = { ok: true, result: { createdLayers: created.length, createdComp: newComp ? newComp.name : null, actions: plan.actions.length } };
        } catch (e) {
            if (began && changed) {
                try {
                    if (newComp) { newComp.remove(); }
                    else {
                        for (i = created.length - 1; i >= 0; i -= 1) { created[i].remove(); }
                        for (i = markers.length - 1; i >= 0; i -= 1) { comp.markerProperty.removeKey(comp.markerProperty.nearestKeyIndex(markers[i])); }
                    }
                    for (i = sources.length - 1; i >= 0; i -= 1) { if (!sources[i].usedIn.length) { sources[i].remove(); } }
                } catch (cleanupError) { cleanupFailed = true; }
            }
            result = { ok: false, error: String(e.message || e), partial: cleanupFailed };
        } finally {
            if (began) {
                try { app.endUndoGroup(); }
                catch (endError) { result = { ok: false, error: "Unable to close Undo group: " + String(endError.message || endError), partial: changed }; }
            }
        }
        return AEAIJSON.stringify(result);
    }
    return { getContext: getContext, applyPlan: applyPlan };
}());
#target aftereffects
#include "../extension/host/bridge.jsx"
/* AE AI Studio beta smoke test. Use-only license; see LICENSE.
   Run with File > Scripts > Run Script File. Creates one isolated test composition.
   Never saves the project or changes any existing layer. Undo once to remove the test.
   On a successful run the test comp remains open for visual inspection. */
(function () {
    var checks = 0, result, contextResult, comp = null, prefix = "AE AI Studio Smoke " + new Date().getTime();
    function assert(condition, message) { if (!condition) { throw new Error(message); } checks += 1; }
    function near(a, b) { return Math.abs(a - b) < 0.001; }
    function xy(value, x, y) { return near(value[0], x) && near(value[1], y); }
    function prop(layer, name) { return layer.property("ADBE Transform Group").property(name); }
    function layer(name) { return comp.layer(name); }
    if (!app.project) { alert("AE AI Studio smoke test: open a project first. No changes were made."); return; }
    var plan = {
        version: 1,
        summary: "Isolated beta smoke test: all supported layer types, parenting and 2D keyframes",
        actions: [
            {type:"create_comp",id:"comp",name:prefix,width:640,height:360,duration:3,frameRate:30,bgColor:[0.05,0.05,0.08]},
            {type:"create_solid",id:"bg",name:"SMOKE Background",color:[0.05,0.05,0.08]},
            {type:"create_adjustment",id:"adj",name:"SMOKE Adjustment"},
            {type:"create_null",id:"ctrl",name:"SMOKE Controller"},
            {type:"set_transform",target:"ctrl",property:"anchorPoint",value:[0,0]},
            {type:"set_transform",target:"ctrl",property:"position",value:[320,180]},
            {type:"create_text",id:"title",name:"SMOKE Title",text:"BEAT / 한글 / 中文",fontSize:40,color:[1,1,1]},
            {type:"set_parent",target:"title",parent:"ctrl"},
            {type:"set_transform",target:"title",property:"rotation",value:10},
            {type:"animate",target:"title",property:"position",keys:[{time:0,value:[0,40]},{time:1,value:[0,0]}],easing:"ease"},
            {type:"animate",target:"title",property:"scale",keys:[{time:0,value:[90,90]},{time:1,value:[100,100]}],easing:"ease"},
            {type:"animate",target:"title",property:"anchorPoint",keys:[{time:0,value:[0,0]},{time:1,value:[0,0]}],easing:"ease"},
            {type:"animate",target:"title",property:"opacity",keys:[{time:0,value:0},{time:1,value:100}],easing:"linear"},
            {type:"animate",target:"title",property:"rotation",keys:[{time:0,value:10},{time:1,value:0}],easing:"linear"},
            {type:"create_shape",id:"rect",name:"SMOKE Rectangle",shape:"rectangle",size:[150,4],color:[0.63,0.96,0.81]},
            {type:"set_transform",target:"rect",property:"position",value:[320,220]},
            {type:"create_shape",id:"ellipse",name:"SMOKE Ellipse",shape:"ellipse",size:[20,20],color:[0.63,0.96,0.81]},
            {type:"set_transform",target:"ellipse",property:"position",value:[320,255]},
            {type:"add_marker",time:1.5,comment:"후렴 / Chorus / 副歌"}
        ]
    };
    try {
        contextResult = AEAIJSON.parse(AEAI.getContext());
        assert(contextResult.ok, "Unable to read AE context");
        result = AEAIJSON.parse(AEAI.applyPlan(encodeURIComponent(AEAIJSON.stringify({plan:plan,contextToken:contextResult.context.contextToken}))));
        assert(result.ok, "Host rejected the smoke plan: " + (result.error || "unknown error"));
        comp = app.project.activeItem;
        assert(comp instanceof CompItem && comp.name === prefix, "Expected the isolated smoke comp to be active");
        assert(comp.width === 640 && comp.height === 360 && near(comp.duration, 3), "Composition dimensions/duration mismatch");
        assert(result.result.createdLayers === 6 && comp.numLayers === 6, "Expected six new layers");
        assert(layer("SMOKE Adjustment").adjustmentLayer === true, "Adjustment-layer flag missing");
        assert(layer("SMOKE Controller").nullLayer === true, "Null layer not created");
        var title = layer("SMOKE Title"), controller = layer("SMOKE Controller");
        assert(title.parent === controller, "Parent link missing");
        assert(xy(prop(controller,"ADBE Anchor Point").value,0,0) && xy(prop(controller,"ADBE Position").value,320,180), "Controller origin is not explicitly centered");
        var text = title.property("ADBE Text Properties").property("ADBE Text Document").value;
        assert(text.text === "BEAT / 한글 / 中文" && near(text.fontSize,40), "Unicode text or font size mismatch");
        assert(text.justification === ParagraphJustification.CENTER_JUSTIFY, "Text horizontal alignment mismatch");
        var position = prop(title,"ADBE Position"), scale = prop(title,"ADBE Scale"), anchor = prop(title,"ADBE Anchor Point"), opacity = prop(title,"ADBE Opacity"), rotation = prop(title,"ADBE Rotate Z");
        assert(position.numKeys === 2 && xy(position.keyValue(2),0,0), "Position keyframes mismatch");
        assert(position.keyInTemporalEase(2).length === 1 && near(position.keyInTemporalEase(2)[0].influence,33.333), "Spatial-position ease mismatch");
        assert(scale.numKeys === 2 && scale.keyInTemporalEase(2).length === 2 && xy(scale.keyValue(2),100,100), "2D scale ease mismatch");
        assert(anchor.numKeys === 2 && anchor.keyInTemporalEase(2).length === 1, "Anchor-point spatial ease mismatch");
        assert(opacity.numKeys === 2 && near(opacity.keyValue(2),100) && opacity.keyInInterpolationType(2) === KeyframeInterpolationType.LINEAR, "Opacity linear keyframes mismatch");
        assert(rotation.numKeys === 2 && near(rotation.keyValue(2),0), "Rotation keyframes mismatch");
        var rect = layer("SMOKE Rectangle").property("ADBE Root Vectors Group").property(1).property("ADBE Vectors Group");
        var ellipse = layer("SMOKE Ellipse").property("ADBE Root Vectors Group").property(1).property("ADBE Vectors Group");
        assert(xy(rect.property("ADBE Vector Shape - Rect").property("ADBE Vector Rect Size").value,150,4), "Rectangle path mismatch");
        assert(xy(ellipse.property("ADBE Vector Shape - Ellipse").property("ADBE Vector Ellipse Size").value,20,20), "Ellipse path mismatch");
        assert(near(rect.property("ADBE Vector Graphic - Fill").property("ADBE Vector Fill Color").value[1],0.96), "Shape fill-color mismatch");
        assert(comp.markerProperty.numKeys === 1 && comp.markerProperty.keyValue(1).comment === "후렴 / Chorus / 副歌", "Unicode composition marker mismatch");
        var stale = AEAIJSON.parse(AEAI.applyPlan(encodeURIComponent(AEAIJSON.stringify({plan:plan,contextToken:contextResult.context.contextToken}))));
        assert(!stale.ok && comp.numLayers === 6, "Stale context must reject a second apply without mutations");
        alert("AE AI Studio beta smoke test PASSED: " + checks + " checks.\n\nCreated only the isolated composition:\n" + prefix + "\n\nNo existing layers were edited. Project was not saved.\nMove the playhead to 1 second to inspect the title.\nUndo once (Ctrl/Cmd+Z) to remove the smoke composition.");
    } catch (error) {
        alert("AE AI Studio beta smoke test FAILED after " + checks + " checks.\n\n" + String(error.message || error) + "\n\n" + (result && result.ok ? "The isolated smoke comp remains for diagnosis. Undo once to remove it." : "Host attempted to roll back any newly created objects.") + "\nNo project save was performed.");
    }
}());
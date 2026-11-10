/* AE AI Studio panel controller. MIT. No generated JavaScript is evaluated. */
(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var settings = { locale:"ko", provider:"ollama", models:{ollama:"qwen2.5:7b",openai:"",anthropic:""} };
  try {
    var saved = JSON.parse(localStorage.getItem("aeai.settings.v1") || "null");
    if (saved) {
      if (AEAILocale.messages[saved.locale]) { settings.locale = saved.locale; }
      if (["ollama","openai","anthropic"].indexOf(saved.provider) >= 0) { settings.provider = saved.provider; }
      if (saved.models) {
        ["ollama","openai","anthropic"].forEach(function (id) {
          if (typeof saved.models[id] === "string") { settings.models[id] = saved.models[id].slice(0,120); }
        });
      }
    }
  } catch (ignored) { }
  var state = { phase:"idle",plan:null,context:null,request:null,revision:0,status:null,hostContext:null,hostAvailable:false,consumed:false };
  function t(key, params) { return AEAILocale.t(settings.locale,key,params); }
  function save() { try { localStorage.setItem("aeai.settings.v1", JSON.stringify(settings)); } catch (ignored) { } }
  function status(key, params, error) {
    state.status = key ? {key:key,params:params || {},error:!!error} : null;
    $("status").textContent = key ? t(key,params) : "";
    $("status").className = "status" + (error ? " error" : "");
  }
  function hostLabel() {
    $("host-status").textContent = state.hostAvailable ?
      (state.hostContext && state.hostContext.comp ? t("hostComp",{name:state.hostContext.comp.name}) : t("hostReady")) : t("hostPreview");
  }
  function connectionLabel() {
    var local = settings.provider === "ollama";
    $("key-field").hidden = local;
    $("provider-hint").textContent = t(local ? "localHint" : "apiHint");
    $("model").placeholder = t(local ? "localModelPlaceholder" : "modelPlaceholder");
  }
  function translate() {
    document.documentElement.lang = settings.locale;
    Array.prototype.forEach.call(document.querySelectorAll("[data-i18n]"),function (element) {
      element.textContent = t(element.getAttribute("data-i18n"));
    });
    Array.prototype.forEach.call(document.querySelectorAll("[data-i18n-placeholder]"),function (element) {
      element.placeholder = t(element.getAttribute("data-i18n-placeholder"));
    });
    connectionLabel(); hostLabel(); renderPlan();
    if (state.status) { status(state.status.key,state.status.params,state.status.error); }
  }
  function busy(phase) {
    state.phase = phase;
    var disabled = phase !== "idle";
    ["provider","model","api-key","clear-key","prompt","share-context","generate","demo"].forEach(function (id) { $(id).disabled = disabled; });
    Array.prototype.forEach.call(document.querySelectorAll("[data-preset]"),function (element) { element.disabled = disabled; });
    $("cancel").hidden = phase !== "generating";
    $("apply").disabled = disabled || !state.hostAvailable || !state.plan || !state.plan.actions.length || state.consumed;
  }
  function invalidate() {
    state.revision += 1;
    if (state.request) { state.request.cancel(); state.request = null; }
    var hadPlan = !!state.plan;
    state.plan = null; state.context = null; state.consumed = false;
    renderPlan(); busy("idle");
    if (hadPlan) { status("invalidated"); }
  }
  function bridge(command, callback) {
    if (!window.__adobe_cep__ || typeof window.__adobe_cep__.evalScript !== "function") { callback(new Error(t("noHost"))); return; }
    var finished = false;
    var timer = setTimeout(function () {
      if (finished) { return; } finished = true;
      callback(new Error("After Effects did not respond. Check any open dialog and try again."));
    }, 15000);
    try {
      window.__adobe_cep__.evalScript(command,function (raw) {
        if (finished) { return; } finished = true; clearTimeout(timer);
        try {
          var parsed = JSON.parse(raw);
          if (!parsed || typeof parsed.ok !== "boolean") { throw new Error("Invalid After Effects response"); }
        } catch (err) { callback(err); return; }
        callback(null,parsed);
      });
    } catch (err) { if (!finished) { finished = true; clearTimeout(timer); callback(err); } }
  }
  function readContext(callback) {
    bridge("AEAI.getContext()",function (err,result) {
      if (err || !result.ok) { state.hostAvailable = false; state.hostContext = null; hostLabel(); callback(err || new Error(result.error)); return; }
      if (!result.context || typeof result.context.contextToken !== "string") { state.hostAvailable = false; state.hostContext = null; hostLabel(); callback(new Error("Invalid composition context")); return; }
      state.hostAvailable = true; state.hostContext = result.context; hostLabel();
      callback(null,result.context);
    });
  }
  function publicContext(context) {
    if (!$("share-context").checked || !context.comp) { return null; }
    var c = context.comp;
    return {comp:{width:c.width,height:c.height,duration:c.duration,frameRate:c.frameRate,time:c.time}};
  }
  function describe(action) {
    var label = t(action.type), detail = "";
    if (action.name) { detail = action.name; }
    else if (action.type === "set_parent") { detail = action.target + " → " + action.parent; }
    else if (action.type === "animate") { detail = action.target + " · " + action.property + " · " + action.keys.length + " keys · " + action.easing; }
    else if (action.type === "set_transform") { detail = action.target + " · " + action.property + " = " + JSON.stringify(action.value); }
    else if (action.type === "add_marker") { detail = action.time + "s · " + action.comment; }
    return label + (detail ? " — " + detail : "");
  }
  function renderPlan() {
    $("action-list").textContent = "";
    $("action-count").textContent = state.plan ? String(state.plan.actions.length) : "0";
    $("empty-preview").hidden = !!state.plan;
    $("plan-preview").hidden = !state.plan;
    if (!state.plan) { $("plan-summary").textContent = ""; $("plan-json").textContent = ""; return; }
    $("plan-summary").textContent = state.plan.summary;
    state.plan.actions.forEach(function (action) {
      var li = document.createElement("li"); li.textContent = describe(action); $("action-list").appendChild(li);
    });
    $("plan-json").textContent = JSON.stringify(state.plan,null,2);
  }
  function showPlan(plan,context,isDemo) {
    AEAIPlan.validate(plan);
    state.plan = plan; state.context = context; state.consumed = false;
    renderPlan(); busy("idle");
    status(!plan.actions.length ? "emptyPlan" : isDemo ? "demoReady" : "ready",{count:plan.actions.length});
  }
  function errorStatus(err) {
    var code = err.code || "";
    var map = {
      AUTH:"AUTH",FORBIDDEN:"AUTH",RATE_LIMIT:"RATE_LIMIT",TIMEOUT:"TIMEOUT",NETWORK:"NETWORK",
      INVALID_RESPONSE:"RESPONSE",RESPONSE_LIMIT:"INCOMPLETE",REFUSAL:"REFUSAL",INCOMPLETE:"INCOMPLETE",
      INVALID_PLAN:"INVALID_PLAN",NODE_UNAVAILABLE:"UNSUPPORTED_RUNTIME",CANCELLED:"cancelled",
      PROVIDER:"RESPONSE",MODEL:"missingModel",PROMPT:"missingPrompt",API:"RESPONSE",SERVER:"NETWORK",REQUEST:"NETWORK",CONFIG:"RESPONSE"
    };
    status(map[code] || "genericError",{detail:String(err.message || err).slice(0,450)},code !== "CANCELLED");
  }
  function generate() {
    if (state.phase !== "idle") { return; }
    var prompt = $("prompt").value.trim(), model = $("model").value.trim(), key = $("api-key").value.trim();
    if (!prompt) { status("missingPrompt",null,true); $("prompt").focus(); return; }
    if (!model) { status("missingModel",null,true); $("model").focus(); return; }
    if (settings.provider !== "ollama" && !key) { status("missingKey",null,true); $("api-key").focus(); return; }
    invalidate(); busy("generating"); status("loading");
    var revision = state.revision;
    readContext(function (err,context) {
      if (revision !== state.revision) { return; }
      if (err) { busy("idle"); status("noHost",null,true); return; }
      status("generating");
      state.request = AEAIProviders.generate({
        provider:settings.provider,apiKey:key,model:model,prompt:prompt,context:publicContext(context),locale:settings.locale
      },function (error,plan) {
        if (revision !== state.revision) { return; }
        state.request = null; busy("idle");
        if (error) { errorStatus(error); return; }
        try { showPlan(plan,context,false); } catch (failure) { errorStatus({code:"INVALID_PLAN",message:failure.message}); }
      });
    });
  }
  function demoPlan(context) {
    var c = context.comp || {width:1920,height:1080,duration:10,frameRate:30};
    var end = Math.max(0.01,Math.min(0.8,c.duration * 0.5));
    var x = c.width / 2, y = c.height / 2, font = Math.min(120,c.width * 0.12);
    var actions = [];
    if (!context.comp) {
      actions.push({type:"create_comp",id:"demo_comp",name:"AE AI Studio Demo",width:1920,height:1080,duration:10,frameRate:30,bgColor:[0.04,0.055,0.065]});
    }
    actions.push(
      {type:"create_null",id:"main_ctrl",name:"MAIN_CTRL"},
      {type:"set_transform",target:"main_ctrl",property:"position",value:[x,y]},
      {type:"set_transform",target:"main_ctrl",property:"anchorPoint",value:[0,0]},
      {type:"create_text",id:"beat",name:"BEAT",text:"BEAT",fontSize:font,color:[1,1,1]},
      {type:"set_parent",target:"beat",parent:"main_ctrl"},
      {type:"animate",target:"beat",property:"position",keys:[{time:0,value:[0,100]},{time:end,value:[0,0]}],easing:"ease"},
      {type:"animate",target:"beat",property:"opacity",keys:[{time:0,value:0},{time:end,value:100}],easing:"ease"},
      {type:"create_shape",id:"accent",name:"Accent",shape:"rectangle",size:[Math.max(1,c.width * 0.2),Math.max(1,c.height * 0.008)],color:[0.63,0.96,0.81]},
      {type:"set_transform",target:"accent",property:"position",value:[x,y + font * 0.7]},
      {type:"animate",target:"accent",property:"scale",keys:[{time:0,value:[0,100]},{time:end,value:[100,100]}],easing:"ease"}
    );
    return {version:1,summary:settings.locale === "ko" ? "BEAT 타이틀과 민트색 라인을 부드럽게 등장시키는 데모" : settings.locale === "zh-CN" ? "BEAT 标题和薄荷色线条的缓动入场演示" : "A smooth BEAT title reveal with a mint accent line",actions:actions};
  }
  $("language").value = settings.locale; $("provider").value = settings.provider; $("model").value = settings.models[settings.provider];
  $("language").addEventListener("change",function () { settings.locale = this.value; save(); translate(); });
  $("provider").addEventListener("change",function () {
    invalidate(); settings.provider = this.value; $("api-key").value = "";
    $("model").value = settings.models[this.value]; save(); connectionLabel();
  });
  $("model").addEventListener("input",function () { invalidate(); settings.models[settings.provider] = this.value; save(); });
  $("api-key").addEventListener("input",invalidate);
  $("clear-key").addEventListener("click",function () { $("api-key").value = ""; invalidate(); });
  $("prompt").addEventListener("input",invalidate); $("share-context").addEventListener("change",invalidate);
  Array.prototype.forEach.call(document.querySelectorAll("[data-preset]"),function (element) {
    element.addEventListener("click",function () { invalidate(); $("prompt").value = t(element.getAttribute("data-preset") + "Prompt"); $("prompt").focus(); });
  });
  $("generate").addEventListener("click",generate);
  $("prompt").addEventListener("keydown",function (event) { if ((event.ctrlKey || event.metaKey) && event.key === "Enter") { event.preventDefault(); generate(); } });
  $("cancel").addEventListener("click",function () { invalidate(); status("cancelled"); });
  $("demo").addEventListener("click",function () {
    if (state.phase !== "idle") { return; }
    invalidate(); busy("generating"); var revision = state.revision;
    readContext(function (err,context) {
      if (revision !== state.revision) { return; }
      context = context || {comp:null,selectedLayers:[],contextToken:"preview-only"};
      try { showPlan(demoPlan(context),context,true); } catch (failure) { busy("idle"); errorStatus(failure); }
    });
  });
  $("apply").addEventListener("click",function () {
    if (state.phase !== "idle" || !state.plan || !state.context || state.consumed || !state.hostAvailable) { return; }
    var encoded = encodeURIComponent(JSON.stringify({plan:state.plan,contextToken:state.context.contextToken}));
    state.consumed = true; busy("applying"); status("applying");
    bridge("AEAI.applyPlan(" + JSON.stringify(encoded) + ")",function (err,result) {
      busy("idle");
      if (err) { status("partialError",{detail:err.message},true); return; }
      if (!result.ok) { status(result.partial ? "partialError" : "rolledBack",{detail:String(result.error || "").slice(0,450)},true); return; }
      status("done",{layers:result.result.createdLayers});
      readContext(function () { busy("idle"); });
    });
  });
  window.addEventListener("beforeunload",function () {
    if (state.request) { state.request.cancel(); }
    $("api-key").value = ""; state.plan = null;
  });
  translate(); busy("idle");
  readContext(function () { hostLabel(); busy(state.phase); });
}());

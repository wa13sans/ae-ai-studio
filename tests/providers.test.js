"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const { EventEmitter } = require("node:events");
const Providers = require("../extension/js/providers.js");
const Plan = require("../extension/shared/plan.js");

const validPlan = () => ({ version: 1, summary: "널 생성 / Create null / 创建空对象", actions: [{ type: "create_null", id: "control", name: "제어 / 控制" }] });
const openai = plan => ({ status: "completed", output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify(plan) }] }] });
const anthropic = plan => ({ stop_reason: "tool_use", content: [{ type: "tool_use", name: "emit_plan", input: plan }] });
const ollama = plan => ({ done: true, done_reason: "stop", message: { role: "assistant", content: JSON.stringify(plan) } });
const options = () => ({ provider: "openai", apiKey: "secret-test-key", model: "example-model", prompt: "한글 제목을 만들어줘 🎬", locale: "ko", context: { comp: { name: "테스트", width: 1920, height: 1080, duration: 10, frameRate: 30, time: 0 }, path: "DO_NOT_SEND", selectedLayers: [{ name: "DO_NOT_SEND" }], contextToken: "DO_NOT_SEND" } });

function transport(status, responseBody, behavior) {
    let request, response, config, sentBody;
    return {
        request(received, callback) {
            config = received;
            request = new EventEmitter();
            request.destroyed = false;
            request.destroy = function () { this.destroyed = true; this.emit("error", new Error("private network diagnostics")); };
            request.end = function (body) {
                sentBody = body;
                if (behavior === "hang") { return; }
                process.nextTick(() => {
                    if (behavior === "network") { request.emit("error", new Error("secret-test-key")); return; }
                    response = new EventEmitter();
                    response.statusCode = status;
                    response.setEncoding = () => {};
                    response.destroy = function () { this.destroyed = true; this.emit("error", new Error("destroyed")); };
                    callback(response);
                    if (behavior === "abort") { response.emit("aborted"); response.emit("error", new Error("secret")); return; }
                    const bodyText = typeof responseBody === "string" ? responseBody : JSON.stringify(responseBody);
                    response.emit("data", bodyText);
                    response.emit("end");
                    if (behavior === "lateError") { request.emit("error", new Error("late")); }
                });
            };
            return request;
        },
        get config() { return config; }, get sentBody() { return sentBody; }, get requestObject() { return request; }, get responseObject() { return response; }
    };
}

function run(adapter, opts) {
    return new Promise(resolve => {
        opts = Object.assign(options(), opts || {});
        if (opts.provider === "ollama") { opts.http = adapter; } else { opts.https = adapter; }
        Providers.generate(opts, (err, plan) => resolve({ err, plan }));
    });
}

test("OpenAI request uses fixed official Responses endpoint and strict shared schema", () => {
    const o = options();
    const request = Providers.createRequest(o.provider, o.apiKey, o.model, o.prompt, o.context, o.locale);
    const body = JSON.parse(request.body);
    assert.equal(request.protocol, "https:");
    assert.equal(request.hostname, "api.openai.com");
    assert.equal(request.path, "/v1/responses");
    assert.equal(request.headers.Authorization, "Bearer secret-test-key");
    assert.equal(request.headers["Content-Length"], Buffer.byteLength(request.body));
    assert.equal(body.store, false);
    assert.equal(body.max_output_tokens, 12000);
    assert.equal(body.text.format.strict, true);
    assert.deepEqual(body.text.format.schema, Plan.schema);
    assert.match(body.instructions, /Korean/);
    assert.doesNotMatch(request.body, /DO_NOT_SEND/);
    assert.equal(JSON.parse(body.input).request, o.prompt);
});

test("Anthropic request forces one output tool and pins documented compatible API version", () => {
    const request = Providers.createRequest("anthropic", "secret-test-key", "user-selected-model", "create a null", null, "zh");
    const body = JSON.parse(request.body);
    assert.equal(request.hostname, "api.anthropic.com");
    assert.equal(request.path, "/v1/messages");
    assert.equal(request.headers["anthropic-version"], "2023-06-01");
    assert.equal(request.headers["x-api-key"], "secret-test-key");
    assert.deepEqual(body.tool_choice, { type: "tool", name: "emit_plan" });
    assert.deepEqual(body.tools[0].input_schema, Plan.schema);
    assert.match(body.system, /Simplified Chinese/);
    assert.match(JSON.parse(Providers.createRequest("anthropic", "key", "model", "create", null, "zh-CN").body).system, /Simplified Chinese/);
});

test("CEP script tags expose globals even when a Node module object exists", () => {
    const source = fs.readFileSync(path.join(__dirname, "../extension/js/providers.js"), "utf8");
    const sandbox = { AEAIPlan: Plan, module: { exports: {} }, require() { throw new Error("Script-tag require must not resolve paths against CEP's main module"); } };
    vm.runInNewContext(source, sandbox);
    assert.equal(typeof sandbox.AEAIProviders.generate, "function");
    assert.equal(sandbox.AEAIProviders, sandbox.module.exports);
    assert.match(JSON.parse(sandbox.AEAIProviders.createRequest("ollama", "", "model", "create", null, "zh-CN").body).messages[0].content, /Simplified Chinese/);
});

test("Ollama is fixed to local loopback, schema constrained and never sends an API key", () => {
    const request = Providers.createRequest("ollama", "secret-must-not-leak", "local-model:8b", "创建文字", null, "en");
    const body = JSON.parse(request.body);
    assert.equal(request.protocol, "http:");
    assert.equal(request.hostname, "127.0.0.1");
    assert.equal(request.port, 11434);
    assert.equal(request.path, "/api/chat");
    assert.equal(body.stream, false);
    assert.equal(body.options.num_predict, 12000);
    assert.deepEqual(body.format, Plan.schema);
    assert.doesNotMatch(JSON.stringify(request), /secret-must-not-leak/);
    assert.equal(request.headers["Content-Length"], Buffer.byteLength(request.body));
});

test("Inputs reject unknown provider, header injection, arbitrary model URLs and large prompts", () => {
    const cases = [
        ["elsewhere", "key", "model", "null", "PROVIDER"],
        ["openai", "key\r\nInjected: value", "model", "null", "AUTH"],
        ["anthropic", "", "model", "null", "AUTH"],
        ["openai", "key", "https://bad.invalid/?secret", "null", "MODEL"],
        ["ollama", "", "model", " ", "PROMPT"],
        ["openai", "key", "model", "x".repeat(6001), "PROMPT"]
    ];
    for (const [provider, key, model, prompt, code] of cases) {
        assert.throws(() => Providers.createRequest(provider, key, model, prompt, null, "en"), err => err.code === code);
    }
});

test("All provider parsers preserve Unicode and validate the same plan", () => {
    assert.deepEqual(Providers.parseResponse("openai", JSON.stringify(openai(validPlan()))), validPlan());
    assert.deepEqual(Providers.parseResponse("anthropic", anthropic(validPlan())), validPlan());
    assert.deepEqual(Providers.parseResponse("ollama", ollama(validPlan())), validPlan());
    const unsupported = { version: 1, summary: "Unsupported action", actions: [] };
    assert.deepEqual(Providers.parseResponse("openai", openai(unsupported)), unsupported);
});

test("Parsers reject refused, incomplete, malformed and executable AI outputs", () => {
    const cases = [
        ["openai", { status: "incomplete", output: [] }, "INCOMPLETE"],
        ["openai", { status: "completed", output: [{ type: "message", content: [{ type: "refusal", refusal: "private" }] }] }, "REFUSAL"],
        ["openai", { status: "completed", output: [{ type: "message", content: [{ type: "output_text", text: "```json\n{}\n```" }] }] }, "INVALID_RESPONSE"],
        ["anthropic", { stop_reason: "max_tokens", content: [] }, "INCOMPLETE"],
        ["anthropic", { stop_reason: "refusal", content: [] }, "REFUSAL"],
        ["anthropic", { stop_reason: "tool_use", content: [] }, "INVALID_RESPONSE"],
        ["anthropic", { stop_reason: "tool_use", content: [{ type: "tool_use", name: "emit_plan", input: validPlan() }, { type: "tool_use", name: "emit_plan", input: validPlan() }] }, "INVALID_RESPONSE"],
        ["ollama", { done: false, message: { content: "{}" } }, "INCOMPLETE"],
        ["ollama", { done: true, done_reason: "length", message: { content: "{}" } }, "INCOMPLETE"],
        ["ollama", { done: true, done_reason: "stop", message: { content: "not json" } }, "INVALID_RESPONSE"],
        ["openai", "not json", "INVALID_RESPONSE"],
        ["openai", { error: { message: "secret-test-key" } }, "API"],
        ["openai", openai({ version: 1, summary: "run", actions: [{ type: "execute", code: "app.quit()" }] }), "INVALID_PLAN"]
    ];
    for (const [provider, response, code] of cases) {
        assert.throws(() => Providers.parseResponse(provider, response), err => err.code === code && !err.message.includes("secret-test-key"));
    }
});

test("Mock HTTPS and local HTTP generation returns plans without network access", async () => {
    const first = transport(200, openai(validPlan()));
    const result = await run(first);
    assert.equal(result.err, null);
    assert.deepEqual(result.plan, validPlan());
    assert.equal(first.config.hostname, "api.openai.com");
    const local = transport(200, ollama(validPlan()));
    const localResult = await run(local, { provider: "ollama", apiKey: "" });
    assert.equal(localResult.err, null);
    assert.equal(local.config.hostname, "127.0.0.1");
});

test("HTTP failures have safe actionable codes and never echo provider secrets", async () => {
    for (const [status, code] of [[400, "REQUEST"], [401, "AUTH"], [403, "FORBIDDEN"], [404, "MODEL"], [429, "RATE_LIMIT"], [503, "SERVER"]]) {
        const result = await run(transport(status, { error: { message: "secret-test-key" } }));
        assert.equal(result.err.code, code);
        assert.doesNotMatch(result.err.message, /secret-test-key/);
        assert.equal(result.plan, undefined);
    }
    const result = await run(transport(404, { error: "model not found" }), { provider: "ollama", apiKey: "" });
    assert.match(result.err.message, /local model/);
});

test("Cancellation, late errors and aborted connections callback exactly once", async () => {
    for (const behavior of ["lateError", "abort", "network"]) {
        const adapter = transport(200, openai(validPlan()), behavior);
        let calls = 0;
        await new Promise(resolve => {
            Providers.generate(Object.assign(options(), { https: adapter }), () => { calls += 1; setImmediate(resolve); });
        });
        assert.equal(calls, 1);
    }
    const hanging = transport(200, "", "hang");
    let calls = 0, error;
    const handle = Providers.generate(Object.assign(options(), { https: hanging }), err => { calls += 1; error = err; });
    handle.cancel(); handle.cancel();
    assert.equal(calls, 1);
    assert.equal(error.code, "CANCELLED");
    assert.equal(hanging.requestObject.destroyed, true);
});

test("Response size is limited before parsing", async () => {
    const adapter = transport(200, "한".repeat(800000));
    const result = await run(adapter);
    assert.equal(result.err.code, "RESPONSE_LIMIT");
    assert.equal(adapter.requestObject.destroyed, true);
    assert.equal(adapter.responseObject.destroyed, true);
});

test("Absolute timeout closes even a connection that never responds", () => {
    let scheduled, cleared, callbackError, count = 0;
    const source = fs.readFileSync(path.join(__dirname, "../extension/js/providers.js"), "utf8");
    const sandbox = { AEAIPlan: Plan, setTimeout(fn, delay) { assert.equal(delay, 60000); scheduled = fn; return 7; }, clearTimeout(id) { cleared = id; } };
    vm.runInNewContext(source, sandbox);
    const adapter = transport(200, "", "hang");
    sandbox.AEAIProviders.generate(Object.assign(options(), { https: adapter }), err => { callbackError = err; count += 1; });
    scheduled();
    assert.equal(callbackError.code, "TIMEOUT");
    assert.equal(count, 1);
    assert.equal(cleared, 7);
    assert.equal(adapter.requestObject.destroyed, true);
});

test("Initial invalid configuration reports asynchronously without sending a request", async () => {
    let calledTransport = false, returned = false;
    await new Promise(resolve => {
        Providers.generate({ provider: "unknown", https: { request() { calledTransport = true; } } }, err => {
            assert.equal(returned, true); assert.equal(err.code, "PROVIDER"); resolve();
        });
        returned = true;
    });
    assert.equal(calledTransport, false);
});

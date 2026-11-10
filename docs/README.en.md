# AE AI Studio · Beta 1.0.0

An independent, dockable After Effects CEP panel that turns natural-language requests into previewable plans and creates motion graphics layers.

**Version:** `1.0.0-beta.1` · **License:** [Use-only · no redistribution or resale](../LICENSE) · **Languages:** Korean / English / Simplified Chinese

[한국어](../README.md) · [简体中文](README.zh-CN.md) · [Testing](TESTING.md)

No Higgsfield or Magnetic subscription is required. Connect your own OpenAI GPT or Anthropic Claude API account, or use a local model through Ollama. Cloud API access and charges follow the provider's policy. Local Ollama requires no paid AI subscription or API key; performance depends on your hardware and model.

## Features

- Compositions, nulls, text, solids, rectangles, ellipses, and adjustment layers.
- 2D Position, Scale, Rotation, Opacity, and Anchor Point.
- Keyframes with Linear or Ease interpolation, parenting between created layers, and composition markers.
- An offline demo, plan preview before execution, and one Undo group per application.
- Session-only API keys and cancellable network requests.

This beta creates new layers. It does not modify or delete existing layers, execute AI-generated code or expressions, import files, render, or support arbitrary effects.

## Installation

Extract the **complete** ZIP. Keep `extension/`, `scripts/`, and `docs/` together. Close After Effects.

Windows, from the extracted project directory:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\install-windows.ps1 -EnableDebugMode
```

macOS:

```bash
bash scripts/install-macos.sh --enable-debug-mode
```

Restart After Effects and choose **Window → Extensions → AE AI Studio**. No administrator access is required.

Per-user destinations:

- Windows: `%APPDATA%\Adobe\CEP\extensions\com.aeaistudio.panel`
- macOS: `~/Library/Application Support/Adobe/CEP/extensions/com.aeaistudio.panel`

Existing installations are preserved under `Adobe/CEP/ae-ai-studio-backups`, outside the scanned extensions directory.

The unsigned beta needs CEP debug mode. The explicit install option enables **CSXS.11 and CSXS.12** for the current user; it also allows other unsigned CEP extensions. Omit the option if debug mode is already enabled. The installer does not permanently change PowerShell's execution policy.

## First request

1. Select the interface language and provider.
2. Enter a model ID available to your account. For cloud providers, enter your API key.
3. Activate the composition that should receive new layers, or request a new composition.
4. Enter a request and generate a plan.
5. Read the preview, then execute.
6. Undo with **Ctrl+Z** on Windows or **Cmd+Z** on macOS.

Example:

> Create a 1920×1080, 30 fps, 5-second composition. Add a white title “MOTION” in the center. Ease its scale from 80% at 0 seconds to 100% at 1 second.

API keys remain in memory for the panel session. They are not written to settings or files. Failed paid requests are not automatically retried.

### Local Ollama

Install [Ollama](https://ollama.com/) separately, download a model (for example `ollama pull qwen2.5:7b`), and run the Ollama app/service. If needed, start it with `ollama serve`. Select Ollama in the panel and enter the downloaded model's ID. No API key is needed.

The local endpoint is `http://127.0.0.1:11434`. Start with small, explicit requests; smaller models may produce invalid plans.

## Data and limits

Only your request and the composition summary you allow are sent to the selected provider. Composition context sharing is enabled by default and can be switched off. Only width, height, duration, frame rate, and current time are shared; composition and layer names are omitted. The panel does not automatically upload footage, audio, project files, or screenshots. Local Ollama requests stay on the loopback endpoint above.

A plan is limited to **40 actions** and **200 keyframes total**. New compositions are limited to **4096px per dimension**, **300 seconds**, and **120 fps**. Transform and parenting targets must be layers created by the plan.

The active composition is checked again before execution. Regenerate the plan after changing compositions. Host errors may leave partial work; read the message and use Undo to recover.

## Development and verification

Development tools: **Node.js 18+**. No external npm packages are required.

```bash
npm test
npm run package
```

The ZIP and SHA-256 checksum are written to `dist/`. This project uses **JavaScript and ExtendScript**, not a Java runtime. AE uses CEP's bundled runtime.

AE 2022+ is the target. The manifest's allowed version range is not a claim that every AE release has been tested. Automated tests use mocked AE and network environments. Real AE execution, API access, and local model performance require the [manual checks](TESTING.md).

If the panel is absent, check extraction, the per-user destination, debug mode, and an AE restart. Opening `index.html` in an ordinary browser does not provide an AE bridge.

## Removal

Close AE and remove only the `com.aeaistudio.panel` installation folder. Restore a backup by copying it to that location.

To disable unsigned CEP extensions, set `PlayerDebugMode` to `0` for CSXS.11 and CSXS.12. Windows registry locations: `HKCU\Software\Adobe\CSXS.11` and `CSXS.12`. macOS example: `defaults write com.adobe.CSXS.11 PlayerDebugMode 0` and repeat for `CSXS.12`. This affects other unsigned CEP panels too.

See the [Korean README](../README.md#참고-문서) for official implementation references.

## License

The [AE AI Studio Use-Only License 1.0](../LICENSE) permits personal learning, internal use, commercial creative work, private modification, and backups. Redistribution, resale, sublicensing, and bundling of the Software or modified copies or substantial code portions require the rights holder's prior written permission, even when supplied for free.

You may publish, deliver, and sell rendered videos, images, MV/BGA work, and independent project files that do not contain substantial copies of the Software. Sharing the official download link is permitted.

The new terms start with the license-change commit published on 2026-11-10 (Asia/Seoul); the app remains version `1.0.0-beta.1`. Prior MIT grants are not retroactively revoked. [Earlier MIT releases](https://github.com/wa13sans/ae-ai-studio/tree/f42fd4f73a69f3c56963b068cd613b417888f158) retain their terms.

This is a custom restrictive license, not an open-source license. GitHub's public-repository viewing/forking rights, applicable legal exceptions, and third-party terms remain unaffected. Adobe and AI provider services have separate terms.

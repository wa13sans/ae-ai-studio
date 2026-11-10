# Verification for Beta 1.0.0

## Automated checks

Use Node.js 18 or later:

```bash
npm test
npm run package
```

These checks cover the shared plan validator, provider request/response handling, mocked AE host behavior, and release ZIP structure, checksums, missing files, and excluded private files. Tests use fake transport and host objects: passing them does **not** establish actual CEP/AE compatibility, live provider access, model output quality, or animation appearance.

The package command creates `dist/ae-ai-studio-1.0.0-beta.1.zip` and a sibling `.sha256` file. Extract the archive and confirm its top folder contains `extension/` and `scripts/`.

## Manual AE checks

Record the AE version, OS, provider/model, date, expected result, and actual result for each check.

1. **Install:** Close AE, run the appropriate installer with explicit debug-mode opt-in, restart AE, and open Window → Extensions → AE AI Studio.
2. **Reinstall:** Install again. Confirm the old copy is preserved under CEP/ae-ai-studio-backups and only one panel appears.
3. **Localization:** Change Korean → English → Simplified Chinese. Check labels, prompts, status, and text overflow at the panel's minimum size.
4. **Offline demo:** Run the offline demo without any API key. Inspect the preview, execute, and verify created layers in the Timeline.
5. **Undo:** Press Ctrl+Z / Cmd+Z once. Confirm that the complete generated result is undone.
6. **Existing composition:** Open a 1920×1080, 30fps, 5-second composition containing a manually created layer. Generate new text, null, rectangle, ellipse, solid, and adjustment layers. Confirm the original layer is unchanged.
7. **New composition:** Request a new composition and generated layers. Verify its dimensions, frame rate, duration, layer names, and Unicode text.
8. **Transforms:** Check Position, Scale, Rotation, Opacity, and Anchor Point for generated layers.
9. **Animation:** Check keyframe time and values, Linear interpolation, and Ease behavior. Scrub and preview the result. Verify no keys exceed the composition duration.
10. **Parenting:** Parent two new layers and verify the relationship in Parent & Link. Reject invalid self/cyclic references before changes occur.
11. **Markers:** Add a composition marker and inspect its time and comment.
12. **Changed context:** Preview a plan, change the active composition, then execute. Confirm a clear error and no unintended edits.
13. **Invalid plan:** Try an unsupported action, an excessive plan, or an invalid number. Confirm rejection before mutations.
14. **Host error:** Trigger a controlled host failure in a disposable project. Confirm the error is shown, the Undo group is closed, and recovery guidance is accurate.
15. **Panel resize:** Dock and resize the panel. Confirm the prompt, preview, and execute/cancel controls remain usable.

## Live provider checks

Use a disposable project and a short request. Never commit API keys or paste them into test logs.

- **OpenAI:** Use an account-authorized model and API key. Generate and execute a short title animation. Check request failure/refusal and output truncation messages.
- **Anthropic:** Repeat with a model available to the account.
- **Ollama:** Start a local model and enter its ID. Generate a small plan without a key. Stop the service and confirm an actionable connection error.
- **Cancellation:** Cancel while waiting for a response. Confirm the pending plan cannot subsequently become executable.
- **API failure:** Use an invalid key, inaccessible model, or offline connection. Confirm keys and raw provider responses are not displayed.
- **Request bounds:** Verify large requests and oversized responses fail cleanly without freezing AE.
- **Context:** Toggle composition information sharing. Confirm only the enabled summary is included, with no media/file upload.
- **Privacy:** Close and reopen the panel. Confirm cloud API keys and conversation data are not restored.

Live model calls may incur provider charges. No automatic paid retry should occur.

## Release record

Before claiming a platform/provider is verified, record:

| Check | Environment | Result | Evidence |
| --- | --- | --- | --- |
| Automated tests | Node version / OS | Pass / fail | Test summary |
| Package integrity | Archive checksum | Pass / fail | SHA-256 |
| AE installation + Undo | AE version / OS | Pass / fail / not run | Manual notes |
| OpenAI | Model ID | Pass / fail / not run | Key-free result notes |
| Anthropic | Model ID | Pass / fail / not run | Key-free result notes |
| Ollama | Model ID / hardware | Pass / fail / not run | Key-free result notes |

Do not replace “not run” with “pass” solely because mocked tests passed.

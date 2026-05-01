# Logging Coherence Implementation Plan

> **For agentic workers:** Execute task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Each task is one commit. Code blocks are intentionally omitted from steps; rely on the task description, the design doc, and read the existing code before writing. The point is for you to remain free to adapt to surprises in the codebase.

**Goal:** Realign log output channels with the UI toggles, persist logging config in `network.json` so the backend boots in a coherent state, and add an in-process pcap recorder gated by a UI toggle.

**Architecture:** Three source-based log directories (`sessions/` server, `debug/` frontend, `errors/` ERROR+CRITICAL post-mortem) plus a new `captures/` for raw pcap recordings. Backend reads the persisted toggles at boot. A unified `/api/settings/logging` endpoint replaces the bespoke `/api/settings/server-logs`.

**Tech Stack:** Go 1.22+, gopacket+pcapgo, segmentio/encoding/json, Vitest 4.x, vanilla JS frontend.

**Spec:** `docs/plans/2026-04-24-logging-coherence-design.md`

---

## Project conventions to honour throughout

These are non-negotiable and apply to every task in this plan. They come from `CLAUDE.md` and the user's persistent feedback.

- **TDD strict, red-green-refactor.** Production code without a failing test written first gets deleted and rewritten. Run the test, see it fail with the right error, then implement, then see it pass. No exception "for trivial code". The discipline catches the case where the test was wrong all along.
- **TDD directed by intent.** Tests assert the user-expected behaviour, never the buggy one currently in code. When adding a test to existing code, state the expected outcome from the spec, not from the current implementation. If the test fails, the code has a bug.
- **No worktrees.** Work on a feature branch directly in the main repo (`feat/logging-coherence`). The user's preference overrides the CLAUDE.md Rule 7 worktree mention.
- **One intent per commit.** Each task lands as one commit. Refactors, doc tweaks, "while I'm here" cleanups belong in separate commits. The "while I'm here" pattern broke the project before; do not repeat it.
- **Minimal comments.** Default to none. Add a comment only when the WHY is non-obvious (a hidden constraint, a workaround for a specific bug, a surprise). Never cite tasks, issues, sibling commit SHAs, or "added for the X flow" rationale; that belongs in the PR description.
- **No AI writing tells.** No em-dash, no "crucial / essential / seamless / leverage / utilize / delve / it is worth noting". Short direct sentences. Bullets only for real parallel items. Applies to docs, commit messages, code comments.
- **No `Co-Authored-By: Claude` trailer.** Absolute rule. Ever.
- **Verification before completion.** No "done" claim without fresh command output as evidence. After each task, run the relevant Go test, the Vitest suite, golangci-lint, and `npm run lint`. Save the green output before moving on.
- **Modern Go syntax (1.22+).** Generics, `range over int`, `errors.Is/As`, method-pattern HTTP routing where applicable. No legacy.
- **Run golangci-lint, not just `go vet`.** CI uses `.golangci.yml`. Local pre-push must mirror: `golangci-lint run ./...` exits 0.
- **Push coverage by variant.** When testing a switch (level, source, gate state), enumerate every distinct case the user could realistically hit, not one happy-path sample. The test grid for the routing matrix in Task 3 is concrete.
- **Synthetic tests are not proof.** A passing unit test on a mocked routing function is not enough. Pair it with at least one integration test that walks the real chain from `Logger.WriteLogs` to the file on disk. Same for pcap recording: round-trip through `pcap.OpenOffline` to confirm the file is readable.
- **Trust user observations.** If live behaviour contradicts a test or a spec, question the test/spec first. Live is ground truth.
- **Commit message style.** Conventional commits prefix (`feat`, `fix`, `refactor`, `test`, `chore`, `docs`). Subject under 70 chars. Body in short sentences explaining the WHY, never restating the diff. No co-author trailer.

## Verification commands

Memorise these. Run them at the end of every task.

- Go tests: `go test ./...`
- Go lint: `golangci-lint run ./...`
- Go build: `go build ./...`
- JS tests: `npx vitest run`
- JS lint: `npx eslint web/scripts internal/templates`

The full set must exit 0 before the commit step in any task.

## File map

| File | Touched by tasks | Responsibility |
|---|---|---|
| `internal/capture/network_config.go` | 1 | Schema for `network.json`. New `LoggingConfig` field on `Config`. |
| `internal/capture/network_config_test.go` | 1 | Round-trip test for the new field. |
| `internal/logger/logger.go` | 2, 3, 4 | Logger struct, constructor signature, file routing rules. |
| `internal/logger/logger_test.go` | 2, 3, 4 | New file. Routing matrix coverage. |
| `internal/capture/pcap.go` | 7 | Capturer with optional pcap recorder hooks. |
| `internal/capture/pcap_record_test.go` | 7 | New file. Recording start/stop/round-trip via `pcap.OpenOffline`. |
| `internal/server/http.go` | 5 | `/api/settings/logging` GET+POST. Removes `/api/settings/server-logs`. |
| `internal/server/http_test.go` (or new) | 5 | Endpoint tests. |
| `cmd/radar/main.go` | 2, 8 | Wire logger constructor with config flag. Wire pcap recording at boot + via API. |
| `internal/templates/pages/settings.gohtml` | 6, 9 | Bind new checkbox, fetch settings from backend, tooltip rewording. |
| `internal/templates/layouts/base.gohtml` | 6 | Drop the existing localStorage-driven server-logs POST on page load. |
| `web/scripts/utils/SettingsSync.js` (read-only) | 6 | Confirm setBool API used to mirror backend state. |

---

## Task 1: Extend `network.json` schema with `Logging`

**Files:**
- Modify: `internal/capture/network_config.go`
- Modify: `internal/capture/network_config_test.go`

**Why first:** every later task depends on this struct being available.

- [ ] **Step 1: Write the failing test**

Add a test in `network_config_test.go` named `TestConfig_LoggingRoundTrip` that:
- Creates a temp dir.
- Calls `WriteConfig` with a `Config` whose `Logging.ServerLogsEnabled = true` and `Logging.PcapRecording = true`.
- Calls `ReadConfig` on the same dir.
- Asserts both fields come back as `true`.

Add a second test `TestConfig_MissingLoggingKey` that writes a `network.json` body containing only `captureInterfaces` (no `logging` key), calls `ReadConfig`, and asserts the returned `cfg.Logging.ServerLogsEnabled` and `cfg.Logging.PcapRecording` are both `false` (zero-value default).

- [ ] **Step 2: Run test to verify it fails**

Run: `go test ./internal/capture/ -run TestConfig_Logging -v`
Expected: FAIL because the `Logging` field does not exist on `Config`.

- [ ] **Step 3: Implement**

In `network_config.go`:
- Add a new exported `LoggingConfig` struct with two `bool` fields: `ServerLogsEnabled` (json tag `serverLogsEnabled`) and `PcapRecording` (json tag `pcapRecording`).
- Add a `Logging LoggingConfig` field on the existing `Config` struct with json tag `logging`.
- Do not change `ReadConfig` / `WriteConfig` signatures; the standard library handles the missing-key case via zero values.

- [ ] **Step 4: Verify**

Run: `go test ./internal/capture/ -run TestConfig -v`
Expected: PASS for the two new tests AND every existing test in `network_config_test.go`.

Then run the full suite: `go test ./...` and `golangci-lint run ./...`. Both must exit 0.

- [ ] **Step 5: Commit**

Branch: ensure you are on `feat/logging-coherence`. Create it from `main` if it does not exist yet.

Commit subject: `feat(config): add logging section to network.json schema`
Commit body: one or two sentences on the why (boot-time persistence of the two logging toggles).

---

## Task 2: Logger constructor takes initial enabled state

**Files:**
- Modify: `internal/logger/logger.go`
- Modify: `cmd/radar/main.go`
- Create: `internal/logger/logger_test.go`

**Why:** decouples the logger boot state from a separate API call. Future tasks rely on the new signature.

- [ ] **Step 1: Write the failing test**

Create `internal/logger/logger_test.go` with a test `TestNew_RespectsInitialEnabled` that calls `logger.New(t.TempDir(), true)`, then `IsEnabled()`, and asserts `true`. Add a sibling test `TestNew_RespectsInitialDisabled` that mirrors with `false`.

- [ ] **Step 2: Run test to verify it fails**

Run: `go test ./internal/logger/ -run TestNew_Respects -v`
Expected: FAIL because `New` currently takes a single argument.

- [ ] **Step 3: Implement**

Change the `New` signature to `func New(logsDir string, enabled bool) *Logger`. Set `l.enabled = enabled` before any other side effect. Keep all other behaviour identical (initialise dirs, create session file, start flush loop).

In `cmd/radar/main.go`:
- Read the config via `capture.ReadConfig(appDir)` early in `setup`.
- Pass `cfg.Logging.ServerLogsEnabled` to `logger.New`.

Drop the existing log line `Logger.SetEnabled(...)` if `main.go` was setting it manually based on a different source; from now on the constructor is the single boot-time setter.

- [ ] **Step 4: Verify**

Run: `go test ./internal/logger/ -run TestNew_Respects -v` and the full Go suite. All must pass.
Run: `go build ./...`. Must exit 0.
Run: `golangci-lint run ./...`. Must exit 0.

- [ ] **Step 5: Commit**

Commit subject: `refactor(logger): accept initial enabled state in constructor`

---

## Task 3: Split frontend logs into `debug/` with ERROR/CRITICAL also routed to `errors/`

**Files:**
- Modify: `internal/logger/logger.go`
- Modify: `internal/logger/logger_test.go`

**Why:** today `WriteLogs` dumps everything into `sessions/`. After this task, frontend events live in their own file.

- [ ] **Step 1: Write the failing tests**

Add to `logger_test.go`:

- `TestWriteLogs_RoutesToDebugFile`: build a logger in a temp dir with `enabled=false` (irrelevant for client side), call `WriteLogs([{level:"DEBUG", category:"X", event:"e", data:{}}])`, call `Flush`, then assert that the `debug/front_<TS>.jsonl` file exists and contains exactly one line whose JSON has `level == "DEBUG"`. Assert the matching `sessions/` file is empty.

- `TestWriteLogs_ErrorAlsoRoutesToErrorsFile`: build a logger, call `WriteLogs([{level:"ERROR", category:"X", event:"e", data:{}}])`, flush, assert the `debug/front_<TS>.jsonl` has one line AND the `errors/errors_<DATE>.log` has one line whose body mentions `X.e`.

- `TestWriteLogs_CriticalAlsoRoutesToErrorsFile`: same as above with `level:"CRITICAL"`.

- `TestWriteLogs_MixedBatch_RoutesPerLevel`: send `[{level:"INFO"}, {level:"WARN"}, {level:"ERROR"}, {level:"CRITICAL"}]`. Assert: `debug/` has 4 lines; `errors/` has 2 lines (only ERROR + CRITICAL).

Use the helper `os.ReadFile` and JSON line counting. Read the existing file naming pattern from `createSessionFile()` for the `<TS>` placeholder; the new helper should mirror that.

- [ ] **Step 2: Run tests to verify they fail**

Run: `go test ./internal/logger/ -run TestWriteLogs -v`
Expected: all four FAIL because `debug/` is never written today.

- [ ] **Step 3: Implement**

In `logger.go`:
- Add a `currentDebugFile` field initialised next to `currentSessionFile`. Naming: `debug/front_<same TS>.jsonl` so a session file and its debug peer pair by name.
- Add a `clientBuffer []interface{}` next to the existing buffer (rename the existing one to `serverBuffer` to make the split explicit).
- `WriteLogs` appends to `clientBuffer` only.
- `Log` appends to `serverBuffer` only (already the only producer of `Log`-shaped entries).
- `Flush` flushes both buffers: `serverBuffer` to `currentSessionFile`, `clientBuffer` to `currentDebugFile`. Wrap each write in an `OpenFile` + `Close` like the existing flush.
- Inside `WriteLogs`, before appending, scan each entry. If `level` is `ERROR` or `CRITICAL`, also write a one-line entry to `errors/errors_<DATE>.log` synchronously (same shape as the current `Error` writer). Use the entry's category and event in the line for grep-friendliness.

Keep `Error` (server side) untouched in this task. Task 4 covers it.

- [ ] **Step 4: Verify**

Run: `go test ./internal/logger/ -v`. All tests pass (existing + new).
Run: `go test ./...` and lint. Must exit 0.

- [ ] **Step 5: Commit**

Commit subject: `feat(logger): route frontend logs to debug/ and mirror errors`

---

## Task 4: Backend ERROR/CRITICAL always lands in `errors/`, sessions/ stays gated

**Files:**
- Modify: `internal/logger/logger.go`
- Modify: `internal/logger/logger_test.go`

**Why:** post-mortem trace must survive a disabled toggle.

- [ ] **Step 1: Write the failing tests**

Add to `logger_test.go`:

- `TestLog_ErrorWritesToErrorsEvenWhenDisabled`: build logger with `enabled=false`, call `Logger.Error("CAT", "ev", data, ctx)`, assert `errors/errors_<DATE>.log` has one line. Assert `sessions/session_<TS>.jsonl` is empty (or has zero lines containing `CAT.ev`).

- `TestLog_CriticalWritesToErrorsEvenWhenDisabled`: same with `Logger.Critical(...)`.

- `TestLog_ErrorWhenEnabledHitsBothFiles`: `enabled=true`, call `Error`, assert both files have one matching line.

- `TestLog_InfoWhenDisabledWritesNothing`: `enabled=false`, call `Info`, assert `sessions/` empty AND `errors/` empty.

- [ ] **Step 2: Run tests**

Run: `go test ./internal/logger/ -run TestLog_ -v`
Expected: at least the two "even when disabled" cases FAIL, because `Error` currently routes through `Log` first which short-circuits when disabled, so the `errors/` write is also gated.

- [ ] **Step 3: Implement**

Restructure `Error` and `Critical` in `logger.go`:
- Always perform the `errors/errors_<DATE>.log` append, regardless of `l.enabled`. Move that write to the top of the function.
- Then call `Log(level, ...)` for the chronological session file write. `Log` keeps its existing `enabled` gate, which means the session file is updated only when on.

Confirm `Critical` exists and follows the same pattern; if not, mirror the change.

- [ ] **Step 4: Verify**

Run: `go test ./internal/logger/ -v`. All pass.
Run: `go test ./...` and lint. Exit 0.

- [ ] **Step 5: Commit**

Commit subject: `feat(logger): keep errors/ always-on for ERROR and CRITICAL`

---

## Task 5: Unified `/api/settings/logging` endpoint

**Files:**
- Modify: `internal/server/http.go`
- Modify (or create): `internal/server/http_test.go`

**Why:** single source of truth for the two toggles, replaces the bespoke `/api/settings/server-logs`.

- [ ] **Step 1: Write the failing tests**

Tests with `httptest.NewServer` and the existing route registration helpers:

- `TestSettingsLogging_GetReturnsCurrentConfig`: seed `network.json` in a temp `appDir` with `Logging.ServerLogsEnabled=true, PcapRecording=false`. Boot the server. `GET /api/settings/logging`. Assert HTTP 200 and JSON body `{"serverLogsEnabled":true,"pcapRecording":false}`.

- `TestSettingsLogging_PostUpdatesPersistAndApply`: seed both toggles to false. POST `{"serverLogsEnabled":true}`. Assert HTTP 200, response echoes the new full state, `network.json` on disk now has `serverLogsEnabled: true, pcapRecording: false`, and `logger.IsEnabled() == true`.

- `TestSettingsLogging_PostPartialBody`: seed `serverLogsEnabled=true, pcapRecording=false`. POST `{"pcapRecording":true}`. Assert `serverLogsEnabled` is still `true` after the call (untouched by partial update).

- `TestSettingsLogging_PostInvalidJson`: POST with malformed body. Assert HTTP 400, `network.json` unchanged.

- `TestSettingsServerLogs_LegacyEndpointIsGone`: GET or POST `/api/settings/server-logs`. Assert HTTP 404.

- [ ] **Step 2: Run tests**

Run: `go test ./internal/server/ -run TestSettingsLogging -v`
Expected: FAIL across the board because the endpoint does not exist yet.

- [ ] **Step 3: Implement**

In `http.go`:
- Register handler for `/api/settings/logging`. Use Go 1.22 method-pattern routing (`s.mux.HandleFunc("GET /api/settings/logging", ...)` and `"POST /api/settings/logging"`). No external router.
- The handler captures the `appDir`, the `Logger`, and the `Capturer` references at registration time (closures or a small struct method, whichever fits the existing pattern).
- GET: read current `network.json`, return `cfg.Logging` as JSON.
- POST: decode the partial body into a struct with two pointer fields (`*bool` each) so absent fields stay nil. Read current config. For each non-nil pointer, apply the new value. Write config atomically. Then propagate to runtime: call `logger.SetEnabled(...)` if `serverLogsEnabled` changed; call `capturer.StartRecording(captureDir)` or `StopRecording()` if `pcapRecording` changed (Task 8 wires this; for this task an `if pointer != nil` no-op stub for the capturer side is fine, replaced in Task 8).
- On any IO error, respond 500 and do not partially apply runtime changes.

Remove the old `/api/settings/server-logs` registration and its handler function entirely.

- [ ] **Step 4: Verify**

Run: `go test ./internal/server/ -v`. All pass.
Run: `go test ./...` and lint. Exit 0.

- [ ] **Step 5: Commit**

Commit subject: `feat(http): unify logging settings endpoint`

---

## Task 6: Frontend boot fetches `/api/settings/logging`

**Files:**
- Modify: `internal/templates/pages/settings.gohtml`
- Modify: `internal/templates/layouts/base.gohtml`

**Why:** localStorage is no longer the source of truth. The UI reflects the backend.

- [ ] **Step 1: Manual reproduction first**

Run the radar locally. Open DevTools Network tab. Reload the settings page. You should see the existing POST to `/api/settings/server-logs` from `base.gohtml:57-61` firing on every page load. Note this is what the new flow replaces.

- [ ] **Step 2: Implement**

In `base.gohtml`:
- Remove the block that POSTs `settingServerLogsEnabled` from localStorage on every page load (around lines 55-65). The fetch in `settings.gohtml` is the only path now.

In `settings.gohtml`:
- At the top of the settings init function (where the existing `bindCheckbox` calls live), insert an `await fetch('/api/settings/logging')` call. Parse the JSON. Call `settingsSync.setBool('settingServerLogsEnabled', resp.serverLogsEnabled)` and `settingsSync.setBool('settingPcapRecording', resp.pcapRecording)` BEFORE any `bindCheckbox` for these two keys runs.
- Replace the bespoke `addListener(serverLogsEl, "change", async ...)` block with a generic helper that POSTs `/api/settings/logging` with the partial body `{ <field>: el.checked }`. Apply the same helper to the new `settingPcapRecording` checkbox (Task 9 adds the HTML element).
- Errors from the fetch are non-fatal: log to console, fall back to the localStorage value, leave the checkbox in its last-known state. Do not throw.

- [ ] **Step 3: Manual verification**

Reload the settings page. DevTools Network tab shows one GET to `/api/settings/logging` and zero POSTs at boot. Toggle either checkbox: a single POST appears with the partial body. Refresh the page: the checkbox state matches the value previously POSTed (because `network.json` persists it).

Run `npx eslint web/scripts internal/templates`. Must exit 0.

- [ ] **Step 4: Commit**

Commit subject: `feat(ui): fetch logging settings from backend on settings page load`

---

## Task 7: Capturer pcap recording (Start/Stop/Is)

**Files:**
- Modify: `internal/capture/pcap.go`
- Create: `internal/capture/pcap_record_test.go`

**Why:** in-process pcap eliminates the need for external tcpdump runs while debugging.

- [ ] **Step 1: Write the failing tests**

Tests in `pcap_record_test.go`. Use `pcap.OpenOffline` to verify file readability after writing.

- `TestStartRecording_CreatesReadableFile`: build a `Capturer` (you may need a small constructor variant for tests that takes a synthetic pcap handle from `pcap.OpenOffline` of a tiny fixture, or pass `nil` and only test the recorder path; pick whichever fits the existing test setup, see how `internal/photon/live_pcap_test.go` builds its parser harness for inspiration). Call `StartRecording(t.TempDir())`. Assert that a file matching `capture_*.pcap` exists in the dir. Open it via `pcap.OpenOffline`; assert it returns no error and reports a non-zero linktype.

- `TestStartRecording_TwiceIsAnError`: call `StartRecording` twice without intervening `StopRecording`. Second call returns an error.

- `TestStopRecording_BeforeStartIsNoOp`: call `StopRecording` on a fresh capturer. Returns nil error.

- `TestProcessPacket_WritesToRecorder`: feed two synthetic packets through the capturer's packet handler while recording. Stop. Open the file with `pcap.OpenOffline`. Read packets via `gopacket.NewPacketSource` and assert exactly two packets are read with the expected payload bytes.

- `TestClose_StopsRecording`: start recording, then call `c.Close()`. Reopen the file via `pcap.OpenOffline`. Assert the file is well-formed (no error). Implies `Close` flushed and closed the writer.

- [ ] **Step 2: Run tests**

Run: `go test ./internal/capture/ -run TestStartRecording -run TestStopRecording -run TestProcessPacket_Writes -run TestClose_StopsRecording -v`
Expected: all FAIL because the methods do not exist.

- [ ] **Step 3: Implement**

In `pcap.go`:
- Add fields to the `Capturer` struct: `recordMu sync.Mutex`, `recordFile *os.File`, `recordWriter *pcapgo.Writer` (import the gopacket pcapgo package), `recordWriteErrors uint64`.
- `StartRecording(dir string) error`: under the mutex, return an error if `recordWriter != nil`. Make sure `dir` exists (`MkdirAll`). Build path `capture_<TS>.pcap` using the same timestamp format as the logger (`2006-01-02T15-04-05` with `:` replaced by `-`). Create the file. Construct a `pcapgo.NewWriter`. Call `WriteFileHeader` with the link type from `c.handle.LinkType()` and a snaplen matching the existing `SnapLen` constant. On any error path, close partial state and return the error.
- `StopRecording() error`: under the mutex. Return nil if not recording. Close the file. Set both fields to nil.
- `IsRecording() bool`: read under the mutex.
- Modify `processPacket(packet gopacket.Packet)`: after the existing UDP/payload handling, if `c.recordWriter != nil`, take the mutex and call `WritePacket(packet.Metadata().CaptureInfo, packet.Data())`. On error, increment `recordWriteErrors` and emit a throttled `[PKT] pcap recorder write error: %v` log every 100 errors (mirror the parsing-error throttle pattern in `handlePacket` at `cmd/radar/main.go:312`).
- Modify `Close()`: call `StopRecording()` before closing the handle.

- [ ] **Step 4: Verify**

Run: `go test ./internal/capture/ -v`. All pass.
Run: `go test ./...` and lint. Exit 0.

- [ ] **Step 5: Commit**

Commit subject: `feat(pcap): in-process pcap recording on capturer`

---

## Task 8: Wire pcap recording at boot and through the API

**Files:**
- Modify: `cmd/radar/main.go`
- Modify: `internal/server/http.go`
- Modify: `internal/server/http_test.go`

**Why:** make the new toggle reach the runtime and survive restarts.

- [ ] **Step 1: Write the failing tests**

Extend `http_test.go`:
- `TestSettingsLogging_PostStartsRecording`: seed `network.json` with `pcapRecording=false`, boot a server with a real `Capturer` (or a small mockable interface; if introducing the interface is too large for this task, build a real Capturer over a tiny fixture pcap as in Task 7's tests). POST `{"pcapRecording": true}`. Assert `capturer.IsRecording() == true` and a file appears under `logs/captures/`.
- `TestSettingsLogging_PostStopsRecording`: same setup but the capturer is already recording. POST `{"pcapRecording": false}`. Assert `capturer.IsRecording() == false`.

In `cmd/radar/main.go`:
- Boot path test is harder without significant rework. Skip a Go-level test for the boot path here; cover via manual smoke at Step 4. The HTTP-level tests above lock in the runtime propagation.

- [ ] **Step 2: Run tests**

Run: `go test ./internal/server/ -run TestSettingsLogging_Post -v`
Expected: the `pcapRecording` cases FAIL because Task 5 left a stub.

- [ ] **Step 3: Implement**

In `cmd/radar/main.go`:
- After `Capturer` is constructed and before `Start`, check `cfg.Logging.PcapRecording`. If true, call `c.StartRecording(filepath.Join(logsDir, "captures"))`. If the call returns an error, log a warning via `logger.PrintWarn("PKT", "pcap recording could not start: %v", err)`, set `cfg.Logging.PcapRecording = false`, and call `capture.WriteConfig(appDir, cfg)` so the persisted state matches reality on the next boot. Continue starting the radar.

In `internal/server/http.go`:
- Replace the Task 5 stub for the capturer side with the real call. When the POST diff includes `pcapRecording: true`, call `capturer.StartRecording(...)`. When `false`, call `capturer.StopRecording()`. On error, respond 500 and do not write `network.json`. Only write the config after the runtime change succeeds.

- [ ] **Step 4: Verify**

Run: `go test ./...` and lint. Exit 0.

Manual smoke: launch the radar with `pcapRecording: true` in `network.json`. Watch for the start log. Confirm a `logs/captures/capture_*.pcap` file appears and grows while the radar runs. Stop the radar. Open the file with `wireshark` or `tcpdump -r` and confirm packets are present. Then set the file's `pcapRecording` to a path that cannot be written (read-only dir) and reboot: confirm the warning log fires and `network.json` gets rewritten with `false`.

- [ ] **Step 5: Commit**

Commit subject: `feat: wire pcap recording at boot and via /api/settings/logging`

---

## Task 9: UI tooltips and new pcap checkbox

**Files:**
- Modify: `internal/templates/pages/settings.gohtml`

**Why:** make the UI reflect the new semantics so the user stops being surprised.

- [ ] **Step 1: Implement**

Locate the three logging-related toggles in `settings.gohtml`:
- `settingLogToConsole`
- `settingLogToServer`
- `settingServerLogsEnabled`

Update each tooltip to the wording fixed in the spec:
- `settingLogToConsole`: "Print logs in the browser DevTools console."
- `settingLogToServer`: "Send frontend logs to the backend (saved to `logs/debug/`; errors go to `logs/errors/` too)."
- `settingServerLogsEnabled`: "Save backend (Go) logs to `logs/sessions/`. Errors are always saved to `logs/errors/`."

Add a new checkbox `settingPcapRecording` next to `settingServerLogsEnabled` with the same daisyUI styling pattern. Tooltip: "Record the raw network capture to `logs/captures/`. Useful for debugging without running tcpdump externally."

Add a one-line note above the four toggles: "Logs land in `logs/sessions/`, `logs/debug/`, `logs/errors/`. Errors are always saved on the backend side."

- [ ] **Step 2: Verify**

Run `npx eslint web/scripts internal/templates`. Exit 0.

Manual smoke: open the settings page in the browser. Hover each tooltip; confirm the new wording. Toggle `settingPcapRecording` and watch the network tab for the POST. Confirm a capture file is created under `logs/captures/`.

- [ ] **Step 3: Commit**

Commit subject: `feat(ui): add pcap recording toggle and reword logging tooltips`

---

## Task 10: Final verification sweep

**Files:**
- None (read-only).

**Why:** lock in the green state before merging.

- [ ] **Step 1: Run the full verification grid**

Run each, save the output:
- `go test ./...`
- `golangci-lint run ./...`
- `go build ./...`
- `npx vitest run`
- `npx eslint web/scripts internal/templates`

All five must exit 0. If any fails, return to the relevant task and fix; do not patch over with a "while I'm here" change.

- [ ] **Step 2: Manual smoke checklist**

Run the radar end-to-end:
- Backend boots, reads `network.json`, applies both toggles to the runtime.
- Settings page on first load: GET `/api/settings/logging` returns the persisted state. Both checkboxes match.
- Toggle `settingServerLogsEnabled` on. POST goes through. Trigger a few backend log calls (move around in game). Watch `logs/sessions/session_*.jsonl` grow.
- Toggle `settingServerLogsEnabled` off. POST goes through. Force a backend ERROR (kill a dependency, observe a parsing error, etc.). Watch `logs/errors/errors_<DATE>.log` grow even though `sessions/` is silent.
- Toggle `settingLogToServer` on. Trigger frontend logs (open the radar UI, click around). Watch `logs/debug/front_*.jsonl` grow. Trigger a frontend error (e.g. a known broken path) and confirm the error appears in BOTH `logs/debug/` AND `logs/errors/`.
- Toggle `settingPcapRecording` on. Watch `logs/captures/capture_*.pcap` appear and grow. Open it with `wireshark` to confirm packets.
- Restart the radar. Confirm both toggles boot in the same state they were left in.

- [ ] **Step 3: Pre-PR checklist**

- `git log origin/main..HEAD` shows one commit per task (10 commits expected).
- `git diff origin/main..HEAD` is reviewable. No stray files (capture pcaps, mise.toml, .playwright-mcp).
- No `Co-Authored-By: Claude` trailer in any commit.
- No em-dash, no banned AI words in any code, comment, or commit message. Run `grep -rE "crucial|essential|seamless|leverage|utilize|delve|worth noting|—" --include="*.go" --include="*.js" --include="*.gohtml" --include="*.md"` and confirm zero matches in the changed surface.
- The PR description is short: a Summary section (3-5 bullets), a Test plan section (the manual smoke checklist above), and nothing else. No commit-by-commit recap.

- [ ] **Step 4: Push and open PR**

Push `feat/logging-coherence`. Open the PR with the short description. Wait for CI green before merging.

---

## Self-review

**Spec coverage:** every routing rule, persistence rule, API contract, file naming convention, and pcap recording behaviour from `2026-04-24-logging-coherence-design.md` maps to one or more tasks above. Tooltip wording lives in Task 9; routing matrix split is covered by Tasks 3 and 4; the unified API and the legacy endpoint removal are both in Task 5.

**Placeholder scan:** no TBD/TODO/"implement later" patterns. Tests are described by behaviour and assertion content rather than by literal code, per the user's instruction; the engineer is expected to write the actual test code following the description plus the existing testing conventions in `internal/logger`, `internal/capture`, and `internal/server`.

**Type consistency:** `LoggingConfig`, `Config.Logging`, `Logger.New(logsDir, enabled)`, `Capturer.StartRecording(dir)`, `StopRecording()`, `IsRecording()`, `/api/settings/logging`, `settingPcapRecording`. Every name appears identically across the tasks that reference it.

**Risk areas to watch:**
- Task 3 splits the buffer in `Logger`. Existing flush behaviour is preserved; race conditions on the new client buffer require the same `bufferMu` discipline as the server one.
- Task 7 uses gopacket's `pcapgo.NewWriter`. Confirm the link type returned by `c.handle.LinkType()` matches what `WriteFileHeader` expects; common values are `layers.LinkTypeEthernet` (Ethernet) and may be `layers.LinkTypeNull` on some adapters. Trust whatever the live handle reports; do not hardcode.
- Task 8 boot-time failure path rewrites `network.json`. Ensure the rewrite happens AFTER the warning log, AFTER setting the runtime flag to false, and uses the same atomic `WriteConfig` helper so a crash mid-write cannot corrupt the file.
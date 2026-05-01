# Logging Coherence Design

**Date**: 2026-04-24
**Status**: Spec approved, ready for implementation plan

## Problem

Three issues today on the logging surface:

1. **Directory promise vs reality**. `internal/logger/logger.go` creates `sessions/`, `errors/`, `debug/` at boot. In practice everything ends up in `sessions/`. `errors/` only fills when `Logger.Error` runs server-side AND the toggle is on. `debug/` is never written.
2. **Toggle vs behaviour**. The UI toggle "Server side recording" (`settingServerLogsEnabled`) gates only `Logger.Log` for backend Go entries. Frontend logs sent via `settingLogToServer` keep flowing into `sessions/` regardless. Toggle wording suggests a master file-write switch; reality is a partial backend gate.
3. **Boot incoherence**. The frontend pushes `settingServerLogsEnabled` from `localStorage` to the backend on every page load via `/api/settings/server-logs`. Until that POST lands, the backend sits at the constructor default (`false`). One-shot scripts and the first events of a session can be silently dropped or written depending on race timing.

A fourth opportunity surfaced during the same review: the user often takes external `tcpdump` captures to debug parser issues. The backend already receives every UDP packet via libpcap. Recording could be done in-process and gated by a UI toggle, removing the round-trip through external tooling.

## Scope

- Restructure log routing so each directory has a clear, source-based meaning.
- Move the persisted source of truth for the logging toggles from `localStorage` to `network.json` so the backend boots with the correct state.
- Add an in-process pcap recorder gated by a new toggle.

Out of scope:
- Log rotation by size or time (one file per session start for `sessions/` and `debug/`, daily rotation already exists for `errors/`).
- Anonymization of recorded pcap files. Existing `tools/anonymize-pcap` covers post-processing.
- Frontend log levels and category filters (already work, no change).

## Architecture

### Output channels

| Source              | Level                | `sessions/` | `debug/` | `errors/` | Conditions                                         |
|---------------------|----------------------|-------------|----------|-----------|----------------------------------------------------|
| Backend Go          | DEBUG / INFO / WARN  | yes         | no       | no        | `settingServerLogsEnabled`                         |
| Backend Go          | ERROR / CRITICAL     | yes if gate | no       | yes       | `sessions/` gated, `errors/` always-on             |
| Frontend (`/api`)   | DEBUG / INFO / WARN  | no          | yes      | no        | `settingLogToServer` + frontend filters            |
| Frontend (`/api`)   | ERROR / CRITICAL     | no          | yes      | yes       | same as DEBUG/INFO/WARN                            |

Notes:
- An ERROR/CRITICAL on the backend lands in two files at once when the gate is on: `sessions/` for the chronological context, `errors/` for the post-mortem aggregator. The duplicate is intentional.
- The frontend never writes to `sessions/`. Mixing the two streams in a single file was the original confusion. They now live apart.
- `errors/` for backend stays always-on. A server crash leaves a trace even when file logging is otherwise off.
- `errors/` for frontend follows `settingLogToServer`. If the user has chosen to keep frontend events local, an error stays local too.

### File naming and rotation

| Directory   | File                                  | Rotation                      |
|-------------|---------------------------------------|-------------------------------|
| `sessions/` | `session_<YYYY-MM-DDTHH-MM-SS>.jsonl` | One per backend start         |
| `debug/`    | `front_<YYYY-MM-DDTHH-MM-SS>.jsonl`   | One per backend start         |
| `errors/`   | `errors_<YYYY-MM-DD>.log`             | Daily (existing)              |
| `captures/` | `capture_<YYYY-MM-DDTHH-MM-SS>.pcap`  | One per recording ON cycle    |

`debug/` aligns its timestamp on the backend start so a session and its frontend trace pair by name.

### Configuration persistence

`network.json` becomes the source of truth for both logging toggles:

```json
{
  "captureInterfaces": [...],
  "logging": {
    "serverLogsEnabled": false,
    "pcapRecording": false
  }
}
```

A `network.json` without the `logging` key keeps working: defaults are `false` for both fields. No breaking change for existing installs.

### Boot flow

1. `cmd/radar/main.go` calls `capture.ReadConfig(appDir)`.
2. The returned `Config.Logging.ServerLogsEnabled` is passed to `logger.New(logsDir, enabled)`. The default constructor signature changes to take the boolean.
3. The returned `Config.Logging.PcapRecording` is passed to the `Capturer`. If true, `Capturer.StartRecording(filepath.Join(logsDir, "captures"))` is called before `Start`.
4. The frontend, on settings page load, calls `GET /api/settings/logging`. The response populates `localStorage` for both keys (`settingServerLogsEnabled`, `settingPcapRecording`). The UI checkboxes then bind from `localStorage`.
5. A `change` event on either checkbox calls `POST /api/settings/logging` with the partial body. The handler updates `network.json` (atomic write via `WriteConfig`) and applies the change in runtime (Logger or Capturer).

The endpoint `/api/settings/server-logs` is replaced by the unified `/api/settings/logging` GET/POST. The single-toggle endpoint is removed in the same change.

## Components

### `internal/capture/network_config.go`

Add the `Logging` struct field on `Config`:

```go
type LoggingConfig struct {
    ServerLogsEnabled bool `json:"serverLogsEnabled"`
    PcapRecording     bool `json:"pcapRecording"`
}

type Config struct {
    CaptureInterfaces []PersistedInterface `json:"captureInterfaces"`
    Logging           LoggingConfig        `json:"logging"`
}
```

`ReadConfig`/`WriteConfig` use `encoding/json` round-trip; the existing tests cover the migration of unknown fields with the standard library default (silently ignored, zero values applied).

### `internal/logger/logger.go`

Constructor takes the initial enabled state:

```go
func New(logsDir string, enabled bool) *Logger
```

Routing changes:
- `WriteLogs(logs)` (frontend stream): write each entry to the current `front_<TS>.jsonl` file inside `debug/`. If `entry.level` is `ERROR` or `CRITICAL`, also append to `errors/errors_<DATE>.log`.
- `Log(level, ...)` (backend self-log): if `enabled`, append to `sessions/session_<TS>.jsonl`. If level is `ERROR` or `CRITICAL`, append to `errors/errors_<DATE>.log` regardless of `enabled`.
- The dedicated `Error` path keeps its always-on write to `errors/`. The current behaviour where `Error` ALSO routes through `Log` (and thus skips the session file when disabled) keeps that semantic: errors never lose their post-mortem trace.

Buffer split: the existing single buffer is replaced by two buffers, `serverBuffer` and `clientBuffer`. The flush ticker iterates each buffer and writes to its target file. Errors are appended to `errors/` synchronously inside the producer (already the case for `Error`); same path for client ERROR/CRITICAL inside `WriteLogs`.

### `internal/capture/pcap.go`

Add three methods to `Capturer`:

```go
func (c *Capturer) StartRecording(dir string) error
func (c *Capturer) StopRecording() error
func (c *Capturer) IsRecording() bool
```

State held under a new mutex:
- `recordFile *os.File`
- `recordWriter *pcapgo.Writer`

`processPacket` writes to the recorder under the mutex when `recordWriter != nil`. The packet is written with the original capture metadata (timestamp from the gopacket frame, full snaplen, link type from the live handle).

`Close` calls `StopRecording` if a recording is in progress.

Errors:
- Open failure on `StartRecording` returns an error to the caller. The HTTP handler responds 500 and leaves the runtime state at false; `network.json` is not updated.
- Open failure at boot (when `network.json` had `pcapRecording: true` but the file cannot be created): main.go logs a `[PKT]` warning, leaves the capturer in non-recording state, and writes `pcapRecording: false` back to `network.json` so the UI reflects the runtime state. The radar still starts.
- Write errors during `processPacket` increment a counter and emit `[PKT] pcap recorder write error: %v` once per 100, identical to the parsing-error log throttling.

### `internal/server/http.go`

Two endpoints:

`GET /api/settings/logging`:

```json
{
  "serverLogsEnabled": false,
  "pcapRecording": false
}
```

`POST /api/settings/logging` accepts a partial body:

```json
{ "serverLogsEnabled": true }
```

or both fields. Missing fields keep their current value. Implementation:
1. Read current `network.json`.
2. Apply the diff to `cfg.Logging`.
3. Write `network.json` atomically.
4. Apply runtime changes:
   - `serverLogsEnabled` -> `app.logger.SetEnabled(value)`.
   - `pcapRecording` -> `app.capturer.StartRecording(...)` or `StopRecording()`.
5. Respond `200` with the new full state.

The existing `POST /api/settings/server-logs` handler is removed.

### `web/scripts/utils/Utils.js` (or wherever settings boot lives)

On settings page init, before binding any of the two toggles:

```js
const resp = await fetch('/api/settings/logging');
const cfg = await resp.json();
settingsSync.setBool('settingServerLogsEnabled', cfg.serverLogsEnabled);
settingsSync.setBool('settingPcapRecording', cfg.pcapRecording);
```

The change handlers POST the new value:

```js
addListener(el, 'change', async (e) => {
    const body = { [field]: e.target.checked };
    await fetch('/api/settings/logging', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
});
```

The current bespoke handler around `settingServerLogsEnabled` collapses into the same generic `change` listener pattern.

### `internal/templates/pages/settings.gohtml`

Three tooltip rewrites:

| Toggle id                     | New tooltip                                                                              |
|-------------------------------|------------------------------------------------------------------------------------------|
| `settingLogToConsole`         | "Print logs in the browser DevTools console."                                            |
| `settingLogToServer`          | "Send frontend logs to the backend (saved to `logs/debug/`; errors go to `logs/errors/` too)." |
| `settingServerLogsEnabled`    | "Save backend (Go) logs to `logs/sessions/`. Errors are always saved to `logs/errors/`." |

New checkbox `settingPcapRecording` with tooltip:
"Record the raw network capture to `logs/captures/`. Useful for debugging without running tcpdump externally."

A short note above the toggles: "Logs land in `logs/sessions/`, `logs/debug/`, `logs/errors/`. Errors are always saved on the backend side."

## Tests

### Go

`internal/capture/network_config_test.go`:
- `LoggingConfig` round-trip (write then read, fields match).
- `network.json` without `logging` key reads back as zero values.

`internal/logger/logger_test.go` (new):
- `enabled=false` + `Log(INFO)` -> session file empty.
- `enabled=false` + `Error(...)` -> session file empty, error file has the entry.
- `enabled=true` + `Log(INFO)` -> session file has the entry, error file empty.
- `enabled=true` + `Error(...)` -> session file has the entry AND error file has the entry.
- `WriteLogs([{level:DEBUG}, {level:ERROR}])` -> debug file has both, error file has only the ERROR.

`internal/capture/pcap_record_test.go` (new):
- `StartRecording` with a valid dir creates `capture_<TS>.pcap` and writes a valid pcap header (read back with `pcap.OpenOffline`).
- After `StartRecording`, calling `processPacket` with a synthetic packet writes a record; reading the file back yields one packet with the same payload bytes.
- `StopRecording` closes the file cleanly; reopening the file as a reader succeeds.
- `Close` while recording stops the recorder.

`internal/server/http_test.go` (extended or new file):
- `GET /api/settings/logging` returns the persisted state.
- `POST /api/settings/logging` partial update writes only the included field.
- `POST` failure path (e.g. invalid JSON) returns 400 and leaves the file untouched.

### Frontend

No new logic in `web/scripts/logger.js`; existing test coverage stays. The settings boot fetch is straightforward fetch + setBool, covered by manual smoke (no new Vitest test added).

## Migration

- Existing `sessions/*.jsonl` files are left in place. The directory keeps receiving server logs; frontend logs no longer mix in.
- The first restart after the change creates the first `debug/front_<TS>.jsonl`. Existing `debug/` directory stays untouched (was empty).
- `errors/` keeps its daily rotation pattern. Existing files remain valid.
- `captures/` is created on first `StartRecording` call (not at boot).
- `localStorage.settingServerLogsEnabled` is overwritten by the value from `network.json` on the first settings page load. Users who had the toggle off see it stay off; users who had it on see it stay on (because `network.json` was being POSTed to from `localStorage` before the change).

## Open questions

None.

## Self-review

Placeholder scan: clean, no TBD/TODO.
Internal consistency: routing matrix matches code descriptions in Components section.
Scope check: three points of work (routing, persistence, pcap recorder) share enough surface (settings UI, network.json, logger code path) to belong in one plan. Splitting would force two near-identical migration sections.
Ambiguity: ERROR routing rules stated explicitly in the matrix; tooltip wording provided verbatim; API contracts defined with example bodies.
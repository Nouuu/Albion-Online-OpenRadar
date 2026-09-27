# Logging and pcap recording

How OpenRadar routes its log output and records raw network traffic.

*Last verified against code: 2026-09-25.*

## Output channels

Logs are split by source and severity into four directories under `logs/`.

| Source | Level | `sessions/` | `debug/` | `errors/` | Conditions |
|---|---|---|---|---|---|
| Backend Go | DEBUG/INFO/WARN | yes | no | no | gated by `serverLogsEnabled` |
| Backend Go | ERROR/CRITICAL | yes if gate on | no | yes (always) | `errors/` is always-on |
| Frontend (`/api`) | DEBUG/INFO/WARN | no | yes | no | gated by frontend `settingLogToServer` |
| Frontend (`/api`) | ERROR/CRITICAL | no | yes | yes | same gate; errors copied to `errors/` |

Backend ERROR and CRITICAL entries land in two files at once when the session gate is on: `sessions/` for chronological context, `errors/` for the post-mortem aggregator. The duplicate is intentional. `errors/` for backend stays always-on so a server crash leaves a trace even when file logging is otherwise off.

The frontend never writes to `sessions/`. Mixing both streams in one file was the original confusion before the coherence rework; they now live apart.

## File naming

| Directory | File | Rotation |
|---|---|---|
| `sessions/` | `session_<YYYY-MM-DDTHH-MM-SS>.jsonl` | one per backend start |
| `debug/` | `front_<YYYY-MM-DDTHH-MM-SS>.jsonl` | one per backend start (timestamp pairs with the session) |
| `errors/` | `errors_<YYYY-MM-DD>.log` | daily |
| `captures/` | `capture_<YYYY-MM-DDTHH-MM-SS>_<sanitized-iface>.pcap` | one per recording start, one per active capturer |

## Configuration

The source of truth is `network.json` at `appDir`. Two boolean toggles live under the `logging` key:

```json
{
  "captureInterfaces": [...],
  "logging": {
    "serverLogsEnabled": false,
    "pcapRecording": false
  }
}
```

A `network.json` without the `logging` key keeps working: defaults are `false` for both fields. No breaking change for older installs.

## Boot flow

1. `cmd/radar/main.go` calls `capture.ReadConfig(appDir)`, then `bootInterfaces` picks the persisted interfaces, an auto-selected default, or leaves the manager waiting for the settings page.
2. `Config.Logging.ServerLogsEnabled` is passed through `newApp` to `logger.New(logsDir, enabled)`. The constructor takes the boolean so the first events are routed correctly without waiting for the frontend to push a value.
3. `Config.Logging.PcapRecording` is read after `Manager.Reconfigure` returns. If true, `Manager.StartRecording(filepath.Join(logsDir, "captures"))` runs before the radar enters the running state.
4. If pcap recording start fails at boot, `main.go` logs a `[PKT]` warning, leaves the runtime in non-recording state, and writes `pcapRecording: false` back to `network.json` so the UI reflects reality.

## HTTP API

Two endpoints, both at `/api/settings/logging`:

- `GET` returns `{"serverLogsEnabled": bool, "pcapRecording": bool}`, read live from the logger and the recorder, not from `network.json`.
- `POST` accepts a partial body; missing fields keep their value. Successful POST writes `network.json` atomically via `capture.MutateConfig`, applies the runtime change (logger `SetEnabled` or recorder `StartRecording`/`StopRecording`), and responds with the new full state.

`POST /api/settings/logging` is host-only: a wrapper accepts loopback callers and a remote whose IP equals the connection's local IP, ignores forwarding headers, and otherwise answers 403 "Only the PC running the radar can change this." `GET` stays open to every device on the LAN.

Per-interface guarantees: `MutateConfig` reads, mutates, and writes under a single critical section so that a logging toggle never wipes the `captureInterfaces` slice and a network reconfigure never wipes the `logging` slice.

## In-process pcap recording

`Capturer.StartRecording(dir)`, `StopRecording()`, `IsRecording()` are exposed on each capturer. `Manager.StartRecording`/`StopRecording`/`IsRecording` propagate to all active capturers and remember the recording-enabled flag so future capturers added by `Reconfigure` start recording too.

`Manager.StartRecording` is all or nothing: calling it while already recording is a no-op, and if one capturer fails to start, the Manager stops recording on every capturer and resets its state. The interfaces handler then writes `pcapRecording: false`, so the next `GET` reports the real, stopped state.

Each active capturer writes its own pcap file. Filename uses the capturer's interface name sanitized through a `[^A-Za-z0-9_-]` to `_` regex. A start-stop-start cycle on the same interface produces two distinct files.

`processPacket` writes to the recorder under a mutex when `recordWriter != nil`. Packets are written with their original capture metadata (timestamp from the gopacket frame, full snaplen, link type from the live handle) so the output is replayable through `pcap.OpenOffline`.

`Capturer.Close` calls `StopRecording` first, before closing the libpcap handle, so a goroutine cannot poll a freed handle while flushing.

## Frontend behavior

On settings page load, `fetchBackendSettings('/api/settings/logging')` populates the two checkboxes from the backend response. A `change` event on either checkbox calls `POST /api/settings/logging` with the partial body. The frontend never writes the persisted state directly; the backend is the source of truth. On a device that is not the host, both checkboxes render disabled with "Only the PC running the radar can change this."

The Settings page carries the logging-related controls in two places:

- Settings > Logging: `settingLogLevel`, the category filters, `settingLogToConsole` and `settingLogToServer`.
- Settings > Debug: a Backend logs group with `settingDebugBackendLogs` (host-only), and a Network traffic group with
  `settingDebugPcapRecording` (host-only) and `settingDebugWsCoalescing`.

What each key does:

- `settingLogToConsole`: print frontend logs in the browser DevTools console.
- `settingLogToServer`: send frontend logs to `logs/debug/`.
- `settingDebugBackendLogs`: save backend Go logs to `logs/sessions/` (errors always go to `logs/errors/` regardless).
- `settingDebugPcapRecording`: record raw network capture to `logs/captures/`.

The Logging section banner reads: "Logs land in `logs/sessions/`, `logs/debug/`, `logs/errors/`. Backend errors are always saved to `logs/errors/`. Browser errors are saved only while this browser sends its logs (Settings > Logging > "Save browser logs")."

## Frontend log API

The frontend log call site:

```javascript
window.logger?.debug(CATEGORIES.PLAYERS, 'EquipmentUpdated', { playerId, nickname, slotCount });
```

`Logger.shouldLog(level, category)` in `web/scripts/logger.js` is the single filtering point. `settingLogLevel` sets the minimum level; below it, everything is dropped except CRITICAL. DEBUG and INFO also need their category enabled through `settingLogCategory<Area>`, read live off `settingsSync` (no cache). A passing entry is printed to the console when `settingLogToConsole` is on, and queued for `logs/debug/` when `settingLogToServer` is on. The queue flushes over the same WebSocket connection used for game events, every 5 seconds or at 200 buffered entries, whichever comes first.

## Operational notes

- pcap files at 24 bytes are not corrupt: that is the pcap-global header alone, written when recording starts but no Albion UDP 5056 packet was observed during the recording window.

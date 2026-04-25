# Issue #83 — LAN connect + minimal mobile responsive

**Date**: 2026-04-25
**Issue**: https://github.com/Nouuu/Albion-Online-OpenRadar/issues/83
**Branch**: `feat/83-lan-connect-and-responsive`
**Closes**: #83

## Problem

Users want to view the radar from another device on the same LAN (phone, second laptop). The Go server already binds `:5001` on every interface, and the WebSocket upgrader has `CheckOrigin: return true`, so the HTML page is reachable from any LAN client. Only the WebSocket fails to connect because three frontend locations hardcode `ws://localhost:5001/ws`. When a phone loads `http://192.168.1.42:5001` and the JS tries to open `ws://localhost:5001/ws`, the phone resolves `localhost` to itself and the connection dies.

A second, related concern: even if the WebSocket connects, the page layout was built for desktop. The responsive scaffolding exists (`md:hidden`/`hidden md:flex`, mobile sidebar drawer in `internal/templates/layouts/sidebar.gohtml`, hamburger button in `internal/templates/layouts/header.gohtml`, viewport meta tag set), but the radar canvas and several settings pages have not been validated at portrait phone widths.

## Goals

1. Any device on the LAN that loads `http://<server-ip>:5001` gets a working radar (HTML + WebSocket).
2. The startup banner reveals the LAN URL the user should type into their phone, without forcing them to look up their own IP.
3. Every existing page is at minimum **usable** at 375x667 portrait (no horizontal overflow, no clipped controls, canvas readable). No mobile redesign, no new touch features.
4. Single PR, two commits, closes #83.

## Non-goals

- No `--bind` CLI flag. Binding `:port` already exposes all interfaces; an opt-in flag adds surface for no gain.
- No HTTPS, no auth, no per-IP allowlist. The LAN trust assumption matches the issue framing ("trusted local network"). Document the exposure.
- No CORS changes. `CheckOrigin: return true` is already permissive.
- No change to the TUI WebSocket URL (`internal/ui/dashboard.go:169`). The TUI is local-only.
- No mobile-specific UX (touch gestures, PWA, offline mode).
- No performance optimisation for mobile devices.

## Sub-project A — LAN connect

### A.1 Dynamic WebSocket URL

Replace the hardcoded constant in two files:

`web/scripts/core/WebSocketManager.js:6`
```js
const WS_URL = 'ws://localhost:5001/ws';
```
becomes
```js
const wsScheme = location.protocol === 'https:' ? 'wss:' : 'ws:';
const WS_URL = `${wsScheme}//${location.host}/ws`;
```

`web/scripts/logger.js:159` follows the same pattern.

The TUI logs in `cmd/radar/main.go:262` keep `ws://localhost:%d/ws` because the TUI runs on the same host. Same for `internal/ui/dashboard.go:169`.

### A.2 Startup banner with LAN URL

The capture layer already discovers the active adapter IP (`app.adapterIP`, printed at `cmd/radar/main.go:264` as `Adapter: %s`). Reuse that single value, do not enumerate all interfaces. Replace the single localhost line with two lines so the user sees both URLs side by side:

```
HTTP   Server: http://localhost:5001
HTTP   Server: http://192.168.1.42:5001  (LAN)
WS     WebSocket: ws://localhost:5001/ws
```

If `adapterIP` is empty or equals `127.0.0.1`, only print the localhost line (no `(LAN)` suffix). The WebSocket line stays as-is for the local case.

### A.3 Test

One Vitest test in a new co-located file `web/scripts/core/_WebSocketManager.test.js` (project convention `_*.test.js`). Cover:

- `location.host = 'localhost:5001'`, `protocol = 'http:'` -> `ws://localhost:5001/ws`
- `location.host = '192.168.1.42:5001'`, `protocol = 'http:'` -> `ws://192.168.1.42:5001/ws`
- `location.host = 'radar.example:5001'`, `protocol = 'https:'` -> `wss://radar.example:5001/ws`
- `location.host = 'localhost'` (no port), `protocol = 'http:'` -> `ws://localhost/ws`

Stub `location` via `Object.defineProperty(window, 'location', ...)` per test. The WS_URL must be evaluated lazily (function or getter) so each test sees its own stub. If keeping it as a module-level `const` is preferred, the test imports a `buildWsUrl(location)` helper instead.

Recommendation: refactor to `export function buildWsUrl(loc = window.location)` for testability. The module then calls `buildWsUrl()` at connect time.

## Sub-project B — Minimal mobile responsive

### B.1 Audit (Step 1)

Use Playwright (already in devDependencies) at viewport 375x667 to load each of the seven pages on the locally running server:

1. `/` (radar)
2. `/players`
3. `/resources`
4. `/enemies`
5. `/chests`
6. `/ignorelist`
7. `/settings`

For each page, capture:
- A screenshot
- A list of detected breaks: horizontal scrollbar, elements with `scrollWidth > clientWidth`, controls clipped by viewport, canvas with fixed width that exceeds viewport, formulaires with `md:col-span-2` that don't break correctly

### B.2 Report-to-user (Step 2)

Mid-implementation message to the user with the audit list. Format:

```
Page: <name>
- [break 1] - severity high / medium / low
- [break 2] - ...
```

Wait for user to confirm scope ("fix all", "fix only high-severity", "fix these specific items, defer the rest to IMPROVEMENTS.md") before patching.

### B.3 Minimal patch (Step 3)

Apply the smallest possible Tailwind utility additions to each broken page:
- `<canvas>` containers: add `w-full h-auto max-w-full` and let `CanvasManager` handle the resize-on-orientation-change loop (already in place).
- Settings forms with `md:col-span-2`: verify they collapse to single column at `< md` breakpoint. If they don't (e.g. parent grid is `grid-cols-2` instead of `grid-cols-1 md:grid-cols-2`), patch.
- Header `wsStatusIndicator` and PiP button: already use `hidden sm:inline` for the text label. Verify icon-only mode is reachable.
- Stats overlay on the radar: position must not be `fixed` outside the viewport.

No new CSS files, no new Tailwind config changes, no DaisyUI component swaps. Reuse existing utility classes.

### B.4 Re-audit (Step 4)

Re-run the same Playwright pass after patching. Confirm every break in the validated list is fixed. Anything still broken or out of scope per user decision goes to `docs/project/IMPROVEMENTS.md` with a one-line entry: `- mobile portrait: <break> on <page>` (no further detail).

## Files modified

### Sub-project A (3 files + 1 new)

- `web/scripts/core/WebSocketManager.js` (refactor to `buildWsUrl`)
- `web/scripts/logger.js` (use same helper or inline pattern)
- `cmd/radar/main.go` (startup banner)
- `web/scripts/core/_WebSocketManager.test.js` (new, Vitest)

### Sub-project B (variable, depends on audit)

Files touched will be a subset of:
- `internal/templates/pages/radar.gohtml`
- `internal/templates/pages/players.gohtml`
- `internal/templates/pages/resources.gohtml`
- `internal/templates/pages/enemies.gohtml`
- `internal/templates/pages/chests.gohtml`
- `internal/templates/pages/ignorelist.gohtml`
- `internal/templates/pages/settings.gohtml`

Plus possibly `internal/templates/layouts/header.gohtml` if the header overflows.

### Doc

- `docs/project/IMPROVEMENTS.md` (deferred mobile items, if any)

## Tests

- Vitest: new `_WebSocketManager.test.js`. Existing 482 tests must remain green.
- Go: no new tests required (banner change is a `Printf`, not behaviour).
- Playwright: audit + re-audit are manual one-shots, not committed regression tests. A future plan could add a committed Playwright responsive regression suite (out of scope here).
- Live test: start the binary, open the LAN URL on a phone, confirm the radar loads, the WebSocket connects, and an injected entity appears.

## Verification gate

Before pushing:
- `npm test` green
- `npm run lint` clean
- `make lint` clean (golangci-lint v2.11.4, gofmt strict)
- `go build ./...` succeeds
- Manual phone test (LAN URL works end to end)
- Re-audit Playwright shows the validated break list as fixed

## PR shape

- Branch: `feat/83-lan-connect-and-responsive` (created from `main`)
- Commit 1: `feat(83): WS URL + startup banner LAN-aware`
- Commit 2: `feat(83): minimal mobile responsive on broken pages`
- Single PR, body lists the audit findings and the patches applied
- Closes #83

## Risks

- A.1: if a future deployment serves the page over a reverse proxy with a different path or scheme, the helper handles that automatically (uses `location` as source of truth). Lower risk than hardcoded.
- A.2: `app.adapterIP` could in theory be a non-routable interface for the user (e.g. WSL bridge on Windows). Mitigation: the localhost line is always printed too, and the user can fall back to `ipconfig` if the announced LAN URL doesn't work. Document in a one-line note in the PR body.
- B.3: minimal patches may not match a future visual designer's preferences. Mitigation: scope is explicitly "make it usable", not "make it pretty". Designer pass is its own future plan.

# Pre-bump Baseline Capture

Captured on 2026-04-12 before running the Release CI/CD Automation plan.
This file is the reference state against which later tasks compare.
Branch: `feat/revival`. HEAD at capture time: `af064cf64586bd9ca6f3376ffcd995a10d86f7dd`.

## Go toolchain

    go env GOVERSION: go1.26.2

## go.mod

```
module github.com/nospy/albion-openradar

go 1.26

require (
	github.com/charmbracelet/bubbles v1.0.0
	github.com/charmbracelet/bubbletea v1.3.10
	github.com/charmbracelet/lipgloss v1.1.0
	github.com/fatih/color v1.19.0
	github.com/google/gopacket v1.1.19
	github.com/gorilla/websocket v1.5.3
	github.com/segmentio/encoding v0.5.4
)

require (
	github.com/atotto/clipboard v0.1.4 // indirect
	github.com/aymanbagabas/go-osc52/v2 v2.0.1 // indirect
	github.com/charmbracelet/colorprofile v0.4.3 // indirect
	github.com/charmbracelet/x/ansi v0.11.6 // indirect
	github.com/charmbracelet/x/cellbuf v0.0.15 // indirect
	github.com/charmbracelet/x/term v0.2.2 // indirect
	github.com/clipperhouse/displaywidth v0.11.0 // indirect
	github.com/clipperhouse/uax29/v2 v2.7.0 // indirect
	github.com/erikgeiser/coninput v0.0.0-20211004153227-1c3628e74d0f // indirect
	github.com/lucasb-eyer/go-colorful v1.4.0 // indirect
	github.com/mattn/go-colorable v0.1.14 // indirect
	github.com/mattn/go-isatty v0.0.21 // indirect
	github.com/mattn/go-localereader v0.0.1 // indirect
	github.com/mattn/go-runewidth v0.0.23 // indirect
	github.com/muesli/ansi v0.0.0-20230316100256-276c6243b2f6 // indirect
	github.com/muesli/cancelreader v0.2.2 // indirect
	github.com/muesli/termenv v0.16.0 // indirect
	github.com/rivo/uniseg v0.4.7 // indirect
	github.com/segmentio/asm v1.2.1 // indirect
	github.com/xo/terminfo v0.0.0-20220910002029-abceb7e1c41e // indirect
	golang.org/x/net v0.53.0 // indirect
	golang.org/x/sys v0.43.0 // indirect
	golang.org/x/text v0.36.0 // indirect
)
```

`go.sum` total length: 80 lines.

## go.sum header (first 20 lines)

```
github.com/atotto/clipboard v0.1.4 h1:EH0zSVneZPSuFR11BlR9YppQTVDbh5+16AmcJi4g1z4=
github.com/atotto/clipboard v0.1.4/go.mod h1:ZY9tmq7sm5xIbd9bOK4onWV4S6X0u6GY7Vn0Yu86PYI=
github.com/aymanbagabas/go-osc52/v2 v2.0.1 h1:HwpRHbFMcZLEVr42D4p7XBqjyuxQH5SMiErDT4WkJ2k=
github.com/aymanbagabas/go-osc52/v2 v2.0.1/go.mod h1:uYgXzlJ7ZpABp8OJ+exZzJJhRNQ2ASbcXHWsFqH8hp8=
github.com/charmbracelet/bubbles v1.0.0 h1:12J8/ak/uCZEMQ6KU7pcfwceyjLlWsDLAxB5fXonfvc=
github.com/charmbracelet/bubbles v1.0.0/go.mod h1:9d/Zd5GdnauMI5ivUIVisuEm3ave1XwXtD1ckyV6r3E=
github.com/charmbracelet/bubbletea v1.3.10 h1:otUDHWMMzQSB0Pkc87rm691KZ3SWa4KUlvF9nRvCICw=
github.com/charmbracelet/bubbletea v1.3.10/go.mod h1:ORQfo0fk8U+po9VaNvnV95UPWA1BitP1E0N6xJPlHr4=
github.com/charmbracelet/colorprofile v0.4.3 h1:QPa1IWkYI+AOB+fE+mg/5/4HRMZcaXex9t5KX76i20Q=
github.com/charmbracelet/colorprofile v0.4.3/go.mod h1:/zT4BhpD5aGFpqQQqw7a+VtHCzu+zrQtt1zhMt9mR4Q=
github.com/charmbracelet/lipgloss v1.1.0 h1:vYXsiLHVkK7fp74RkV7b2kq9+zDLoEU4MZoFqR/noCY=
github.com/charmbracelet/lipgloss v1.1.0/go.mod h1:/6Q8FR2o+kj8rz4Dq0zQc3vYf7X+B0binUUBwA0aL30=
github.com/charmbracelet/x/ansi v0.11.6 h1:GhV21SiDz/45W9AnV2R61xZMRri5NlLnl6CVF7ihZW8=
github.com/charmbracelet/x/ansi v0.11.6/go.mod h1:2JNYLgQUsyqaiLovhU2Rv/pb8r6ydXKS3NIttu3VGZQ=
github.com/charmbracelet/x/cellbuf v0.0.15 h1:ur3pZy0o6z/R7EylET877CBxaiE1Sp1GMxoFPAIztPI=
github.com/charmbracelet/x/cellbuf v0.0.15/go.mod h1:J1YVbR7MUuEGIFPCaaZ96KDl5NoS0DAWkskup+mOY+Q=
github.com/charmbracelet/x/term v0.2.2 h1:xVRT/S2ZcKdhhOuSP4t5cLi5o+JxklsoEObBSgfgZRk=
github.com/charmbracelet/x/term v0.2.2/go.mod h1:kF8CY5RddLWrsgVwpw4kAa6TESp6EB5y3uxGLeCqzAI=
github.com/clipperhouse/displaywidth v0.11.0 h1:lBc6kY44VFw+TDx4I8opi/EtL9m20WSEFgwIwO+UVM8=
github.com/clipperhouse/displaywidth v0.11.0/go.mod h1:bkrFNkf81G8HyVqmKGxsPufD3JhNl3dSqnGhOoSD/o0=
```

## package.json

```json
{
  "name": "albion-openradar",
  "version": "2.0.0",
  "description": "OpenRadar - Real-time radar for Albion Online (Go Backend)",
  "private": true,
  "type": "module",
  "scripts": {
    "css": "tailwindcss -i web/styles/input.css -o web/styles/tailwind.css --minify",
    "css:watch": "tailwindcss -i web/styles/input.css -o web/styles/tailwind.css --watch",
    "vendors:js": "cpy node_modules/lucide/dist/umd/lucide.min.js node_modules/htmx.org/dist/htmx.min.js web/scripts/vendors --flat",
    "vendors:fonts": "cpy \"node_modules/@fontsource/jetbrains-mono/files/jetbrains-mono-latin-{400,500}-normal.woff2\" \"node_modules/@fontsource/space-grotesk/files/space-grotesk-latin-{400,500,700}-normal.woff2\" web/styles/fonts --flat",
    "vendors": "npm run vendors:js && npm run vendors:fonts",
    "build": "npm run css && npm run vendors",
    "update-data": "tsx tools/update-ao-data.ts --replace-existing",
    "download-icons": "tsx tools/download-and-optimize-item-icons.ts",
    "download-spells": "tsx tools/download-and-optimize-spell-icons.ts",
    "download-map": "tsx tools/download-and-optimize-map.ts",
    "download-assets": "npm run download-icons && npm run download-spells && npm run download-map",
    "update-assets": "npm run update-data && npm run download-assets",
    "compress:data": "node tools/compress-game-data.js",
    "postbuild": "node tools/post-build.js",
    "lint": "eslint web/scripts/ internal/templates/ tools/",
    "lint:fix": "eslint web/scripts/ internal/templates/ tools/ --fix",
    "typecheck": "tsc --noEmit"
  },
  "author": "Nospy",
  "license": "ISC",
  "engines": {
    "node": ">=20.0.0"
  },
  "devDependencies": {
    "@eslint/js": "^9.39.1",
    "@fontsource/jetbrains-mono": "^5.2.8",
    "@fontsource/space-grotesk": "^5.2.10",
    "@tailwindcss/cli": "^4.0.0",
    "archiver": "^7.0.1",
    "cpy-cli": "^6.0.0",
    "daisyui": "^5.0.0",
    "eslint": "^9.39.1",
    "eslint-plugin-html": "^8.1.3",
    "eslint-plugin-import": "^2.32.0",
    "globals": "^16.5.0",
    "htmx.org": "^2.0.8",
    "lucide": "^0.562.0",
    "puppeteer": "^24.31.0",
    "puppeteer-extra": "^3.3.6",
    "puppeteer-extra-plugin-stealth": "^2.11.2",
    "puppeteer-real-browser": "^1.4.4",
    "sharp": "^0.33.5",
    "tailwindcss": "^4.0.0",
    "tsx": "^4.20.6",
    "typescript": "^5.9.3",
    "typescript-eslint": "^8.50.0"
  }
}
```

## package-lock.json

    sha256: 7c9ac689183353356aa780938fea2b6697def906fb6717cf7a7757e6a983abc6

## Dockerfile.build base image

    FROM golang:1.26-bookworm AS builder

(Second stage uses `FROM scratch` for the final image.)

## GitHub Actions versions

`.github/workflows/ci.yml`:

```
actions/checkout@v4
actions/setup-go@v5
actions/setup-node@v4
golangci/golangci-lint-action@v7
```

`.github/workflows/release.yml`:

```
actions/checkout@v4
actions/setup-node@v4
docker/setup-buildx-action@v3
docker/build-push-action@v6
actions/upload-artifact@v4
actions/checkout@v4
actions/setup-go@v5
actions/setup-node@v4
actions/upload-artifact@v4
actions/checkout@v4
actions/setup-node@v4
actions/download-artifact@v4
actions/download-artifact@v4
softprops/action-gh-release@v2
```

## Standard baseline results

### go build ./...

    exit: 0
    notes: clean build, no output

### go vet ./...

    exit: 0
    notes: clean, no warnings

### go test -v ./...

    exit: 0
    notes: zero test files in any package, all packages report `[no test files]`

### golangci-lint run ./...

    exit: 3
    notes: locally installed binary built against go1.25, refuses to run on go1.26 module. Treated as recorded incompatibility, not a project failure. CI uses golangci-lint-action@v7 which pins its own version.

### npm run lint

    exit: 0
    notes: eslint clean over web/scripts, internal/templates, tools

### npm run css

    exit: 0
    notes: tailwindcss v4.1.18 plus daisyUI 5.5.14, one warning about `@property --radialprogress` (unknown at-rule), output written to web/styles/tailwind.css

### npm run vendors

    exit: 0
    notes: copies lucide, htmx, and font files, no errors

### make all-in-one

    exit: 2
    artifacts produced: none, dist/ directory does not exist after the failure
    notes: goreleaser snapshot reached the docker hook, then failed with `failed to connect to the docker API at npipe:////./pipe/dockerDesktopLinuxEngine`. Docker Desktop Linux engine not running. All earlier hooks (npm install, css, vendors, compress-game-data, go mod tidy) completed successfully and mutated the working tree (asset files and go.sum). Per task instructions this Docker failure is recorded and not treated as a baseline blocker.

## Summary

Project is in a clean buildable state on `feat/revival` at commit `af064cf6`. Go build, vet, tests, eslint, tailwind css, and vendor copy all succeed. Two non-blocking gaps are recorded for later tasks: the locally installed golangci-lint is built against go1.25 and cannot lint a go1.26 module (CI is unaffected since it uses golangci-lint-action), and `make all-in-one` cannot finish locally without a running Docker Desktop Linux engine. The bump plan can proceed.

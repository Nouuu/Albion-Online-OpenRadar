# GitHub Actions CI/CD Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add GitHub Actions workflows for CI (lint/test on PRs) and Release (build + publish on tags).

**Architecture:** Two workflows - `ci.yml` runs on PR/push to main (lint, test, build check), `release.yml` runs on semver tags or manual dispatch with two parallel build jobs (Linux via Docker, Windows native) then assembles release.

**Tech Stack:** GitHub Actions, Docker Buildx, GoReleaser concepts (but manual steps for cross-platform)

**Constraints:** 
- MUST NOT break existing `Makefile` workflows (`make all-in-one`, `make release`)
- MUST NOT modify `.goreleaser.yml` behavior
- Tags without `v` prefix (e.g., `2.2.0` not `v2.2.0`)

---

## Task 1: Create CI Workflow

**Files:**
- Create: `.github/workflows/ci.yml`

**Step 1: Create the workflow file**

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  lint-and-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - uses: actions/setup-go@v5
        with:
          go-version-file: 'go.mod'
          cache: true
      
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - run: npm ci
      
      - name: Lint Go
        uses: golangci/golangci-lint-action@v6
        with:
          version: latest
      
      - name: Lint Frontend
        run: npm run lint
      
      - name: Test Go
        run: go test -v ./...
      
      - name: Build Check (Linux)
        run: go build -o /dev/null ./cmd/radar
        env:
          CGO_ENABLED: '0'
      
      - name: Build Check (Windows cross-compile)
        run: GOOS=windows GOARCH=amd64 go build -o /dev/null ./cmd/radar
        env:
          CGO_ENABLED: '0'
```

**Step 2: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add CI workflow for lint, test, and build check"
```

---

## Task 2: Create Release Workflow

**Files:**
- Create: `.github/workflows/release.yml`

**Step 1: Create the workflow file**

```yaml
name: Release

on:
  push:
    tags:
      - '[0-9]+.[0-9]+.[0-9]+*'
  workflow_dispatch:
    inputs:
      tag:
        description: 'Tag to release (e.g., 2.2.0)'
        required: true
        type: string

concurrency:
  group: release-${{ github.ref_name }}
  cancel-in-progress: false

env:
  VERSION: ${{ github.event.inputs.tag || github.ref_name }}

jobs:
  # ═══════════════════════════════════════════════════════════════
  # Build Linux binary via Docker (CGO + libpcap)
  # ═══════════════════════════════════════════════════════════════
  build-linux:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - run: npm ci
      
      # ─── Prepare assets (same as .goreleaser.yml before.hooks) ───
      - name: Update AO data
        run: npx tsx tools/update-ao-data.ts --replace-existing
      
      - name: Build CSS
        run: npm run css
      
      - name: Copy vendors
        run: npm run vendors
      
      - name: Compress game data
        run: npx tsx tools/compress-game-data.ts web/ao-bin-dumps --delete-originals
      
      # ─── Docker build with cache ───
      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3
      
      - name: Build Linux binary
        uses: docker/build-push-action@v6
        with:
          context: .
          file: Dockerfile.build
          outputs: type=local,dest=dist-build
          cache-from: type=gha
          cache-to: type=gha,mode=max
          build-args: |
            VERSION=${{ env.VERSION }}
            BUILD_TIME=${{ github.event.head_commit.timestamp || github.event.repository.updated_at }}
      
      - name: Rename binary
        run: mv dist-build/OpenRadar-linux dist-build/OpenRadar-linux-amd64
      
      - name: Upload Linux binary
        uses: actions/upload-artifact@v4
        with:
          name: linux-binary
          path: dist-build/OpenRadar-linux-amd64
          retention-days: 1

  # ═══════════════════════════════════════════════════════════════
  # Build Windows binary natively (CGO + Npcap SDK)
  # ═══════════════════════════════════════════════════════════════
  build-windows:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4
      
      - uses: actions/setup-go@v5
        with:
          go-version-file: 'go.mod'
          cache: true
      
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - run: npm ci
      
      # ─── Prepare assets ───
      - name: Update AO data
        run: npx tsx tools/update-ao-data.ts --replace-existing
      
      - name: Build CSS
        run: npm run css
      
      - name: Copy vendors
        run: npm run vendors
      
      - name: Compress game data
        run: npx tsx tools/compress-game-data.ts web/ao-bin-dumps --delete-originals
      
      - run: go mod tidy
      
      # ─── Windows resources (icon + version info) ───
      - name: Install goversioninfo
        run: go install github.com/josephspurrier/goversioninfo/cmd/goversioninfo@latest
      
      - name: Generate version info
        shell: pwsh
        run: |
          $version = "${{ env.VERSION }}"
          $parts = $version -split '[.\-]'
          $major = if ($parts[0] -match '^\d+$') { [int]$parts[0] } else { 0 }
          $minor = if ($parts.Length -gt 1 -and $parts[1] -match '^\d+$') { [int]$parts[1] } else { 0 }
          $patch = if ($parts.Length -gt 2 -and $parts[2] -match '^\d+$') { [int]$parts[2] } else { 0 }
          
          $json = @{
            FixedFileInfo = @{
              FileVersion = @{ Major = $major; Minor = $minor; Patch = $patch; Build = 0 }
              ProductVersion = @{ Major = $major; Minor = $minor; Patch = $patch; Build = 0 }
            }
            StringFileInfo = @{
              FileDescription = "OpenRadar - Albion Online Radar"
              FileVersion = $version
              ProductName = "OpenRadar"
              ProductVersion = $version
              LegalCopyright = "MIT License"
            }
            IconPath = "../../web/images/favicon.ico"
          } | ConvertTo-Json -Depth 10
          
          $json | Out-File -FilePath cmd/radar/versioninfo.json -Encoding UTF8
      
      - name: Generate Windows resources
        run: goversioninfo -64
        working-directory: cmd/radar
      
      # ─── Build ───
      - name: Build Windows binary
        shell: pwsh
        run: |
          $env:CGO_ENABLED = "1"
          $buildTime = Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ"
          go build -ldflags="-s -w -X main.Version=${{ env.VERSION }} -X main.BuildTime=$buildTime" -o dist-build/OpenRadar-windows-amd64.exe ./cmd/radar
      
      - name: Upload Windows binary
        uses: actions/upload-artifact@v4
        with:
          name: windows-binary
          path: dist-build/OpenRadar-windows-amd64.exe
          retention-days: 1

  # ═══════════════════════════════════════════════════════════════
  # Assemble release artifacts and create GitHub Release (draft)
  # ═══════════════════════════════════════════════════════════════
  create-release:
    needs: [build-linux, build-windows]
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - run: npm ci
      
      # ─── Download build artifacts ───
      - name: Download Linux binary
        uses: actions/download-artifact@v4
        with:
          name: linux-binary
          path: dist
      
      - name: Download Windows binary
        uses: actions/download-artifact@v4
        with:
          name: windows-binary
          path: dist
      
      # ─── Generate READMEs ───
      - name: Generate READMEs
        run: npx tsx tools/generate-readmes.ts --output-dir=dist --version=${{ env.VERSION }}
      
      # ─── Generate checksums ───
      - name: Generate checksums
        working-directory: dist
        run: sha256sum OpenRadar-linux-amd64 OpenRadar-windows-amd64.exe README-linux.txt README-windows.txt > checksums-sha256.txt
      
      # ─── List final artifacts ───
      - name: List artifacts
        run: ls -la dist/
      
      # ─── Create GitHub Release (draft) ───
      - name: Create Release
        uses: softprops/action-gh-release@v2
        with:
          tag_name: ${{ env.VERSION }}
          name: "Release ${{ env.VERSION }}"
          draft: true
          generate_release_notes: true
          files: |
            dist/OpenRadar-linux-amd64
            dist/OpenRadar-windows-amd64.exe
            dist/README-linux.txt
            dist/README-windows.txt
            dist/checksums-sha256.txt
          body: |
            ## OpenRadar v${{ env.VERSION }}
            
            Real-time radar for Albion Online.
            
            ### Verification
            
            ```bash
            sha256sum -c checksums-sha256.txt
            ```
            
            ### Requirements
            
            **Windows:** Windows 10/11 (64-bit), [Npcap 1.84+](https://npcap.com/)
            
            **Linux:** libpcap (`apt install libpcap0.8`)
            
            ---
            
            **Note:** Edit this draft to add detailed release notes before publishing.
```

**Step 2: Commit**

```bash
git add .github/workflows/release.yml
git commit -m "ci: add Release workflow with parallel Linux/Windows builds"
```

---

## Task 3: Create workflows directory

**Files:**
- Create: `.github/workflows/` directory (if not exists)

**Step 1: Ensure directory exists**

The directory will be created when writing the workflow files.

---

## Task 4: Test CI workflow locally (validation)

**Step 1: Verify lint commands work**

```bash
npm run lint
golangci-lint run ./...
go test -v ./...
```

**Step 2: Verify build check works**

```bash
CGO_ENABLED=0 go build -o /dev/null ./cmd/radar
```

---

## Task 5: Validate Makefile still works

**Step 1: Run make help**

```bash
make help
```

Expected: Shows all targets including `all-in-one`, `release`, etc.

**Step 2: Verify no changes to Makefile**

```bash
git diff Makefile
```

Expected: No changes

**Step 3: Verify no changes to .goreleaser.yml**

```bash
git diff .goreleaser.yml
```

Expected: No changes

---

## Acceptance Criteria

1. [ ] `.github/workflows/ci.yml` exists and is valid YAML
2. [ ] `.github/workflows/release.yml` exists and is valid YAML
3. [ ] CI workflow triggers on PR to main
4. [ ] CI workflow triggers on push to main
5. [ ] Release workflow triggers on semver tags (without v prefix)
6. [ ] Release workflow can be triggered manually
7. [ ] `Makefile` unchanged and `make help` works
8. [ ] `.goreleaser.yml` unchanged
9. [ ] Local lint/test commands still work

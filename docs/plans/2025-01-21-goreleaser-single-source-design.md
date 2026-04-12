# GoReleaser as Single Source of Truth

**Date:** 2025-01-21
**Status:** Completed

## Problem Statement

Current build system has fragmentation:
- Multiple output directories: `dist/`, `dist-linux/`, `dist-readme/`
- Resources not restored after build (compressed `.gz` files remain)
- Duplication between `make all-in-one` and `goreleaser release`
- No single source of truth for the build process

## Goals

1. **Single `dist/` folder** with exactly 5 files:
   - `OpenRadar-windows-amd64.exe`
   - `OpenRadar-linux-amd64`
   - `README-windows.txt`
   - `README-linux.txt`
   - `checksums-sha256.txt`

2. **Proper cleanup** after build:
   - Restore original (uncompressed) data files
   - Clean intermediate build artifacts

3. **GoReleaser as source of truth**:
   - `make all-in-one` calls `goreleaser release --snapshot`
   - `make release` calls `goreleaser release` (for tagged releases)
   - Same workflow, same output, everywhere

## Design

### Architecture

```
goreleaser release --snapshot --clean
    │
    ├── before.hooks (preparation)
    │   ├── Update AO data files
    │   ├── npm install + css + vendors
    │   ├── Compress game data
    │   ├── go mod tidy
    │   ├── Docker build for Linux → dist/OpenRadar-linux-amd64
    │   └── Generate READMEs → dist/README-*.txt
    │
    ├── builds (Windows only - native CGO)
    │   └── Windows binary → dist/OpenRadar-windows-amd64.exe
    │
    ├── archives (binary format - no zip)
    │   └── Copies binary as-is
    │
    ├── checksum
    │   └── dist/checksums-sha256.txt
    │
    └── release (GitHub - only for tagged releases)
        └── Uploads all 5 files
```

### Key Changes

#### 1. GoReleaser Configuration (`.goreleaser.yml`)

- Docker outputs directly to `dist/` (not `dist-linux/`)
- README generation outputs to `dist/` (not `dist-readme/`)
- Use `dist` as the single output directory
- Binary archive format (no zip)

#### 2. Makefile Updates

```makefile
# Old approach (removed)
all-in-one: update-ao-data npm css vendors compress build-win build-linux package

# New approach
all-in-one: ## Complete build via GoReleaser snapshot
	goreleaser release --snapshot --clean --skip=publish
	@$(MAKE) restore-data
	@$(MAKE) clean-goreleaser-artifacts

release: ## Create GitHub release
	goreleaser release --clean
	@$(MAKE) restore-data
```

#### 3. New Cleanup Target

```makefile
clean-goreleaser-artifacts: ## Remove intermediate GoReleaser files
	# Remove everything except the 5 final files
	# Keep: OpenRadar-windows-amd64.exe, OpenRadar-linux-amd64,
	#       README-windows.txt, README-linux.txt, checksums-sha256.txt
```

#### 4. Docker Build Output

Change `Dockerfile.build` output to use consistent naming:
- Output: `dist/OpenRadar-linux-amd64` (directly in dist/)

### Acceptance Criteria

1. [x] `make release-snapshot` produces exactly 5 files in `dist/`
2. [x] No intermediate directories (`dist-linux/`, `dist-readme/`) remain
3. [x] Resources restored (no `.gz` files, original JSON present)
4. [x] `make all-in-one` uses GoReleaser (same workflow as release-snapshot)
5. [x] Checksums file contains hashes for both binaries
6. [x] Both binaries are functional (correct architecture, embedded assets)

### Files Modified

| File | Changes |
|------|---------|
| `.goreleaser.yml` | Updated to output to `dist-build/` temp dir, snapshot uses branch-commit version |
| `Makefile` | `all-in-one` uses goreleaser, new `clean-goreleaser-intermediate` target |
| `tools/post-build.js` | Updated README filenames to `README-windows.txt` and `README-linux.txt` |
| `tools/consolidate-dist.ps1` | NEW: Consolidates artifacts and regenerates checksums |

## Implementation Summary

All acceptance criteria verified:
- `make all-in-one` and `make release-snapshot` both produce exactly 5 files in `dist/`
- GoReleaser is now the single source of truth for builds
- Resources are properly restored after build
- Checksums are regenerated with correct hashes for final binaries

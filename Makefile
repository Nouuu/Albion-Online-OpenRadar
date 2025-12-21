# ============================================
# OpenRadar - Makefile (Go Backend v2.0)
# ============================================
# Usage: make [target]
# Requires: Go 1.25+, Npcap 1.84+ (Windows) or libpcap (Linux)
# ============================================

.PHONY: help dev run all-in-one clean clean-goreleaser-intermediate \
        test lint lint-go lint-frontend lint-fix \
        install-tools check release release-snapshot \
        update-ao-data download-assets update-assets restore-data css css-watch vendors

# Variables - Dynamic version from Git
# If on a tag: use tag name (strip 'v' prefix if present)
# Otherwise: branch-commitshort
GIT_TAG := $(shell git describe --tags --exact-match 2>nul)
GIT_BRANCH := $(shell git rev-parse --abbrev-ref HEAD 2>nul || echo "unknown")
GIT_COMMIT := $(shell git rev-parse --short HEAD 2>nul || echo "unknown")
VERSION := $(if $(GIT_TAG),$(patsubst v%,%,$(GIT_TAG)),$(GIT_BRANCH)-$(GIT_COMMIT))
# Windows-compatible: use PowerShell for date, fallback to static if not available
BUILD_TIME := $(shell powershell -NoProfile -Command "Get-Date -Format 'yyyy-MM-ddTHH:mm:ssZ'" 2>nul || echo "unknown")
BUILD_DIR := dist
BINARY_NAME := OpenRadar
GO := go
LDFLAGS := -ldflags="-s -w -X main.Version=$(VERSION) -X main.BuildTime=$(BUILD_TIME)"

# Default target
.DEFAULT_GOAL := help

help: ## Display help
	@echo ""
	@echo "OpenRadar v$(VERSION) - Go Backend"
	@echo "=================================="
	@echo ""
	@echo "Development:"
	@echo "  dev              Run with hot-reload (requires air)"
	@echo "  run              Run without hot-reload"
	@echo "  css              Build Tailwind CSS"
	@echo "  css-watch        Watch and rebuild Tailwind CSS"
	@echo "  vendors          Copy vendor libraries (JS + fonts)"
	@echo ""
	@echo "Build (GoReleaser - single source of truth):"
	@echo "  all-in-one       Complete build via GoReleaser (5 files in dist/)"
	@echo "  release-snapshot Same as all-in-one, for testing"
	@echo "  release          Create GitHub release (requires git tag)"
	@echo ""
	@echo "Quality:"
	@echo "  lint             Lint all code (Go + Frontend)"
	@echo "  lint-fix         Lint and auto-fix all code"
	@echo "  test             Run Go tests"
	@echo ""
	@echo "Data:"
	@echo "  update-ao-data   Update Albion Online data files"
	@echo "  restore-data     Restore original data (after build)"
	@echo ""
	@echo "Utilities:"
	@echo "  clean            Clean build artifacts"
	@echo "  check            Check system requirements"
	@echo "  install-tools    Install dev tools (air, golangci-lint, goreleaser)"
	@echo ""

# ============================================
# Development
# ============================================

dev: css vendors ## Run with hot-reload (requires air)
	@echo "Starting dev server with hot-reload..."
	air

run: css vendors ## Run without hot-reload
	@echo "Starting OpenRadar..."
	$(GO) run ./cmd/radar -dev

css: ## Build Tailwind CSS
	@echo "Building Tailwind CSS..."
	@npm run css

css-watch: ## Watch and rebuild Tailwind CSS
	@echo "Watching Tailwind CSS..."
	@npm run css:watch

vendors: ## Copy vendor libraries (JS + fonts)
	@echo "Copying vendor libraries..."
	@npm run vendors

# ============================================
# Build (GoReleaser is the single source of truth)
# ============================================

all-in-one: ## Complete build via GoReleaser (single source of truth)
	@echo "=========================================="
	@echo "  OpenRadar - Complete Build (GoReleaser)"
	@echo "=========================================="
	@echo ""
	@echo "Using GoReleaser as single source of truth..."
	@echo "This ensures identical builds locally and in CI."
	@echo ""
	goreleaser release --snapshot --clean --skip=publish
	@echo ""
	@echo "Cleaning up intermediate files..."
	@$(MAKE) clean-goreleaser-intermediate
	@echo ""
	@echo "Restoring original data files..."
	@$(MAKE) restore-data
	@echo ""
	@echo "=========================================="
	@echo "  Build complete! Check dist/ folder"
	@echo "=========================================="
	@echo ""
	@echo "Final artifacts (5 files):"
	@dir /b dist 2>nul || ls dist 2>/dev/null
	@echo ""

# ============================================
# Data & Assets Management
# ============================================

update-ao-data: ## Update Albion Online data files
	@echo "Updating AO data files..."
	@npx tsx tools/update-ao-data.ts --replace-existing

download-assets: ## Download required assets (icons, maps)
	@echo "Downloading assets..."
	@npx tsx tools/download-and-optimize-spell-icons.ts
	@npx tsx tools/download-and-optimize-item-icons.ts
	@npx tsx tools/download-and-optimize-map.ts

update-assets: update-ao-data download-assets ## Update all assets

restore-data: ## Restore original data files (removes .gz, re-downloads originals)
	@echo "Restoring original data files..."
	@powershell -Command "Remove-Item -Path 'web/ao-bin-dumps/*.gz' -Force -ErrorAction SilentlyContinue"
	@$(MAKE) update-ao-data
	@echo "Data files restored!"

# ============================================
# Utilities
# ============================================

clean: ## Clean build artifacts
	@echo "Cleaning..."
	-@rmdir /s /q $(BUILD_DIR) 2>nul
	-@rmdir /s /q tmp 2>nul
	-@del /q *.exe ip.txt nul VERSION 2>nul
	@echo "Clean complete"

clean-goreleaser-intermediate: ## Consolidate all artifacts into dist/ with exactly 5 files
	@npx tsx tools/consolidate-dist.ts

test: ## Run Go tests
	$(GO) test -v ./...

lint: lint-go lint-frontend ## Lint all code (Go + Frontend)

lint-go: ## Lint Go code (golangci-lint)
	@golangci-lint run ./...

lint-go-fix: ## Lint and auto-fix Go code
	@golangci-lint run --fix ./...

lint-frontend: ## Lint frontend code (ESLint)
	@npm run lint

lint-frontend-fix: ## Lint and auto-fix frontend code
	@npm run lint:fix

lint-fix: lint-go-fix lint-frontend-fix ## Lint and fix all code

install-tools: ## Install development tools (air, golangci-lint v2, goreleaser)
	@echo "Installing development tools..."
	$(GO) install github.com/air-verse/air@latest
	$(GO) install github.com/golangci/golangci-lint/v2/cmd/golangci-lint@latest
	$(GO) install github.com/goreleaser/goreleaser/v2@latest
	@echo "Tools installed: air, golangci-lint v2, goreleaser"

release: ## Create GitHub release with goreleaser (requires git tag)
	@echo "=========================================="
	@echo "  OpenRadar - GitHub Release (GoReleaser)"
	@echo "=========================================="
	@echo ""
	@echo "Note: Ensure you have created and pushed a git tag first"
	@echo "  git tag -a v1.0.0 -m 'Release v1.0.0'"
	@echo "  git push origin v1.0.0"
	@echo ""
	goreleaser release --clean
	@echo ""
	@echo "Restoring original data files..."
	@$(MAKE) restore-data
	@echo ""
	@echo "Release complete!"

release-snapshot: ## Test release locally (dry-run, no publish)
	@echo "=========================================="
	@echo "  OpenRadar - Snapshot Test (GoReleaser)"
	@echo "=========================================="
	@echo ""
	goreleaser release --snapshot --clean --skip=publish
	@echo ""
	@echo "Cleaning up intermediate files..."
	@$(MAKE) clean-goreleaser-intermediate
	@echo ""
	@echo "Restoring original data files..."
	@$(MAKE) restore-data
	@echo ""
	@echo "=========================================="
	@echo "  Snapshot complete! Check dist/ folder"
	@echo "=========================================="
	@echo ""
	@echo "Final artifacts (5 files):"
	@dir /b dist 2>nul || ls dist 2>/dev/null
	@echo ""

check: ## Check system requirements
	@echo "Checking Go installation..."
	@$(GO) version
	@echo ""
	@echo "Checking air (for hot-reload)..."
	-@air -v
	@echo ""

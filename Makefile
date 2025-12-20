# ============================================
# OpenRadar - Makefile (Go Backend v2.0)
# ============================================
# Usage: make [target]
# Requires: Go 1.25+, Npcap 1.84+ (Windows) or libpcap (Linux)
# ============================================

.PHONY: help dev run build build-win build-linux build-all \
        package package-win all-in-one clean test lint install-tools check \
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
	@echo "Build:"
	@echo "  build-win        Build for Windows"
	@echo "  build-linux      Build for Linux (Docker)"
	@echo "  build-all        Build Win + Linux"
	@echo ""
	@echo "Release:"
	@echo "  all-in-one       Complete build (all platforms + package)"
	@echo "  package          Build + package for distribution"
	@echo ""
	@echo "Data:"
	@echo "  update-ao-data   Update Albion Online data files"
	@echo "  restore-data     Restore original data (after build)"
	@echo ""
	@echo "Utilities:"
	@echo "  clean            Clean build artifacts"
	@echo "  check            Check system requirements"
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
# Build
# ============================================

build: build-win ## Build for current platform (default: Windows)

build-win: ## Build for Windows
	@echo "Building for Windows..."
	-@mkdir $(BUILD_DIR) 2>nul
	@echo "Generating versioninfo.json with version $(VERSION)..."
	@node -e "const fs=require('fs'); const v='$(VERSION)'.match(/^(\d+)\.(\d+)\.(\d+)/) || ['','0','0','0']; fs.writeFileSync('cmd/radar/versioninfo.json', JSON.stringify({FixedFileInfo:{FileVersion:{Major:parseInt(v[1])||0,Minor:parseInt(v[2])||0,Patch:parseInt(v[3])||0,Build:0},ProductVersion:{Major:parseInt(v[1])||0,Minor:parseInt(v[2])||0,Patch:parseInt(v[3])||0,Build:0}},StringFileInfo:{FileDescription:'OpenRadar - Albion Online Radar',FileVersion:'$(VERSION)',ProductName:'OpenRadar',ProductVersion:'$(VERSION)',LegalCopyright:'MIT License'},IconPath:'../../web/images/favicon.ico'},null,2));"
	@echo "Generating Windows resources (icon + version info)..."
	cd cmd/radar && goversioninfo -64
	$(GO) build $(LDFLAGS) -o $(BUILD_DIR)/$(BINARY_NAME).exe ./cmd/radar
	@echo "Built: $(BUILD_DIR)/$(BINARY_NAME).exe"

build-linux: ## Build for Linux (via Docker)
	@echo "Building for Linux via Docker..."
	-@mkdir $(BUILD_DIR) 2>nul
	docker build -f Dockerfile.build -o $(BUILD_DIR) \
		--build-arg VERSION=$(VERSION) \
		--build-arg BUILD_TIME=$(BUILD_TIME) .
	@echo "Built: $(BUILD_DIR)/$(BINARY_NAME)-linux"

build-all: build-win build-linux ## Build for all platforms (Windows + Linux)

# ============================================
# Packaging
# ============================================

package: build ## Build + copy assets + compress + archive
	@echo "Creating distribution packages..."
	@node tools/post-build.js --version=$(VERSION)
	@echo "Package complete!"

package-win: build-win ## Full Windows package
	@node tools/post-build.js --version=$(VERSION)
	@echo "Windows package ready in $(BUILD_DIR)/"

all-in-one: ## Complete build process (update data + build all platforms + package)
	@echo "=========================================="
	@echo "  OpenRadar v$(VERSION) - Complete Build"
	@echo "=========================================="
	@echo ""
	@echo "Step 1/9: Updating AO data files..."
	@$(MAKE) update-ao-data
	@echo ""
	@echo "Step 2/9: Installing npm dependencies..."
	@npm install
	@echo ""
	@echo "Step 3/9: Building Tailwind CSS..."
	@npm run css
	@echo ""
	@echo "Step 4/9: Copying vendor libraries..."
	@npm run vendors
	@echo ""
	@echo "Step 5/9: Compressing game data for embed..."
	@node tools/compress-game-data.js web/public/ao-bin-dumps --delete-originals
	@echo ""
	@echo "Step 6/9: Building for Windows..."
	@$(MAKE) build-win
	@echo ""
	@echo "Step 7/9: Building for Linux (Docker)..."
	@$(MAKE) build-linux
	@echo ""
	@echo "Step 8/9: Creating release packages..."
	@node tools/post-build.js --embed --version=$(VERSION)
	@echo ""
	@echo "Step 9/9: Restoring original data files..."
	@$(MAKE) restore-data
	@echo ""
	@echo "=========================================="
	@echo "  Build complete! Check dist/ folder"
	@echo "=========================================="

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
	-@del /q web\public\ao-bin-dumps\*.gz 2>nul
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

test: ## Run Go tests
	$(GO) test -v ./...

lint: ## Lint Go code
	@$(GO) vet ./...

lint-frontend: ## Lint frontend code (ESLint)
	@npx eslint web/scripts/ web/public/

install-tools: ## Install development tools (air for hot-reload)
	@echo "Installing development tools..."
	$(GO) install github.com/air-verse/air@latest
	@echo "air installed! Run 'make dev' to start with hot-reload"

check: ## Check system requirements
	@echo "Checking Go installation..."
	@$(GO) version
	@echo ""
	@echo "Checking air (for hot-reload)..."
	-@air -v
	@echo ""

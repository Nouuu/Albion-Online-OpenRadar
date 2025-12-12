# ============================================
# OpenRadar - Makefile (Go Backend v2.0)
# ============================================
# Usage: make [target]
# Requires: Go 1.22+, Npcap 1.84+ (Windows)
# ============================================

.PHONY: help dev run build build-win build-all \
        package package-win all-in-one clean test lint install-tools check \
        update-ao-data download-assets update-assets

# Variables
VERSION := 2.0.0
BUILD_DIR := dist
BINARY_NAME := OpenRadar
GO := go
GOFLAGS := -ldflags="-s -w"

# Default target
.DEFAULT_GOAL := help

help: ## Display help
	@echo.
	@echo OpenRadar v$(VERSION) - Go Backend
	@echo ==================================
	@echo.
	@echo   dev              Run with hot-reload (requires air)
	@echo   run              Run without hot-reload
	@echo   build            Build for Windows
	@echo   package          Build + package for distribution
	@echo   all-in-one       Complete build process
	@echo   clean            Clean build artifacts
	@echo   test             Run Go tests
	@echo   lint             Lint Go code
	@echo   install-tools    Install dev tools (air)
	@echo   check            Check system requirements
	@echo   update-ao-data   Update Albion Online data files
	@echo   download-assets  Download assets (icons, maps)
	@echo.

# ============================================
# Development
# ============================================

dev: ## Run with hot-reload (requires air)
	@echo Starting dev server with hot-reload...
	air

run: ## Run without hot-reload
	@echo Starting OpenRadar...
	$(GO) run ./cmd/radar -dev

# ============================================
# Build
# ============================================

build: build-win ## Build for current platform (default: Windows)

build-win: ## Build for Windows
	@echo Building for Windows...
	-@mkdir $(BUILD_DIR) 2>nul
	$(GO) build $(GOFLAGS) -o $(BUILD_DIR)/$(BINARY_NAME).exe ./cmd/radar
	@echo Built: $(BUILD_DIR)/$(BINARY_NAME).exe

build-all: build-win ## Build for all platforms

# ============================================
# Packaging
# ============================================

package: build ## Build + copy assets + compress + archive
	@echo Creating distribution packages...
	@node scripts-shell/post-build.js
	@echo Package complete!

package-win: build-win ## Full Windows package
	@node scripts-shell/post-build.js
	@echo Windows package ready in $(BUILD_DIR)/

all-in-one: ## Complete build process (update data + build + package)
	@echo ==========================================
	@echo   OpenRadar - Complete Build Process
	@echo ==========================================
	@echo.
	@echo Step 1/5: Updating AO data files...
	@$(MAKE) update-ao-data
	@echo.
	@echo Step 2/5: Installing npm dependencies...
	@npm install
	@echo.
	@echo Step 3/5: Compressing game data for embed...
	@node scripts-shell/compress-game-data.js public/ao-bin-dumps --delete-originals
	@echo.
	@echo Step 4/5: Building for Windows (with embedded assets)...
	@$(MAKE) build-win
	@echo.
	@echo Step 5/5: Creating release packages...
	@node scripts-shell/post-build.js --embed
	@echo.
	@echo ==========================================
	@echo   Build complete! Check dist/ folder
	@echo ==========================================

# ============================================
# Data & Assets Management
# ============================================

update-ao-data: ## Update Albion Online data files
	@echo Updating AO data files...
	@npx tsx scripts-shell/update-ao-data.ts --replace-existing

download-assets: ## Download required assets (icons, maps)
	@echo Downloading assets...
	@npx tsx scripts-shell/download-and-optimize-spell-icons.ts
	@npx tsx scripts-shell/download-and-optimize-item-icons.ts
	@npx tsx scripts-shell/download-and-optimize-map.ts

update-assets: update-ao-data download-assets ## Update all assets

# ============================================
# Utilities
# ============================================

clean: ## Clean build artifacts
	@echo Cleaning...
	-@rmdir /s /q $(BUILD_DIR) 2>nul
	-@rmdir /s /q tmp 2>nul
	-@del /q *.exe 2>nul
	@echo Clean complete

test: ## Run Go tests
	$(GO) test -v ./...

lint: ## Lint Go code
	@$(GO) vet ./...

lint-frontend: ## Lint frontend code (ESLint)
	@npx eslint scripts/ public/

install-tools: ## Install development tools (air for hot-reload)
	@echo Installing development tools...
	$(GO) install github.com/air-verse/air@latest
	@echo air installed! Run 'make dev' to start with hot-reload

check: ## Check system requirements
	@echo Checking Go installation...
	@$(GO) version
	@echo.
	@echo Checking air (for hot-reload)...
	-@air -v
	@echo.

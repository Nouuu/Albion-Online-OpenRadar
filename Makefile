# ============================================
# OpenRadar - Makefile (Go Backend v2.0)
# ============================================
# Usage: make [target]
# Requires: Go 1.22+, Npcap 1.84+ (Windows), libpcap (Linux/macOS)
# ============================================

.PHONY: help dev run build build-win build-linux build-macos build-all \
        package package-win all-in-one clean test lint install-tools check \
        update-ao-data download-assets update-assets

# Variables
VERSION := 2.0.0
BUILD_DIR := dist
BINARY_NAME := OpenRadar
GO := go
GOFLAGS := -ldflags="-s -w"

# Colors for display
GREEN := \033[0;32m
YELLOW := \033[1;33m
RED := \033[0;31m
NC := \033[0m

# Default target
.DEFAULT_GOAL := help

help: ## Display help
	@echo ""
	@echo "$(GREEN)OpenRadar v$(VERSION) - Go Backend$(NC)"
	@echo "=================================="
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  $(YELLOW)%-18s$(NC) %s\n", $$1, $$2}'
	@echo ""

# ============================================
# Development
# ============================================

dev: ## Run with hot-reload (requires air)
	@echo "$(GREEN)Starting dev server with hot-reload...$(NC)"
	@if command -v air > /dev/null 2>&1; then \
		air; \
	else \
		echo "$(RED)air not found. Install with: make install-tools$(NC)"; \
		exit 1; \
	fi

run: ## Run without hot-reload
	@echo "$(GREEN)Starting OpenRadar...$(NC)"
	$(GO) run ./cmd/radar

# ============================================
# Build
# ============================================

build: build-win ## Build for current platform (default: Windows)

build-win: ## Build for Windows
	@echo "$(YELLOW)Building for Windows...$(NC)"
	-@mkdir $(BUILD_DIR) 2>nul
	set GOOS=windows&& set GOARCH=amd64&& $(GO) build $(GOFLAGS) -o $(BUILD_DIR)/$(BINARY_NAME).exe ./cmd/radar
	@echo "$(GREEN)Built: $(BUILD_DIR)/$(BINARY_NAME).exe$(NC)"

build-linux: ## Build for Linux (via Docker)
	@echo "$(YELLOW)Building for Linux via Docker...$(NC)"
	@mkdir -p $(BUILD_DIR)
	docker run --rm -v "$(CURDIR):/app" -w /app golang:1.22 \
		sh -c "apt-get update && apt-get install -y libpcap-dev && \
		go build -ldflags='-s -w' -o dist/$(BINARY_NAME)-linux ./cmd/radar"
	@echo "$(GREEN)Built: $(BUILD_DIR)/$(BINARY_NAME)-linux$(NC)"

build-macos: ## Build for macOS (via Docker)
	@echo "$(YELLOW)Building for macOS via Docker...$(NC)"
	@mkdir -p $(BUILD_DIR)
	@echo "$(RED)Note: macOS cross-compilation requires osxcross setup$(NC)"
	@echo "$(YELLOW)Consider using GitHub Actions for macOS builds$(NC)"

build-all: build-win build-linux ## Build for all platforms

# ============================================
# Packaging
# ============================================

package: build ## Build + copy assets + compress + archive
	@echo "$(YELLOW)Creating distribution packages...$(NC)"
	@node scripts-shell/post-build.js
	@echo "$(GREEN)Package complete!$(NC)"

package-win: build-win ## Full Windows package
	@node scripts-shell/post-build.js
	@echo "$(GREEN)Windows package ready in $(BUILD_DIR)/$(NC)"

all-in-one: ## Complete build process (update data + build + package)
	@echo "$(GREEN)==========================================$(NC)"
	@echo "$(GREEN)  OpenRadar - Complete Build Process     $(NC)"
	@echo "$(GREEN)==========================================$(NC)"
	@echo ""
	@echo "$(YELLOW)Step 1/4: Updating AO data files...$(NC)"
	@$(MAKE) update-ao-data
	@echo ""
	@echo "$(YELLOW)Step 2/4: Installing npm dependencies...$(NC)"
	@npm install
	@echo ""
	@echo "$(YELLOW)Step 3/4: Building for Windows...$(NC)"
	@$(MAKE) build-win
	@echo ""
	@echo "$(YELLOW)Step 4/4: Creating release packages...$(NC)"
	@node scripts-shell/post-build.js
	@echo ""
	@echo "$(GREEN)==========================================$(NC)"
	@echo "$(GREEN)  Build complete! Check dist/ folder     $(NC)"
	@echo "$(GREEN)==========================================$(NC)"

# ============================================
# Data & Assets Management
# ============================================

update-ao-data: ## Update Albion Online data files
	@echo "$(YELLOW)Updating AO data files...$(NC)"
	@npx tsx scripts-shell/update-ao-data.ts --replace-existing

download-assets: ## Download required assets (icons, maps)
	@echo "$(YELLOW)Downloading assets...$(NC)"
	@npx tsx scripts-shell/download-and-optimize-spell-icons.ts
	@npx tsx scripts-shell/download-and-optimize-item-icons.ts
	@npx tsx scripts-shell/download-and-optimize-map.ts

update-assets: update-ao-data download-assets ## Update all assets

# ============================================
# Utilities
# ============================================

clean: ## Clean build artifacts
	@echo "$(YELLOW)Cleaning...$(NC)"
	@rm -rf $(BUILD_DIR)
	@rm -rf tmp
	@rm -f *.exe
	@echo "$(GREEN)Clean complete$(NC)"

test: ## Run Go tests
	$(GO) test -v ./...

lint: ## Lint Go code
	@$(GO) vet ./...

lint-frontend: ## Lint frontend code (ESLint)
	@npx eslint scripts/ public/

install-tools: ## Install development tools (air for hot-reload)
	@echo "$(YELLOW)Installing development tools...$(NC)"
	$(GO) install github.com/air-verse/air@latest
	@echo "$(GREEN)air installed! Run 'make dev' to start with hot-reload$(NC)"

check: ## Check system requirements
	@echo "$(YELLOW)Checking Go installation...$(NC)"
	@$(GO) version
	@echo ""
	@echo "$(YELLOW)Checking Docker (for cross-compilation)...$(NC)"
	@docker --version 2>/dev/null || echo "$(RED)Docker not found (optional, for Linux builds)$(NC)"
	@echo ""
	@echo "$(YELLOW)Checking air (for hot-reload)...$(NC)"
	@air -v 2>/dev/null || echo "$(RED)air not found. Install with: make install-tools$(NC)"
	@echo ""
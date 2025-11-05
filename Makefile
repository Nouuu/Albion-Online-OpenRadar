# ============================================
# ZQRadar - Makefile
# ============================================
# Usage: make [target]
# Requires: Node.js v18.18.2, npm, Npcap 1.84
# ============================================

.PHONY: help install start dev check build build-linux build-macos build-all release clean rebuild package optimize-images all-in-one clean-all

# Variables
NODE_VERSION = v18.18.2
NPCAP_VERSION = 1.84
DIST_DIR = dist
BUILD_DIR = build
RELEASE_NAME = ZQRadar-$(shell date +%Y%m%d)

# Colors for display
GREEN = \033[0;32m
YELLOW = \033[1;33m
RED = \033[0;31m
NC = \033[0m # No Color

help: ## Display help
	@echo ""
	@echo "$(GREEN)ZQRadar - Available Commands$(NC)"
	@echo "=================================="
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(YELLOW)%-15s$(NC) %s\n", $$1, $$2}'
	@echo ""

install: ## Install all dependencies
	@echo "$(GREEN)[1/2] Installing npm dependencies...$(NC)"
	npm install
	@echo ""
	@echo "$(GREEN)[2/2] Rebuilding native modules (cap, node-sass)...$(NC)"
	npm rebuild cap node-sass
	@echo ""
	@echo "$(GREEN)✓ Installation complete!$(NC)"

start: ## Run ZQRadar in development mode
	npm start

dev: ## Run with auto-reload (nodemon)
	@command -v nodemon >/dev/null 2>&1 || npm install -D nodemon
	npm run dev

check: ## Check system requirements
	@echo "$(YELLOW)Checking system requirements...$(NC)"
	@echo ""
	@echo -n "Node.js version: "
	@node --version || (echo "$(RED)✗ Node.js not found!$(NC)" && exit 1)
	@echo "$(GREEN)✓ Node.js OK$(NC)"
	@echo ""
	@echo -n "npm version: "
	@npm --version || (echo "$(RED)✗ npm not found!$(NC)" && exit 1)
	@echo "$(GREEN)✓ npm OK$(NC)"
	@echo ""

# Build targets
build: ## Build Windows executable
	@echo "$(GREEN)Installing build dependencies...$(NC)"
	npm install -D pkg archiver
	@echo ""
	@echo "$(GREEN)Building Windows executable...$(NC)"
	@echo "$(YELLOW)This may take a few minutes...$(NC)"
	@echo ""
	npm run build:win
	@echo ""
	@echo "$(GREEN)✓ Build complete: dist/ZQRadar.exe$(NC)"
	@echo ""
	@echo "$(YELLOW)💡 Run 'node build/post-build.js' to copy assets + create archives$(NC)"
	@echo "$(YELLOW)💡 Or run 'npm run optimize:images' first to reduce archive size$(NC)"

build-linux: ## Build Linux executable
	@echo "$(GREEN)Building Linux executable...$(NC)"
	npm run build:linux
	@echo ""
	@echo "$(GREEN)✓ Build complete: dist/ZQRadar-linux$(NC)"
	@echo ""
	@echo "$(YELLOW)💡 Run 'node build/post-build.js' to copy assets + create archives$(NC)"

build-macos: ## Build macOS executable
	@echo "$(GREEN)Building macOS executable...$(NC)"
	npm run build:macos
	@echo ""
	@echo "$(GREEN)✓ Build complete: dist/ZQRadar-macos$(NC)"
	@echo ""
	@echo "$(YELLOW)💡 Run 'node build/post-build.js' to copy assets + create archives$(NC)"

build-all: ## Build for all platforms
	@echo "$(GREEN)Building for all platforms (Windows, Linux, macOS)...$(NC)"
	@echo "$(YELLOW)This will take several minutes...$(NC)"
	@echo ""
	npm run build:all
	@echo ""
	@echo "$(GREEN)✓ Build complete!$(NC)"
	@echo ""
	@echo "$(YELLOW)Files created:$(NC)"
	@ls -lh $(DIST_DIR)/*.exe $(DIST_DIR)/ZQRadar-* 2>/dev/null || true
	@echo ""
	@echo "$(YELLOW)Next steps:$(NC)"
	@echo "  1. Optimize: npm run optimize:images (optional, reduces archives by 30-40%)"
	@echo "  2. Package: node build/post-build.js (copies assets + creates archives)"

# All-in-one build
all-in-one: ## Complete build process (install + build all platforms + package)
	@echo "$(GREEN)═══════════════════════════════════════$(NC)"
	@echo "$(GREEN)  ZQRadar - Complete Build Process     $(NC)"
	@echo "$(GREEN)═══════════════════════════════════════$(NC)"
	@echo ""
	@echo "$(YELLOW)Step 1/4: Installing dependencies...$(NC)"
	@npm install
	@echo ""
	@echo "$(YELLOW)Step 2/4: Rebuilding native modules...$(NC)"
	@npm rebuild cap node-sass
	@echo ""
	@echo "$(YELLOW)Step 3/4: Installing build tools...$(NC)"
	@npm install -D pkg archiver sharp
	@echo ""
	@echo "$(YELLOW)Step 4/4: Building all platforms...$(NC)"
	@npm run build:all
	@echo ""
	@echo "$(YELLOW)Step 5/5: Creating release packages...$(NC)"
	@node build/post-build.js
	@echo ""
	@echo "$(GREEN)✓ Complete build process finished!$(NC)"
	@echo ""
	@ls -lh $(DIST_DIR)/*.zip 2>/dev/null || true

# Rebuild (clean + build)
rebuild: ## Clean and rebuild from scratch
	@echo "$(YELLOW)Cleaning...$(NC)"
	@$(MAKE) clean
	@echo ""
	@echo "$(YELLOW)Installing dependencies...$(NC)"
	@npm install
	@echo ""
	@echo "$(YELLOW)Rebuilding native modules...$(NC)"
	@npm rebuild cap node-sass
	@echo ""
	@echo "$(YELLOW)Building Windows executable...$(NC)"
	@npm run build:win
	@echo ""
	@echo "$(YELLOW)Creating release packages...$(NC)"
	@node build/post-build.js
	@echo ""
	@echo "$(GREEN)✓ Rebuild complete!$(NC)"

# Release (build + package)
release: ## Build and create release (Windows only)
	@echo "$(GREEN)Creating release...$(NC)"
	npm run release
	@echo ""
	@echo "$(GREEN)✓ Release created!$(NC)"

# Cleaning
clean: ## Clean build artifacts (keep optimized images if any)
	@echo "$(YELLOW)Cleaning build artifacts...$(NC)"
	@if [ -d "$(DIST_DIR)/images/.optimized" ]; then \
		echo "$(GREEN)Preserving optimized images...$(NC)"; \
		find $(DIST_DIR) -mindepth 1 -maxdepth 1 ! -name images -exec rm -rf {} +; \
	else \
		rm -rf $(DIST_DIR); \
	fi
	@rm -rf $(BUILD_DIR)/temp
	@rm -f *.log
	@echo "$(GREEN)✓ Clean complete!$(NC)"

clean-all: ## Complete cleanup (including optimized images + node_modules)
	@echo "$(RED)Complete cleanup (including node_modules)...$(NC)"
	@rm -rf $(DIST_DIR)
	@rm -rf $(BUILD_DIR)/temp
	@rm -rf node_modules package-lock.json
	@rm -f *.log
	@echo "$(GREEN)✓ Complete cleanup done!$(NC)"

# Image optimization
optimize-images: ## Optimize images to reduce package size
	npm run optimize:images

# Default target
.DEFAULT_GOAL := help


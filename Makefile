# ============================================
# OpenRadar - Makefile
# ============================================
# Usage: make [target]
# Requires: Node.js v24.11.1, npm, Npcap 1.84
# ============================================

.PHONY: help install check all-in-one update-ao-data download-assets update-assets

# Variables
NODE_VERSION = v24.11.1
NPCAP_VERSION = 1.84
DIST_DIR = dist

# Colors for display
GREEN = \033[0;32m
YELLOW = \033[1;33m
RED = \033[0;31m
NC = \033[0m # No Color

help: ## Display help
	@echo ""
	@echo "$(GREEN)OpenRadar - Available Commands$(NC)"
	@echo "=================================="
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(YELLOW)%-15s$(NC) %s\n", $$1, $$2}'
	@echo ""

install: ## Install all dependencies
	@echo "$(GREEN)[1/2] Installing npm dependencies...$(NC)"
	npm install
	@echo ""
	@echo "$(GREEN)[2/2] Rebuilding native modules (cap)...$(NC)"
	npm rebuild cap
	@echo ""
	@echo "$(GREEN)✓ Installation complete!$(NC)"

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

# All-in-one build
all-in-one: ## Complete build process (install + build all platforms + package)
	@echo "$(GREEN)═══════════════════════════════════════$(NC)"
	@echo "$(GREEN)  OpenRadar - Complete Build Process   $(NC)"
	@echo "$(GREEN)═══════════════════════════════════════$(NC)"
	@echo ""
	@echo "$(YELLOW)Step 1/6: Installing dependencies...$(NC)"
	@npm install
	@echo ""
	@echo "$(YELLOW)Step 2/6: Rebuilding native modules...$(NC)"
	@npm rebuild cap
	@echo ""
	@echo "$(YELLOW)Step 3/6: Installing build tools...$(NC)"
	@npm install -D @yao-pkg/pkg archiver sharp
	@echo ""
	@echo "$(YELLOW)Step 4/6: Updating ao-data files...$(NC)"
	@$(MAKE) update-ao-data
	@echo ""
	@echo "$(YELLOW)Step 5/6: Building all platforms...$(NC)"
	@npm run build:all
	@echo ""
	@echo "$(YELLOW)Step 6/6: Creating release packages...$(NC)"
	@node scripts-shell/post-build.js
	@echo ""
	@echo "$(GREEN)✓ Complete build process finished!$(NC)"


update-ao-data: ## Update AO data files
	@echo "$(YELLOW)Updating AO data files...$(NC)"
	@tsx scripts-shell/update-ao-data.ts --replace-existing

download-assets: ## Download required assets
	@echo "$(YELLOW)Downloading required assets...$(NC)"
	@tsx scripts-shell/download-and-optimize-spell-icons.ts
	@tsx scripts-shell/download-and-optimize-item-icons.ts
	@tsx scripts-shell/download-and-optimize-map.ts

update-assets: ## Update all assets
	@echo "$(YELLOW)Updating all assets...$(NC)"
	@$(MAKE) update-ao-data
	@$(MAKE) download-assets


# Default target
.DEFAULT_GOAL := help


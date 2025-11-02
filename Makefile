# ============================================
# ZQRadar - Makefile
# ============================================
# Usage: make [target]
# Requires: Node.js v18.18.2, npm, Npcap 1.79
# ============================================

.PHONY: help install start dev check build release clean rebuild package

# Variables
NODE_VERSION = v18.18.2
NPCAP_VERSION = 1.79
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
	@echo "$(GREEN)✓ Installation completed!$(NC)"

start: ## Launch the radar
	@echo "$(GREEN)Starting ZQRadar...$(NC)"
	@echo ""
	npm start

dev: ## Launch in development mode (auto-reload)
	@echo "$(GREEN)Development mode with auto-reload...$(NC)"
	@command -v nodemon >/dev/null 2>&1 || npm install -D nodemon
	npm run dev

check: ## Check system dependencies
	@echo "$(GREEN)Checking system dependencies...$(NC)"
	@echo ""
	@echo -n "Node.js version: "
	@node --version || (echo "$(RED)✗ Node.js not found!$(NC)" && exit 1)
	@echo "$(GREEN)✓ Node.js OK$(NC)"
	@echo ""
	@echo -n "npm version: "
	@npm --version || (echo "$(RED)✗ npm not found!$(NC)" && exit 1)
	@echo "$(GREEN)✓ npm OK$(NC)"
	@echo ""
	@echo "$(YELLOW)Note: Npcap $(NPCAP_VERSION) must be installed on Windows$(NC)"
	@echo "      Download: https://npcap.com/dist/npcap-$(NPCAP_VERSION).exe"
	@echo ""
	@echo "$(GREEN)✓ Check completed!$(NC)"

install-pkg: ## Install pkg and archiver for build
	@echo "$(GREEN)Installing pkg and archiver...$(NC)"
	npm install -D pkg archiver

build: install-pkg ## Build Windows executable (.exe)
	@echo "$(GREEN)[1/2] Checking dependencies...$(NC)"
	@make check
	@echo ""
	@echo "$(GREEN)[2/2] Building Windows executable...$(NC)"
	npm run build:win
	@echo ""
	@echo "$(GREEN)✓ Build completed!$(NC)"
	@echo "$(YELLOW)Executable created: $(DIST_DIR)/ZQRadar.exe$(NC)"

build-all: install-pkg ## Build for Windows and Linux
	@echo "$(GREEN)Multi-platform build...$(NC)"
	npm run build:all
	@echo ""
	@echo "$(GREEN)✓ Build completed for all platforms!$(NC)"

clean: ## Clean temporary files and builds
	@echo "$(GREEN)Cleaning temporary files...$(NC)"
	rm -rf $(DIST_DIR)
	rm -rf $(BUILD_DIR)/temp
	rm -f *.log
	@echo "$(GREEN)✓ Cleaning completed!$(NC)"

clean-all: clean ## Complete cleanup (+ node_modules)
	@echo "$(YELLOW)Removing node_modules...$(NC)"
	rm -rf node_modules package-lock.json
	@echo "$(GREEN)✓ Complete cleanup finished!$(NC)"

rebuild: clean install build ## Complete rebuild (clean + install + build)
	@echo ""
	@echo "$(GREEN)✓ Complete rebuild finished!$(NC)"

package: build ## Create release package (ZIP)
	@echo "$(GREEN)Creating release package...$(NC)"
	@mkdir -p $(DIST_DIR)/$(RELEASE_NAME)
	@cp $(DIST_DIR)/ZQRadar.exe $(DIST_DIR)/$(RELEASE_NAME)/
	@cp -r views $(DIST_DIR)/$(RELEASE_NAME)/
	@cp -r scripts $(DIST_DIR)/$(RELEASE_NAME)/
	@cp -r images $(DIST_DIR)/$(RELEASE_NAME)/
	@cp -r sounds $(DIST_DIR)/$(RELEASE_NAME)/
	@cp README.md $(DIST_DIR)/$(RELEASE_NAME)/
	@cp zqradar.ico $(DIST_DIR)/$(RELEASE_NAME)/ 2>/dev/null || true
	@echo "$(YELLOW)Creating archive...$(NC)"
	@cd $(DIST_DIR) && zip -r $(RELEASE_NAME).zip $(RELEASE_NAME)
	@rm -rf $(DIST_DIR)/$(RELEASE_NAME)
	@echo ""
	@echo "$(GREEN)✓ Package created: $(DIST_DIR)/$(RELEASE_NAME).zip$(NC)"

release: rebuild package ## Create complete release
	@echo ""
	@echo "$(GREEN)✓ Complete release finished!$(NC)"
	@echo "$(YELLOW)Files created in $(DIST_DIR)/$(NC)"

test-build: ## Test if executable works
	@echo "$(GREEN)Testing executable...$(NC)"
	@if [ -f $(DIST_DIR)/ZQRadar.exe ]; then \
		echo "$(GREEN)✓ ZQRadar.exe found$(NC)"; \
		echo "$(YELLOW)Note: Full test requires Windows to execute .exe$(NC)"; \
	else \
		echo "$(RED)✗ ZQRadar.exe not found. Run 'make build' first.$(NC)"; \
		exit 1; \
	fi

info: ## Display project information
	@echo ""
	@echo "$(GREEN)ZQRadar - Project Information$(NC)"
	@echo "=================================="
	@echo "Required Node version: $(NODE_VERSION)"
	@echo "Required Npcap version: $(NPCAP_VERSION)"
	@echo "Build folder: $(DIST_DIR)/"
	@echo ""
	@echo "Main dependencies:"
	@echo "  - express: Web server"
	@echo "  - ws: WebSocket"
	@echo "  - cap: Packet capture (native module)"
	@echo "  - ejs: Templates"
	@echo ""
	@echo "Native modules (require rebuild):"
	@echo "  - cap.node (network capture)"
	@echo "  - node-sass (SASS compilation)"
	@echo ""
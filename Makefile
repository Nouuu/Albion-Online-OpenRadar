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

# Couleurs pour l'affichage
GREEN = \033[0;32m
YELLOW = \033[1;33m
RED = \033[0;31m
NC = \033[0m # No Color

help: ## Afficher l'aide
	@echo ""
	@echo "$(GREEN)ZQRadar - Commandes disponibles$(NC)"
	@echo "=================================="
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(YELLOW)%-15s$(NC) %s\n", $$1, $$2}'
	@echo ""

install: ## Installer toutes les dépendances
	@echo "$(GREEN)[1/2] Installation des dépendances npm...$(NC)"
	npm install
	@echo ""
	@echo "$(GREEN)[2/2] Rebuild des modules natifs (cap, node-sass)...$(NC)"
	npm rebuild cap node-sass
	@echo ""
	@echo "$(GREEN)✓ Installation terminée !$(NC)"

start: ## Lancer le radar
	@echo "$(GREEN)Démarrage de ZQRadar...$(NC)"
	@echo ""
	npm start

dev: ## Lancer en mode développement (auto-reload)
	@echo "$(GREEN)Mode développement avec auto-reload...$(NC)"
	@command -v nodemon >/dev/null 2>&1 || npm install -D nodemon
	npm run dev

check: ## Vérifier les dépendances système
	@echo "$(GREEN)Vérification des dépendances système...$(NC)"
	@echo ""
	@echo -n "Node.js version: "
	@node --version || (echo "$(RED)✗ Node.js non trouvé !$(NC)" && exit 1)
	@echo "$(GREEN)✓ Node.js OK$(NC)"
	@echo ""
	@echo -n "npm version: "
	@npm --version || (echo "$(RED)✗ npm non trouvé !$(NC)" && exit 1)
	@echo "$(GREEN)✓ npm OK$(NC)"
	@echo ""
	@echo "$(YELLOW)Note: Npcap $(NPCAP_VERSION) doit être installé sur Windows$(NC)"
	@echo "      Télécharger: https://npcap.com/dist/npcap-$(NPCAP_VERSION).exe"
	@echo ""
	@echo "$(GREEN)✓ Vérification terminée !$(NC)"

install-pkg: ## Installer pkg pour le build
	@echo "$(GREEN)Installation de pkg...$(NC)"
	npm install -D pkg

build: install-pkg ## Builder l'exécutable Windows (.exe)
	@echo "$(GREEN)[1/2] Vérification des dépendances...$(NC)"
	@make check
	@echo ""
	@echo "$(GREEN)[2/2] Build de l'exécutable Windows...$(NC)"
	npm run build:win
	@echo ""
	@echo "$(GREEN)✓ Build terminé !$(NC)"
	@echo "$(YELLOW)Exécutable créé: $(DIST_DIR)/ZQRadar.exe$(NC)"

build-all: install-pkg ## Builder pour Windows et Linux
	@echo "$(GREEN)Build multi-plateforme...$(NC)"
	npm run build:all
	@echo ""
	@echo "$(GREEN)✓ Build terminé pour toutes les plateformes !$(NC)"

clean: ## Nettoyer les fichiers temporaires et builds
	@echo "$(GREEN)Nettoyage des fichiers temporaires...$(NC)"
	rm -rf $(DIST_DIR)
	rm -rf $(BUILD_DIR)/temp
	rm -f *.log
	@echo "$(GREEN)✓ Nettoyage terminé !$(NC)"

clean-all: clean ## Nettoyage complet (+ node_modules)
	@echo "$(YELLOW)Suppression de node_modules...$(NC)"
	rm -rf node_modules package-lock.json
	@echo "$(GREEN)✓ Nettoyage complet terminé !$(NC)"

rebuild: clean install build ## Rebuild complet (clean + install + build)
	@echo ""
	@echo "$(GREEN)✓ Rebuild complet terminé !$(NC)"

package: build ## Créer un package de release (ZIP)
	@echo "$(GREEN)Création du package de release...$(NC)"
	@mkdir -p $(DIST_DIR)/$(RELEASE_NAME)
	@cp $(DIST_DIR)/ZQRadar.exe $(DIST_DIR)/$(RELEASE_NAME)/
	@cp -r views $(DIST_DIR)/$(RELEASE_NAME)/
	@cp -r scripts $(DIST_DIR)/$(RELEASE_NAME)/
	@cp -r images $(DIST_DIR)/$(RELEASE_NAME)/
	@cp -r sounds $(DIST_DIR)/$(RELEASE_NAME)/
	@cp README.md $(DIST_DIR)/$(RELEASE_NAME)/
	@cp zqradar.ico $(DIST_DIR)/$(RELEASE_NAME)/ 2>/dev/null || true
	@echo "$(YELLOW)Création de l'archive...$(NC)"
	@cd $(DIST_DIR) && zip -r $(RELEASE_NAME).zip $(RELEASE_NAME)
	@rm -rf $(DIST_DIR)/$(RELEASE_NAME)
	@echo ""
	@echo "$(GREEN)✓ Package créé: $(DIST_DIR)/$(RELEASE_NAME).zip$(NC)"

release: rebuild package ## Créer une release complète
	@echo ""
	@echo "$(GREEN)✓ Release complète terminée !$(NC)"
	@echo "$(YELLOW)Fichiers créés dans $(DIST_DIR)/$(NC)"

test-build: ## Tester si l'exécutable fonctionne
	@echo "$(GREEN)Test de l'exécutable...$(NC)"
	@if [ -f $(DIST_DIR)/ZQRadar.exe ]; then \
		echo "$(GREEN)✓ ZQRadar.exe trouvé$(NC)"; \
		echo "$(YELLOW)Note: Le test complet nécessite Windows pour exécuter le .exe$(NC)"; \
	else \
		echo "$(RED)✗ ZQRadar.exe non trouvé. Lancez 'make build' d'abord.$(NC)"; \
		exit 1; \
	fi

info: ## Afficher les informations du projet
	@echo ""
	@echo "$(GREEN)ZQRadar - Informations du projet$(NC)"
	@echo "=================================="
	@echo "Version Node requise: $(NODE_VERSION)"
	@echo "Version Npcap requise: $(NPCAP_VERSION)"
	@echo "Dossier de build: $(DIST_DIR)/"
	@echo ""
	@echo "Dépendances principales:"
	@echo "  - express: Serveur web"
	@echo "  - ws: WebSocket"
	@echo "  - cap: Capture de paquets (module natif)"
	@echo "  - ejs: Templates"
	@echo ""
	@echo "Modules natifs (nécessitent rebuild):"
	@echo "  - cap.node (capture réseau)"
	@echo "  - node-sass (compilation SASS)"
	@echo ""
# ============================================================================
# OpenRadar Makefile (cross-platform: Linux, macOS, Windows via Git Bash)
#
# Requirements:
#   - GNU Make, bash (Git Bash on Windows)
#   - Go 1.25+
#   - Node 20+
#   - Docker (only needed to build the non-native platform locally)
#   - git, gh, git-cliff, golangci-lint (see `make install-tools`)
# ============================================================================

SHELL := bash
.SHELLFLAGS := -eu -o pipefail -c

HOST_OS := $(shell uname -s | tr '[:upper:]' '[:lower:]')

GIT_TAG := $(shell git describe --tags --exact-match 2>/dev/null || true)
GIT_BRANCH := $(shell git rev-parse --abbrev-ref HEAD 2>/dev/null || echo unknown)
GIT_COMMIT := $(shell git rev-parse --short HEAD 2>/dev/null || echo unknown)
VERSION ?= $(if $(GIT_TAG),$(patsubst v%,%,$(GIT_TAG)),$(GIT_BRANCH)-$(GIT_COMMIT))
BUILD_TIME := $(shell date -u +%Y-%m-%dT%H:%M:%SZ)
LDFLAGS := -s -w -X main.Version=$(VERSION) -X main.BuildTime=$(BUILD_TIME)

DIST := dist

.PHONY: help dev run css css-watch vendors test lint lint-fix clean \
        install-tools assets restore-assets refresh-assets \
        update-ao-data download-icons download-spells download-map \
        build-linux build-windows readmes checksums all-in-one \
        release release-dry-run

.DEFAULT_GOAL := help

help: ## Display help
	@echo ""
	@echo "OpenRadar v$(VERSION) (host: $(HOST_OS))"
	@echo "====================================="
	@echo ""
	@echo "Development:"
	@echo "  dev               Run with hot-reload (requires air)"
	@echo "  run               Run once without hot-reload"
	@echo "  css               Build Tailwind CSS"
	@echo "  css-watch         Watch Tailwind CSS"
	@echo "  vendors           Copy vendor JS + fonts"
	@echo ""
	@echo "Build:"
	@echo "  assets            Prepare embedded assets (CSS, vendors, gzip data)"
	@echo "  restore-assets    Restore source tree after assets step"
	@echo "  build-linux       Build Linux binary (native on Linux, Docker elsewhere)"
	@echo "  build-windows     Build Windows .exe (native on Windows, Docker elsewhere)"
	@echo "  all-in-one        assets + both binaries + READMEs + checksums + restore"
	@echo ""
	@echo "Assets refresh (committed to repo):"
	@echo "  update-ao-data    Update Albion Online data JSON files"
	@echo "  download-icons    Download + optimize item icons"
	@echo "  download-spells   Download + optimize spell icons"
	@echo "  download-map      Download + optimize world map (Puppeteer)"
	@echo "  refresh-assets    Run all of the above sequentially"
	@echo ""
	@echo "Release:"
	@echo "  release-dry-run   all-in-one + generate dist/RELEASE.md (no tag, no GH call)"
	@echo "  release TAG=x.y.z all-in-one + tag + gh release create --draft"
	@echo ""
	@echo "Quality:"
	@echo "  test              Run Go + frontend tests"
	@echo "  lint              Lint Go + frontend"
	@echo "  lint-fix          Lint and auto-fix"
	@echo ""
	@echo "Utilities:"
	@echo "  clean             Remove dist/ and compressed .gz files"
	@echo "  install-tools     Install air, golangci-lint, git-cliff"
	@echo ""

# ============================================================================
# Development
# ============================================================================

dev: css vendors ## Run with hot-reload
	air

run: css vendors ## Run without hot-reload
	go run ./cmd/radar -dev

css: ## Build Tailwind CSS
	npm run css

css-watch: ## Watch and rebuild Tailwind CSS
	npm run css:watch

vendors: ## Copy vendor libraries
	npm run vendors

# ============================================================================
# Quality
# ============================================================================

test: ## Run Go + frontend tests
	go test ./...
	npm test

lint: ## Lint Go + frontend
	golangci-lint run ./...
	npm run lint

lint-fix: ## Lint and auto-fix
	golangci-lint run --fix ./...
	npm run lint:fix

# ============================================================================
# Assets (prepares web/ao-bin-dumps/*.gz for go:embed)
# ============================================================================

assets: ## Install deps, build CSS, copy vendors, gzip embedded data
	npm ci
	npm run build
	npx tsx tools/compress-game-data.ts web/ao-bin-dumps --delete-originals

restore-assets: ## Restore web/ao-bin-dumps/*.json from git, remove *.gz
	git checkout -- web/ao-bin-dumps/
	rm -f web/ao-bin-dumps/*.gz

update-ao-data: ## Refresh web/ao-bin-dumps/*.json from upstream
	npx tsx tools/update-ao-data.ts --replace-existing

download-icons: ## Refresh item icons (web/images/icons/)
	npx tsx tools/download-and-optimize-item-icons.ts

download-spells: ## Refresh spell icons (web/images/spells/)
	npx tsx tools/download-and-optimize-spell-icons.ts

download-map: ## Refresh world map (web/images/map/)
	npx tsx tools/download-and-optimize-map.ts

refresh-assets: update-ao-data download-icons download-spells download-map ## Refresh all network-sourced assets
	@echo ""
	@echo "All assets refreshed. Review changes with 'git status' before committing."

# ============================================================================
# Build
# ============================================================================

$(DIST):
	mkdir -p $(DIST)

build-linux: | $(DIST) ## Build Linux binary
ifeq ($(HOST_OS),linux)
	CGO_ENABLED=1 GOOS=linux GOARCH=amd64 \
		go build -ldflags="$(LDFLAGS)" -o $(DIST)/OpenRadar-linux-amd64 ./cmd/radar
else
	docker build -f Dockerfile.linux -o $(DIST)/ \
		--build-arg VERSION=$(VERSION) --build-arg BUILD_TIME=$(BUILD_TIME) .
endif

build-windows: | $(DIST) ## Build Windows .exe
ifneq (,$(findstring mingw,$(HOST_OS))$(findstring msys,$(HOST_OS)))
	CGO_ENABLED=1 GOOS=windows GOARCH=amd64 \
		go build -ldflags="$(LDFLAGS)" -o $(DIST)/OpenRadar-windows-amd64.exe ./cmd/radar
else
	docker build -f Dockerfile.windows -o $(DIST)/ \
		--build-arg VERSION=$(VERSION) --build-arg BUILD_TIME=$(BUILD_TIME) .
endif

readmes: | $(DIST) ## Generate platform-specific README files
	npx tsx tools/generate-readmes.ts --output-dir=$(DIST) --version=$(VERSION)

checksums: | $(DIST) ## Generate SHA256 checksums for dist/ contents
	cd $(DIST) && sha256sum OpenRadar-linux-amd64 OpenRadar-windows-amd64.exe README-linux.txt README-windows.txt > checksums-sha256.txt

all-in-one: ## Full release artifacts (both binaries + READMEs + checksums)
	trap '$(MAKE) restore-assets' EXIT; \
	$(MAKE) assets && \
	$(MAKE) build-linux && \
	$(MAKE) build-windows && \
	$(MAKE) readmes && \
	$(MAKE) checksums
	@echo ""
	@echo "Build complete. Artifacts in $(DIST)/:"
	@ls -la $(DIST)/

# ============================================================================
# Release
# ============================================================================

release-dry-run: all-in-one ## Full build + generate RELEASE.md for review
	git-cliff --unreleased --config cliff.toml --output $(DIST)/RELEASE.md
	@echo ""
	@echo "Release notes (unreleased commits since last tag): $(DIST)/RELEASE.md"
	@echo "Review before running 'make release TAG=x.y.z'"

release: ## Create draft GitHub release (requires TAG=x.y.z)
ifndef TAG
	$(error TAG is required, e.g. make release TAG=2.2.0)
endif
	@echo "Building release $(TAG)..."
	$(MAKE) all-in-one VERSION=$(TAG)
	git-cliff --unreleased --tag $(TAG) --config cliff.toml --output $(DIST)/RELEASE.md
	git tag $(TAG)
	git push origin $(TAG)
	gh release create $(TAG) \
		--draft \
		--title "OpenRadar v$(TAG)" \
		--notes-file $(DIST)/RELEASE.md \
		$(DIST)/OpenRadar-linux-amd64 \
		$(DIST)/OpenRadar-windows-amd64.exe \
		$(DIST)/README-linux.txt \
		$(DIST)/README-windows.txt \
		$(DIST)/checksums-sha256.txt
	@echo ""
	@echo "Draft release created. Review and publish at:"
	@echo "  https://github.com/Nouuu/Albion-Online-OpenRadar/releases"

# ============================================================================
# Utilities
# ============================================================================

clean: ## Remove build artifacts
	rm -rf $(DIST) tmp
	rm -f web/ao-bin-dumps/*.gz

install-tools: ## Install air, golangci-lint, git-cliff
	go install github.com/air-verse/air@latest
	go install github.com/golangci/golangci-lint/v2/cmd/golangci-lint@latest
	@echo ""
	@echo "git-cliff must be installed separately (Rust binary):"
	@echo "  - Linux/macOS: brew install git-cliff  OR  cargo install git-cliff"
	@echo "  - Binary:     https://github.com/orhun/git-cliff/releases"

# fitfiller — static, client-side build (GitHub Pages). Run `make help`.
SHELL := bash
.SHELLFLAGS := -eu -o pipefail -c
.DEFAULT_GOAL := help

PNPM ?= pnpm

.PHONY: help install dev build preview test typecheck check stop clean

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
		| sort \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-12s\033[0m %s\n", $$1, $$2}'

install: ## Install all workspace dependencies
	$(PNPM) install

dev: stop install ## Run the web app with live reload (http://localhost:5173)
	@echo "web → http://localhost:5173"
	$(PNPM) --filter @fitfiller/core build
	$(PNPM) --filter @fitfiller/web dev

build: ## Build core + the static site into apps/web/dist
	$(PNPM) -r build

preview: build ## Serve the production build locally
	$(PNPM) --filter @fitfiller/web preview

test: ## Run all tests (core + web)
	$(PNPM) -r test

typecheck: ## Type-check every package
	$(PNPM) -r typecheck

check: typecheck test ## Full gate: typecheck + tests

stop: ## Stop a stray Vite dev server
	@pids=$$(lsof -ti tcp:5173 2>/dev/null || true); \
	if [ -n "$$pids" ]; then kill $$pids 2>/dev/null || true; fi; \
	echo "stopped dev server (freed :5173)"

clean: ## Remove build output and caches
	@rm -rf packages/*/dist apps/*/dist .turbo packages/*/.turbo apps/*/.turbo
	@echo "cleaned build output"

# Phoenix Monorepo Makefile
# Unified commands for Python and TypeScript development

SHELL := /bin/bash
.DEFAULT_GOAL := help

# Tools
TOX := tox
PNPM := pnpm
UV := uv
HATCH := hatch
NODE := node

# Directories
APP_DIR := app
JS_DIR := js
SCHEMAS_DIR := schemas
PACKAGES_DIR := packages

# Colors for output
CYAN := \033[0;36m
GREEN := \033[0;32m
YELLOW := \033[0;33m
RED := \033[0;31m
NC := \033[0m # No Color

#=============================================================================
# Meta Targets
#=============================================================================

.PHONY: help check-tools \
	setup install-python install-node setup-symlinks \
	graphql schema-graphql relay-build \
	openapi schema-openapi codegen-python-client codegen-ts-client \
	dev dev-backend dev-frontend \
	test test-python test-frontend test-ts typecheck typecheck-python typecheck-python-ty typecheck-frontend typecheck-ts \
	format format-python format-frontend format-ts lint lint-python lint-frontend lint-ts clean-notebooks \
	build build-python build-frontend build-ts \
	clean clean-all

help: ## Show this help message
	@echo -e ""
	@echo -e "$(CYAN)Phoenix Monorepo - Available Make Targets$(NC)"
	@echo -e ""
	@echo -e "$(GREEN)Schema Generation:$(NC)"
	@echo -e "  $(YELLOW)graphql$(NC)               - Generate GraphQL schema and build Relay (Python → TypeScript)"
	@echo -e "  $(YELLOW)openapi$(NC)               - Generate OpenAPI schema and clients (Python + TypeScript)"
	@echo -e "  schema-graphql         - Generate GraphQL schema only"
	@echo -e "  relay-build            - Build Relay from existing schema"
	@echo -e "  schema-openapi         - Generate OpenAPI schema only"
	@echo -e "  codegen-python-client  - Generate Python client types from OpenAPI"
	@echo -e "  codegen-ts-client      - Generate TypeScript client types from OpenAPI"
	@echo -e ""
	@echo -e "$(GREEN)Setup:$(NC)"
	@echo -e "  $(YELLOW)setup$(NC)                 - Complete development environment setup"
	@echo -e "  check-tools            - Verify required tools are installed"
	@echo -e "  install-python         - Install Python dependencies"
	@echo -e "  install-node           - Install Node.js dependencies"
	@echo -e "  setup-symlinks         - Create Python package symlinks"
	@echo -e ""
	@echo -e "$(GREEN)Development:$(NC)"
	@echo -e "  $(YELLOW)dev$(NC)                   - Full dev environment (backend + frontend)"
	@echo -e "  dev-backend            - Backend only (FastAPI server)"
	@echo -e "  dev-frontend           - Frontend only (React dev server)"
	@echo -e ""
	@echo -e "$(GREEN)Testing:$(NC)"
	@echo -e "  $(YELLOW)test$(NC)                  - Run all tests (Python + frontend + TypeScript)"
	@echo -e "  test-python            - Run Python tests (unit + integration)"
	@echo -e "  test-frontend          - Run frontend tests (app/)"
	@echo -e "  test-ts                - Run TypeScript package tests (js/)"
	@echo -e "  typecheck              - Type check all code (Python + frontend + TypeScript)"
	@echo -e "  typecheck-python       - Type check Python only"
	@echo -e "  typecheck-python-ty    - Type check Python with ty (verify expected errors only)"
	@echo -e "  typecheck-frontend     - Type check frontend only (app/)"
	@echo -e "  typecheck-ts           - Type check TypeScript packages only (js/)"
	@echo -e ""
	@echo -e "$(GREEN)Code Quality:$(NC)"
	@echo -e "  $(YELLOW)format$(NC)                - Format all code (Python + frontend + TypeScript)"
	@echo -e "  format-python          - Format Python with ruff"
	@echo -e "  format-frontend        - Format frontend (app/)"
	@echo -e "  format-ts              - Format TypeScript packages (js/)"
	@echo -e "  clean-notebooks        - Clean Jupyter notebook metadata"
	@echo -e "  $(YELLOW)lint$(NC)                  - Lint all code (Python + frontend + TypeScript)"
	@echo -e "  lint-python            - Lint Python with ruff"
	@echo -e "  lint-frontend          - Lint frontend (app/)"
	@echo -e "  lint-ts                - Lint TypeScript packages (js/)"
	@echo -e ""
	@echo -e "$(GREEN)Build:$(NC)"
	@echo -e "  $(YELLOW)build$(NC)                 - Build everything (Python + frontend + TypeScript packages)"
	@echo -e "  build-python           - Build Python package"
	@echo -e "  build-frontend         - Build frontend"
	@echo -e "  build-ts               - Build TypeScript packages"
	@echo -e ""
	@echo -e "$(GREEN)Cleanup:$(NC)"
	@echo -e "  clean                  - Clean build artifacts"
	@echo -e "  clean-all              - Clean everything including node_modules"
	@echo -e ""
	@echo -e "Highlighted targets are the most commonly used."
	@echo -e ""

#=============================================================================
# Tool Checks
#=============================================================================

check-tools: ## Verify required tools are installed
	@echo -e "$(CYAN)Checking required tools...$(NC)"
	@command -v $(UV) >/dev/null 2>&1 || { echo -e "$(RED)ERROR: uv is not installed. Install from https://github.com/astral-sh/uv$(NC)"; exit 1; }
	@echo -e "$(GREEN)✓$(NC) uv found: $$($(UV) --version)"
	@command -v $(PNPM) >/dev/null 2>&1 || { echo -e "$(RED)ERROR: pnpm is not installed. Run: npm install -g pnpm$(NC)"; exit 1; }
	@echo -e "$(GREEN)✓$(NC) pnpm found: $$($(PNPM) --version)"
	@command -v $(TOX) >/dev/null 2>&1 || { echo -e "$(RED)ERROR: tox is not installed. Run: pip install tox$(NC)"; exit 1; }
	@echo -e "$(GREEN)✓$(NC) tox found: $$($(TOX) --version)"
	@command -v $(NODE) >/dev/null 2>&1 || { echo -e "$(RED)ERROR: node is not installed. Install from https://nodejs.org$(NC)"; exit 1; }
	@echo -e "$(GREEN)✓$(NC) node found: $$($(NODE) --version)"
	@command -v $(HATCH) >/dev/null 2>&1 || { echo -e "$(RED)ERROR: hatch is not installed. Run: pip install hatch$(NC)"; exit 1; }
	@echo -e "$(GREEN)✓$(NC) hatch found: $$($(HATCH) --version)"
	@echo -e "$(GREEN)All required tools are installed!$(NC)"

#=============================================================================
# Setup
#=============================================================================

install-python: ## Install Python dependencies
	@echo -e "$(CYAN)Installing Python dependencies...$(NC)"
	@$(UV) venv --python 3.10
	@$(UV) pip install -e ".[dev]"
	@echo -e "$(GREEN)✓ Done$(NC)"

install-node: ## Install Node.js dependencies
	@echo -e "$(CYAN)Installing Node.js dependencies...$(NC)"
	@cd $(APP_DIR) && $(PNPM) install --silent
	@cd $(JS_DIR) && $(PNPM) install --silent
	@echo -e "$(GREEN)✓ Done$(NC)"

setup-symlinks: ## Create Python package symlinks
	@echo -e "$(CYAN)Creating Python package symlinks...$(NC)"
	@$(TOX) run -q -e add_symlinks
	@echo -e "$(GREEN)✓ Done$(NC)"

setup: check-tools install-python install-node setup-symlinks ## Complete development environment setup
	@echo -e ""
	@echo -e "$(GREEN)✓ Phoenix development environment setup complete!$(NC)"
	@echo -e ""
	@echo -e "Next steps:"
	@echo -e "  1. Activate Python virtualenv: source .venv/bin/activate"
	@echo -e "  2. Start development: make dev"
	@echo -e ""

#=============================================================================
# Schema Generation
#=============================================================================

schema-graphql: ## Generate GraphQL schema from Python
	@echo -e "$(CYAN)Generating GraphQL schema...$(NC)"
	@$(TOX) run -q -e build_graphql_schema
	@echo -e "$(GREEN)✓ app/schema.graphql$(NC)"

relay-build: ## Build Relay from GraphQL schema
	@echo -e "$(CYAN)Building Relay GraphQL types...$(NC)"
	@cd $(APP_DIR) && $(PNPM) run --silent build:relay
	@echo -e "$(GREEN)✓ Done$(NC)"

graphql: schema-graphql relay-build ## Generate GraphQL schema and build Relay (full workflow)
	@echo -e "$(GREEN)✓ GraphQL schema workflow complete$(NC)"

schema-openapi: ## Generate OpenAPI schema from Python
	@echo -e "$(CYAN)Generating OpenAPI schema...$(NC)"
	@$(TOX) run -q -e build_openapi_schema
	@echo -e "$(GREEN)✓ schemas/openapi.json$(NC)"

codegen-python-client: ## Generate Python client types from OpenAPI
	@echo -e "$(CYAN)Generating Python client types...$(NC)"
	@$(TOX) run -q -e openapi_codegen_for_python_client
	@echo -e "$(GREEN)✓ Done$(NC)"

codegen-ts-client: ## Generate TypeScript client types from OpenAPI
	@echo -e "$(CYAN)Generating TypeScript client types...$(NC)"
	@cd $(JS_DIR)/packages/phoenix-client && $(PNPM) run --silent generate
	@echo -e "$(GREEN)✓ Done$(NC)"

openapi: schema-openapi codegen-python-client codegen-ts-client ## Generate OpenAPI schema and all clients (full workflow)
	@echo -e "$(GREEN)✓ OpenAPI schema workflow complete$(NC)"

#=============================================================================
# Development
#=============================================================================

dev: ## Full dev environment (backend + frontend with hot reload)
	@echo -e "$(CYAN)Starting full development environment...$(NC)"
	cd $(APP_DIR) && $(PNPM) dev

dev-backend: ## Backend only (FastAPI server)
	@echo -e "$(CYAN)Starting backend server...$(NC)"
	$(TOX) run -e phoenix_main

dev-frontend: ## Frontend only (React dev server)
	@echo -e "$(CYAN)Starting frontend dev server...$(NC)"
	cd $(APP_DIR) && $(PNPM) run dev:ui

#=============================================================================
# Testing
#=============================================================================

test-python: ## Run Python tests (unit + integration)
	@echo -e "$(CYAN)Running Python unit tests...$(NC)"
	@$(TOX) run -q -e unit_tests -- -n auto
	@echo -e "$(CYAN)Running Python integration tests...$(NC)"
	@$(TOX) run -q -e integration_tests

test-frontend: ## Run frontend tests (app/)
	@echo -e "$(CYAN)Running frontend tests...$(NC)"
	@cd $(APP_DIR) && $(PNPM) test

test-ts: ## Run TypeScript package tests (js/)
	@echo -e "$(CYAN)Running TypeScript package tests...$(NC)"
	@cd $(JS_DIR) && $(PNPM) run -r test

test: test-python test-frontend test-ts ## Run all tests (Python + frontend + TypeScript)
	@echo -e "$(GREEN)✓ All tests complete$(NC)"

typecheck-python: ## Type check Python code
	@echo -e "$(CYAN)Type checking Python...$(NC)"
	@$(TOX) run -q -e remove_symlinks,type_check,add_symlinks

typecheck-python-ty: ## Type check Python with ty (verify expected errors only)
	@echo -e "$(CYAN)Type checking Python with ty...$(NC)"
	@$(UV) run python scripts/uv/type-check/type_check.py
	@echo -e "$(GREEN)✓ Done$(NC)"

typecheck-frontend: ## Type check frontend (app/)
	@echo -e "$(CYAN)Type checking frontend...$(NC)"
	@cd $(APP_DIR) && $(PNPM) run --silent typecheck

typecheck-ts: ## Type check TypeScript packages (js/)
	@echo -e "$(CYAN)Type checking TypeScript packages...$(NC)"
	@cd $(JS_DIR) && $(PNPM) run --silent -r typecheck

typecheck: typecheck-python typecheck-frontend typecheck-ts ## Type check all code (Python + frontend + TypeScript)
	@echo -e "$(GREEN)✓ Type checking complete$(NC)"

#=============================================================================
# Code Quality
#=============================================================================

format-python: ## Format Python code with ruff
	@echo -e "$(CYAN)Formatting Python code...$(NC)"
	@$(TOX) run -q -e ruff
	@echo -e "$(GREEN)✓ Done$(NC)"

format-frontend: ## Format frontend (app/)
	@echo -e "$(CYAN)Formatting frontend...$(NC)"
	@cd $(APP_DIR) && $(PNPM) run --silent lint:fix
	@echo -e "$(GREEN)✓ Done$(NC)"

format-ts: ## Format TypeScript packages (js/)
	@echo -e "$(CYAN)Formatting TypeScript packages...$(NC)"
	@cd $(JS_DIR) && $(PNPM) run --silent prettier:write
	@echo -e "$(GREEN)✓ Done$(NC)"

format: format-python format-frontend format-ts ## Format all code (Python + frontend + TypeScript)
	@echo -e "$(GREEN)✓ Code formatting complete$(NC)"

clean-notebooks: ## Clean Jupyter notebook metadata
	@echo -e "$(CYAN)Cleaning Jupyter notebook metadata...$(NC)"
	@$(TOX) run -q -e clean_jupyter_notebooks
	@echo -e "$(GREEN)✓ Done$(NC)"

lint-python: ## Lint Python code with ruff
	@echo -e "$(CYAN)Linting Python code...$(NC)"
	@$(TOX) run -q -e ruff
	@echo -e "$(GREEN)✓ Done$(NC)"

lint-frontend: ## Lint frontend (app/)
	@echo -e "$(CYAN)Linting frontend...$(NC)"
	@cd $(APP_DIR) && $(PNPM) run --silent lint
	@echo -e "$(GREEN)✓ Done$(NC)"

lint-ts: ## Lint TypeScript packages (js/)
	@echo -e "$(CYAN)Linting TypeScript packages...$(NC)"
	@cd $(JS_DIR) && $(PNPM) run --silent lint
	@echo -e "$(GREEN)✓ Done$(NC)"

lint: lint-python lint-frontend lint-ts ## Lint all code (Python + frontend + TypeScript)
	@echo -e "$(GREEN)✓ Linting complete$(NC)"

#=============================================================================
# Build
#=============================================================================

build-python: ## Build Python package
	@echo -e "$(CYAN)Building Python package...$(NC)"
	@$(HATCH) build
	@echo -e "$(GREEN)✓ dist/$(NC)"

build-frontend: ## Build frontend for production
	@echo -e "$(CYAN)Building frontend...$(NC)"
	@cd $(APP_DIR) && $(PNPM) run --silent build
	@echo -e "$(GREEN)✓ Done$(NC)"

build-ts: ## Build TypeScript packages
	@echo -e "$(CYAN)Building TypeScript packages...$(NC)"
	@cd $(JS_DIR) && $(PNPM) run --silent -r build
	@echo -e "$(GREEN)✓ Done$(NC)"

build: build-python build-frontend build-ts ## Build everything (Python + frontend + TypeScript packages)
	@echo -e "$(GREEN)✓ Build complete$(NC)"

#=============================================================================
# Cleanup
#=============================================================================

clean: ## Clean build artifacts
	@echo -e "$(CYAN)Cleaning build artifacts...$(NC)"
	@rm -rf dist/ build/ *.egg-info
	@rm -rf $(APP_DIR)/dist $(APP_DIR)/build
	@find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
	@find . -type d -name ".pytest_cache" -exec rm -rf {} + 2>/dev/null || true
	@find . -type d -name ".ruff_cache" -exec rm -rf {} + 2>/dev/null || true
	@find . -type d -name ".mypy_cache" -exec rm -rf {} + 2>/dev/null || true
	@find . -type f -name "*.pyc" -delete
	@echo -e "$(GREEN)✓ Done$(NC)"

clean-all: clean ## Clean everything including node_modules
	@echo -e "$(CYAN)Cleaning node_modules...$(NC)"
	@rm -rf $(APP_DIR)/node_modules $(APP_DIR)/.pnpm-store
	@rm -rf $(JS_DIR)/node_modules $(JS_DIR)/.pnpm-store
	@find $(JS_DIR) -type d -name "node_modules" -exec rm -rf {} + 2>/dev/null || true
	@rm -rf .venv
	@echo -e "$(GREEN)✓ Done$(NC)"

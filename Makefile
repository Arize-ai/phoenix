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
	test test-python test-ts typecheck typecheck-python typecheck-ts \
	format format-python format-ts lint lint-python lint-ts \
	build build-python build-frontend build-ts \
	clean clean-all

help: ## Show this help message
	@echo ""
	@echo "$(CYAN)Phoenix Monorepo - Available Make Targets$(NC)"
	@echo ""
	@echo "$(GREEN)Schema Generation:$(NC)"
	@echo "  $(YELLOW)graphql$(NC)                  - Generate GraphQL schema and build Relay (Python → TypeScript)"
	@echo "  $(YELLOW)openapi$(NC)                  - Generate OpenAPI schema and clients (Python + TypeScript)"
	@echo "  schema-graphql             - Generate GraphQL schema only"
	@echo "  relay-build                - Build Relay from existing schema"
	@echo "  schema-openapi             - Generate OpenAPI schema only"
	@echo "  codegen-python-client      - Generate Python client types from OpenAPI"
	@echo "  codegen-ts-client          - Generate TypeScript client types from OpenAPI"
	@echo ""
	@echo "$(GREEN)Setup:$(NC)"
	@echo "  $(YELLOW)setup$(NC)                    - Complete development environment setup"
	@echo "  check-tools                - Verify required tools are installed"
	@echo "  install-python             - Install Python dependencies"
	@echo "  install-node               - Install Node.js dependencies"
	@echo "  setup-symlinks             - Create Python package symlinks"
	@echo ""
	@echo "$(GREEN)Development:$(NC)"
	@echo "  $(YELLOW)dev$(NC)                      - Full dev environment (backend + frontend)"
	@echo "  dev-backend                - Backend only (FastAPI server)"
	@echo "  dev-frontend               - Frontend only (React dev server)"
	@echo ""
	@echo "$(GREEN)Testing:$(NC)"
	@echo "  $(YELLOW)test$(NC)                     - Run all tests (Python + TypeScript)"
	@echo "  test-python                - Run Python tests (unit + integration)"
	@echo "  test-ts                    - Run TypeScript tests (app + packages)"
	@echo "  typecheck                  - Type check all code (Python + TypeScript)"
	@echo "  typecheck-python           - Type check Python only"
	@echo "  typecheck-ts               - Type check TypeScript only"
	@echo ""
	@echo "$(GREEN)Code Quality:$(NC)"
	@echo "  $(YELLOW)format$(NC)                   - Format all code (Python + TypeScript)"
	@echo "  format-python              - Format Python with ruff"
	@echo "  format-ts                  - Format TypeScript with prettier"
	@echo "  $(YELLOW)lint$(NC)                     - Lint all code (Python + TypeScript)"
	@echo "  lint-python                - Lint Python with ruff"
	@echo "  lint-ts                    - Lint TypeScript with ESLint"
	@echo ""
	@echo "$(GREEN)Build:$(NC)"
	@echo "  $(YELLOW)build$(NC)                    - Build everything (Python + frontend + TypeScript packages)"
	@echo "  build-python               - Build Python package"
	@echo "  build-frontend             - Build frontend"
	@echo "  build-ts                   - Build TypeScript packages"
	@echo ""
	@echo "$(GREEN)Cleanup:$(NC)"
	@echo "  clean                      - Clean build artifacts"
	@echo "  clean-all                  - Clean everything including node_modules"
	@echo ""
	@echo "Highlighted targets are the most commonly used."
	@echo ""

#=============================================================================
# Tool Checks
#=============================================================================

check-tools: ## Verify required tools are installed
	@echo "$(CYAN)Checking required tools...$(NC)"
	@command -v $(UV) >/dev/null 2>&1 || { echo "$(RED)ERROR: uv is not installed. Install from https://github.com/astral-sh/uv$(NC)"; exit 1; }
	@echo "$(GREEN)✓$(NC) uv found: $$($(UV) --version)"
	@command -v $(PNPM) >/dev/null 2>&1 || { echo "$(RED)ERROR: pnpm is not installed. Run: npm install -g pnpm$(NC)"; exit 1; }
	@echo "$(GREEN)✓$(NC) pnpm found: $$($(PNPM) --version)"
	@command -v $(TOX) >/dev/null 2>&1 || { echo "$(RED)ERROR: tox is not installed. Run: pip install tox$(NC)"; exit 1; }
	@echo "$(GREEN)✓$(NC) tox found: $$($(TOX) --version)"
	@command -v $(NODE) >/dev/null 2>&1 || { echo "$(RED)ERROR: node is not installed. Install from https://nodejs.org$(NC)"; exit 1; }
	@echo "$(GREEN)✓$(NC) node found: $$($(NODE) --version)"
	@command -v $(HATCH) >/dev/null 2>&1 || { echo "$(RED)ERROR: hatch is not installed. Run: pip install hatch$(NC)"; exit 1; }
	@echo "$(GREEN)✓$(NC) hatch found: $$($(HATCH) --version)"
	@echo "$(GREEN)All required tools are installed!$(NC)"

#=============================================================================
# Setup
#=============================================================================

install-python: ## Install Python dependencies
	@echo "$(CYAN)Installing Python dependencies...$(NC)"
	$(UV) venv --python 3.10
	$(UV) pip install -e ".[dev]"
	@echo "$(GREEN)Python dependencies installed!$(NC)"

install-node: ## Install Node.js dependencies
	@echo "$(CYAN)Installing Node.js dependencies...$(NC)"
	cd $(APP_DIR) && $(PNPM) install
	cd $(JS_DIR) && $(PNPM) install
	@echo "$(GREEN)Node.js dependencies installed!$(NC)"

setup-symlinks: ## Create Python package symlinks
	@echo "$(CYAN)Creating Python package symlinks...$(NC)"
	$(TOX) run -e add_symlinks
	@echo "$(GREEN)Symlinks created!$(NC)"

setup: check-tools install-python install-node setup-symlinks ## Complete development environment setup
	@echo ""
	@echo "$(GREEN)✓ Phoenix development environment setup complete!$(NC)"
	@echo ""
	@echo "Next steps:"
	@echo "  1. Activate Python virtualenv: source .venv/bin/activate"
	@echo "  2. Start development: make dev"
	@echo ""

#=============================================================================
# Schema Generation
#=============================================================================

schema-graphql: ## Generate GraphQL schema from Python
	@echo "$(CYAN)Generating GraphQL schema...$(NC)"
	$(TOX) run -e build_graphql_schema
	@echo "$(GREEN)GraphQL schema generated at app/schema.graphql$(NC)"

relay-build: ## Build Relay from GraphQL schema
	@echo "$(CYAN)Building Relay GraphQL types...$(NC)"
	cd $(APP_DIR) && $(PNPM) run build:relay
	@echo "$(GREEN)Relay types generated!$(NC)"

graphql: schema-graphql relay-build ## Generate GraphQL schema and build Relay (full workflow)
	@echo ""
	@echo "$(GREEN)✓ GraphQL schema workflow complete!$(NC)"
	@echo "  1. GraphQL schema: app/schema.graphql"
	@echo "  2. Relay types: app/src/__generated__/**"
	@echo ""

schema-openapi: ## Generate OpenAPI schema from Python
	@echo "$(CYAN)Generating OpenAPI schema...$(NC)"
	$(TOX) run -e build_openapi_schema
	@echo "$(GREEN)OpenAPI schema generated at schemas/openapi.json$(NC)"

codegen-python-client: ## Generate Python client types from OpenAPI
	@echo "$(CYAN)Generating Python client types...$(NC)"
	$(TOX) run -e openapi_codegen_for_python_client
	@echo "$(GREEN)Python client types generated at packages/phoenix-client/src/phoenix/client/__generated__/v1/$(NC)"

codegen-ts-client: ## Generate TypeScript client types from OpenAPI
	@echo "$(CYAN)Generating TypeScript client types...$(NC)"
	cd $(JS_DIR)/packages/phoenix-client && $(PNPM) run generate
	@echo "$(GREEN)TypeScript client types generated at js/packages/phoenix-client/src/__generated__/api/v1.ts$(NC)"

openapi: schema-openapi codegen-python-client codegen-ts-client ## Generate OpenAPI schema and all clients (full workflow)
	@echo ""
	@echo "$(GREEN)✓ OpenAPI schema workflow complete!$(NC)"
	@echo "  1. OpenAPI schema: schemas/openapi.json"
	@echo "  2. Python client: packages/phoenix-client/src/phoenix/client/__generated__/v1/"
	@echo "  3. TypeScript client: js/packages/phoenix-client/src/__generated__/api/v1.ts"
	@echo ""

#=============================================================================
# Development
#=============================================================================

dev: ## Full dev environment (backend + frontend with hot reload)
	@echo "$(CYAN)Starting full development environment...$(NC)"
	cd $(APP_DIR) && $(PNPM) dev

dev-backend: ## Backend only (FastAPI server)
	@echo "$(CYAN)Starting backend server...$(NC)"
	$(TOX) run -e phoenix_main

dev-frontend: ## Frontend only (React dev server)
	@echo "$(CYAN)Starting frontend dev server...$(NC)"
	cd $(APP_DIR) && $(PNPM) run dev:ui

#=============================================================================
# Testing
#=============================================================================

test-python: ## Run Python tests (unit + integration)
	@echo "$(CYAN)Running Python tests...$(NC)"
	$(TOX) run -e unit_tests,integration_tests

test-ts: ## Run TypeScript tests (app + packages)
	@echo "$(CYAN)Running TypeScript tests...$(NC)"
	cd $(APP_DIR) && $(PNPM) test
	cd $(JS_DIR) && $(PNPM) run -r test

test: test-python test-ts ## Run all tests (Python + TypeScript)
	@echo ""
	@echo "$(GREEN)✓ All tests complete!$(NC)"
	@echo ""

typecheck-python: ## Type check Python code
	@echo "$(CYAN)Type checking Python...$(NC)"
	$(TOX) run -e remove_symlinks,type_check,add_symlinks

typecheck-ts: ## Type check TypeScript code
	@echo "$(CYAN)Type checking TypeScript...$(NC)"
	cd $(APP_DIR) && $(PNPM) run typecheck
	cd $(JS_DIR) && $(PNPM) run -r typecheck

typecheck: typecheck-python typecheck-ts ## Type check all code (Python + TypeScript)
	@echo ""
	@echo "$(GREEN)✓ Type checking complete!$(NC)"
	@echo ""

#=============================================================================
# Code Quality
#=============================================================================

format-python: ## Format Python code with ruff
	@echo "$(CYAN)Formatting Python code...$(NC)"
	$(TOX) run -e ruff

format-ts: ## Format TypeScript code
	@echo "$(CYAN)Formatting TypeScript code...$(NC)"
	cd $(APP_DIR) && $(PNPM) run lint:fix
	cd $(JS_DIR) && $(PNPM) run lint:fix

format: format-python format-ts ## Format all code (Python + TypeScript)
	@echo ""
	@echo "$(GREEN)✓ Code formatting complete!$(NC)"
	@echo ""

lint-python: ## Lint Python code with ruff
	@echo "$(CYAN)Linting Python code...$(NC)"
	$(TOX) run -e ruff

lint-ts: ## Lint TypeScript code
	@echo "$(CYAN)Linting TypeScript code...$(NC)"
	cd $(APP_DIR) && $(PNPM) run lint
	cd $(JS_DIR) && $(PNPM) run lint

lint: lint-python lint-ts ## Lint all code (Python + TypeScript)
	@echo ""
	@echo "$(GREEN)✓ Linting complete!$(NC)"
	@echo ""

#=============================================================================
# Build
#=============================================================================

build-python: ## Build Python package
	@echo "$(CYAN)Building Python package...$(NC)"
	$(HATCH) build
	@echo "$(GREEN)Python package built in dist/$(NC)"

build-frontend: ## Build frontend for production
	@echo "$(CYAN)Building frontend...$(NC)"
	cd $(APP_DIR) && $(PNPM) run build
	@echo "$(GREEN)Frontend built!$(NC)"

build-ts: ## Build TypeScript packages
	@echo "$(CYAN)Building TypeScript packages...$(NC)"
	cd $(JS_DIR) && $(PNPM) run -r build
	@echo "$(GREEN)TypeScript packages built!$(NC)"

build: build-python build-frontend build-ts ## Build everything (Python + frontend + TypeScript packages)
	@echo ""
	@echo "$(GREEN)✓ Build complete!$(NC)"
	@echo ""

#=============================================================================
# Cleanup
#=============================================================================

clean: ## Clean build artifacts
	@echo "$(CYAN)Cleaning build artifacts...$(NC)"
	rm -rf dist/ build/ *.egg-info
	rm -rf $(APP_DIR)/dist $(APP_DIR)/build
	find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name ".pytest_cache" -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name ".ruff_cache" -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name ".mypy_cache" -exec rm -rf {} + 2>/dev/null || true
	find . -type f -name "*.pyc" -delete
	@echo "$(GREEN)Build artifacts cleaned!$(NC)"

clean-all: clean ## Clean everything including node_modules
	@echo "$(CYAN)Cleaning all artifacts including node_modules...$(NC)"
	rm -rf $(APP_DIR)/node_modules $(APP_DIR)/.pnpm-store
	rm -rf $(JS_DIR)/node_modules $(JS_DIR)/.pnpm-store
	find $(JS_DIR) -type d -name "node_modules" -exec rm -rf {} + 2>/dev/null || true
	rm -rf .venv
	@echo "$(GREEN)All artifacts cleaned!$(NC)"

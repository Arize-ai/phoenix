# Phoenix Monorepo Makefile
# Unified commands for Python and TypeScript development

SHELL := /bin/bash
.DEFAULT_GOAL := help

# Tools
TOX := tox
PNPM := pnpm
UV := uv
NODE := node

# Directories
APP_DIR := js/app
JS_DIR := js
SCHEMAS_DIR := schemas
PACKAGES_DIR := packages
PHOENIX_CLIENT_GENERATED := packages/phoenix-client/src/phoenix/client/__generated__
GH_COMMENT_WATCH_DIR := scripts/gh-comment-watch

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
	setup setup-remote-export install-python install-node \
	graphql schema-graphql relay-build \
	openapi schema-openapi schema-generative-ui ui-message-stream-fixtures codegen-python-client codegen-ts-client codegen-ts-app \
	dev dev-backend dev-frontend dev-docker dev-mock-llm \
	test test-python test-frontend test-ts test-helm test-jcs doctest typecheck typecheck-python typecheck-python-ty typecheck-frontend typecheck-ts \
	format format-python format-frontend format-ts lint lint-python lint-frontend lint-ts clean-notebooks \
	build build-python build-frontend build-ts \
	codegen-prompts sync-models schema-ddl check-graphql-permissions gen-otel-models \
	gen-session-filter-ai-query-vocabulary check-session-filter-ai-query-vocabulary \
	gh-comment-watch \
	harbor-stage-environments harbor-publish-fixtures harbor-oracle harbor-run harbor-view \
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
	@echo -e "  schema-generative-ui   - Generate Generative UI catalog schema artifacts"
	@echo -e "  ui-message-stream-fixtures - Generate AI SDK reducer conformance fixtures"
	@echo -e "  codegen-python-client  - Generate Python client types from OpenAPI"
	@echo -e "  codegen-ts-client      - Generate TypeScript client types from OpenAPI"
	@echo -e "  codegen-ts-app         - Generate TypeScript OpenAPI types for frontend (js/app/)"
	@echo -e ""
	@echo -e "$(GREEN)Setup:$(NC)"
	@echo -e "  $(YELLOW)setup$(NC)                 - Complete development environment setup"
	@echo -e "  setup-remote-export   - Configure PXI remote trace export"
	@echo -e "  check-tools            - Verify required tools are installed"
	@echo -e "  install-python         - Install Python dependencies"
	@echo -e "  install-node           - Install Node.js dependencies"
	@echo -e ""
	@echo -e "$(GREEN)Development:$(NC)"
	@echo -e "  $(YELLOW)dev$(NC)                   - Full dev environment (backend + frontend)"
	@echo -e "  dev-backend            - Backend only (FastAPI server)"
	@echo -e "  dev-frontend           - Frontend only (React dev server)"
	@echo -e "  dev-docker             - Docker devops environment (use ARGS= for arguments)"
	@echo -e "  dev-mock-llm           - Start the mock LLM server"
	@echo -e ""
	@echo -e "$(GREEN)Testing:$(NC)"
	@echo -e "  $(YELLOW)test$(NC)                  - Run all tests (Python + TypeScript workspace)"
	@echo -e "  test-python            - Run Python tests (unit + integration)"
	@echo -e "  test-frontend          - Run frontend tests only (js/app/)"
	@echo -e "  test-ts                - Run all TypeScript tests (js/ workspace)"
	@echo -e "  test-helm              - Run Helm chart tests"
	@echo -e "  doctest                - Run doctests across all modules in src/ (override with MODULES=...)"
	@echo -e "  typecheck              - Type check all code (Python + TypeScript workspace)"
	@echo -e "  typecheck-python       - Type check Python only"
	@echo -e "  typecheck-python-ty    - Type check Python with ty (verify expected errors only)"
	@echo -e "  typecheck-frontend     - Type check frontend only (js/app/)"
	@echo -e "  typecheck-ts           - Type check all TypeScript (js/ workspace)"
	@echo -e ""
	@echo -e "$(GREEN)Code Quality:$(NC)"
	@echo -e "  $(YELLOW)format$(NC)                - Format all code (Python + TypeScript workspace)"
	@echo -e "  format-python          - Format Python with ruff"
	@echo -e "  format-frontend        - Format frontend only (js/app/)"
	@echo -e "  format-ts              - Format all TypeScript (js/ workspace)"
	@echo -e "  clean-notebooks        - Clean Jupyter notebook metadata"
	@echo -e "  $(YELLOW)lint$(NC)                  - Lint all code (Python + TypeScript workspace)"
	@echo -e "  lint-python            - Lint Python with ruff"
	@echo -e "  lint-frontend          - Lint frontend only (js/app/)"
	@echo -e "  lint-ts                - Lint all TypeScript (js/ workspace)"
	@echo -e "  check-graphql-permissions - Ensure GraphQL mutations have permission classes"
	@echo -e ""
	@echo -e "$(GREEN)Utilities:$(NC)"
	@echo -e "  codegen-prompts        - Compile YAML prompts to Python and TypeScript"
	@echo -e "  sync-models            - Sync model cost manifest from remote sources"
	@echo -e "  schema-ddl             - Compile DDL schema from PostgreSQL and SQLite (use ARGS=/SQLITE_ARGS= for arguments)"
	@echo -e "  gen-otel-models        - Generate OTel GenAI semconv Pydantic models"
	@echo -e "  gen-session-filter-ai-query-vocabulary   - Generate the session AI query vocabulary"
	@echo -e "  check-session-filter-ai-query-vocabulary - Check the session AI query vocabulary for drift"
	@echo -e "  gh-comment-watch       - Start the GitHub comment watcher"
	@echo -e ""
	@echo -e "$(GREEN)Harbor Evals:$(NC)"
	@echo -e "  harbor-stage-environments - Build the Phoenix wheel and stage each Harbor task environment"
	@echo -e "  harbor-publish-fixtures   - Regenerate fixtures and publish to cloud storage"
	@echo -e "  $(YELLOW)harbor-oracle$(NC)            - Validate the task with the oracle (HARBOR_TASK=..., HARBOR_ENV=...)"
	@echo -e "  $(YELLOW)harbor-run$(NC)               - Run the real ServerAgent trial (HARBOR_TASK=..., HARBOR_MODEL=..., HARBOR_ENV=...)"
	@echo -e "  harbor-view               - Browse Harbor job results in a local web viewer"
	@echo -e ""
	@echo -e "$(GREEN)Build:$(NC)"
	@echo -e "  $(YELLOW)build$(NC)                 - Build everything (Python + TypeScript workspace)"
	@echo -e "  build-python           - Build Python package"
	@echo -e "  build-frontend         - Build frontend only (js/app/ and its deps)"
	@echo -e "  build-ts               - Build all TypeScript (js/ workspace)"
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
	@echo -e "$(GREEN)All required tools are installed!$(NC)"

#=============================================================================
# Setup
#=============================================================================

install-python: ## Install Python dependencies
	@echo -e "$(CYAN)Installing Python dependencies...$(NC)"
	@$(UV) sync --python 3.10
	@echo -e "$(GREEN)✓ Done$(NC)"

install-node: ## Install Node.js dependencies
	@echo -e "$(CYAN)Installing Node.js dependencies...$(NC)"
	@cd $(JS_DIR) && $(PNPM) install --silent
	@echo -e "$(CYAN)Building workspace dependencies of the app...$(NC)"
	@cd $(APP_DIR) && $(PNPM) run --silent build:deps
	@echo -e "$(GREEN)✓ Done$(NC)"

setup: check-tools install-python install-node ## Complete development environment setup
	@echo -e ""
	@echo -e "$(GREEN)✓ Phoenix development environment setup complete!$(NC)"
	@echo -e ""
	@echo -e "Next steps:"
	@echo -e "  1. Activate Python virtualenv: source .venv/bin/activate"
	@echo -e "  2. Start development: make dev"
	@echo -e ""

setup-remote-export: ## Configure PXI remote trace export
	@$(NODE) --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON $(APP_DIR)/scripts/setup-remote-export.ts

#=============================================================================
# Schema Generation
#=============================================================================

schema-graphql: ## Generate GraphQL schema from Python
	@echo -e "$(CYAN)Generating GraphQL schema...$(NC)"
	@$(UV) run strawberry export-schema phoenix.server.api.schema:_EXPORTED_GRAPHQL_SCHEMA -o $(APP_DIR)/schema.graphql
	@echo -e "$(GREEN)✓ js/app/schema.graphql$(NC)"

relay-build: ## Build Relay from GraphQL schema
	@echo -e "$(CYAN)Building Relay GraphQL types...$(NC)"
	@cd $(APP_DIR) && $(PNPM) run --silent build:relay
	@echo -e "$(GREEN)✓ Done$(NC)"

graphql: schema-graphql relay-build ## Generate GraphQL schema and build Relay (full workflow)
	@echo -e "$(GREEN)✓ GraphQL schema workflow complete$(NC)"

schema-openapi: ## Generate OpenAPI schema from Python
	@echo -e "$(CYAN)Generating OpenAPI schema...$(NC)"
	@$(UV) run python scripts/ci/compile_openapi_schema.py -o $(SCHEMAS_DIR)/openapi.json
	@echo -e "$(GREEN)✓ schemas/openapi.json$(NC)"

codegen-python-client: ## Generate Python client types from OpenAPI
	@echo -e "$(CYAN)Generating Python client types...$(NC)"
	@rm -f $(PHOENIX_CLIENT_GENERATED)/v1/__init__.py
	@$(UV) run datamodel-codegen \
		--input $(CURDIR)/schemas/openapi.json \
		--input-file-type openapi \
		--output $(PHOENIX_CLIENT_GENERATED)/v1/.dataclass.py \
		--output-model-type dataclasses.dataclass \
		--collapse-root-models \
		--enum-field-as-literal all \
		--target-python-version 3.10 \
		--use-default-kwarg \
		--use-double-quotes \
		--use-generic-container-types \
		--no-use-union-operator \
		--wrap-string-literal \
		--formatters black isort \
		--disable-timestamp
	@$(UV) run python $(CURDIR)/packages/phoenix-client/scripts/codegen/transform.py $(PHOENIX_CLIENT_GENERATED)/v1
	@$(UV) run ruff format $(PHOENIX_CLIENT_GENERATED)/v1
	@$(UV) run ruff check --fix $(PHOENIX_CLIENT_GENERATED)/v1
	@echo -e "$(GREEN)✓ Done$(NC)"

codegen-ts-client: ## Generate TypeScript client types from OpenAPI
	@echo -e "$(CYAN)Generating TypeScript client types...$(NC)"
	@cd $(JS_DIR)/packages/phoenix-client && $(PNPM) run --silent generate
	@cd $(JS_DIR)/packages/phoenix-testing && $(PNPM) run --silent generate
	@echo -e "$(GREEN)✓ Done$(NC)"

codegen-ts-testing: ## Generate phoenix-testing TypeScript types from OpenAPI
	@echo -e "$(CYAN)Generating phoenix-testing TypeScript types...$(NC)"
	@cd $(JS_DIR)/packages/phoenix-testing && $(PNPM) run --silent generate
	@echo -e "$(GREEN)✓ Done$(NC)"

codegen-ts-app: ## Generate TypeScript OpenAPI types for js/app/
	@echo -e "$(CYAN)Generating TypeScript OpenAPI types for app...$(NC)"
	@cd $(APP_DIR) && $(PNPM) run --silent generate:openapi
	@echo -e "$(GREEN)✓ Done$(NC)"

schema-generative-ui: ## Generate generative UI catalog schema artifacts
	@echo -e "$(CYAN)Generating UI catalog schema artifacts...$(NC)"
	@cd $(APP_DIR) && $(PNPM) run --silent generate:generative-ui-catalog
	@echo -e "$(GREEN)✓ src/phoenix/server/generative_ui$(NC)"

ui-message-stream-fixtures: ## Generate AI SDK UI-message reducer conformance fixtures
	@echo -e "$(CYAN)Generating UI-message stream conformance fixtures...$(NC)"
	@cd $(APP_DIR) && $(PNPM) run --silent generate:ui-message-stream-fixtures
	@echo -e "$(GREEN)✓ tests/unit/server/agents/fixtures/ui_message_stream$(NC)"

openapi: schema-openapi codegen-python-client codegen-ts-client codegen-ts-testing codegen-ts-app ## Generate OpenAPI schema and all clients (full workflow)
	@echo -e "$(GREEN)✓ OpenAPI schema workflow complete$(NC)"

#=============================================================================
# Development
#=============================================================================

dev: ## Full dev environment (backend + frontend with hot reload)
	@echo -e "$(CYAN)Starting full development environment...$(NC)"
	cd $(APP_DIR) && $(PNPM) dev

dev-backend: ## Backend only (FastAPI server)
	@echo -e "$(CYAN)Starting backend server...$(NC)"
	$(UV) run phoenix serve --debug
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

# Run doctests across all modules under src/ by default; override on the command
# line, e.g. `make doctest MODULES="src/phoenix/foo.py src/phoenix/bar.py"`.
DOCTEST_MODULES ?= src/phoenix

doctest: ## Run doctests across all modules in src/ (override with MODULES=...)
	@echo -e "$(CYAN)Running doctests on $(or $(MODULES),$(DOCTEST_MODULES))...$(NC)"
	@$(UV) run pytest --doctest-modules $(or $(MODULES),$(DOCTEST_MODULES))
	@echo -e "$(GREEN)✓ Doctests passed$(NC)"

test-frontend: ## Run frontend tests (js/app/)
	@echo -e "$(CYAN)Running frontend tests...$(NC)"
	@cd $(APP_DIR) && $(PNPM) test

test-ts: ## Run all TypeScript tests (js/ workspace, including the app)
	@echo -e "$(CYAN)Running TypeScript tests...$(NC)"
	@cd $(JS_DIR) && $(PNPM) run test

test: test-python test-ts ## Run all tests (Python + TypeScript workspace)
	@echo -e "$(GREEN)✓ All tests complete$(NC)"

typecheck-python: ## Type check Python code
	@echo -e "$(CYAN)Type checking Python...$(NC)"
	@$(UV) run mypy
	@echo -e "$(GREEN)✓ Type check complete$(NC)"

typecheck-python-ty: ## Type check Python with ty (verify expected errors only)
	@echo -e "$(CYAN)Type checking Python with ty...$(NC)"
	@$(UV) run python scripts/uv/type_check/type_check.py
	@echo -e "$(GREEN)✓ Done$(NC)"

typecheck-frontend: ## Type check frontend (js/app/)
	@echo -e "$(CYAN)Type checking frontend...$(NC)"
	@cd $(APP_DIR) && $(PNPM) run --silent typecheck

typecheck-ts: ## Type check all TypeScript (js/ workspace, including the app)
	@echo -e "$(CYAN)Type checking TypeScript...$(NC)"
	@cd $(JS_DIR) && $(PNPM) run --silent typecheck

typecheck: check-session-filter-ai-query-vocabulary typecheck-python typecheck-ts ## Type check all code (Python + TypeScript workspace)
	@echo -e "$(GREEN)✓ Type checking complete$(NC)"

#=============================================================================
# Code Quality
#=============================================================================

format-python: ## Format Python code with ruff
	@echo -e "$(CYAN)Formatting Python code...$(NC)"
	@$(UV) run ruff format
	@echo -e "$(GREEN)✓ Done$(NC)"

format-frontend: ## Format frontend (js/app/)
	@echo -e "$(CYAN)Formatting frontend...$(NC)"
	@cd $(APP_DIR) && $(PNPM) run --silent fmt
	@echo -e "$(GREEN)✓ Done$(NC)"

format-ts: ## Format all TypeScript (js/ workspace, including the app)
	@echo -e "$(CYAN)Formatting TypeScript...$(NC)"
	@cd $(JS_DIR) && $(PNPM) run --silent fmt
	@echo -e "$(GREEN)✓ Done$(NC)"

format: format-python format-ts ## Format all code (Python + TypeScript workspace)
	@echo -e "$(GREEN)✓ Code formatting complete$(NC)"

clean-notebooks: ## Clean Jupyter notebook output and metadata
	@echo -e "$(CYAN)Cleaning Jupyter notebook metadata...$(NC)"
	@find . -type f -name "*.ipynb" \
		-not -path "*/tutorials/evals/*" \
		-exec uv run jupyter nbconvert \
			--ClearOutputPreprocessor.enabled=True \
			--ClearMetadataPreprocessor.enabled=True \
			--inplace {} +
	@echo -e "$(GREEN)✓ Done$(NC)"

lint-python: ## Lint Python code with ruff
	@echo -e "$(CYAN)Linting Python code...$(NC)"
	@$(UV) run ruff check --fix
	@echo -e "$(GREEN)✓ Done$(NC)"

lint-frontend: ## Lint frontend (js/app/)
	@echo -e "$(CYAN)Linting frontend...$(NC)"
	@cd $(APP_DIR) && $(PNPM) run --silent lint
	@echo -e "$(GREEN)✓ Done$(NC)"

lint-ts: ## Lint all TypeScript (js/ workspace, including the app)
	@echo -e "$(CYAN)Linting TypeScript...$(NC)"
	@cd $(JS_DIR) && $(PNPM) run --silent lint
	@echo -e "$(GREEN)✓ Done$(NC)"

lint: lint-python lint-ts ## Lint all code (Python + TypeScript workspace)
	@echo -e "$(GREEN)✓ Linting complete$(NC)"

#=============================================================================
# Build
#=============================================================================

build-python: ## Build Python package
	@echo -e "$(CYAN)Building Python package...$(NC)"
	@$(UV) build
	@echo -e "$(GREEN)✓ dist/$(NC)"

build-frontend: ## Build frontend for production
	@echo -e "$(CYAN)Building frontend...$(NC)"
	@cd $(JS_DIR) && $(PNPM) --filter 'phoenix-ui...' run --silent build
	@echo -e "$(GREEN)✓ Done$(NC)"

build-ts: ## Build all TypeScript (js/ workspace, including the app)
	@echo -e "$(CYAN)Building TypeScript...$(NC)"
	@cd $(JS_DIR) && $(PNPM) run --silent build
	@echo -e "$(GREEN)✓ Done$(NC)"

build: build-python build-ts ## Build everything (Python + TypeScript workspace)
	@echo -e "$(GREEN)✓ Build complete$(NC)"

gen-session-filter-ai-query-vocabulary: ## Generate the session AI query vocabulary
	@$(UV) run python scripts/generate_session_filter_ai_query_vocabulary.py

check-session-filter-ai-query-vocabulary: ## Check the session AI query vocabulary for drift
	@$(UV) run python scripts/generate_session_filter_ai_query_vocabulary.py --check

#=============================================================================
# Utilities
#=============================================================================


codegen-prompts: ## Generate prompts code from YAML files
	@echo -e "$(CYAN)Generating prompts code...$(NC)"
	@$(UV) run python scripts/prompts/compile_python_prompts.py src/phoenix/__generated__/classification_evaluator_configs
	@$(UV) run python scripts/prompts/compile_python_prompts.py packages/phoenix-evals/src/phoenix/evals/__generated__/classification_evaluator_configs
	@$(UV) run ruff format src/phoenix/__generated__/classification_evaluator_configs packages/phoenix-evals/src/phoenix/evals/__generated__/classification_evaluator_configs
	@$(UV) run ruff check --fix src/phoenix/__generated__/classification_evaluator_configs packages/phoenix-evals/src/phoenix/evals/__generated__/classification_evaluator_configs
	@$(UV) run python scripts/prompts/compile_typescript_prompts.py js/packages/phoenix-evals/src/__generated__/default_templates
	@$(UV) run python -c "import shutil; from pathlib import Path; dest = Path('src/phoenix/server/api/helpers/substitutions'); dest.mkdir(exist_ok=True); shutil.copy('prompts/formatters/server.yaml', dest / 'server.yaml')"
	@echo -e "$(GREEN)✓ Done$(NC)"

sync-models: ## Sync model cost manifest from remote sources
	@echo -e "$(CYAN)Syncing model cost manifest...$(NC)"
	@$(UV) run python .github/.scripts/sync_models.py
	@echo -e "$(GREEN)✓ Done$(NC)"

# ARGS=--external points the PostgreSQL extractor at a foreign database, which
# says nothing about SQLite; regenerating sqlite_schema.sql from ephemeral
# migrations would overwrite a checked-in file as a side effect. SQLITE_ARGS
# requests the SQLite step outright, so it always runs.
ifeq (,$(strip $(SQLITE_ARGS)))
SKIP_SQLITE := $(findstring --external,$(ARGS))
endif

schema-ddl: ## Compile DDL schema from PostgreSQL and SQLite databases (ARGS=/SQLITE_ARGS= pass per-database arguments)
	@echo -e "$(CYAN)Compiling DDL schema...$(NC)"
	@$(UV) pip install --strict psycopg[binary] testing.postgresql pglast ty
	@$(UV) pip install --no-sources --strict --reinstall-package arize-phoenix .
	@cd scripts/ddl && $(UV) run ty check *.py && $(UV) run pytest -q -rN test_*.py
	@cd scripts/ddl && $(UV) run python generate_ddl_postgresql.py $(ARGS)
ifeq (,$(SKIP_SQLITE))
	@cd scripts/ddl && $(UV) run python generate_ddl_sqlite.py $(SQLITE_ARGS)
else
	@echo -e "$(YELLOW)Skipping SQLite: ARGS targets an external PostgreSQL database (pass SQLITE_ARGS= to run it too)$(NC)"
endif
	@cd scripts/ddl && $(UV) run python validate_schema_assets.py --postgresql-args "$(ARGS)" --sqlite-args "$(SQLITE_ARGS)"
ifeq (,$(strip $(ARGS))$(strip $(SQLITE_ARGS)))
	@cd scripts/ddl && $(UV) run python compare_schemas.py
else
	@echo -e "$(YELLOW)Skipping cross-dialect comparison: ARGS/SQLITE_ARGS may not have written the canonical files$(NC)"
endif

check-graphql-permissions: ## Ensure GraphQL mutations and subscriptions have permission classes
	@echo -e "$(CYAN)Checking GraphQL permissions...$(NC)"
	@$(UV) run python $(CURDIR)/scripts/ci/ensure_graphql_mutations_have_permission_classes.py src/phoenix/server/api
	@echo -e "$(GREEN)✓ Done$(NC)"

gen-otel-models: ## Generate OTel GenAI semconv Pydantic models into src/phoenix/trace/gen_ai/__generated__/models.py
	@echo -e "$(CYAN)Generating OTel GenAI semconv Pydantic models...$(NC)"
	@$(UV) run --script scripts/generate_otel_gen_ai_models.py
	@$(UV) run ruff format src/phoenix/trace/gen_ai/__generated__/models.py
	@$(UV) run ruff check --fix src/phoenix/trace/gen_ai/__generated__/models.py
	@echo -e "$(GREEN)✓ src/phoenix/trace/gen_ai/__generated__/models.py$(NC)"

test-jcs: ## Test JSON canonicalization schema implementation
	@if [ ! -f .jcs-test-data/es6testfile100m.txt ]; then \
		echo -e "$(CYAN)Downloading ES6 numbers test file...$(NC)"; \
		curl -fL https://github.com/cyberphone/json-canonicalization/releases/download/es6testfile/es6testfile100m.txt.gz | gunzip > .jcs-test-data/es6testfile100m.txt; \
	fi
	@echo -e "$(CYAN)Running JSON canonicalization tests...$(NC)"
	@PYTHONPATH=src $(UV) run python scripts/ci/json-canonicalization-schema/verify-canonicalization.py
	@PYTHONPATH=src $(UV) run python scripts/ci/json-canonicalization-schema/verify-numbers.py
	@echo -e "$(GREEN)✓ Done$(NC)"

test-helm: ## Run comprehensive Helm chart tests
	@echo -e "$(CYAN)Running Helm chart tests...$(NC)"
	$(UV) run python scripts/ci/test_helm.py
	@echo -e "$(GREEN)✓ Done$(NC)"

dev-docker: ## Run Docker devops environment (use ARGS= to pass arguments, default: up)
	@echo -e "$(CYAN)Starting Docker devops environment...$(NC)"
	cd scripts/docker/devops && bash dev.sh $(or $(ARGS),up)

dev-mock-llm: ## Start the mock LLM server
	@echo -e "$(CYAN)Starting mock LLM server...$(NC)"
	cd scripts/mock-llm-server && $(PNPM) install && $(PNPM) run build:all && $(PNPM) start

gh-comment-watch: ## Start the GitHub comment watcher
	@echo -e "$(CYAN)Starting GH Comment Watch...$(NC)"
	cd $(GH_COMMENT_WATCH_DIR) && $(PNPM) start

#=============================================================================
# Harbor Evals
#=============================================================================

HARBOR_TASK ?= evals/harbor/tasks/regression-triage
HARBOR_MODEL ?= anthropic/claude-sonnet-4-5
# Environment backend for trials (harbor run -e): docker, daytona, etc.
# Cloud backends need credentials in the host env (e.g. DAYTONA_API_KEY).
HARBOR_ENV ?= docker
HARBOR_VERSION ?= 0.18.0
# harbor needs Python >=3.12; pin explicitly so uvx doesn't inherit the
# repo's .python-version (3.10).
HARBOR_PYTHON ?= 3.13
HARBOR_ATTEMPTS ?= 1
# Retry trials that die on transient infrastructure errors (e.g. a cloud
# sandbox failing to start); reward-scored failures are not retried.
HARBOR_RETRIES ?= 1
# Daytona sandboxes orphaned by a killed run (e.g. a canceled CI job) would
# otherwise occupy org quota forever and starve later runs into
# EnvironmentStartTimeoutError; have Daytona stop and delete them itself.
ifeq ($(HARBOR_ENV),daytona)
HARBOR_ENV_KWARGS := --ek auto_stop_interval_mins=30 --ek auto_delete_interval_mins=30
endif
UVX := uvx
HARBOR := $(UVX) --python $(HARBOR_PYTHON) --from 'harbor[daytona]==$(HARBOR_VERSION)' harbor

# The runner is staged into the task's Docker build context by stage_harbor_task_environments.sh.
define check-harbor-staged
	@test -f $(HARBOR_TASK)/environment/run_server_agent.py || \
		{ echo -e "$(RED)Missing staged runner in $(HARBOR_TASK)/environment/ — run 'make harbor-stage-environments' first$(NC)"; exit 1; }
endef

harbor-stage-environments: ## Build the Phoenix wheel and stage each Harbor task environment
	@echo -e "$(CYAN)Staging Harbor task environments...$(NC)"
	./evals/harbor/scripts/stage_harbor_task_environments.sh
	@echo -e "$(GREEN)✓ Done$(NC)"

harbor-publish-fixtures: ## Regenerate Harbor fixtures and publish to cloud storage
	@echo -e "$(CYAN)Publishing Harbor fixtures...$(NC)"
	./evals/harbor/scripts/publish_fixtures.sh

harbor-oracle: ## Validate the Harbor task with the oracle solution (HARBOR_TASK=..., HARBOR_ENV=...)
	$(check-harbor-staged)
	@echo -e "$(CYAN)Running Harbor oracle trial for $(HARBOR_TASK) on $(HARBOR_ENV)...$(NC)"
	$(HARBOR) run -p $(HARBOR_TASK) -a oracle -e $(HARBOR_ENV) -r $(HARBOR_RETRIES) $(HARBOR_ENV_KWARGS) --yes

harbor-run: ## Run the real ServerAgent Harbor trial (HARBOR_TASK=..., HARBOR_MODEL=..., HARBOR_ENV=..., HARBOR_ATTEMPTS=...)
	$(check-harbor-staged)
	@echo -e "$(CYAN)Running Harbor ServerAgent trial for $(HARBOR_TASK) with $(HARBOR_MODEL) on $(HARBOR_ENV)...$(NC)"
	PYTHONPATH=. $(HARBOR) run -p $(HARBOR_TASK) \
		-a evals.harbor.agents.phoenix_server_agent:PhoenixServerAgent \
		-m $(HARBOR_MODEL) -e $(HARBOR_ENV) -k $(HARBOR_ATTEMPTS) -r $(HARBOR_RETRIES) $(HARBOR_ENV_KWARGS) --yes

harbor-view: ## Browse Harbor job results in a local web viewer
	$(HARBOR) view jobs

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

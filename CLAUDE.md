# Phoenix - AI Observability Platform

Phoenix is an open-source AI observability platform built on OpenTelemetry with a Python/FastAPI backend and React/TypeScript frontend.

## Project Overview

- **Main Package**: `arize-phoenix` - Full Phoenix platform
- **Sub-packages**:
  - `arize-phoenix-client` - Lightweight Python client (packages/phoenix-client/)
  - `arize-phoenix-otel` - OpenTelemetry wrapper (packages/phoenix-otel/)
  - `arize-phoenix-evals` - LLM evaluation tooling (packages/phoenix-evals/)
- **Supported Python**: 3.10, 3.11, 3.12, 3.13
- **Node Version**: 22 (managed via nvm, see .nvmrc)

## Development Environment Setup

### Python Environment

IMPORTANT: Use Python 3.10 for development to ensure compatibility across all supported versions.

```bash
# Install uv (macOS)
brew install uv

# Create virtual environment with Python 3.10
uv venv --python 3.10

# Activate virtual environment
source ./.venv/bin/activate

# Install Phoenix with dev dependencies
uv pip install -e ".[dev]"

# Create symbolic links for sub-packages (required for local development)
tox run -e add_symlinks
```

### Frontend Environment

```bash
# Install nvm (if not already installed)
# https://github.com/nvm-sh/nvm

# Install Node.js (version from .nvmrc)
nvm install
nvm alias default <version-that-was-installed>

# Install pnpm globally
npm i -g pnpm@9.15.5

# Install frontend dependencies and build
cd app
pnpm install
pnpm run build
```

### Database Setup

Phoenix supports both SQLite and PostgreSQL. For development involving database features, install PostgreSQL:

```bash
# Install PostgreSQL (macOS)
brew install postgresql

# Verify pg_config points to homebrew install
pg_config --bindir
```

## Common Development Commands

### Python Testing & Linting

IMPORTANT: Phoenix uses `tox` with `tox-uv` for all testing, linting, and type-checking. Install globally:

```bash
pip install tox-uv
```

**Linting and Formatting** (Uses ruff):
```bash
# Run ruff formatter and linter (auto-fixes issues)
tox run -e ruff

# This command runs:
# - ruff format (formats code)
# - ruff check --fix (lints and fixes issues)
```

**Type Checking**:
```bash
# Type check main source code
tox run -e type_check

# Type check unit tests
tox run -e type_check_unit_tests

# Type check integration tests
tox run -e type_check_integration_tests
```

**Running Tests**:
```bash
# Run unit tests (SQLite only)
tox run -e unit_tests

# Run unit tests with PostgreSQL
tox run -e unit_tests -- --run-postgres

# Run integration tests
tox run -e integration_tests

# Run tests for specific sub-packages
tox run -e phoenix_client
tox run -e phoenix_evals
tox run -e phoenix_otel
```

**List all available tox environments**:
```bash
tox list
```

### Frontend Commands

All frontend commands run from the `app/` directory:

```bash
cd app

# Development with hot reload (uses mprocs to run both server and UI)
pnpm dev

# Run UI only (requires separate server)
pnpm run dev:ui

# Run server only with debugger
pnpm run dev:server

# Run server with in-memory SQLite (fresh database)
PHOENIX_SQL_DATABASE_URL=sqlite:///:memory: pnpm dev

# Build production assets
pnpm run build

# Run tests
pnpm test              # Run tests once
pnpm run test:watch    # Watch mode
pnpm run test:e2e      # End-to-end tests
pnpm run test:e2e:ui   # E2E tests with UI

# Linting & Type checking
pnpm run lint          # Check for issues
pnpm run lint:fix      # Auto-fix issues
pnpm run typecheck     # TypeScript type checking
pnpm run prettier:check
pnpm run prettier:write

# Build Relay GraphQL schema
pnpm run build:relay
```

### Jupyter Notebooks

When contributing notebooks:
```bash
# Format notebooks
tox run -e ruff

# Clean notebook output and metadata (required for CI)
tox run -e clean_jupyter_notebooks
```

### Database Migrations

```bash
# View migration history
tox -e alembic -- history

# Run migrations (upgrade to latest)
tox -e alembic -- upgrade head

# Rollback one migration
tox -e alembic -- downgrade -1

# View current version
tox -e alembic -- current
```

## Building & Publishing

```bash
# Build frontend
cd app
pnpm run build

# Build Python package (from root)
hatch build

# This creates:
# - Source distribution: dist/*.tar.gz
# - Python wheel: dist/*.whl
```

## Pre-commit Hooks

IMPORTANT: Install pre-commit hooks to catch issues before committing:

```bash
pre-commit install
```

Pre-commit hooks will automatically run formatters and linters before each commit. Skip with `git commit -n` if needed.

## Project Structure

```
phoenix/
├── app/                    # React/TypeScript frontend
│   ├── src/               # Frontend source code
│   ├── schema.graphql     # GraphQL schema (generated)
│   └── package.json       # Frontend dependencies
├── packages/              # Sub-packages (client, evals, otel)
├── src/phoenix/           # Main Python source code
│   ├── server/           # FastAPI server & GraphQL API
│   ├── db/               # Database models & migrations
│   └── proto/            # Protobuf definitions
├── tests/                # Unit and integration tests
├── docs/                 # Mintlify documentation
├── scripts/              # Build & utility scripts
├── requirements/         # Python dependencies
├── tox.ini              # Test & lint configurations
└── pyproject.toml       # Python package configuration
```

## Key Files & Utilities

- **GraphQL Schema**: `app/schema.graphql` (exported from Python code)
- **OpenAPI Schema**: `schemas/openapi.json` (exported for client generation)
- **Version**: `src/phoenix/version.py` (update for releases)
- **Migrations**: `src/phoenix/db/migrations/` (Alembic migrations)

## Code Style & Conventions

### Python Style
- **Line length**: 100 characters
- **Target version**: Python 3.10
- **Type checking**: Strict mode with mypy
- **Linting**: Ruff (replaces black, isort, flake8)
- **Import style**: Multi-line imports allowed (not forced single-line)

### TypeScript Style
- **Node version**: 22+
- **Package manager**: pnpm only (enforced by preinstall script)
- **GraphQL**: Uses Relay for data fetching
- **Linting**: ESLint with TypeScript

### REST API Conventions (Backend)
- Use nouns for resources (pluralized), avoid verbs in paths
- Example: `/datasets/:dataset_id` (not `/getDataset/:id`)
- HTTP Methods: GET (retrieve), POST (create), PUT (replace), PATCH (partial update), DELETE (delete)
- Status Codes: 2xx (success), 4xx (client error), 5xx (server error)
- Query parameters: Use snake_case with `_` separator
- Response format: JSON with `data` key, use snake_case for payload fields
- Pagination: Cursor-based pagination

## Debugging

### Python Server Debugging (VS Code/Cursor)

The dev server runs with `debugpy` enabled on port 5678. Add to `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Attach to Phoenix Dev Server",
      "type": "debugpy",
      "request": "attach",
      "connect": {
        "host": "localhost",
        "port": 5678
      },
      "justMyCode": false
    }
  ]
}
```

Start the dev server with `cd app && pnpm dev`, then attach the debugger in VS Code.

## Common Pitfalls & Quirks

1. **Symbolic Links**: Always run `tox run -e add_symlinks` after setting up the dev environment. Sub-packages (client, evals, otel) are NOT installed by default and require symlinks for local development.

2. **Frontend Package Manager**: Only pnpm is allowed. The preinstall script will error if you try to use npm or yarn.

3. **Node Version**: Must use Node 22+. Use nvm to manage Node versions.

4. **PostgreSQL Path**: Ensure `pg_config` points to homebrew installation, not system PostgreSQL.

5. **Python Version**: Develop on Python 3.10 (the minimum supported version) to catch compatibility issues early.

6. **Tox with UV**: This project uses `tox-uv` (not vanilla `tox`). Install with `pip install tox-uv` for faster execution.

7. **Ruff Usage**: Run `tox run -e ruff` to format AND lint. Don't run ruff directly; use tox to ensure consistent environment.

8. **Database Tests**: By default, tests only run against SQLite. Use `--run-postgres` flag to test against PostgreSQL.

9. **Notebook Metadata**: Always run `tox run -e clean_jupyter_notebooks` after editing notebooks to strip output and metadata.

10. **GraphQL Schema**: If modifying GraphQL schema in Python, rebuild with `tox run -e build_graphql_schema` (Python 3.10 only).

## Documentation

Phoenix uses [Mintlify](https://mintlify.com/) for documentation. Docs are in the `docs/` directory.

```bash
# Install Mintlify CLI
npm i -g mint

# Run local docs server
mint dev

# Access at http://localhost:3000
```

Documentation pages are written in MDX (Markdown with JSX). The `docs.json` file controls navigation and settings.

## Running Phoenix Server

```bash
# Development mode (from root, no hot reload)
tox run -e phoenix_main

# With environment variables
PHOENIX_PORT=6006 tox run -e phoenix_main

# Production mode (from app directory with hot reload)
cd app && pnpm dev
```

## Environment Variables

Key environment variables (see `tox.ini` for full list):
- `PHOENIX_PORT`: Server port (default: 6006)
- `PHOENIX_GRPC_PORT`: gRPC port
- `PHOENIX_SQL_DATABASE_URL`: Database connection string (default: SQLite)
- `PHOENIX_ENABLE_AUTH`: Enable authentication
- `PHOENIX_LOGGING_LEVEL`: Log level
- `PHOENIX_TELEMETRY_ENABLED`: Enable/disable telemetry (default: true)

## Testing Strategy

1. **Unit Tests**: Fast, isolated tests in `tests/unit/`
2. **Integration Tests**: End-to-end tests in `tests/integration/`
3. **E2E Tests**: Frontend Playwright tests in `app/tests/`
4. **Type Checking**: Strict mypy for Python, TypeScript for frontend

## Contributing Workflow

1. Install pre-commit hooks: `pre-commit install`
2. Create feature branch from `main`
3. Make changes, run formatters/linters: `tox run -e ruff`
4. Run type checks: `tox run -e type_check`
5. Run tests: `tox run -e unit_tests`
6. For frontend changes: `cd app && pnpm run lint:fix && pnpm run typecheck && pnpm test`
7. Clean notebooks if applicable: `tox run -e clean_jupyter_notebooks`
8. Commit changes (pre-commit hooks will run automatically)
9. Create pull request against `main` branch

## VS Code / Cursor Extensions

Recommended extensions are in `.vscode/extensions.json`. When opening Phoenix in VS Code/Cursor, you'll be prompted to install them.

Recommended workspace settings (`.vscode/settings.json`):
```json
{
  "python.languageServer": "Default",
  "mypy-type-checker.importStrategy": "fromEnvironment",
  "[python]": {
    "editor.codeActionsOnSave": {
      "source.fixAll.ruff": "always"
    }
  },
  "mypy-type-checker.ignorePatterns": [".tox,.venv,app"],
  "javascript.preferences.importModuleSpecifier": "shortest",
  "typescript.preferences.importModuleSpecifier": "non-relative",
  "prettier.configPath": "app/.prettierrc.json",
  "prettier.prettierPath": "app/node_modules/prettier",
  "typescript.tsdk": "app/node_modules/typescript/lib",
  "relay.rootDirectory": "app",
  "relay.pathToConfig": "app/relay.config.js",
  "relay.autoStartCompiler": true
}
```

## Additional Resources

- **Documentation**: https://arize.com/docs/phoenix/
- **GitHub Issues**: https://github.com/Arize-ai/phoenix/issues
- **Slack Community**: https://arize-ai.slack.com/
- **Migration Guide**: See MIGRATION.md for breaking changes
- **Security**: See SECURITY.md for security and privacy details

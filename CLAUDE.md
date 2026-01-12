# Phoenix - AI Observability Platform

Phoenix is an open-source AI observability platform built on OpenTelemetry with a Python/FastAPI backend and React/TypeScript frontend.

## Project Overview

- **Main Package**: `arize-phoenix` - Full Phoenix platform
- **Sub-packages**:
  - `arize-phoenix-client` - Lightweight Python client (packages/phoenix-client/)
  - `arize-phoenix-otel` - OpenTelemetry wrapper (packages/phoenix-otel/)
  - `arize-phoenix-evals` - LLM evaluation tooling (packages/phoenix-evals/)
- **Supported Python**: 3.10, 3.11, 3.12, 3.13
- **Node Version**: 22 (see .nvmrc)
- **Package Manager**: pnpm only (enforced by preinstall script)

## Development Setup

IMPORTANT: Always run `tox run -e add_symlinks` after environment setup. Sub-packages (client, evals, otel) require symlinks for local development.

```bash
# Python setup
uv venv --python 3.10
source ./.venv/bin/activate
uv pip install -e ".[dev]"
tox run -e add_symlinks

# Frontend setup
cd app
pnpm install
pnpm run build
```

## Common Development Commands

### Python Commands

IMPORTANT: Use `tox` for all testing, linting, and type-checking.

```bash
# Linting and formatting (uses ruff)
tox run -e ruff

# Type checking
tox run -e type_check

# Running tests
tox run -e unit_tests                    # SQLite only
tox run -e unit_tests -- --run-postgres  # Include PostgreSQL tests
tox run -e integration_tests

# Sub-package tests
tox run -e phoenix_client
tox run -e phoenix_evals
tox run -e phoenix_otel

# List all tox environments
tox list
```

### Frontend Commands

Run from `app/` directory:

```bash
# Build and test
pnpm run build
pnpm test
pnpm run lint:fix
pnpm run typecheck

# Development
pnpm dev  # Runs both server and UI with hot reload

# Build Relay GraphQL schema
pnpm run build:relay
```

### Other Commands

```bash
# Jupyter notebooks - clean output/metadata before committing
tox run -e clean_jupyter_notebooks

# Database migrations
tox -e alembic -- upgrade head   # Run migrations
tox -e alembic -- history        # View history

# Build Python package
hatch build  # Creates dist/*.tar.gz and dist/*.whl
```

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

## Key Files

- **GraphQL Schema**: `app/schema.graphql` (generated from Python)
- **OpenAPI Schema**: `schemas/openapi.json` (generated for clients)
- **Version**: `src/phoenix/version.py`
- **Migrations**: `src/phoenix/db/migrations/`

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

### REST API Conventions
- Use nouns for resources (pluralized), avoid verbs in paths
- Example: `/datasets/:dataset_id` (not `/getDataset/:id`)
- HTTP Methods: GET (retrieve), POST (create), PUT (replace), PATCH (partial update), DELETE (delete)
- Status Codes: 2xx (success), 4xx (client error), 5xx (server error)
- Query parameters: Use snake_case with `_` separator
- Response format: JSON with `data` key, use snake_case for payload
- Pagination: Cursor-based

## Important Notes

1. **Symbolic Links**: Always run `tox run -e add_symlinks` after setup. Sub-packages (client, evals, otel) require symlinks for local development.

2. **Package Manager**: Only pnpm is allowed for frontend (enforced by preinstall script).

3. **Python Version**: Use Python 3.10 for development (minimum supported version).

4. **Ruff Usage**: Always run `tox run -e ruff` for formatting and linting (don't run ruff directly).

5. **Database Tests**: By default, tests only run against SQLite. Use `--run-postgres` flag for PostgreSQL tests.

6. **Notebook Metadata**: Run `tox run -e clean_jupyter_notebooks` after editing notebooks to strip output/metadata.

7. **GraphQL Schema**: After modifying GraphQL schema in Python, rebuild with `tox run -e build_graphql_schema`.

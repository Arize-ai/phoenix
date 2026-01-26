# Phoenix - AI Observability Platform

Phoenix is an open-source AI observability platform built on OpenTelemetry with a Python/FastAPI backend and React/TypeScript frontend.

## Project Overview

- **Main Package**: `arize-phoenix` - Full Phoenix platform
- **Sub-packages**:
  - `arize-phoenix-client` - Lightweight Python client (packages/phoenix-client/)
  - `arize-phoenix-otel` - OpenTelemetry wrapper (packages/phoenix-otel/)
  - `arize-phoenix-evals` - LLM evaluation tooling (packages/phoenix-evals/)
- **Supported Python**: 3.10, 3.11, 3.12, 3.13 (develop on 3.10 for compatibility)
- **Node Version**: 22 (see .nvmrc)
- **Package Manager**: pnpm only (enforced in app/ by preinstall script, used by convention in js/)
- **TypeScript Packages**: `js/` directory contains phoenix-otel, phoenix-client, phoenix-evals, phoenix-mcp, phoenix-cli, phoenix-config

## Development Setup

IMPORTANT: Always run `tox run -e add_symlinks` after setup. Python sub-packages (client, evals, otel) require symlinks for local development.

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

### Python

Unit and integration tests are located in `tests/unit` and `tests/integration`, respectively, and are run using `uv run pytest`. By default, `pytest` is configured to produce verbose output. When running large numbers of tests:

- Use `-n auto` to run tests in parallel
- Use `pytest-quiet.ini` to produce quiet output that avoids flooding the context window

```bash
uv run pytest tests/unit -c pytest-quiet.ini -n auto                  # Runs the entire unit test suite in parallel with quiet output
uv run pytest tests/unit/test_failed_unit_tests.py::test_failed_test  # Runs a particular failed test with verbose output
uv run pytest tests/integration                                       # Runs integration tests
```

Other commands can be managed through the 

```bash
tox run -e ruff                                          # Format and lint
tox run -e ruff,remove_symlinks,type_check,add_symlinks  # Type check (remove/add symlinks)
tox run -e type_check_unit_tests                         # Type check unit tests
tox run -e type_check_integration_tests                  # Type check integration tests
tox run -e phoenix_client                                # Test sub-package
tox list                                                 # List all environments
```

### Frontend (app/)

```bash
pnpm dev                                 # Dev server with hot reload
pnpm run build                           # Build production
pnpm test                                # Run tests
pnpm run lint:fix                        # Fix linting issues
pnpm run typecheck                       # Type check
pnpm run build:relay                     # Build GraphQL schema
```

### TypeScript Packages (js/)

```bash
pnpm install                             # Install dependencies
pnpm run -r build                        # Build all packages
pnpm run -r test                         # Test all packages
pnpm run lint                            # Lint all packages
pnpm changeset                           # Create version changeset (required for PRs)
```

### Other

```bash
tox run -e clean_jupyter_notebooks       # Clean notebook metadata
tox -e alembic -- upgrade head           # Run migrations
hatch build                              # Build Python package
```

### Running Phoenix

```bash
cd app && pnpm dev                       # Full dev environment (server + UI)
tox run -e phoenix_main                  # Server only
PHOENIX_SQL_DATABASE_URL=sqlite:///:memory: pnpm dev  # Fresh in-memory database
```

## Project Structure

```
phoenix/
├── app/                    # React/TypeScript frontend (main Phoenix UI)
│   ├── src/               # Frontend source code
│   ├── schema.graphql     # GraphQL schema (generated)
│   └── package.json       # Frontend dependencies
├── js/                    # TypeScript packages monorepo (phoenix-otel, phoenix-client, phoenix-evals, etc.)
│   └── packages/          # Individual TypeScript packages
├── packages/              # Python sub-packages (client, evals, otel)
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

## Code Style & Conventions

### Python Style
- **Line length**: 100 characters
- **Target version**: Python 3.10
- **Type checking**: Strict mode with mypy
- **Linting**: Ruff (replaces black, isort, flake8)
- **Import style**: Multi-line imports allowed (not forced single-line)

### TypeScript Style
- **Node version**: 22+
- **GraphQL**: Uses Relay for data fetching
- **Linting**: ESLint with TypeScript

### REST API Conventions
- Resources are nouns (pluralized): `/datasets/:dataset_id` not `/getDataset/:id`
- Use snake_case for query params and JSON payloads
- Responses have `data` key, cursor-based pagination

## Important Notes

1. **Database Tests**: Default is SQLite only. Use `--run-postgres` flag for PostgreSQL tests.

2. **Notebook Metadata**: Run `tox run -e clean_jupyter_notebooks` after editing notebooks.

3. **GraphQL Schema**: After modifying schema in Python, rebuild with `tox run -e build_graphql_schema`.

4. **Changesets**: TypeScript package changes require a changeset via `pnpm changeset`.

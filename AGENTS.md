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

Your development environment should already be set up, but in case it is not, use these commands to bootstrap a new environment.

IMPORTANT: Use the lowest supported version of Python (currently 3.10) to ensure compatibility across all supported Python versions.

```bash
# Python setup
uv sync --python 3.10

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
uv run pytest tests/integration -n auto                               # Runs integration tests in parallel
```

Other commands can be managed through tox

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
pnpm run test:e2e                        # Run Playwright E2E tests (builds first, starts test server)
pnpm run test:e2e -- tests/foo.spec.ts --project=chromium # Run specific E2E test file
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
├── skills/               # Agent skill definitions for Phoenix features
├── scripts/              # Build & utility scripts
├── requirements/         # Python dependencies
├── tox.ini              # Test & lint configurations
└── pyproject.toml       # Python package configuration
```

## Agent Skills

Phoenix includes specialized skills in the `skills/` directory that teach AI agents how to work with Phoenix features like tracing, evaluations, and CLI tools. When creating or updating skills, use the `phoenix-skill-development` skill for guidance on structure, naming conventions, and quality standards.

## Code Style & Conventions

### Python Style

- **Line length**: 100 characters
- **Target version**: Python 3.10
- **Type checking**: Strict mode with mypy
- **Linting**: Ruff (replaces black, isort, flake8)
- **Import style**: Multi-line imports allowed (not forced single-line)
- All imports MUST be included at the top of each module rather than inside functions or methods, unless doing so causes circular import issues or unless the imported dependencies belong to an extra (e.g., `openai` belongs to the `container` extra in `pyproject.toml`). If you must import a module inside a function or method, include a brief **inline** comment explaining why the import is necessary (e.g., `# avoids circular import`).
- When creating or updating tests that use `vcrpy` to record requests and responses to and from third-party APIs, DO NOT create or update the cassette YAML file directly via a file edit. Instead, first ensure that the test passes by actually hitting the third-party API. This typically requires (1) deleting the pre-existing cassette YAML file (if one exists) and (2) commenting out fixtures for API keys (e.g., `openai_api_key`) to allow API keys set as environment variables in the the development environment to be used. Once the test passes by hitting the actual third-party API, uncomment any API key fixtures and re-run the test to ensure it still passes using `vcrpy`. A consequence of this approach is that tests using `vcrpy` should avoid hard-coding details that are likely to vary between responses from the API. For example, instead of asserting an exact token count that likely differs for each response, just assert that the token count returned from the API is an integer.

### TypeScript Style

- **Node version**: 22+
- **GraphQL**: Uses Relay for data fetching
- **Linting**: ESLint with TypeScript
- **Function parameters**: Prefer a single destructured object parameter over multiple positional arguments for functions with two or more parameters (e.g., `function foo({ searchParams, prompts }: { searchParams: URLSearchParams; prompts: Prompt[] })` instead of `function foo(searchParams: URLSearchParams, prompts: Prompt[])`). This improves readability at call sites and makes future parameter additions non-breaking.

### REST API Conventions

- Resources are nouns (pluralized): `/datasets/:dataset_id` not `/getDataset/:id`
- Use snake_case for query params and JSON payloads
- Responses have `data` key, cursor-based pagination

## Important Notes

1. **Database Tests**: Default is SQLite only. Use `--run-postgres` flag for PostgreSQL tests.

2. **Notebook Metadata**: Run `tox run -e clean_jupyter_notebooks` after editing notebooks.

3. **GraphQL Schema**: After modifying schema in Python, rebuild with `tox run -e build_graphql_schema`.

4. **Changesets**: Any change inside `js/` requires a changeset via `pnpm changeset` (including dependency updates, code changes, and config updates).

5. **Lint Fix Required Before Handoff**: After making changes, run the relevant lint command with auto-fix and then re-run validation for touched areas.
   - `js/`: `pnpm --dir js run lint:fix`
   - `app/`: `pnpm --dir app run lint:fix`

6. **README Guidelines**: When writing or updating README files, focus on the key functionality and features that matter to users (e.g., tracing, evaluations, observability). DO NOT include random implementation details like color schemes, gradients, styling choices, or other superficial aspects. READMEs should communicate what the tool does and how to use it, not aesthetic implementation details.

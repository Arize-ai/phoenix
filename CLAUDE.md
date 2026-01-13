# Phoenix - AI Observability Platform

Phoenix is an open-source AI observability platform built on OpenTelemetry with a Python/FastAPI backend and React/TypeScript frontend.

## Quick Start

**For detailed commands, code style, and workflows, see:**

- `.cursor/rules/python/RULE.md` - Python development
- `.cursor/rules/frontend/RULE.md` - Frontend (app/) development
- `.cursor/rules/typescript-packages/RULE.md` - TypeScript packages (js/)

**For specialized knowledge and workflows, see:**

- `.cursor/skills/client-migration/` - Migrating to new client APIs
- `.cursor/skills/evals-migration/` - Migrating to new evals APIs
- `.cursor/skills/testing-workflow/` - Running tests efficiently
- `.cursor/skills/commit-and-pr/` - Git and PR workflow

## Project Overview

- **Main Package**: `arize-phoenix` - Full Phoenix platform
- **Sub-packages**:
  - `arize-phoenix-client` - Lightweight Python client (packages/phoenix-client/)
  - `arize-phoenix-otel` - OpenTelemetry wrapper (packages/phoenix-otel/)
  - `arize-phoenix-evals` - LLM evaluation tooling (packages/phoenix-evals/)
- **Supported Python**: 3.10, 3.11, 3.12, 3.13 (develop on 3.10 for compatibility)
- **Node Version**: 22 (see .nvmrc)
- **Package Manager**: pnpm only
- **TypeScript Packages**: `js/` directory contains phoenix-otel, phoenix-client, phoenix-evals, phoenix-mcp, phoenix-cli, phoenix-config

## Project Structure

```
phoenix/
├── .cursor/
│   ├── rules/              # Static context for agent
│   │   ├── python/         # Python dev commands & style
│   │   ├── frontend/       # Frontend dev commands & style
│   │   └── typescript-packages/ # TS packages commands
│   └── skills/             # Dynamic capabilities & workflows
│       ├── client-migration/ # Client API migration guide
│       ├── evals-migration/  # Evals API migration guide
│       ├── testing-workflow/ # Testing best practices
│       └── commit-and-pr/    # Git & PR workflow
├── app/                    # React/TypeScript frontend
│   └── .cursor/rules/      # Frontend-specific rules
├── js/packages/            # TypeScript packages monorepo
├── packages/               # Python sub-packages
│   └── */cursor/rules/     # Package-specific rules
├── src/phoenix/            # Main Python source
├── tests/                  # Unit and integration tests
└── docs/                   # Documentation
```

## Development Setup

```bash
# Python setup
uv venv --python 3.10
source ./.venv/bin/activate
uv pip install -e ".[dev]"
tox run -e add_symlinks  # Required!

# Frontend setup
cd app && pnpm install && pnpm run build

# TypeScript packages setup
cd js && pnpm install && pnpm run -r build
```

## Common Commands

See individual rule files for complete command references:

- Python: `.cursor/rules/python/RULE.md`
- Frontend: `.cursor/rules/frontend/RULE.md`
- TypeScript: `.cursor/rules/typescript-packages/RULE.md`

## Key Conventions

### Python

- Always use `tox` for testing/linting (never run tools directly)
- Run `tox run -e add_symlinks` after setup
- Line length: 100 characters
- Target: Python 3.10

### Frontend

- Use pnpm only
- Node 22+
- Emotion for styling
- Relay for GraphQL

### TypeScript Packages

- Use pnpm
- Create changesets for PR
- ES modules only

## Important Notes

1. **Symlinks**: Python sub-packages require symlinks. Always run `tox run -e add_symlinks` after setup.
2. **Database Tests**: Default is SQLite. Use `--run-postgres` for PostgreSQL tests.
3. **Notebook Metadata**: Run `tox run -e clean_jupyter_notebooks` after editing notebooks.
4. **GraphQL Schema**: After modifying schema, rebuild with `tox run -e build_graphql_schema`.
5. **Changesets**: TypeScript package changes require a changeset via `pnpm changeset`.

## Getting Help

- Check `.cursor/rules/` for static development guidelines
- Check `.cursor/skills/` for specific workflows and migrations
- See subdirectory `.cursor/rules/` for component-specific guidelines

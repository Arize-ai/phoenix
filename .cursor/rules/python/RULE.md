# Python Development

## Commands

### Testing and Linting

- `make format-python lint-python` - Format and lint code
- `cd tests && uv run pytest unit/ -q` - Run all unit tests in quiet mode
- `cd tests && uv run pytest unit/ -k test_name` - Run specific test in verbose mode
- `cd tests/integration && uv run pytest .` - Run integration tests
- `make typecheck-python` or `uv run mypy` - Type check all Python code
- `make help` - List all available make targets

By default, `pytest` is configured to run in verbose mode. When running a large number of tests at once, ensure that you run in quiet mode to avoid flooding the context window.

### Database

- `uv run alembic upgrade head` - Run migrations
- Use `--run-postgres` flag for PostgreSQL tests (defaults to SQLite)

### Other

- `make clean-notebooks` - Clean notebook metadata (required after editing)
- `make build-python` - Build Python package

## Code Style

- **Line length**: 100 characters
- **Python version**: See `pyproject.toml` for supported versions
- **Type checking**: Strict mode with mypy
- **Linting**: Use `make format-python lint-python` (never run ruff directly)
- **Import style**: Multi-line imports allowed
- See existing code in `src/phoenix/` for patterns

## Workflow

1. Use `uv run` / `make` for all testing and linting operations
2. Run `make clean-notebooks` after editing notebooks
3. Type check with: `make typecheck-python` or `uv run mypy`
4. Check linter errors with ReadLints tool after making changes

## Project Structure

- `src/phoenix/` - Main Python source (FastAPI server, GraphQL API, DB models)
- `packages/` - Sub-packages (phoenix-client, phoenix-evals, phoenix-otel)
- `tests/` - Unit and integration tests
- `uv.lock` - Pinned Python dependencies

# Python Development

## Commands

### Testing and Linting

- `tox run -e ruff` - Format and lint code
- `tox run -e unit_tests -- -c pytest-quiet.ini` - Run all unit tests in quiet mode
- `tox run -e unit_tests -- -k test_name` - Run specific test in verbose mode
- `tox run -e integration_tests` - Run integration tests
- `make typecheck-python` or `uv run mypy` - Type check all Python code
- `tox list` - List all available tox environments

By default, `pytest` is configured to run in verbose mode. When running a large number of tests at once, ensure that you run in quiet mode to avoid flooding the context window.

### Database

- `tox -e alembic -- upgrade head` - Run migrations
- Use `--run-postgres` flag for PostgreSQL tests (defaults to SQLite)

### Other

- `tox run -e clean_jupyter_notebooks` - Clean notebook metadata (required after editing)
- `hatch build` - Build Python package

## Code Style

- **Line length**: 100 characters
- **Python version**: See `pyproject.toml` for supported versions
- **Type checking**: Strict mode with mypy
- **Linting**: Use `tox run -e ruff` (never run ruff directly)
- **Import style**: Multi-line imports allowed
- See existing code in `src/phoenix/` for patterns

## Workflow

1. Use tox for all testing and linting operations
2. Run `tox run -e clean_jupyter_notebooks` after editing notebooks
3. Type check with: `make typecheck-python` or `uv run mypy`
4. Check linter errors with ReadLints tool after making changes

## Project Structure

- `src/phoenix/` - Main Python source (FastAPI server, GraphQL API, DB models)
- `packages/` - Sub-packages (phoenix-client, phoenix-evals, phoenix-otel)
- `tests/` - Unit and integration tests
- `requirements/` - Python dependencies

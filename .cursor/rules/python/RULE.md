# Python Development

## Commands

### Testing and Linting
- `tox run -e ruff` - Format and lint code
- `tox run -e unit_tests` - Run all unit tests
- `tox run -e unit_tests -- -k test_name` - Run specific test
- `tox run -e integration_tests` - Run integration tests
- `tox run -e type_check_unit_tests` - Type check unit tests
- `tox list` - List all available tox environments

### Development Setup
- `tox run -e add_symlinks` - Add symlinks for sub-packages (required after setup)
- `tox run -e remove_symlinks` - Remove symlinks before type checking

### Database
- `tox -e alembic -- upgrade head` - Run migrations
- Use `--run-postgres` flag for PostgreSQL tests (defaults to SQLite)

### Other
- `tox run -e clean_jupyter_notebooks` - Clean notebook metadata (required after editing)
- `hatch build` - Build Python package

## Code Style

- **Line length**: 100 characters
- **Target version**: Python 3.10 (for compatibility across 3.10-3.13)
- **Type checking**: Strict mode with mypy
- **Linting**: Use `tox run -e ruff` (never run ruff directly)
- **Import style**: Multi-line imports allowed
- See existing code in `src/phoenix/` for patterns

## Workflow

1. Always run `tox run -e add_symlinks` after initial setup
2. Use tox for all testing and linting operations
3. Run `tox run -e clean_jupyter_notebooks` after editing notebooks
4. Type check with: `tox run -e ruff,remove_symlinks,type_check,add_symlinks`
5. Check linter errors with ReadLints tool after making changes

## Project Structure

- `src/phoenix/` - Main Python source (FastAPI server, GraphQL API, DB models)
- `packages/` - Sub-packages (phoenix-client, phoenix-evals, phoenix-otel)
- `tests/` - Unit and integration tests
- `requirements/` - Python dependencies

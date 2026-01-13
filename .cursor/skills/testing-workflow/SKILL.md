# Testing Workflow Skill

## Description
Run tests efficiently for Python and TypeScript codebases.

## Commands

### Python Testing
```bash
# Run specific test file
tox run -e unit_tests -- tests/path/to/test_file.py

# Run specific test by name
tox run -e unit_tests -- -k test_function_name

# Run with PostgreSQL
tox run -e unit_tests -- --run-postgres

# Run integration tests
tox run -e integration_tests -- -k test_name
```

### TypeScript Testing
```bash
# Frontend tests
cd app && pnpm test

# Package tests
cd js && pnpm run -r test

# Single package
cd js/packages/phoenix-client && pnpm test
```

## Workflow

1. **Before testing**: Ensure code is formatted
   - Python: `tox run -e ruff`
   - Frontend: `pnpm run lint:fix` (in app/)

2. **Run tests**: Prefer single test files for speed
   - Use `-k` flag to run specific tests
   - Default to SQLite (use `--run-postgres` only when needed)

3. **After testing**: Check for type errors
   - Python: `tox run -e type_check_unit_tests`
   - Frontend: `pnpm run typecheck` (in app/)

## Tips

- Run tests locally before pushing
- Use specific test selection for faster feedback
- Check linter output with ReadLints tool after changes
- For notebooks: Run `tox run -e clean_jupyter_notebooks` after editing

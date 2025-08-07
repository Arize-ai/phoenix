# AGENTS.md

This document outlines the key commands and coding conventions for this repository.

## Build, Lint, and Test

**Python:**
- Use `tox` for managing test environments.
- Run all Python tests: `tox`
- Run unit tests: `tox -e unit_tests`
- Run a single unit test file: `tox -e unit_tests -- tests/unit/test_file.py`
- Linting and formatting: `ruff format && ruff check --fix` (or `tox -e ruff`)
- Type checking: `mypy --strict src/phoenix/` (or `tox -e type_check`)

**JavaScript (in `app/` directory):**
- Install dependencies: `pnpm install`
- Run all JS tests: `pnpm test`
- Run a single JS test file: `pnpm test src/components/MyComponent.test.tsx`
- Linting and formatting: `pnpm lint:fix && pnpm prettier`
- Type checking: `pnpm typecheck`

## Code Style and Conventions

- **Imports:** Use `ruff`'s isort for automatic import sorting.
- **Formatting:** Adhere to `ruff` for Python and `prettier` for JS.
- **Types:**
    - Python: Use type hints and run `mypy` for static analysis.
    - JS: Use TypeScript and run `tsc --noEmit` to check for errors.
- **Naming:** Follow PEP 8 for Python and standard TypeScript/React conventions.
- **Error Handling:** Use try-except blocks for Python and standard error boundaries/try-catch for React.
- **Dependencies:** Keep the client light-weight. Use lazy imports for heavy libraries like `pandas`.
- **API Client:** Methods that interact with the server should be namespaced (e.g., `client.projects.get()`) and use keyword arguments (`kwargs`) in Python or object parameters in TypeScript.
- **Styling:** Use `emotion` for CSS-in-JS, and leverage design tokens from `GlobalStyles.tsx`.
- **Components:** Reusable React components go in `src/components`, and their stories in `stories/`.

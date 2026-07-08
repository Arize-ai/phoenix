# Agent Instructions

## Build & Development

This repo uses a **Makefile** for all build, test, lint, and dev commands. Run `make help` to see all available targets.

- Python packages are managed with `uv`
- TypeScript packages are managed with `pnpm`

## Python Dependency Version Policy

**Never add pre-release versions to production dependencies in `pyproject.toml` files.** Pre-release suffixes (`aN`, `bN`, `rcN`, `.devN` per [PEP 440](https://peps.python.org/pep-0440/)) are implicitly excluded from pip's dependency resolution by default — they are only installed if explicitly requested via `--pre` or a pinned pre-release specifier. Adding a pre-release pin to a production dependency forces users to opt into unstable software or causes resolution failures. Dev/test dependency groups may use pre-release versions when necessary.

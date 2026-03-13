# Code Review Guidelines

## Always Check

- New API endpoints have corresponding tests and authorization checks
- Database schema changes include migrations and are tested across all supported backends
- Error messages don't leak internal details to users — use typed error classes for expected failures
- Data-mutating operations emit events so downstream subscribers stay in sync
- Batch loading is used to avoid N+1 query patterns in resolver-style APIs

## Style

- Don't use short variable names like `x` or `cv` — use descriptive names like `num_experiments` or `current_version`
- Use prefixes to denote the type — e.g. `num_records` rather than `records`
- Name functions precisely with action verbs — e.g. `list_sessions()` rather than `sessions()`
- Use keyword or object arguments over positional arguments for clarity — e.g. `({ numerator, denominator }) => quotient` rather than `(x, y) => z`
- Prefer composition over inheritance
- All functions should have type annotations — lean on the type system to catch bugs at compile time, not runtime
- Use path aliases or absolute imports — avoid deep relative import chains
- Prefer named exports over default exports

## Patterns to Flag

- Catching broad exception types without re-raising — always catch specific exceptions
- Direct database queries inside API resolvers instead of using batched data access patterns
- Missing authorization checks on endpoints that modify data
- Queries or logic that only work on one database backend when multiple are supported
- Deriving state in side effects when it can be computed directly
- Cache or store mutations that don't update collections (causes stale lists in the UI)
- Form fields missing validation rules on required inputs

## Skip

- Generated files under `__generated__` directories
- Files under `node_modules/`, `dist/`, or `build/`
- Auto-generated migration files (review the schema change intent, not the generated boilerplate)

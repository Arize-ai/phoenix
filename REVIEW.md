# Code Review Guidelines

The keywords "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD", "SHOULD NOT", "RECOMMENDED", "NOT RECOMMENDED", "MAY", and "OPTIONAL" in this specification are to be interpreted as described in BCP 14 [RFC2119] [RFC8174] when, and only when, they appear in all capitals, as shown here.

An implementation is compliant if it satisfies all "MUST", "MUST NOT", "REQUIRED", "SHALL", and "SHALL NOT" requirements defined in this specification. An implementation that fails to satisfy any such requirement is not compliant.

## Always Check

- New API endpoints MUST have corresponding tests and authorization checks
- Database schema changes MUST include migrations and MUST be tested across all supported backends
- Error messages MUST NOT leak internal details to users — typed error classes SHOULD be used for expected failures
- Data-mutating operations MUST emit events so downstream subscribers stay in sync
- Batch loading MUST be used to avoid N+1 query patterns in resolver-style APIs

## Style

- Variable names MUST be descriptive — short names like `x` or `cv` MUST NOT be used. Use names like `num_experiments` or `current_version`
- Variable names SHOULD use prefixes to denote the type — e.g. `num_records` rather than `records`
- Functions MUST be named with precise action verbs — e.g. `list_sessions()` rather than `sessions()`
- Keyword or object arguments SHOULD be preferred over positional arguments for clarity — e.g. `({ numerator, denominator }) => quotient` rather than `(x, y) => z`
- Composition SHOULD be preferred over inheritance
- All functions MUST have type annotations — lean on the type system to catch bugs at compile time, not runtime
- Path aliases or absolute imports SHOULD be used — deep relative import chains are NOT RECOMMENDED
- Named exports SHOULD be preferred over default exports

## Patterns to Flag

- Catching broad exception types without re-raising MUST NOT occur — specific exceptions MUST be caught
- Direct database queries inside API resolvers MUST NOT be used — batched data access patterns are REQUIRED
- Endpoints that modify data MUST have authorization checks
- Queries or logic MUST work on all supported database backends — single-dialect code MUST NOT be introduced
- State SHOULD NOT be derived in side effects when it can be computed directly
- Cache or store mutations MUST update affected collections to prevent stale lists in the UI
- Form fields MUST have validation rules on required inputs

## Skip

- Generated files under `__generated__` directories
- Files under `node_modules/`, `dist/`, or `build/`

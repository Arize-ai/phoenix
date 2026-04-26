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

## Security

- GraphQL resolvers that perform side effects — outbound HTTP/RPC, "test connection" / credential validation, database writes, secret reads, filesystem writes, or any operation that takes a user-supplied URL, hostname, or set of HTTP headers — MUST be exposed as `@strawberry.mutation` (or `@strawberry.subscription`), NEVER as a `Query` field. Query fields are reachable through introspection, are not covered by the `make check-graphql-permissions` CI guard, and have historically been used to bypass auth (SSRF against internal services, including cloud metadata endpoints).
- All `@strawberry.mutation` and `@strawberry.subscription` definitions MUST declare `permission_classes=[...]` — at minimum `IsNotReadOnly`, `IsNotViewer`, and (where appropriate) `IsAdminIfAuthEnabled` and/or `IsLocked`. The `make check-graphql-permissions` script enforces this in CI; do not bypass it.
- User-supplied URLs, hostnames, base URLs, or endpoint overrides that the server will dial out to MUST be treated as untrusted. They MUST NOT be allowed to resolve to link-local, loopback, private, or cloud metadata addresses (e.g. `169.254.169.254`, `metadata.google.internal`, `127.0.0.0/8`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `::1`, `fc00::/7`, `fe80::/10`) unless the feature explicitly requires it and is gated behind admin-only auth.
- User-supplied HTTP headers and client kwargs MUST NOT be forwarded to internal or privileged services without an allowlist. Headers like `Metadata-Flavor`, `X-Forwarded-For`, `Authorization`, and `Host` are particularly sensitive.
- Secrets (API keys, tokens, encrypted config) MUST NOT appear in error messages, log lines, GraphQL error payloads, or telemetry. Error messages from upstream providers MAY be surfaced verbatim only when the upstream is the user's own configured provider; otherwise they MUST be sanitized.
- GraphQL introspection-discoverable fields that perform privileged operations MUST have a regression test that asserts both the schema location (mutation, not query) and the presence of the required `permission_classes`. See `tests/unit/server/api/mutations/test_generative_model_custom_provider_mutations.py::test_test_credentials_is_an_auth_gated_mutation_not_a_query` for the canonical pattern.
- Authentication and authorization checks MUST NOT be implemented only on the frontend. Server-side enforcement is REQUIRED for every privileged operation.

## Skip

- Generated files under `__generated__` directories
- Files under `node_modules/`, `dist/`, or `build/`

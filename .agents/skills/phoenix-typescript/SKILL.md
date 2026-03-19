---
name: phoenix-typescript
description: TypeScript conventions and patterns for any TypeScript code in the Phoenix monorepo — including js/packages/, app/, and any other TS directories. Use this skill whenever writing, reviewing, or modifying TypeScript code — new functions, types, exports, tests, or refactors. Also trigger when the user asks about TS patterns, naming conventions, or best practices for this project.
internal: true
---

# Phoenix TypeScript Conventions

These conventions apply to **all** TypeScript in the Phoenix monorepo — the `app/` frontend, the `js/packages/` libraries (phoenix-client, phoenix-cli, phoenix-evals, phoenix-mcp, phoenix-otel, phoenix-config), examples, and benchmarks.

Before writing new code, explore the directory you're working in to understand existing patterns — then follow these rules.

## Naming

Self-documenting names eliminate mental parsing for the next reader.

- Variables must not use single letters — even loop counters benefit from `index`, `row`, `char`.
- Complex conditions should be extracted into named booleans so code reads as prose.
- Booleans must use verb prefixes: `isAllowed`, `hasError`, `canSubmit` — not `allowed`, `error`.

```ts
// Good — self-documenting
const isDisabled = !hasPermission || isSubmitting;

// Bad — reader must parse inline
<Button isDisabled={!hasPermission || isSubmitting}>
```

## Functions

- Functions with 2+ parameters should use object destructuring over positional args — this makes call sites readable and resilient to reordering.
- Behavior should be built from composition (functions and hooks), not inheritance.
- Transforms should prefer functional purity over mutation — use `map` not `reduce` for element-wise transforms, return new objects instead of mutating.

## Type Safety

TypeScript's type system is most valuable when it catches bugs at compile time rather than runtime.

- Type guards must be used to narrow complex union types; edge cases where discriminants might be missing must be tested.
- `any` must not be used; prefer `unknown` and narrow explicitly. If `any` is genuinely necessary (e.g., interfacing with an untyped external API), add a comment explaining why.

## Reuse

Existing shared utilities must be checked before writing inline helpers. Duplicated logic should be extracted to a shared module. When working in `js/packages/`, check sibling packages for existing utilities before adding new dependencies or reimplementing.

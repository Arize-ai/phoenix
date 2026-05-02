---
name: phoenix-typescript
description: TypeScript conventions and patterns for any TypeScript code in the Phoenix monorepo — including js/packages/, app/, and any other TS directories. Use this skill whenever writing, reviewing, or modifying TypeScript code — new functions, types, exports, tests, or refactors. Also trigger when the user asks about TS patterns, naming conventions, or best practices for this project.
metadata:
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
- Function names must start with an action verb that describes what the function does: `getUser`, `normalizeTimestamp`, `logEvent`, `parseResponse`, `buildQuery` — not `user()`, `timestamp()`, `event()`.

```ts
// Bad — single letters and ambiguous names
for (let i = 0; i < s.length; i++) {
  const d = s[i].ts - s[i - 1]?.ts;
  const r = fn(s[i].v);
}

// Good — self-documenting
for (let index = 0; index < spans.length; index++) {
  const elapsed = spans[index].timestamp - spans[index - 1]?.timestamp;
  const result = normalizeValue(spans[index].value);
}

// Bad — boolean without verb prefix, condition inline
<Button isDisabled={!permission || submitting}>

// Good — named boolean with verb prefix
const isDisabled = !hasPermission || isSubmitting;
<Button isDisabled={isDisabled}>
```

## Functions

- Functions with 2+ parameters should use object destructuring over positional args — this makes call sites readable and resilient to reordering.
- Object parameters should be documented with JSDoc using `@param` dot notation so editors surface descriptions on hover and during autocomplete.
- Behavior should be built from composition (functions and hooks), not inheritance.
- Transforms should prefer functional purity over mutation — use `map` not `reduce` for element-wise transforms, return new objects instead of mutating.

```ts
/**
 * Fetch spans matching the given filters.
 * @param params - query parameters
 * @param params.projectId - project to query
 * @param params.timeRange - optional time window to restrict results
 * @param params.limit - max rows to return (default 100)
 */
function fetchSpans({
  projectId,
  timeRange,
  limit = 100,
}: {
  projectId: string;
  timeRange?: TimeRange;
  limit?: number;
}) {
```

## Type Safety

TypeScript's type system is most valuable when it catches bugs at compile time rather than runtime.

- Type guards must be used to narrow complex union types; edge cases where discriminants might be missing must be tested.
- `any` must not be used; prefer `unknown` and narrow explicitly. If `any` is genuinely necessary (e.g., interfacing with an untyped external API), add a comment explaining why.
- `Record<K, V>` used as a lookup map (where keys may be absent) must include `undefined` in the value type — the repo does not enable `noUncheckedIndexedAccess`, so missing-key lookups silently return `undefined` while the type says `V`. Use `Partial<Record<K, V>>` for sparse maps or `Record<K, V | undefined>` when the key set is known but values are nullable.

```ts
// Bad — lookup returns string at compile time, undefined at runtime
const map: Record<string, string> = {};
const value = map["missing"]; // typed as string, actually undefined

// Good — forces a null check at every access site
const map: Partial<Record<string, string>> = {};
const value = map["missing"]; // typed as string | undefined
```

## Reuse

Existing shared utilities must be checked before writing inline helpers. Duplicated logic should be extracted to a shared module. When working in `js/packages/`, check sibling packages for existing utilities before adding new dependencies or reimplementing.

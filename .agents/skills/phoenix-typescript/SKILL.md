---
name: phoenix-typescript
description: TypeScript conventions and patterns for any TypeScript code in the Phoenix monorepo — including js/packages/, js/app/, and any other TS directories. Use this skill whenever writing, reviewing, or modifying TypeScript code — new functions, types, exports, tests, or refactors. Also trigger when the user asks about TS patterns, naming conventions, or best practices for this project.
metadata:
  internal: true
---

# Phoenix TypeScript Conventions

These conventions apply to **all** TypeScript in the Phoenix monorepo — the `js/app/` frontend, the `js/packages/` libraries (phoenix-client, phoenix-cli, phoenix-evals, phoenix-otel, phoenix-config), examples, and benchmarks.

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

- Functions with 2+ parameters must take a single destructured object — this makes call sites readable and resilient to reordering. Callbacks whose signature is fixed by a library or the DOM are exempt.
- Object parameters should be documented with JSDoc using `@param` dot notation so editors surface descriptions on hover and during autocomplete.
- Behavior should be built from composition (functions and hooks), not inheritance.
- Transforms should prefer functional purity over mutation — use `map` not `reduce` for element-wise transforms, return new objects instead of mutating.
- Pure utilities must not reach for hardcoded module constants or ambient state (`Date.now()`, `new Date()`, config singletons) deep inside their bodies. Expose every such value as an optional parameter whose default is the constant, so callers — and especially tests — can override it and the function's output depends only on its inputs. The module constant becomes the default, prefixed `DEFAULT_`.

```ts
const DEFAULT_ZOOM_FACTOR = 2;
const DEFAULT_MIN_WINDOW_MS = 60_000;

// Bad — reads a module constant and the clock internally; output isn't
// determined by inputs, so tests can't pin the window or the factor.
function zoomOut(value: TimeRange): TimeRange {
  const now = new Date();
  return widen(value, ZOOM_FACTOR, now);
}

// Good — constants are overridable defaults; pass `now` to make it pure.
function zoomOut({
  value,
  now = new Date(),
  zoomFactor = DEFAULT_ZOOM_FACTOR,
  minWindowMs = DEFAULT_MIN_WINDOW_MS,
}: {
  value: TimeRange;
  /** Reference "now". Defaults to the current time. */
  now?: Date;
  /** Multiplier applied to the window duration. */
  zoomFactor?: number;
  /** Smallest window the zoom will produce. */
  minWindowMs?: number;
}): TimeRange {
  return widen(value, zoomFactor, now, minWindowMs);
}
```

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

## Comments

Default to no inline comments, in `js/app/` and the packages alike. Keep one only if a competent reader of the final code, without it, would likely change the code wrongly — an early return that looks dead, two calls that must stay in that order. Delete a comment that restates the next line, describes a helper or a test step, or justifies the change; that reasoning belongs in the commit message or PR description.

TSDoc on exported symbols in `js/packages/` is public API, not an inline comment: keep it.

## Imports

- Import lodash utilities via path imports so bundles only carry what's used: `import debounce from "lodash/debounce"`, not `import { debounce } from "lodash"` — the barrel import defeats tree shaking.

## Modules

A module owns one thing, its name says what that thing is, and every consumer imports it from that one place. Clean scoping is what makes code reusable: a module that owns one thing can be imported anywhere without pulling in the code around it.

- **Look before you write.** Existing shared modules must be checked before writing an inline helper. In `js/packages/`, check sibling packages before adding a dependency or reimplementing.
- **One responsibility, specifically named.** A module must be named for what it does, specifically enough that the file name alone finds it in an IDE's file search or a grep: `retryPolicy.ts`, `authTokenStorage.ts`, not `helpers.ts`, `shared.ts`, `common.ts` or `auth/storage.ts`. Do not rely on the directory to supply the meaning; many files called `storage.ts` are hard to tell apart in search results and editor tabs. A module you can name only generically, or only with "and", holds more than one thing: split it.
- **One home for shared code.** Shared code has one home, and every consumer imports it from there. When a second module needs code that lives inside another, move that code to its own module, named for what it does, and import it from both. Do not import it out of the first consumer, and do not copy it. This applies to code that encodes the same rule, so a change to one copy must reach the other; two snippets that only look alike today may need to diverge, and stay apart. Across `js/packages/`, the home is a package the consumer already depends on; do not add a dependency between published packages only to share a helper.
- **Export only what you own.** A module must not export internals for a sibling to use; needing to is the signal that the code wants its own module. A module must not re-export another module's symbols to give them a second import path. An `index.ts` may gather the modules of its own directory, one local module may wrap a third-party package, and a package's entry point may re-export the symbols that make up its public API; none of them forwards code owned elsewhere in the repo.
- **Imports flow one way.** Dependencies point from specific to general: features import shared modules, shared modules never import features, and `utils` never imports from components, pages, contexts or stores. Circular imports must not be introduced: a module in a cycle can run before the module it imports has initialized and read its exports as `undefined`, and neither module can be reused without the other. A cycle usually means two modules share something neither owns: extract that piece into a module both import. When the two modules are one responsibility split in two, merge them instead. Do not hide a cycle behind a lazy import or a type-only import.
- **Group by domain.** Once a directory holds several modules about one domain, move them into a subdirectory named for it instead of growing a flat directory. The files keep their specific names: `auth/authLogin.ts`, `auth/authTokenStorage.ts`.

```ts
// Bad — SpanSearch.tsx exports an internal so TraceSearch.tsx can use it
// SpanSearch.tsx
export function parseSearchTerm(searchText: string): SearchTerm { ... }
// TraceSearch.tsx
import { parseSearchTerm } from "./SpanSearch";

// Bad — re-exporting gives the helper a second home
// TraceSearch.tsx
export { parseSearchTerm } from "./SpanSearch";

// Good — the helper has one home, named for what it does; neither
// component imports the other
// utils/searchTermUtils.ts
export type SearchTerm = { ... };
export function parseSearchTerm(searchText: string): SearchTerm { ... }
// SpanSearch.tsx, TraceSearch.tsx
import { parseSearchTerm } from "@phoenix/utils/searchTermUtils";
```

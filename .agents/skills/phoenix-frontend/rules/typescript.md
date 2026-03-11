# TypeScript & Code Style

## Naming

- Variables MUST NOT use single letters (except short lambdas like `.map(x => x.id)`)
- Complex conditions SHOULD be extracted into named booleans so code reads as prose
- Booleans MUST use verb prefixes: `isAllowed`, `hasError`, `canSubmit` — not `allowed`, `error`

```ts
// Good — self-documenting
const isDisabled = !hasPermission || isSubmitting;

// Bad — reader must parse inline
<Button isDisabled={!hasPermission || isSubmitting}>
```

## Functions

- Functions with 2+ parameters SHOULD use object destructuring over positional args
- Behavior SHOULD be built from composition (functions and hooks), not inheritance
- Transforms SHOULD prefer functional purity over mutation — use `map` not `reduce` for element-wise transforms, return new objects instead of mutating

## Type safety

- Type guards MUST be used to narrow complex union types; edge cases where discriminants might be missing MUST be tested
- `any` MUST NOT be used; prefer `unknown` and narrow explicitly

## Reuse

Existing shared utilities MUST be checked before writing inline helpers. Duplicated logic SHOULD be extracted to a shared module.

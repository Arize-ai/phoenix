# `data-testid` Naming Conventions

`data-testid` is an escape hatch for E2E tests when role/label/text selectors are
not stable or specific enough. When you add one, follow these rules so the IDs stay
stable, unambiguous, and easy to grep.

## Naming

- **kebab-case**, ASCII only.
- **No abbreviations.** Spell out the element role: `button`, `menu-item`, `link`,
  `tab`, `dialog`, `input`, `option` — never `btn`, `mi`, etc.
- **Be specific and scoped.** Prefix with the feature/page/component so the ID is
  globally unique. Prefer `create-dataset-button` over `create-button`,
  `dataset-form-submit-button` over `submit-button`.
- **End with the element role.** Pattern: `<scope>-<subject>-<role>`.
  - `create-dataset-button`
  - `create-project-button`
  - `playground-run-button`
  - `dataset-form-submit-button`
  - `run-dataset-experiment-button`
  - `run-dataset-experiment-via-sdk-menu-item`
  - `llm-evaluator-form-submit-button`
- **A form's primary submit control gets `<form-name>-submit-button`**, not a verb
  that changes with mode (avoid `create-...` / `update-...` on the same element —
  see state below).

## State belongs in `data-*` attributes, not in the `data-testid`

The `data-testid` must be **constant for the life of the element**. Never compute it
from props/state and never make it conditionally `undefined`. If the same element
behaves differently depending on state, keep one `data-testid` and expose the state
through a separate `data-*` attribute:

```tsx
// ❌ testid changes with state; absent in edit mode
<Button data-testid={mode === "create" ? "create-eval-btn" : undefined} />

// ✅ stable testid, state on a data attribute
<Button data-testid="llm-evaluator-form-submit-button" data-mode={mode} />
```

Tests then select the stable ID and assert/filter on the attribute:

```typescript
page.getByTestId("llm-evaluator-form-submit-button"); // always resolves
page.locator('[data-testid="llm-evaluator-form-submit-button"][data-mode="create"]');
```

Common state attributes: `data-mode` (`create` | `edit`), `data-state`
(`open` | `closed` | `loading`), `data-selected`. Reuse an existing attribute name
if one already conveys the state (some design-system components set `data-state` etc.
themselves).

## Placement

Put `data-testid` (and any companion `data-*`) as the **first prop** on the element
for consistency and easy scanning.

## When to add one

Don't reach for `data-testid` first. Prefer, in order: role selectors
(`getByRole`), label selectors (`getByLabel`), text/placeholder selectors. Add a
`data-testid` only when those are ambiguous, unstable, or absent — e.g. an icon-only
button, a row action that repeats, or an element whose visible text changes.

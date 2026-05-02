# Component Patterns

## Core vs. domain split

Explore `app/src/components/` to understand the two layers:

- **Core** (`components/core/`) — presentational primitives. MUST NOT contain data fetching or business logic.
- **Domain** (everything else) — data-rich, composed from core primitives.

New features MUST compose from existing core primitives before creating new low-level UI.

## Layout

Existing flex and view layout primitives SHOULD be used for consistent spacing and alignment. Explore `components/core/` for what's available before writing ad-hoc layout wrappers.

## Storybook

New core components MUST include minimal Storybook stories showing primary variants and states. Explore `app/stories/` for the existing convention.

## File convention

Explore a few existing components to match the established file structure (component, styles, types, barrel export).

## Memoization

React Compiler is enabled — do NOT use `useMemo`, `useCallback`, or `React.memo`. The compiler handles memoization automatically. This includes callback props passed to children; define them inline without wrapping in `useCallback`.

## Refs

React 19 treats `ref` as a regular prop — do NOT use `forwardRef`. Instead, accept `ref` directly in the props type and destructure it like any other prop. Add `ref?: Ref<ElementType>` to the props interface.

## Callback props

Name callback props after the **event** (`onProjectCreated`, `onDismiss`), not the parent's implementation (`refetchProjects`). The callsite should read as plain English.

```tsx
// Good
<NewProjectButton onProjectCreated={() => refetchProjects()} />

// Avoid
<NewProjectButton refetchProjects={() => refetchProjects()} />
```

## Avoid useEffect

Prefer declarative React and React Aria patterns over imperative `useEffect`. Reach for `useEffect` only when there is no declarative alternative.

## Overlays: Drawer vs. Modal

Phoenix has two overlay components with different purposes. Choosing the wrong one breaks the interaction model.

### Drawer (`components/core/overlay/Drawer.tsx`)

A **non-modal** right-side panel. Use for **list-detail** flows where the user selects a row and inspects its details while keeping the list visible and interactive behind it.

- Does NOT render a backdrop — clicks pass through to the page behind it
- Resizable via drag handle; width persists to `localStorage` as a viewport percentage
- Dismissed with Escape or the collapse arrow button
- Route-driven: opening a drawer means navigating to a nested route (e.g., `/sessions/:sessionId`)
- The corresponding table row MUST be highlighted with `data-selected` so the user always knows which item they are viewing

Use `Drawer` when: the user needs to glance at details and return to the list without losing context (traces, spans, sessions).

### Modal (`components/core/overlay/Modal.tsx`)

A **modal** overlay that demands focus. Comes in two variants:

- `variant="default"` — centered dialog with backdrop. Use for confirmations, forms, and focused workflows that require the user's full attention.
- `variant="slideover"` — full-height right-side panel with backdrop. Use when the content needs more space than a centered dialog but still requires modal focus (e.g., a complex creation form that shouldn't compete with the page behind it).

Both variants block interaction with the page behind them via `ModalOverlay`.

### Decision guide

| Signal | Use |
|--------|-----|
| User is browsing a list and inspecting items | `Drawer` |
| User must complete an action before continuing | `Modal` (default) |
| Modal content needs full-height panel layout | `Modal` (slideover) |

## UX: list-detail pattern

Tables that open a detail view on row click MUST follow the **layered list-detail** pattern:

1. **Row click navigates** to a nested route (e.g., `/traces/:traceId`). The detail view renders via `<Outlet />` alongside the table.
2. **Selected row is highlighted** by setting `data-selected={isSelected}` on the `<tr>`, where `isSelected` compares `row.original.id` against the URL param (via `useParams`). The existing `selectableTableCSS` styles `tr[data-selected="true"]` automatically.
3. **Drawer opens** with the detail content. The table remains visible and scrollable behind it.
4. **Closing the drawer** navigates back to the parent route, clearing the selection.

This pattern keeps the user oriented — they always see which row they selected and can click a different row to switch without closing first.

## Shared constants

Shared literals (validation regexes, fixed string sets, etc.) belong in `app/src/constants/` as focused modules re-exported from `index.ts`. Import via `@phoenix/constants`. Do not export them from component or form files.

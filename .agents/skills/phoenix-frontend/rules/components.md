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

React Compiler is enabled — do NOT use `useMemo`, `useCallback`, or `React.memo`. The compiler handles memoization automatically.

## Refs

React 19 treats `ref` as a regular prop — do NOT use `forwardRef`. Instead, accept `ref` directly in the props type and destructure it like any other prop. Add `ref?: Ref<ElementType>` to the props interface.

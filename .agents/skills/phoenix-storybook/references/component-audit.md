# Component audit and granularity

Read before authoring or rewriting a component's stories. It decides *what*
the stories must show and *at which level* each option is shown.

## Contents

- Audit the component file
- States the stories cannot set
- Match capabilities, not current usage
- Show each variation at the level that owns it
- Slots get their own stories, then `Composition`
- Wrappers and sibling components
- One story file per component

## Audit the component file

Knowing the goal is not enough; the audit is a required step before calling a
story set done. Open the component's source and list what it accepts:

- its own props type and the types it extends (a React Aria props type,
  `SizingProps`, a variant union);
- props it spreads onward to an inner component — `SearchButton` passes
  `...props` to `SearchField`, so it accepts the field's states too, and
  those need auditing as well;
- the slots its CSS styles (`[slot="description"]`,
  `.react-aria-FieldError`, a class like `search-field__icon`);
- every `data-*` selector in its styles, since each is a state it draws
  differently, and which selectors combine (a `quiet` rule that excludes
  `[data-invalid]` means quiet × invalid looks different).

Check each item against the stories and either show it or say why it is left
out. The completeness tag records the result: `complete` only when every
listed item appears, `incomplete` when something is knowingly missing.

## States the stories cannot set

- Interaction-only selectors (`[data-hovered]`, `[data-pressed]`,
  `[data-focus-visible]`) count. Storybook here has no pseudo-state addon, so a
  component that styles them stays `incomplete` rather than faking the state
  with story-only CSS or props.
- A state the component keeps in its own `useState` with no prop to set it —
  `ID Badge`'s copied tooltip and checkmark after a press — is described in
  the meta docblock, and the entry stays `incomplete`. Do not give it a lone
  `play` story: as a file's only sidebar story it must be `!dev`, and on the
  Docs page, where `play` does not run, it duplicates `Default`.

## Match capabilities, not current usage

The grid's axes are what the component *supports* — every variant, size, slot
and state it types and styles — not only what the app passes today.
`Link Button` shows `danger`, `success` and disabled although no caller uses
them yet.

**Show every option the component accepts, including one with no styling.**
Exposing a prop that renders nothing different is part of the grid's purpose:
it surfaces props that exist without styles (`Checkbox`'s unstyled
`isInvalid`). Say in the docblock which options are unstyled and what they
render as, and file the gap as an issue.

**Measure before describing an unstyled option.** `Progress Bar`'s
`isIndeterminate` looked like it would leave an empty track, but the fill's
`undefined%` width is dropped and the bar draws full, like `100`. `Button`
size `L` turned out smaller than `S`, not merely unstyled. Read the rendered
geometry, then write the docblock — but keep measurements out of it.

App usage decides realistic content and emphasis, never whether an option
appears.

## Show each variation at the level that owns it

Before building a grid, ask where each option lives: open the component file
and find which export's props or CSS own it. Do not decide by the name of the
entry you happen to be looking at.

When a component is a composition of smaller parts, one grid at the
composite's level multiplies every part's states by every composite option,
grows needlessly large, and hides which level a state belongs to. Use more
than one level instead: a grid for the part's own states, then smaller
stories for what only the composite adds.

Example: `Design System/Forms/Radio` is shaped like `Checkbox` — a single
isolated radio as `Default`, `No Label` and `With Label` grids of one radio's
selection × state, then `Horizontal Group` and `Vertical Group`, with
`Group Help Text` last. The part's entry takes its closest sibling's shape,
including cases production does not use yet, because the grid shows what the
component accepts. Name the entry after the part a reader picks up and list
the composite in `subcomponents`. A state the composite sets but the part
renders (read only on a radio group) goes in the part's grid, set through the
smallest composite that can hold it.

A family whose parts each own a distinct option space gets one entry per part
(see `Menus` in [taxonomy](taxonomy.md)).

## Slots get their own stories, then `Composition`

A component with several content slots shows each slot's options alone, in
bare form, with no marks from other slots (`Menu Item`'s `Leading Content`
and `Trailing Content`). A built-in affordance goes in the slot it occupies:
the selection checkmark under leading, the submenu chevron under trailing. A
`Composition` story then shows realistic combinations, including one that
uses every slot and affordance together.

## Wrappers and sibling components

- **A wrapper that only presets slots or behavior gets no grid of its own.**
  `DebouncedSearch` is `SearchField` with its icon and input built in and a
  debounced `onChange`; list it in `subcomponents` and name it in the
  docblock.
- **A separately exported component that adds its own states and chrome is a
  sibling entry**, not a run of prefixed stories inside the entry it builds
  on: `Design System/Forms/Search Button` beside `…/Search`. Its `Default` and
  `Thumbnail` show what sets it apart, so the two entries do not open onto the
  same picture.
- **A prop that only applies a descendant's setting in bulk** (a table flag
  that formats every cell's JSON) is not the parent's to show. Demonstrate the
  setting on the cell content that owns it. A bulk prop in a story hints that
  production may have it at the wrong level.

## One story file per component

Two exports that a shared container accepts interchangeably are still two
components when each renders its own element: `Input` and `TextArea` both go
inside `TextField`, but they are separate React Aria components, so
`Design System/Forms/Text Area` is its own entry beside `…/Text Field`. Check
the source first: an export that is the same component with different
defaults or a preset prop is one component, and stays a row or subcomponent
of the entry it presets. Name the entry for the part a reader picks up; the
container it needs goes in `subcomponents`.

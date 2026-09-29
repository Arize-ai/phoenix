# Option grids

How to lay out a component's options and states so a reader compares them at
a glance. Read with [component-audit](component-audit.md), which decides what
goes in the grids.

## Contents

- Prefer scannable collections
- Build every grid with `OptionGrid`
- States are their own axis
- Cross axes in pairs
- Keep optional slots out of the state grid
- Collapsing stories into grids
- Naming and labels
- Comparing display modes
- Existing entries

## Prefer scannable collections

- Prefer fewer, vertically scannable stories over many sidebar entries;
  scrolling is easier than navigating between stories.
- Render multiple instances in one story when comparison is its purpose.
- Group a large set of small like items into one labeled list (agent tool and
  skill icons), not one story per item. This consolidation needs no removal
  ruling.
- Show a prop's values side by side, not behind a control: a labeled stack of
  `selectionMode` none / single / multiple compares at a glance, a radio
  control makes the reader switch and remember. Reserve controls for a genuine
  playground whose value space is too large to stack.
- Keep a separate focused story when interaction deserves its own
  demonstration, but do not fragment appearance coverage.

The limit: this groups *like items of one kind*. A kitchen-sink page that
renders many unrelated components from a hand-maintained import list
duplicates each component's own stories and rots silently. If a
cross-component sweep is wanted (a theme check across the library), build it
from the story index and put it under `Storybook/`, never in the design-system
tree.

## Build every grid with `OptionGrid`

`OptionGrid` (`js/app/stories/utils/OptionGrid.tsx`) owns grid layout and
label styling, so grids cannot drift apart. Pass rows and columns as
`{ label, code? }` and render the component in `renderCell`.

- Set `code: true` on a label that is a literal prop value (`S`, `danger`,
  `default · S`, `16`) — it renders monospace because it is what a reader
  types. Leave it off for a description (`Leading visual`, `read only`,
  `Line chart`).
- Row headings are always vertically centered in their row; `alignRows`
  aligns only the cells. Grids of fields pass `alignRows="start"` so inputs
  line up even when one cell carries a message.
- A component that fills its container in production (an `Alert`) passes a
  `cellWidth` and `justifyCells="stretch"`; otherwise each cell shrinks to its
  content and shows widths production never renders.
- Fix grid-wide alignment in `OptionGrid`, never with a per-story wrapper.
- A one-axis set of cases is an `OptionGrid` with short row labels and
  `themeLayout: "column"`, like `Number Field`'s `Formatting`.

## States are their own axis

Disabled, invalid, read only, required, pending and hovered apply whatever
the content, slots, variant or orientation, so they are never one more value
beside those options. A `Disabled` column next to `Leading visual`, `Trailing
shortcut` and `Icon only` shows disabled on plain content only, and a
disabled button with a shortcut is never rendered. The same goes for a
`description` row among the states, or a `No label` column beside `Disabled`.

`pnpm lint:storybook` rejects an axis (an array literal of object literals)
that sets a state prop beside any other option, reading through a `...NAME`
spread of a `const` array in the same file, so `[...SIZES, Disabled]` fails
too. A state entry may carry the data that makes it show (a value, an error
message). Declare each axis as its own literal and cross them with `flatMap`.

Put `disabled` directly after `read only`, as rows or columns: they are the
non-editable states and compare best side by side.

## Cross axes in pairs

Meeting the state rule does not mean one grid of variant × state × content: a
72-cell `Button` grid was unduly complicated. Give every pair of interacting
axes its own small grid — `Variants and Sizes`, `Variants and States`,
`Content and Sizes`, `Content and States` — so each state meets each variant
and each kind of content, and no grid grows past two short axes. A content
option with its own behavior (a trailing shortcut whose chip takes its own
fill per variant) gets its own story crossing it with the axes that change it.

## Keep optional slots out of the state grid

A state × size grid shows the component in its most common composition — a
search field with no visible label, because production names it with
`aria-label`. Vary slots in their own grid, and call the row with no optional
slots `Bare`, not `Neither` or `None`.

## Collapsing stories into grids

- **Two dimensions into one grid** when the matrix is smaller than roughly
  3×8 in either orientation: `Token Costs`' Default, Small, High Cost, Low
  Cost and Null Value became one grid of size × value. Label rows and columns
  so each cell reads without the source.
- **A one-dimension set is named for what it varies:** stories that differ
  only in content or data state become one `Content types` story; stories that
  differ only in min and max widths become `Size constraints`.
- **Do not bundle away a demonstration.** Collapse only when every case still
  shows what it showed alone. An opened state the component cannot hold open
  in a stack (a menu opened by a `play` step, one open at a time) stays
  separate. Before merging, check that the `play` step actually runs; a broken
  one looks like a story with nothing to lose.
- **Line count is not a balance signal.** Fixtures often dominate a file.
  Judge balance by sidebar entries and what each story shows.

Collapsing many-state domain components is covered in
[domain-stories](domain-stories.md).

## Naming and labels

- **Name a grid for what it varies, never `Gallery`.** States × sizes is
  `States and Sizes`; a single axis is named for it (`Sizes`, `Formatting`,
  `Content types`). Pick the axes the component actually varies.
- **Label a state with a row or column label, never inside the component.** A
  field labeled "Ice cream flavor (Invalid)" makes the fixture lie. Keep the
  component's own label a plausible production label.
- **A row label names the case in a few words; it does not caption it.**
  `Not selectable`, `Single select`, `Multi select` in the default face, not a
  mono `selectionMode="none" — static labels; tags cannot be selected`.

## Comparing display modes

When a component renders one value in several modes, one story puts every
mode in its own column of a single-row `OptionGrid`, all on the same content,
with `themeLayout: "column"`. Order columns from unrendered source to rendered
result. `Markdown Block`'s `Raw Text Mode` (raw text, then Markdown) opens its
entry, ahead of `Interactive`. Separate stories per mode, each with its own
sample, cannot be compared.

## Existing entries

"This story is fine" from a reviewer means its scope is right, not that it may
keep a `Gallery` name, missing sizes, or states written into labels. Bring an
entry in line with these conventions when you touch it.

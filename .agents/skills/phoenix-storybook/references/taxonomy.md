# Sidebar taxonomy and placement

Where an entry goes. The declarative source of truth is
`js/app/stories/_meta/taxonomy.ts` (roots, design-system subjects, domain
surfaces); `pnpm lint:storybook` checks titles and `storySort` against it. File
paths, titles, and Overview pages are in [files-and-titles](files-and-titles.md).

## Contents

- Subject, not abstraction tier
- The three roots
- Adding a subject or subfolder
- Placement rules
- Single-entry subjects: `Color` and `Icons`
- The `Menus` family
- Order within a subject

## Subject, not abstraction tier

Group by what content is *about* — typography, layout, tables, overlays,
error display — not where it sits in the abstraction stack. A tier-first
split (foundations / core / patterns, tokens / components / compositions) is
an author's mental model: it scatters one subject across three distant roots,
so working on tables means visiting table tokens, components, and composition
guidance in three places. Do not introduce a tier-first split.

Within a subject, keep the token reference, component stories, and
composition guidance together. Tier is carried by ordering and tags, never by
a `Reference/Components/Patterns` subsection layer. Subjects get internal
subsections when they carry genuine sub-topics (`Tables` splits into sorting,
cell styles, column ordering, and row navigation).

## The three roots

- **`Design System/<Subject>/…`** — anything used across the whole interface.
  Membership is breadth of use, not simplicity: `Table` belongs even though it
  is large; a one-off card does not even though it is small.
- **`Domains/<Surface>/…`** — components tied to one product surface, named
  as a user would name it (`Tracing`, `Experiments`, `PXI`, `Settings`, …).
- **`Storybook/…`** — documentation of Storybook itself: writing a story, the
  frame API, the tag vocabulary. There is no coverage or health page: the
  sidebar's Tag filters menu already counts every tag, and a committed
  summary of the story set churns with every story change (removed
  2026-09-28). Do not add one.

A fourth root is a taxonomy decision for maintainers, not an authoring one.

## Adding a subject or subfolder

- **Group by the reader's question, not the component's name.** An empty state
  answers the same question as a toast, progress bar, or skeleton — what is
  this surface telling me about its state? — so it lives under `Feedback`,
  not in a subject of its own.
- Before proposing a subject, check whether an existing one asks the same
  question. A subject holding only variants of one component is usually a
  member of a broader one.
- When several entries in a subject share one topic, give them a topic
  subfolder: `Feedback/Empty states/…` holds the component, its graphic, and
  the in-context gallery.
- A component family whose parts each own a distinct option space earns its
  own subject, one entry per part (see `Menus` below).
- New subjects and surfaces are added to `taxonomy.ts`; subfolders need
  `storySort` entries (see [files-and-titles](files-and-titles.md)).

## Placement rules

Place an entry by the subject a reader would be thinking about when they need
it, not by the directory its source lives in.

- **A story that imports from `@phoenix/pages/…` is a domain story**, even if
  it looks generic (`Metrics Chart Selector` → `Domains/Tracing`,
  `Timezone Preferences` → `Domains/Settings`).
- **`@phoenix/components/ai/…` and `components/agent/…` are `Domains/PXI`.**
  Nearly all consumers are the agent chat.
- **Date and time inputs go in `Dates and times`, not `Forms`**, beside the
  formatters and range selectors.
- **Chart primitives and palettes go in `Data visualization`**, not `Color`.
  A chart bound to one surface's data (`Experiment Metrics Charts`) goes to
  that domain.
- **Small inline labels go in `Badges`**: badge, ID badge, token, keyboard
  token, counter.
- **`Navigation` holds only ways of moving between places**: tabs,
  breadcrumbs, the command palette. A static list of divided rows (`List`)
  goes in `Layout`; a list the reader picks values from (`List Box`) is an
  input and goes in `Forms` beside the select and combo box.
- **A control that only opens a menu of actions** (`Copy Action Menu`) is an
  action and lives under `Actions`.
- **Icon sets and icon components go in `Icons`**, except one domain's own
  glyph (`Span Kind Icon` → `Domains/Tracing`, tool and skill icons →
  `Domains/PXI`).
- **`Cost`** (token counts and prices) is a domain surface and must not be
  called `Tokens`, which belongs to design tokens.
- **When breadth of use and the current home disagree, keep the current
  domain and say so.** `Latency Text` is used across several surfaces but no
  design-system subject fits it, so it stays in `Domains/Tracing` until one
  does.

## Single-entry subjects: `Color` and `Icons`

A subject whose content is one entry takes the subject itself as the entry —
one sidebar leaf and one Docs page, with no folder, Overview, or same-named
child.

- **`Design System/Icons`** (`stories/design-system/Icons.stories.tsx`) opens
  on the searchable icon set, then chart-type icons, then brand marks
  (generative providers, integrations, sandbox providers), then the record
  icon. Each icon component is a section and is listed in `subcomponents`; a
  new icon component becomes one more story there, not a sibling entry.
- **`Design System/Color/Colors`** is one entry read as a single Docs page.
  Each color family is a story: a vertical stack of its steps with the token
  name as a mono row label, with `themeLayout: "row"`. The semantic colors
  (info, success, warning, danger) are a `Semantic Color` story in the same
  entry, showing text, badge, token and alert per color (no toast; see
  [toasts](toasts.md)).

## The `Menus` family

`Menus` is its own subject because one `Menu` entry could not hold the item's
slots and states, the list's selection and item count, the container's size
and placement, and header/footer/section composition. Entries follow
ownership in the source:

1. `Menu` — the list
2. `Menu Item`
3. `Menu Container` — the popover surface: min and max size, placement
4. `Grid List` — the other list a menu container holds
5. `Menu Button` — a prebuilt part
6. `Composition` — header, footer, sections, submenus

`Menus` holds the menu's own parts, not every button that opens one.

## Order within a subject

Reference and overview pages first, component stories next, composition
guidance last, so a subject opens onto an entry point rather than whatever
sorts first.

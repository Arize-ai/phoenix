# Files, titles, and Overview pages

Mechanics for creating, moving, or renaming a story file or title. Which
subject an entry belongs to is in [taxonomy](taxonomy.md).

## Contents

- Titles match paths
- Leaf names
- Imports
- Story export names
- Overview pages
- `storySort`
- Docs page names in search

## Titles match paths

Story files live under `js/app/stories/` in directories that are the
kebab-case slug of the title's leading segments:
`Design System/Overlays/Popover` →
`stories/design-system/overlays/Popover.stories.tsx`. Directories are slugged
so paths stay safe for globs and shell commands; only the leaf file keeps the
component's casing.

`pnpm lint:stories` checks `slug(title)` equals the file's directory. Do not
hand-write a title that disagrees with its path, and do not add a story
outside this layout — a file flat in `stories/` fails, with no allowlist. Two
files must never claim the same title.

Never put `&` in a title segment. Titles become directory names, and `&` is
hostile to globs, shell commands, and CI path filters. Spell it `and`.

## Leaf names

- The title leaf must match the filename once both are reduced to lowercase
  alphanumerics. When they disagree, keep the leaf a reader already knows and
  rename the file (with `git mv`).
- Leaves are spaced words (`Chart Skeleton`, not `ChartSkeleton`).
- Drop a prefix that only repeats the enclosing section
  (`Domains/Experiments/Run Outputs`, not `…/Experiment Run Outputs`); keep one
  that carries meaning the section does not (`Domains/PXI/AI Outline`).

## Imports

`stories/constants/` and `stories/utils/` hold shared fixtures and helpers,
not stories. Import them relatively from the story's depth. Import production
code through `@phoenix/…`, never `../src/…`, so imports survive a move.

## Story export names

- Never name a story export `Docs`: its id collides with the autodocs page
  (`…--docs`) and the index drops the story without an error.
- When removing or renaming a story export, search MDX for `<Canvas of={…}>`
  references to it. `pnpm lint:stories` fails on a reference that no longer
  resolves.

## Overview pages

Every folder opens onto an Overview, at any depth — a nested subfolder is not
exempt. Otherwise its sidebar row only toggles, and the parent's card for it
lands on whichever child sorts first.

An Overview says in a few sentences how the folder's entries relate, then
renders `<SubjectOverview>` (`stories/utils/SubjectOverview.tsx`) for the
folder's own title. Name it after the folder:

```mdx
<Meta title="Design System/Typography/Overview" name="Typography" />
```

The title ends in `Overview`, which keeps it the folder's entry point; the
name is what a reader searches for. `pnpm lint:stories` enforces the name,
and the sidebar derives the page id from it, so a mismatch also breaks the
folder's click-to-open.

## `storySort`

`options.storySort` in `js/app/.storybook/preview.tsx` must be an inline
literal: Storybook reads it statically and fails on an imported constant.
`pnpm lint:stories` asserts it agrees with `taxonomy.ts`.

List a subfolder and its entries in the subject's nested array, with
`"Overview"` first. Entries the order does not name fall back to index order,
which is not alphabetical — an unlisted folder once sorted its graphic ahead
of the component itself.

## Docs page names in search

Search titles each result with the entry's name, ranks by that name above its
path, and substitutes a component's Docs page for the component. An unnamed
docs page is called "Docs", so it reaches search as one more
indistinguishable "Docs" row.

- Overview pages are named after their folder (above). Search hides the
  trailing `Overview` from their path (`Design System / Typography`), because
  in the sidebar the Overview *is* its folder.
- Autodocs pages cannot be named individually, so the manager retitles "Docs"
  results with the last segment of their path, copying Storybook's match
  highlighting (`.storybook/sidebar/searchDocsTitles.ts`). Do not work around
  this per page, e.g. with a hand-written MDX page whose only purpose is a
  better name.

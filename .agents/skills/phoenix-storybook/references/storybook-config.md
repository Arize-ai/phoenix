# Storybook configuration

Read before editing `js/app/.storybook/` — the manager, sidebar, preview, or
Docs page. Changes to `manager.ts` and `main.ts` take effect only after the
Storybook server restarts.

## Contents

- Where things live
- Sidebar tag chips
- Sidebar indent
- Search titles
- Preview frame and Docs page

## Where things live

| File | Owns |
|---|---|
| `main.ts` | story globs, addons, docgen, Vite config |
| `manager.ts` | manager theme, sidebar config, tag chips |
| `sidebar/subjectOverviews.ts` | Overview folder behavior, row indent |
| `sidebar/searchDocsTitles.ts` | retitling "Docs" search results |
| `preview.tsx` | theme frame (`ThemedStory`), portal hosts, `DocsPage`, global `autodocs` tag, `storySort` |
| `stories/_meta/taxonomy.ts` | roots, subjects, surfaces |
| `stories/_meta/tags.ts` | tag vocabulary |
| `scripts/lint-storybook.ts` | `pnpm lint:storybook` rules |

## Sidebar tag chips

`renderLabel` in `manager.ts` chips only `unused`, in red. The provenance,
completeness and review axes are not drawn in the sidebar; they stay
queryable through Storybook's Tag filters menu. Chipping another tag is a
maintainer decision, made by adding it to `CHIP_ROLE_BY_TAG` and
`CHIP_TAG_ORDER`.

- **Chip text is the tag value verbatim.** No abbreviations or invented
  labels like `WIP`; the chip and the filter must share one vocabulary.
- **Resolve every color in both manager themes.** The manager cannot read
  Phoenix CSS custom properties, so chips need hardcoded light/dark pairs, as
  `PHOENIX_BACKGROUND` in `manager.ts` does — a literal per theme with a
  comment naming the Phoenix token it mirrors. Use a palette's `1000` step:
  the ramps invert between themes, so it contrasts with its own theme's
  background in both. Grey is the trap: one grey value reads muted in one
  theme and near-invisible or near-black in the other.
- **Chips go on their own line below the name.** Return a flex column from
  `renderLabel`. Storybook's sidebar already supports multi-line labels
  (`commonNodeStyles` uses `minHeight: 28`, `alignItems: "start"`, and
  `break-word` wrapping, with no `nowrap` or ellipsis), so do not add
  truncation. Rows grow to about 44px; that is the accepted trade.
- **Chip only leaf entries** (`item.type === "story"` or `"docs"`).
  `renderLabel` runs for roots and groups too; return `item.name` unchanged
  for those.
- **Register with `addons.setConfig`, not `api.setOptions`,** at manager
  module load. The index hash reads `renderLabel` from `provider.getConfig()`
  once while it is built; a `sidebar` key passed to `api.setOptions` is a
  silent no-op.
- **Chips keep their color over a selected row.** A selected row is filled
  with the accent blue in both themes, which swallows a translucent chip.
  Over the selection the chip takes its role color as an opaque fill, with
  text in whichever fixed pigment contrasts — white in light, near-black in
  dark. Do not make selected chips white or translucent; that discards the
  color coding.

Verify chips in a real browser ([verification](verification.md)).

## Sidebar indent

Each sidebar level indents 12px rather than Storybook's 18px. Storybook
hardcodes the step in an emotion class and exposes no depth, so `indentRow` in
`sidebar/subjectOverviews.ts` reads each row's depth from that padding once and
re-indents it inline. Change the step there (`INDENT_STEP`), never with
per-row CSS, and re-check it after a Storybook upgrade, since the formula it
inverts is Storybook's.

## Search titles

See "Docs page names in search" in [files-and-titles](files-and-titles.md).
Do not add per-page workarounds for autodocs names.

## Preview frame and Docs page

- `ThemedStory` gives each theme panel its own portal host so portaled layers
  inherit the panel's theme; fix theme escapes here, never in stories (see
  [themes](themes.md)).
- `DocsPage` excludes the primary story from the Stories list, supports
  `parameters.phoenixDocs.showPrimary: false`, and hides the props table when
  `parameters.controls.disable` is set (see [entry-shape](entry-shape.md)).
- `autodocs` is applied globally here.
- `options.storySort` must stay an inline literal (see
  [files-and-titles](files-and-titles.md)).

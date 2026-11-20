# Badges, tags and labels

Pick a member of the badge family by the role the element plays, not by how it should look. Every member is exported from `@phoenix/components`; the stories under "Design System/Badges" show each one.

| Role | Member | Examples |
| --- | --- | --- |
| A thing's lifecycle or health | `StatusIndicator` | run status, sandbox availability |
| One value from a closed set of kinds | `Badge` | span kind, annotator kind, evaluator kind, "latest" |
| How many of something | `Counter` | tab counts (see `counters.md`) |
| A name keyed to its other appearances | `SwatchedName` | an experiment beside its chart series |
| A machine ID | `Identifier` | trace, span and global IDs |
| A separate object attached to the thing | `Tag` / `TagGroup` | dataset and prompt labels, splits, version tags, project references |
| A set a person edits in place | `EditableTagGroup` + `TagPicker` | labels in the dataset and prompt headers and the dataset form |

A value that is not an object (a model name, a score, an annotation label) is plain text. A command ("add this filter") is a `Button`. `Badge`, `StatusIndicator` and `Counter` are never hit targets: to explain one or open detail from it, wrap it in a `MarkerTrigger`; to filter by one, give the cell, row or a menu the affordance.

## Badge color

A nominal axis takes a categorical `color` from `BADGE_COLORS`, which leaves out green, orange and red so a kind never reads as a judgment. One exception: when an axis already has an established color per value across Phoenix, pass that color through `paletteColor` so the value reads the same everywhere. Span kind is the only such axis today. `SpanKindBadge` takes its color from `getSpanKindColor`, the palette the trace tree's span kind icons use, including orange for LLM. You MUST NOT give span kind a second palette, and MUST NOT use `paletteColor` to bring an excluded hue into an axis that has no established palette.

## Tag

A `Tag` MAY be a hit target, and its props pick its shape:

- read-only: no `onPress`, `href` or `onRemove`; not focusable
- operational: `onPress`, or `href` for a real link to the object's page
- dismissible: `onRemove`, only where the person is editing the set
- press and remove: both, as two focus stops

Color comes from one of two sources, never both. Use `color` (a name from `TAG_COLORS`) whenever Phoenix picks the hue, such as a version tag colored by its name. Use `userColor` only to pass through a color a person picked and Phoenix stored, such as a label's hex. You MUST NOT invent a `userColor`.

Size `S` inside menu items and pickers, `M` everywhere else, table cells included.

## TagGroup

Any set of tags MUST be a `TagGroup`; do not lay tags out in a row of your own. Give it an `aria-label` that names the set.

- `overflow="wrap"` (default) on detail pages and in editors
- `overflow="collapse"` with no `limit` in table cells: one row, fitted to the cell, with a `+N` popover for the rest
- `onAction` for one action per tag (a table cell's label filter); `selectionMode` for tags that toggle membership; `onRemove` for editing (Delete and Backspace remove the focused tag)

Build items with the domain helpers: `labelTagItem` (`@phoenix/components/label`) for anything with a stored color, `projectTagItem` (`@phoenix/components/project`) for projects.

## Editable label sets

Where a person adds and removes labels on a thing, use `EditableTagGroup` with a `TagPicker` in its `picker` slot. Neither holds data; a domain wrapper loads the options and saves:

```tsx
<EditableTagGroup
  aria-label="Dataset labels"
  items={labels.map(labelTagItem)}
  onRemove={(ids) => save(labels.filter((label) => !ids.has(label.id)))}
  picker={<DatasetLabelPicker selectedLabels={labels} onChange={save} />}
/>
```

- In a page header, put it in `PageHeader`'s `labels` slot and save each change at once (`DatasetLabelsEditor`, `PromptLabelsEditor`).
- In a form, hold the change in the form and save on submit (`DatasetLabelsField`).
- Reuse the domain pickers (`DatasetLabelPicker`, `PromptLabelPicker`); they include inline create, and a created label joins the selection.
- Without `onRemove` and `picker` the group is read-only and shows "No labels" when empty.

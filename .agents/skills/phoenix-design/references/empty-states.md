# Empty States

## Filtered vs. genuinely empty

A list that renders nothing has two distinct causes, and they must read
differently:

- **Genuinely empty** (no items exist, unfiltered view): topical icon + "No
  <things>" — e.g. the tag icon + "No tags".
- **Filtered to nothing** (a search/filter matched nothing): the search icon +
  "No results".

When a surface can be in either state — most menus, comboboxes, and
filterable tables — it must transition between them: "No tags" with the tag
icon until the user types a query, then "No results" with the search icon. This
transition must hold even when the underlying list is empty — typing into a
tags menu that has zero tags is still a search, so it reads "No results", not
"No tags".

`CompactEmptyState` handles this automatically inside a React Aria
`Autocomplete` or `ComboBox`: it reads the live input value from context, so a
non-empty query flips the icon/description to the search icon + "No results".
Call sites just pass the topical icon and description:

```tsx
<Menu
  items={tags}
  renderEmptyState={() => (
    <CompactEmptyState
      icon={<Icon svg={<Icons.PriceTags />} />}
      description="No tags"
    />
  )}
>
```

Pass the `isFiltered` prop explicitly only for surfaces with no such context —
e.g. a server-filtered table that tracks its own filter string:

```tsx
<CompactEmptyState
  icon={<Icon svg={<Icons.Scale />} />}
  description="No evaluators"
  isFiltered={!!filter}
/>
```

Do not gate `isFiltered` on `items.length` — with zero items that never flips,
so a search in an empty list wrongly stays on the topical state.

## Never render a bare `Text` as an empty state

Any `renderEmptyState` — menus, comboboxes, and command palettes must
render `CompactEmptyState`, never a lone `<Text>No results</Text>`. Bare text
skips the topical/search icon, the subtle theme-aware color, the centering, and
the faint glow, so it reads as a stray label rather than a considered empty
state and drifts from every other empty surface.

# Empty-State Graphics

`EmptyStateGraphic` renders the illustration shown above an `EmptyState`.
Freeform composability is intentionally limited. Callers pick a named
`variant` based on the application's canonical icons for specific features,
automatically receiving the appropriate icon and card size.

```tsx
<EmptyState
  graphic={<EmptyStateGraphic variant="trace" />}
  title="No traces yet"
  description="…"
/>
```

## Choosing a variant

1. Look for a variant whose name matches the region/topic of your empty state in
   `EMPTY_STATE_GRAPHICS` (`app/src/components/empty-state/EmptyStateGraphic.tsx`).
   If one exists, use it.
2. If none fits, use `variant="genericAdd"` — the fallback for surfaces that do not
   (yet) warrant their own entry.
3. If the surface is represents a real, recurring, conceptually well-bounded part
   of the application, use its existing icon. If no icon exists, fall back to the
   generic case and ask if it warrants its own category.

## Adding a variant

The variant table is the single source of truth — the `EmptyStateGraphicVariant`
type is derived from its keys, so adding an entry is all that's needed.

1. Pick the icon using the noun→icon mapping in `rules/icons.md`. The empty
   state's topic is the noun (e.g. a "no traces" state uses the Trace icon). If
   the noun isn't mapped yet, add it there in the same change.
2. Pick the size: `"large"` for top level categories, and small for their contents.
   'No datasets' on the `/datasets` endpoint is`"large"`, while an empty dataset
   displaying "No entries" would be `"small"`.
3. Add an entry to `EMPTY_STATE_GRAPHICS`, keyed by the region/topic:

   ```tsx
   const EMPTY_STATE_GRAPHICS = {
     genericAdd: { size: "small", icon: <Icon svg={<Icons.PlusOutline />} /> },
     trace: { size: "large", icon: <Icon svg={<Icons.Trace />} /> },
     // ↑ add your entry here
   } satisfies Record<string, EmptyStateGraphicSpec>;
   ```

The `satisfies` checks every value against `EmptyStateGraphicSpec` while keeping
the keys as literals, so the `EmptyStateGraphicVariant` union is derived from
them and the table can never disagree. No other file needs to change —
`EMPTY_STATE_GRAPHIC_VARIANTS` and the Storybook controls pick up the new entry
automatically.

## Why enumerate instead of passing an icon

An open `icon`/`size` API invites drift: two "no traces" states with different
glyphs or sizes. Enumerating the combinations makes `EmptyStateGraphic` the
enforcement point for the noun→icon mapping and makes call sites read as intent
(`variant="traces"`) rather than implementation.

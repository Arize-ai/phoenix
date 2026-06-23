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

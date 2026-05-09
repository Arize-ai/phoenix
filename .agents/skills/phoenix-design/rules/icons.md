# Icons — Noun → Icon Mapping

Phoenix has a curated icon set in `app/src/components/core/icon/Icons.tsx`. Use this canonical mapping so that the same Phoenix concept (the **noun**) is always represented by the same glyph across the app. Consistency matters more than aesthetic preference — when the noun appears, reach for the icon below.

## Canonical mapping

| Noun | Icon | Notes |
|------|------|-------|
| Project | `Icons.GridOutline` | Phoenix projects (the namespace concept). |
| Trace | `Icons.Trace` | A single trace. |
| Span | `Icons.WorkflowOutline` | A single span. The Lucide-style workflow glyph (two connected nodes) reads as a step in a workflow, which matches how spans relate. |
| Span filter | `Icons.FunnelOutline` | A validated span filter expression. |
| Source / citation | `Icons.BookOutline` | Source documents surfaced from RAG / search. |
| Document (generic) | `Icons.FileTextOutline` | Text-bearing documents (PDF, txt, md). |
| File (generic / unknown) | `Icons.FileOutline` | Default file fallback when the media type is not specifically handled. |
| Image | `Icons.ImageOutline` | Image-typed file attachments. |
| Video | `Icons.PlayCircleOutline` | Video-typed file attachments (no dedicated `Video*` icon). |
| Context (generic) | `Icons.InfoOutline` | Default for an `AttachmentContextData` whose category has no canonical icon yet. |

## When you need an icon

1. Look up the noun above. If it is listed, use that icon.
2. If it is not listed but the icon exists in `Icons.tsx`, **add a row to the table above** in the same PR so the next person finds it.
3. If neither the noun nor the icon exists, add the icon to `Icons.tsx` (see "Adding a new icon" below) and add the row to the table.

## Adding a new icon

`Icons.tsx` is alphabetically sectioned (`//A`, `//B`, …). Two coexisting style families:

- **Eva-icons style** (the majority) — filled paths, no `stroke` attribute, `viewBox="0 0 24 24"`. Render at the icon container's `font-size`.
- **Lucide style** — `fill="none"`, `stroke="currentColor"`, explicit `width="20" height="20"`. When porting a Lucide SVG:
  - Convert kebab-case attributes to camelCase (`stroke-width` → `strokeWidth`, etc.).
  - Set `fill="none"` on the root **and** on each child shape — JSX/React rendering does not always honor inheritance the same way as raw SVG.
  - Match the `GitBranchOutline` / `WorkflowOutline` shape exactly so future Lucide additions stay consistent.

Export as `<Name>Outline` (or `<Name>Filled`) to match the existing naming convention. After adding, update the table in this file in the same change.

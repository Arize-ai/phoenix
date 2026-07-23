# Icons — Noun → Icon Mapping

Phoenix has a curated icon set in `app/src/components/core/icon/Icons.tsx`. Use this canonical mapping so that the same Phoenix concept (the **noun**) is always represented by the same glyph across the app. Consistency matters more than aesthetic preference — when the noun appears, reach for the icon below.

## Canonical mapping

| Noun | Icon | Notes |
|------|------|-------|
| Account / user profile | `Icons.Person` | A user's identity, account details, or profile settings. |
| API key | `Icons.Key` | Personal or system credentials used for programmatic access. |
| Authorized application / OAuth grant | `Icons.Link2` | An application connected to a user's Phoenix account through OAuth. |
| Project | `Icons.Grid` | Phoenix projects (the namespace concept). |
| Trace | `Icons.Trace` | A single trace. |
| Span | `Icons.Workflow` | A single span. The Lucide-style workflow glyph (two connected nodes) reads as a step in a workflow, which matches how spans relate. |
| Span filter | `Icons.Funnel` | A validated span filter expression. |
| Source / citation | `Icons.Book` | Source documents surfaced from RAG / search. |
| Document (generic) | `Icons.FileText` | Text-bearing documents (PDF, txt, md). |
| File (generic / unknown) | `Icons.File` | Default file fallback when the media type is not specifically handled. |
| Image | `Icons.Image` | Image-typed file attachments. |
| Video | `Icons.PlayCircle` | Video-typed file attachments (no dedicated `Video*` icon). |
| Code-evaluator form | `Icons.Edit` | Task-role context pill for the code-evaluator create/edit form the user is working in. The edit glyph reads as an action, distinct from entity icons used by surface pills. |
| Context (generic) | `Icons.Info` | Default for an `AttachmentContextData` whose category has no canonical icon yet. |
| Update / release notice | `Icons.Gift` | New-version notices and release prompts. |
| Bypass / unguarded approvals | `Icons.Shield` | Warning shield for bypass/auto-approval modes where approvals are skipped. |
| Undo / rewind | `Icons.RotateCcw` | Counterclockwise arrow for reverting/undoing an action (e.g. rewinding a chat). Distinct from `History` (clock = history/session list). |
| Resume / play | `Icons.Play` | Start or resume a paused activity (e.g. resume live streaming). Distinct from `PlayCircle` (used for video attachments). |
| Pause | `Icons.Pause` | Pause an in-progress activity (e.g. pause live streaming). |
| Mark / bookmark a selection | `Icons.BookmarkCheck` | Mark an item as a designated selection (e.g. mark an experiment as the baseline). Use `Icons.BookmarkX` for the corresponding remove/unset action. Prefer these over `PriceTags`, which reads as free-form tagging. |
| Chart type: vertical bars | `Icons.ChartNoAxesColumn` | Lucide-style glyph (three ascending columns, no axis). Preview for a vertical bar / column chart in the metric chart picker. Distinct from `BarChart` (eva glyph used as the generic "charts" action icon). |
| Chart type: horizontal / ranked bars | `Icons.ChartBarDecreasing` | Lucide-style chart glyph with axis and descending horizontal bars. Preview for a ranked "top N" horizontal bar chart. |
| Chart type: line | `Icons.ChartLine` | Lucide-style chart glyph with axis. Preview for a line / time-series chart. |
| MCP (Model Context Protocol) | `McpSVG` (from `@phoenix/components/project/IntegrationIcons`) | The official MCP mark (filled, evenodd). Used for the MCP settings tab and anything referencing the built-in `/mcp` endpoint. |
| Model | `Icons.Cube` | Lucide box glyph (cube). Used for the Models settings tab and anything representing a model as an entity. Prefer this over `LLMOutput` for the model noun. |
| User preferences | `Icons.Options` | User-selectable theme, timezone, and code presentation preferences. |
| Custom AI provider | `Icons.Sparkle` | Used for custom provider configuration and its empty state. |
| PXI ask tool | `Icons.MessagesSquare` | Tool calls that pause for an answer from the user. |
| PXI command tool | `Icons.Console` | Shell or command execution. |
| PXI configuration tool | `Icons.Options` | Tools that configure an existing playground or evaluator workflow. |
| PXI dataset tool | `Icons.Database` | Dataset discovery and mutation tools. |
| PXI delegation tool | `Icons.Subagent` | Work delegated to a subagent; the split-branch shape points down toward the delegated work. |
| PXI documentation tool | `Icons.Search` | Direct documentation-file queries. |
| PXI edit tool | `Icons.Edit2` | Tools that author, edit, submit, or persist user artifacts. |
| PXI filter tool | `Icons.ListFilter` | Tools that change the visible span filter. |
| PXI navigation tool | `Icons.ArrowUpRightCorner` | Route lookup and tools that open an editing surface. |
| PXI read tool | `Icons.ScanText` | Read-only inspection of an existing user artifact. |
| PXI run tool | `Icons.Play` | Playground and evaluator run actions, including cancellation. |
| PXI search tool | `Icons.Search` | Searching Phoenix documentation or the web. |
| PXI skill tool | `Icons.GraduationCap` | Loading a skill or reading one of its resources. |
| PXI built-in skill | Semantic noun icon | Built-in skills use a noun icon such as `Database` for datasets or `Scale` for evaluators; unknown skills fall back to `GraduationCap`. |
| PXI time tool | `Icons.Clock` | Reading or changing time context. |
| PXI visualization tool | `Icons.BarChart` | Rendering generative charts or other data UI. |
| PXI web retrieval tool | `Icons.Globe` | Fetching a known web page. |
| PXI tool (generic) | `Icons.Wrench` | Fallback for unknown tools or tools without a strong semantic category. |

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
  - Match the `GitBranch` / `Workflow` shape exactly so future Lucide additions stay consistent.

Export the icon under its bare noun (e.g. `Grid`, `Workflow`). Add a `<Name>Filled` variant only when a filled counterpart coexists with the default glyph (e.g. `Info` / `InfoFilled`). After adding, update the table in this file in the same change.

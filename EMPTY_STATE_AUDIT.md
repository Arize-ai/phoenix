# Empty State Audit

> Audit of existing empty-state UI in `app/src/` against the new shared
> empty-state abstractions, to determine where the new components can be
> dropped in cleanly and where current usage is poorly represented or
> ambiguous.
>
> Date: 2026-06-17

## The new abstractions (target)

Public API in `app/src/components/empty-state/index.ts`:

- **`EmptyState`** (`EmptyState.tsx`) — full zero-state block. Props:
  - `graphic?: ReactNode` — typically `<EmptyStateGraphic>`
  - `title?: string` / `description?: ReactNode` — title requires a description
  - `action?` — one of:
    - `{ type: "link"; label; href }`
    - `{ type: "buttons"; buttons: ButtonProps[] }` (size hardcoded to `S`)
    - `{ type: "cards"; items: LinkCard[]; columns?: 1 | 2 }`
  - `orientation?: "auto" | "vertical" | "horizontal"`
- **`EmptyStateGraphic`** (`EmptyStateGraphic.tsx`) — 16 canonical variants, two
  sizes (`large` for top-level categories, `small` for nested content):
  - large: `trace`, `dataset`, `evaluator`, `session`, `experiment`, `prompt`
  - small: `genericAdd`, `genericEdit`, `annotation`, `event`, `attribute`,
    `config`, `credential`, `tag`, `label`, `split`
- **`LinkCard`** (`LinkCard.tsx`) — `{ icon?, title, description, href, external? }`

Design intent (per `.agents/skills/phoenix-design/rules/empty-states.md`):
`EmptyState` is for **full-page / large zero-states** with a graphic, a
title+description, and a standardized CTA. It is deliberately heavier than the
existing lightweight text helpers.

### Pre-existing lightweight helpers (NOT replaced by `EmptyState`)

These are intentionally minimal and serve a different role than the new
full zero-state component. They are out of scope for a `EmptyState` drop-in:

- `Empty` (`components/core/Empty.tsx`) — `{ message?, size? }`, inline text.
- `TableEmpty` (`components/table/TableEmpty.tsx`) — centered tbody row.
- `TableEmptyWrap` (`components/table/TableEmptyWrap.tsx`) — tbody layout shell.
- `MenuEmpty` (`components/core/menu/Menu.tsx`) — dropdown/listbox empty row.
- `ChartEmptyStateOverlay` (`components/chart/ChartEmptyStateOverlay.tsx`) —
  overlay that preserves chart axes; domain-specific.

---

## Fitness legend

- ✅ **Clear drop-in** — maps cleanly onto `EmptyState` + an existing graphic
  variant and standardized CTA. (Some already use `EmptyState`; the work is
  adopting the real graphic variant / standardized action shape.)
- 🟡 **Partial / needs adaptation** — concept fits, but a piece (media, custom
  diagram, layout context) is not first-class in the abstraction.
- 🔴 **Not represented / out of scope** — different purpose (inline cell text,
  dropdown empties, charts, loading placeholders, bespoke hero), or no matching
  graphic variant.

---

## Migration conventions (decided)

Apply these when porting any site below onto `EmptyState`:

- **One mixed action strip** — `action: { type: "strip", items: [...] }` where
  each item is a `link` or a `button`. (Implemented: replaced the old separate
  `link` / `buttons` action variants.)
- **Links for external, buttons for in-product** — use a `link` item for
  external destinations (Docs, Quickstart, Example; rendered as `ExternalLink`)
  and a `button` item for in-product behaviors — navigation, opening a dialog
  (Playground, Run, Get Started, Set up Sessions).
- **No leading icons on buttons** — empty-state CTAs render text-only.
- **"Set up" is a verb** — e.g. "Set up Sessions", never the noun "Setup".
  (Fixes the current `SessionsTableEmpty` button copy.)
- **"Docs", not "Documentation"** — use the short label across the board.

A browsable preview of the proposed migrations lives in
`app/stories/EmptyStateInContext.stories.tsx` (Storybook → *Empty States/In
Context*); each story is the drop-in `EmptyState` config for its site.

---

## 1. Full-page / feature zero-states (primary target for `EmptyState`)

> **Correction (2026-06-17):** an earlier version of this audit claimed these
> states "already use `EmptyState`." That was wrong — **all four marquee states
> are hand-rolled `View`/`Flex`/`Text`/`Video` JSX** and do not import the
> `EmptyState` component at all. Fitness below is reassessed as a *migration
> target*: would the current design fit `EmptyState` if rebuilt on it?
>
> Separately, the embedded onboarding **videos** and the evaluators **workflow
> SVG** are being removed; that removal is assumed below.

| Location | Current (today) | Graphic variant | Fitness | Notes |
|---|---|---|---|---|
| `pages/datasets/DatasetsEmpty.tsx` | custom JSX: title + video + 2 external-link buttons (Documentation, Quickstart) | `dataset` (large) | ✅ | Not on the abstraction today, but the design maps cleanly: `description` + `action: buttons` (two link buttons) + `dataset` graphic, once the video is gone. |
| `pages/prompts/PromptsEmpty.tsx` | custom JSX: title + video + Documentation link + Playground button (`useNavigate`) | `prompt` (large) | ✅ | Maps to `description` + `action: buttons` (Documentation + primary Playground) + `prompt` graphic. |
| `pages/experiments/ExperimentsEmpty.tsx` | custom JSX: title + video + Documentation + Example links + `RunDatasetExperimentButton` | `experiment` (large) | ✅ (with caveat) | Three CTAs map to `action: buttons`. **Caveat:** embeds `RunDatasetExperimentButton`, which reads `useDatasetContext` and throws outside a dataset page — a real context coupling, not just layout. The button (with its code-modal/dialog) would need to ride along as a `ButtonProps` entry. |
| `pages/evaluators/GlobalEvaluatorsEmptyState.tsx` (unfiltered) | custom JSX: title + workflow SVG (outgoing) + **2 informational "cards"** (LLM/Code, non-link) + **2-button CTA** (View Datasets, Documentation) | needs a new variant | 🔴 **PUNTED** | The LLM/Code "cards" are **not interactive** — rendering them via the `cards` action (`LinkCard`, requires `href`, looks clickable) would misrepresent them. They're really a **composite graphic** describing the two evaluator types, and deserve a **dedicated `EmptyStateGraphic` variant that preserves that detail**. Punting pending that graphic. (Secondary blocker: even as cards, `action` is a single one-of, so cards + the CTA buttons can't coexist.) |
| `pages/evaluators/GlobalEvaluatorsEmptyState.tsx` (filtered) | "No evaluators found that match the given filter." | — | ✅ | Trivial text-only branch → `Empty`/`TableEmpty` (or a bare `EmptyState` description). |
| `pages/project/ProjectTableEmpty.tsx` | **migrated** → `EmptyState` + `trace` graphic, inside `TableEmptyWrap` | `trace` (large) | ✅ Done | Manual `tbody`/`tr`/`td` + `Flex` wrapper removed (now `TableEmptyWrap`). CTA "Get Started" opens the setup dialog via a controlled `ModalOverlay` (`DialogTrigger` → `useState`), since the action button is data-driven. |
| `pages/project/SessionsTableEmpty.tsx` | **migrated** → `EmptyState` + `session` graphic, inside `TableEmptyWrap` | `session` (large) | ✅ Done | Same conversion. Button copy fixed to "Set up Sessions" (verb), icon dropped; dialog title fixed to "Set up Sessions for this Project". |

**Takeaway:** Datasets and Prompts are clean migration targets once the videos
are removed. Experiments is representable in layout but carries a real
`DatasetContext` coupling via its embedded run button. **The unfiltered
Evaluators state is the one that genuinely does not fit** — it combines
informational (non-link) cards with a separate CTA row, neither of which the
single mutually-exclusive `action` prop can express. ProjectTableEmpty /
SessionsTableEmpty stay partial (dialog CTA inside a table frame).

---

## 2. Annotation / span / event zero-states

| Location | Current | Graphic variant | Fitness | Notes |
|---|---|---|---|---|
| `pages/trace/SpanAnnotationsEmpty.tsx` | **migrated** → `EmptyState` + `annotation` graphic + link strip | `annotation` (small) | ✅ Done | `View`/`Flex`/`Text`/`ExternalLinkButton` wrapper removed entirely; now a single `EmptyState` with a "How to Annotate" link item. |
| `pages/trace/SpanEventsList.tsx` (L63) | inline View + Text "No events" | `event` (small) | 🟡 | Variant exists, but this is a small inline list empty; full `EmptyState` may be visually heavy. Judgment call. |
| `pages/project/ProjectAnnotationConfigCard.tsx` (L346) | `<Empty message="No annotation configurations available." />` | `config`/`annotation` (small) | 🟡 | Could upgrade to `EmptyState`, but lives in a card; `Empty` may be intentional. |
| `components/trace/SpanAnnotationsEditor.tsx` (L692) | `<Empty message="No annotation configurations for this project." />` | `config`/`annotation` (small) | 🟡 | Same as above — small inline context. |
| `pages/trace/SpanFeedback.tsx` (L180) | `<TableEmpty />` | `annotation` (small) | 🔴 | Table empty; keep `TableEmpty`. |

---

## 3. Settings / admin tables (`TableEmpty` with a message)

All of these are dense table tbody empties with short text. They are
**intentionally lightweight** and the new `EmptyState` is designed for larger
zero-states. Listed together; default recommendation is to **keep `TableEmpty`**
unless a richer first-time-setup experience is wanted (in which case a `small`
graphic variant like `credential`/`config`/`tag` is available).

| Location | Message | Candidate variant | Fitness |
|---|---|---|---|
| `pages/settings/UsersTable.tsx` | `No Data` (default) | — | 🔴 |
| `pages/settings/SystemAPIKeysTable.tsx` | "No Keys" | `credential` | 🔴 (🟡 if upgraded) |
| `pages/settings/UserAPIKeysTable.tsx` | "No Keys" | `credential` | 🔴 (🟡 if upgraded) |
| `pages/profile/APIKeysTable.tsx` | "No Keys" | `credential` | 🔴 (🟡 if upgraded) |
| `pages/settings/secrets/SecretsTable.tsx` | "No Secrets" | `credential` | 🔴 (🟡 if upgraded) |
| `pages/settings/AnnotationConfigTable.tsx` | "No Annotation Configs" | `config`/`annotation` | 🔴 (🟡 if upgraded) |
| `pages/settings/CustomProvidersCard.tsx` | `<Empty>` "No custom AI providers configured yet." | `config` | 🔴 (🟡 if upgraded) |
| `pages/settings/sandboxes/SandboxConfigsCard.tsx` | "No sandbox configs" | `config` | 🔴 (🟡 if upgraded) |
| `pages/settings/datasets/DatasetLabelsTable.tsx` | `No Data` (default) | `label` | 🔴 (🟡 if upgraded) |
| `pages/settings/prompts/PromptLabelsTable.tsx` | `No Data` (default) | `label` | 🔴 (🟡 if upgraded) |
| `pages/prompt/PromptVersionTagsConfigCard.tsx` | "No Tags" | `tag` | 🔴 (🟡 if upgraded) |
| `pages/settings/ModelsTable.tsx` | early-returns `GlobalEvaluatorsEmptyState` | `evaluator` | 🔴 (inherits §1 evaluators — not representable) |

---

## 4. Dataset / experiment / playground tables

| Location | Current | Graphic variant | Fitness | Notes |
|---|---|---|---|---|
| `pages/datasets/DatasetsTable.tsx` (L516) | `<TableEmptyWrap><DatasetsEmpty /></TableEmptyWrap>` | `dataset` | ✅ | Already routes to `DatasetsEmpty` (§1). Good pattern example. |
| `pages/evaluators/EvaluatorsTable.tsx` (L509) | early return `GlobalEvaluatorsEmptyState` | `evaluator` | 🔴 | Inherits §1 evaluators — not representable (cards + buttons). |
| `pages/evaluators/DatasetEvaluatorsTable.tsx` (L555) | `TableEmptyWrap` + Flex col w/ inline buttons + **template selection cards** | `evaluator` | 🟡 | Cards → `action: cards`; filtered variant is plain text. Inline custom layout vs. standardized `EmptyState` needs reconciliation. Text: "No evaluators added to this dataset". |
| `pages/dataset/DatasetHistoryTable.tsx` (L92) | `<TableEmpty />` | — | 🔴 | Generic table empty; keep. |
| `pages/example/ExampleExperimentRunsTable.tsx` (L27) | tbody centered text "No experiments have been run for this example." | `experiment` | 🟡 | Could be `EmptyState` w/ `experiment` graphic; currently bespoke tbody text. |
| `pages/playground/PlaygroundDatasetExamplesTable.tsx` (L1391) | `<TableEmpty />` | — | 🔴 | Generic table empty; keep. |
| `pages/datasets/DatasetPreview/DatasetPreviewTable.tsx` (L53) | conditional `Empty` | — | 🔴 | Preview placeholder; keep. |

---

## 5. Project / trace / session tables & lists

| Location | Current | Graphic variant | Fitness | Notes |
|---|---|---|---|---|
| `pages/project/TracesTable.tsx` (L1081) | `<ProjectTableEmpty />` | `trace` | 🟡 | Routes to §1 ProjectTableEmpty. |
| `pages/project/SpansTable.tsx` (L1041) | `<ProjectTableEmpty />` | `trace` | 🟡 | Same. |
| `pages/project/SessionsTable.tsx` (L623) | `<SessionsTableEmpty />` | `session` | 🟡 | Routes to §1 SessionsTableEmpty. |
| `pages/projects/ProjectsPage.tsx` (L854) | `<TableEmpty />` | `project` | 🟡 | Now has a `project` graphic variant (added). Caveat: a `default` project is auto-created, so a truly empty list is rare in practice. |
| `pages/trace/SessionDetailsTracesView.tsx` (L338) | `<Empty>` "No traces in this session" | `trace` | 🟡 | Inline; `trace` variant exists. |
| `pages/trace/SessionDetailsTracesView.tsx` (L601) | `<Empty>` "Expand a trace and select a span…" | — | 🔴 | Instructional placeholder, not a zero-state. |
| `pages/dashboards/DashboardsPage.tsx` (L111) | `<Empty>` "No project selected" | — | 🔴 | Selection prompt, not a data zero-state. |

> **Resolved:** a `project` graphic variant (large, `FolderOutline`) was added,
> so `ProjectsPage` and other project-list empties now have a clean graphic.

---

## 6. Dropdown / menu / combobox empties (`MenuEmpty`)

All of these are listbox/menu empties surfaced via `renderEmptyState`. They are
**out of scope** for `EmptyState` — keep `MenuEmpty`. Listed for completeness.

| Location | Message |
|---|---|
| `components/trace/AnnotationConfigList.tsx` (L274) | "No annotation configs found." |
| `components/dataset/DatasetSelectWithSplits.tsx` (L234) | "No datasets found" |
| `components/dataset/DatasetLabelConfigButton.tsx` (L236) | "No labels found" |
| `components/dataset/DatasetLabelFilterButton.tsx` (L121) | "No labels found" |
| `components/agent/SessionListMenu.tsx` (L105) | "No sessions yet" |
| `components/project/ProjectMenu.tsx` (L210) | "No projects found" |
| `pages/playground/PromptMenu.tsx` (L299/419/476) | "No prompts found" / "No versions found" / "No tags found" |
| `pages/playground/PromptComboBox.tsx` (L60) | "No prompts found" (plain div) |
| `pages/prompt/PromptLabelConfigButton.tsx` (L262) | "No labels found" |
| `pages/project/DatasetSelectorPopoverContent.tsx` (L115) | "No datasets found" |
| `pages/project/TransferTracesButton.tsx` (L197) | "No projects found" |
| `pages/examples/AssignExamplesToSplitMenu.tsx` (L296) | "No splits found" |
| `pages/examples/ExamplesSplitsMenu.tsx` (L127) | "No splits found" |
| `pages/prompts/PromptsLabelMenu.tsx` (L110) | "No labels found" |

> **Consistency note:** `PromptComboBox.tsx` uses a plain `<div>` instead of
> `MenuEmpty` — worth aligning regardless of this migration.

---

## 7. Chart empties (`ChartEmptyStateOverlay`)

All time-series / chart empties use `ChartEmptyStateOverlay` (preserves axes).
**Out of scope** for `EmptyState` — keep the overlay. ~15 occurrences, all in
`pages/project/metrics/*` plus `components/agent/generativeUI/*` charts and
`pages/experiments/ExperimentsLineChart.tsx`. Messages are mostly "No data in
this time range" / "No data" / "No data available".

---

## 8. Inline / cell-level / bespoke (out of scope)

| Location | Current | Fitness | Notes |
|---|---|---|---|
| `components/agent/ChatEmptyState.tsx` | PXI hero + quick-action buttons | 🔴 | Bespoke chat hero; conceptually unrelated to data zero-states. |
| `components/agent/ChatEmptyShaderHero.tsx` | shader-animated hero | 🔴 | Bespoke animated hero. |
| `components/agent/generativeUI/GenerativeUIPlaceholder.tsx` | dashed loading box | 🔴 | Loading placeholder, not a zero-state. |
| `components/experiment/ExperimentRunMetadataEmpty.tsx` | null-valued metadata row | 🔴 | Placeholder for metric components, not a zero-state. |
| `components/experiment/ExperimentCompareDetails.tsx` (L419/1043) | "No runs selected" / "Did not run" | 🔴 | Cell/section status text. |
| `pages/experiment/ExperimentCompareTable.tsx` (L926/1004) | "No Run" / "Missing Repetition" | 🔴 | Table cell status text. |
| `components/dataset/EditCodeDatasetEvaluatorSlideover.tsx` (L324) | "This code evaluator has no current version yet." | 🔴 | Inline status. |
| `pages/dataset/evaluators/CodeDatasetEvaluatorVersions.tsx` (L290) | "…has no versions yet." | 🔴 | Inline status. |
| `pages/dataset/evaluators/CodeDatasetEvaluatorDetails.tsx` (L517) | "…has no current version yet." | 🔴 | Inline status. |
| `pages/playground/NoInstalledProvider.tsx` (L44) | `<Empty>` provider message | 🔴 | Config-missing prompt; `config` variant exists if upgrade desired. |
| `components/datasetSplit/DatasetSplits.tsx` (L20) | conditional render on empty labels | 🔴 | Inline. `split` variant exists if upgrade desired. |

---

## Summary & recommendations

**Counts by fitness**

- ✅ Clear migration target: `DatasetsEmpty`, `PromptsEmpty` (custom JSX today,
  but map cleanly once videos are removed), the filtered-Evaluators text branch,
  `SpanAnnotationsEmpty`, and `DatasetsTable` (already routes to `DatasetsEmpty`).
  `ExperimentsEmpty` is representable in layout but carries a `DatasetContext`
  coupling via its embedded run button (see §1 caveat).
- 🟡 Partial / needs a decision: the project/session table empties (dialog CTA +
  tbody context), `DatasetEvaluatorsTable` (inline custom layout), and several
  inline list/card empties.
- 🔴 Not representable / out of scope: **unfiltered `GlobalEvaluatorsEmptyState`
  + its entry points (`EvaluatorsTable`, `ModelsTable`)** — needs informational
  cards *and* a CTA row, which the single `action` prop can't express; plus
  dropdown `MenuEmpty` empties (~14), chart overlays (~15), inline cell/status
  text, loading placeholders, bespoke chat heroes.
- ⏸️ Intentionally untouched: the settings/admin `TableEmpty` rows (§3) and the
  generic table empties — to be figured out separately.

**Abstraction gaps surfaced by this audit**

1. ~~**`action` is mutually exclusive** — links and buttons were separate
   variants.~~ **Resolved:** `action` now has a `strip` variant that mixes
   `link` and `button` items in one row. The only remaining exclusivity is
   `strip` vs `cards` (can't show a card grid *and* a CTA strip) — which only
   the punted Evaluators state wanted, and that's being handled via a graphic
   instead.
2. **No composite/descriptive graphic** — the LLM/Code evaluator "cards" are
   non-interactive explanatory content. `cards` items are `LinkCard`s (require
   `href`, render as navigation), so modeling them as cards both invents links
   and misrepresents interactivity. The real need is a richer
   `EmptyStateGraphic` variant that carries that detail. (Punted — see §1.)
3. ~~**No `project` graphic variant**~~ **Resolved:** added a `project` variant
   (large, `FolderOutline` icon) to `EmptyStateGraphic`, unblocking project-list
   zero-states.
4. **Table-context ergonomics** — full `EmptyState` blocks rendered inside a
   table tbody need a `TableEmptyWrap` pattern; worth documenting as the
   canonical recipe (DatasetsTable already does this).
5. **CTA = open-a-dialog** — `type: "buttons"` supports `onPress`, so dialog
   triggers work, but this pattern (ProjectTableEmpty, SessionsTableEmpty)
   should be called out so it isn't reinvented.
6. **Embedded context-coupled CTAs** — `ExperimentsEmpty`'s run button reads
   `DatasetContext`; an empty-state CTA that depends on page context doesn't
   move cleanly into a presentational component.

*(The earlier "no media slot" and "no workflow-diagram" gaps are moot — that
content is being removed rather than ported.)*

**Highest-value, lowest-risk drop-ins to do first**

1. Rebuild `DatasetsEmpty` / `PromptsEmpty` on `EmptyState` once the videos are
   removed (`description` + `action: buttons` + `dataset`/`prompt` graphic). They
   are custom JSX today, so this is a real rewrite, not a prop swap.
2. ~~`SpanAnnotationsEmpty`~~ ✅ **Done** — `EmptyState` + `annotation` graphic + link.
3. ~~`ProjectTableEmpty` / `SessionsTableEmpty`~~ ✅ **Done** — `EmptyState` +
   `trace`/`session` graphic + button strip inside `TableEmptyWrap`; dialog CTA
   via controlled `ModalOverlay`.
4. Hold `ExperimentsEmpty` until the `DatasetContext`-coupled run button is
   resolved; hold the unfiltered Evaluators state pending an abstraction
   decision (cards + CTA) or a redesign.

**Deliberately leave alone**

Dropdown `MenuEmpty` empties, `ChartEmptyStateOverlay` charts, inline cell/status
text, loading placeholders, and the bespoke chat hero components.

---
name: phoenix-docs-gap-audit
description: >
  Audit documentation gaps across the Phoenix repo by analyzing recent commits to main
  (default: last 7 days). Use this skill whenever the user asks to find undocumented features,
  identify docs gaps, audit what shipped without docs, check which recent changes need
  documentation, review stale docs against current code, or mentions "documentation debt",
  "doc coverage", "undocumented APIs", or "what's missing from /docs". Also trigger on
  requests like "what from last week needs docs", "find stale READMEs", or "check docstring
  coverage for recent changes". Covers /docs (Mintlify), package READMEs, package-level
  built-in docs (Sphinx, TypeDoc), Python docstrings, TSDoc, and code comments.
metadata:
  internal: true
---

# Phoenix Docs Gap Audit

Find everything in the Phoenix repo that shipped recently without proper documentation.
The output is a **gap report** — not release notes, not new docs. The gap report tells the
user (or a follow-up skill) exactly what is missing, where it should live, and what the new
content should say, grounded in real code.

This skill is deliberately thorough. Documentation gaps are expensive: users hit undocumented
features blind, stale examples teach wrong APIs, and in-code docstrings go missing silently
because nothing fails CI. A good audit reads the actual code, cross-references every doc
surface, and produces a report a maintainer can act on without re-doing the investigation.

## Scope — what counts as "documentation"

Phoenix has several doc surfaces. A feature can be fully released and still be undocumented
on most of them. Audit **all** of these:

| Surface | Location | Tool |
|---|---|---|
| User-facing product docs | `docs/phoenix/**/*.mdx` | Mintlify |
| Server README | `README.md` | GitHub landing |
| Python package READMEs | `packages/*/README.md` | PyPI landing |
| TS package READMEs | `js/packages/*/README.md` | npm landing |
| Python built-in API docs | `packages/*/docs/source/` | Sphinx |
| TS built-in API docs | `js/packages/*/typedoc.jsonc`, TSDoc in `src/` | TypeDoc |
| Python docstrings | class/function docstrings in `src/` | inline |
| TypeScript TSDoc | `/** */` on exported symbols in `src/` | inline |
| Code comments | non-obvious logic in any `src/` | inline |
| llms.txt | `docs/phoenix/llms.txt` | machine-readable docs index |
| Onboarding snippets | `js/packages/phoenix-client/src/onboarding/` and similar | in-product |

Missing from any of these is a gap. Stale (contradicts current code) is also a gap, and is
more dangerous than missing because it teaches users the wrong thing.

## Workflow

### Phase 1: Gather commits

Default window is the last 7 days on `main`. The user may override (e.g., "since last
release", "last month", a specific tag range). Translate their phrasing into a concrete
range before running anything.

**Always audit `origin/main`, not the local `main` branch.** Local `main` is routinely
stale by dozens of commits in active repos — if you audit the stale tip you will silently
miss every feature and every breaking change that shipped after your last `git pull`. An
early iteration of this skill missed a major breaking change this way.

```bash
# Refresh the remote-tracking branch first — this does NOT touch your working tree
git fetch origin main --quiet

# Then log against origin/main with file stats
git log --since="7 days ago" origin/main --no-merges --pretty=format:"%h %s" --name-status

# If the user gave you a tag range
git log <prev-tag>..<current-tag> --no-merges --pretty=format:"%h %s" --name-status

# Sanity check: how far ahead is origin?
git rev-list --count main..origin/main
```

Save the raw list. You will refer back to it repeatedly — don't re-run git for every
commit. Note the commit you are auditing against in the report header (e.g. "audited
against `origin/main` at `<sha>`") so a reader can reproduce the finding.

### Phase 2: Triage

Commit messages lie — or at least under-report. Use them as an index, not a source of truth.
Split the list into three buckets:

- **Audit candidates** — anything that could plausibly affect a user: new APIs, new CLI
  flags, new UI, new config, new env vars, new providers, behavior changes, performance
  changes visible to users, breaking changes, deprecations. **In-product onboarding
  snippets, integration registries, and provider configs under `app/` count as
  user-facing** — they are literally the instructions users copy out of the product, so
  a new snippet without a matching `docs/phoenix/integrations/<...>.mdx` page is a real
  gap, even though the change technically lives in the frontend.
- **Skip** — dep bumps (`chore(deps):`), internal refactors with no public surface,
  test-only changes, CI/build changes, formatting, skill/workflow edits, release-please
  bookkeeping (`chore(main): release …`), **feature flags** (env vars named
  `*_DANGEROUSLY_*`, `*_EXPERIMENTAL_*`, `*_ENABLE_*` internal toggles, or otherwise
  intentionally undocumented escape hatches — these are deliberately kept out of public
  docs and should never be flagged as missing documentation).
- **Unclear** — when you cannot tell from the message and changed paths. **Default to
  reading the diff** rather than guessing. It is cheap and catches features hidden behind
  `refactor:` or `chore:` prefixes.

Group related commits that implement one logical feature across server + SDK + UI. Audit
them as one unit.

**Breadth before depth.** Enumerate every audit candidate in a flat list before you start
going deep on any of them. It is tempting to find a huge breaking change and spend the
rest of the audit documenting it, but the user is asking "what landed this week that needs
docs" — the answer is a *complete* list, not the single juiciest finding. A one-line entry
per audit candidate is fine at this stage:

```
Audit candidates (N total):
1. 28ecfe023 — ATIF trajectory upload helper (packages/phoenix-client)
2. 15e641510 — evals 3.0 legacy removal (BREAKING, ~24 docs affected)
3. ed559c46e — GraphQL: require explicit first on forward pagination (BREAKING)
4. 81d296bee — 7 new OpenAI-compatible provider onboarding snippets
5. c70eca619 — EvaluatorParams.traceId (TS client)
6. cc644897c — PXI chat tracing env vars
...
```

Only after this list exists do you expand each entry into a full gap analysis. If one
finding is so large that fully documenting all its affected files would blow your budget,
it is better to have ten entries at medium depth than one exhaustive entry and nine
missing. The reader can always come back for more detail; they cannot ask about a feature
the report never mentions.

### Phase 3: Locate the real code

For every audit candidate, open the actual changed files. Commit messages routinely omit:

- New optional parameters added to existing functions
- New exported symbols added alongside a refactor
- Config keys, env vars, and CLI flags
- Behavior changes in existing code paths
- New React components or pages
- Schema/migration changes

Read enough of each changed file to answer:

1. **What is the public surface?** Which exported symbols, endpoints, CLI commands, env
   vars, or UI entry points did this touch? Write down exact names and file paths.
2. **What is the behavior?** Not "what the commit did" — what the resulting code does now.
3. **Why would a user reach for it?** If you cannot answer this from the code, the gap
   is bigger than just missing docs: the feature itself may lack a clear use case. Flag it.
4. **When should a user NOT use it?** Constraints, alternatives, tradeoffs. These are the
   rationale bits the user specifically asked for.

Map each public surface to a **package of record**:

| Surface | Package(s) |
|---|---|
| `src/phoenix/server/api/routers/v1/` | server REST (`arize-phoenix`) |
| `src/phoenix/server/api/types/` and `mutations/` | server GraphQL |
| `packages/phoenix-client/src/phoenix/client/` | Python client |
| `packages/phoenix-evals/src/phoenix/evals/` | Python evals |
| `packages/phoenix-otel/src/phoenix/otel/` | Python otel |
| `js/packages/phoenix-client/src/` | TS client |
| `js/packages/phoenix-evals/src/` | TS evals |
| `js/packages/phoenix-mcp/src/` | TS MCP |
| `js/packages/phoenix-cli/src/` | TS CLI |
| `app/src/` | Phoenix UI |

A single feature often spans multiple packages — keep that mapping, it tells you which doc
surfaces to check.

### Phase 4: Check every doc surface

For each public surface touched, check **all** of the applicable doc locations. Do not stop
at the first hit. "It's mentioned in the README" is not the same as "it's documented in
Mintlify, the README, the docstring, and the TypeDoc output".

**Search strategy — grep first, then read targeted regions.** Thorough does not mean
exhaustive. Reading every doc file top-to-bottom wastes time and tokens. A reliable
pattern:

1. **Grep the symbol, path, or feature name across each doc surface** (Mintlify,
   READMEs, Sphinx sources, TSDoc) to locate candidate files and line numbers.
2. **Only read the files that matched** — and read a window (±30 lines) around each hit,
   not the whole file.
3. For "is it missing?" claims, a zero-result grep across the relevant tree is the
   evidence — quote the grep command and the empty result in the report.
4. Escalate to full-file reads only when the grep result is ambiguous (e.g. nearby code
   snippet in a different language, alias, partial name).

This turns "audit 20 doc files" into "grep 20 files, read the 3 that hit." It cuts tool
calls by roughly an order of magnitude and is more defensible — a grep command is a
reproducible claim, a full-file read is not.

**Adjacent staleness.** When you read an existing doc to check coverage of this week's
change, skim the rest of that doc for any other stale references to the same package or
symbol family — not just the bit the commit touched. A README that gets no commits for
six months is exactly where stale examples accumulate. If you find one, flag it as
"adjacent staleness" with a note that it predates the window; do not bury it just
because it isn't from this week's commits.

For Python changes touching `packages/<pkg>/src/...`:

1. Grep `docs/phoenix/**/*.mdx` for the symbol name, endpoint path, or config key.
2. Read `packages/<pkg>/README.md` — is the feature listed? Are examples still valid?
3. Check `packages/<pkg>/docs/source/` — if Sphinx picks up the symbol, confirm the
   autosummary or explicit reference exists.
4. Open the source file and check the docstring on the class/function. Does it describe
   parameters, return values, raises, and at least one example? Is the example using the
   current signature?

For TypeScript changes touching `js/packages/<pkg>/src/...`:

1. Grep `docs/phoenix/**/*.mdx` for the symbol or feature name.
2. Read `js/packages/<pkg>/README.md` — listed? examples current?
3. Check TSDoc (`/** ... */`) on exported symbols. TypeDoc renders these verbatim — if
   they're missing, so is the TypeDoc page.
4. If the package exposes onboarding snippets (e.g. `phoenix-client` onboarding), check
   whether the snippet still uses current signatures.

For server changes touching `src/phoenix/server/...`:

1. REST endpoints: check `docs/phoenix/sdk-api-reference/` and the OpenAPI spec at
   `schemas/openapi.json`. Check corresponding Python/TS client wrappers.
2. GraphQL: the schema is self-documenting, but user-facing features built on it belong in
   `docs/phoenix/`. Check whether a product doc exists.
3. Env vars / config: grep `docs/phoenix/environments.mdx`, `self-hosting/`, and
   `production-guide.mdx`. New env vars with no mention in any of those are gaps —
   **except feature flags** (e.g. `PHOENIX_CLI_DANGEROUSLY_ENABLE_DELETES`,
   experimental toggles, or any env var the code treats as an internal escape hatch).
   These are intentionally omitted from public docs; do not flag them as gaps, and if
   you find them *already documented*, flag that as a gap in the opposite direction
   (feature flag leaked into public docs).
4. Migrations/schema changes: check `docs/phoenix/self-hosting/` and `MIGRATION.md`.

For UI changes touching `app/src/`:

1. Is there a `docs/phoenix/` page for the feature? User-facing UI should have one.
2. Does the existing page still match current screenshots and flow?

**Code comments** are a softer target — only flag as gaps when the changed code is
non-obvious (complex algorithms, subtle invariants, workarounds) and carries no explanatory
comment. A well-named function does not need a comment; a 40-line regex does.

### Phase 5: Classify every gap

Every gap gets one of these classifications. The labels matter because they drive priority
and the shape of the fix.

- **Missing** — no doc exists for a shipped feature on a surface where it should exist.
- **Stale** — doc exists but contradicts current code (wrong signature, removed param,
  renamed function, outdated example output).
- **Incomplete** — doc exists but omits a material aspect the user needs (e.g. documents
  the function but not the new optional parameter, documents the happy path but not error
  modes, no example).
- **Missing rationale** — doc describes *what* the feature does but not *why* a user would
  choose it or *when* they should prefer an alternative. This is a gap in its own right
  for anything non-trivial.

Also assign a severity:

- **High** — public API, breaking change, new primary feature, anything a first-time user
  will hit. Stale examples are always high.
- **Medium** — optional parameters, secondary features, minor behavior changes.
- **Low** — internal-facing helpers that happen to be exported, edge-case flags.

## Grounding rules — do not skip

Every claim in the gap report must be verifiable against the current tree. This is the
single most important thing this skill enforces.

- **Cite file paths and line numbers** for the code and for any existing doc you are calling
  missing, stale, or incomplete. `src/phoenix/server/api/routers/v1/spans.py:142` is useful;
  "the spans endpoint" is not.
- **Quote the signature** you read. Do not paraphrase. If you say a function takes
  `trace_id: str`, it must be because you read `def foo(trace_id: str)` in the source.
- **Draft examples from real code.** Every code snippet you propose must use import paths,
  class names, and parameter names that exist in the current tree. If you can't verify it,
  don't include it.
- **No hallucinated APIs.** If you're unsure whether a symbol is exported, check the
  package's `index.ts` / `__init__.py`.
- **Stale checks are textual.** Read the existing doc's snippet, then read the current
  source. If they don't match, it's stale — say exactly what changed.
- **Rationale must come from the code or adjacent discussion**, not from your priors.
  If the *why* isn't evident from reading the PR, the tests, and the surrounding code,
  say so and flag it as something the author needs to supply. Do not invent motivation.

When in doubt, read more code. The cost of an extra file read is tiny compared to the cost
of shipping a gap report full of invented APIs.

## Report format

Produce a single markdown report. The user will consume it directly or hand it to another
skill to actually write the docs.

```markdown
# Phoenix Docs Gap Audit — <date range>

## Summary

- N commits analyzed, M user-facing, K gaps found
- High-severity gaps: <count>
- Packages touched: <list>

## Gaps

### <Feature title>

**Source:** <commit SHAs and PR links>
**Package(s):** <e.g., arize-phoenix-client (Python), @arizeai/phoenix-client (TS)>
**Public surface:**
- `packages/phoenix-client/src/phoenix/client/foo.py:42` — `def new_thing(trace_id: str, ...)`
- `js/packages/phoenix-client/src/foo.ts:87` — `export function newThing(...)`

**What it does:** <1-2 sentences grounded in the code, not the commit message>

**Why a user would use it:** <rationale — concrete use case, drawn from the code or tests>

**When NOT to use it / alternatives:** <constraints, tradeoffs, or "N/A — no alternative">

**Gaps:**
- [High | Missing] `docs/phoenix/tracing/` — no page mentions `new_thing`. Should live at
  `docs/phoenix/tracing/how-to-tracing/<slug>.mdx`.
- [High | Stale] `packages/phoenix-client/README.md:120` — example shows old signature
  `new_thing(span_id)`; current is `new_thing(trace_id)`.
- [Medium | Incomplete] `packages/phoenix-client/src/phoenix/client/foo.py:42` — docstring
  describes function but omits `return` type and has no example.
- [Medium | Missing rationale] None of the existing docs explain *why* a user would prefer
  `new_thing` over `old_thing`.

**Proposed content** (rooted in current code):

    ```python
    from phoenix.client import Client
    client = Client()
    # real, verified example using the current signature
    client.new_thing(trace_id="...")
    ```

    Use `new_thing` when you need X. Prefer it over `old_thing` when Y, because Z.

### <Next feature>
...

## Commits skipped

Brief list of commits intentionally excluded (deps, refactors, etc.) so the reader can
confirm nothing was missed.
```

Keep the report tight. One gap per feature, not one per doc surface — group the
surface-level gaps as bullets under a single feature entry. A reader should be able to scan
it and know exactly what to fix next.

## Decision quick reference

| Question | Answer |
|---|---|
| Commit message says `refactor:` — skip? | Read the diff. Refactors often add exports. |
| Feature exists only in an example file? | Not a public API — skip unless `examples/` is documented as a supported surface. |
| New env var, no doc anywhere? | High-severity Missing in `docs/phoenix/environments.mdx` — **unless** it is a feature flag (e.g. `*_DANGEROUSLY_*`, experimental toggle). Feature flags are deliberately undocumented; skip them. |
| Feature flag appears in public docs? | Flag as a gap in the opposite direction — feature flags should be removed from user-facing docs. |
| Stale doc with old param name? | High-severity Stale. Stale examples mislead users. |
| Python docstring missing on exported function? | Medium Incomplete (package-level docs). |
| TS `/** */` missing on exported function? | Medium Incomplete (TypeDoc will render nothing). |
| Feature has no apparent use case from reading the code? | Flag as "rationale unclear — needs author input". Do not invent one. |
| Unsure if something is user-facing? | Check the package's `index.ts` / `__init__.py` exports. If it's exported, assume yes. |

## Pre-submit checklist

Before handing the report to the user, walk through this:

- [ ] Every cited file path and line number was verified against the current tree
- [ ] Every proposed code snippet uses symbols that actually exist in the source
- [ ] Every "stale" claim quotes both the doc and the current code
- [ ] Every "missing rationale" entry either proposes rationale grounded in the code, or
      explicitly flags the rationale as needing author input
- [ ] The skipped-commits list is present so the reader can audit your triage
- [ ] Report is scannable: headings, severity labels, one entry per feature
- [ ] No invented APIs, no invented imports, no placeholder values disguised as real code

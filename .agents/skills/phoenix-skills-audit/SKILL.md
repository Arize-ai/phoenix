---
name: phoenix-skills-audit
description: >
  Audit recent changes to Phoenix's user-facing surfaces (Python clients, TypeScript
  clients, CLI, REST/GraphQL APIs) and patch the three external-facing agent skills —
  `phoenix-tracing`, `phoenix-cli`, and `phoenix-evals` — so they stay in sync with what
  actually shipped. Use this skill whenever a user asks to update those skills, sync the
  skills with recent changes, audit skill drift, check what client/CLI/API changes need
  to land in the skills, or mentions "skill freshness", "skill drift", "stale skills",
  or "are the skills up to date". Also trigger when shipping a notable client/CLI/API
  change and the user asks "do the skills need updating?". Default window is the last
  7 days on `origin/main`; user may override.
metadata:
  internal: true
---

# Phoenix Skills Audit

Keep the three external-facing skills — `phoenix-tracing`, `phoenix-cli`, `phoenix-evals` —
truthful about what the Phoenix Python clients, TypeScript clients, CLI, and APIs actually
do today. The output is **patches applied to the skill files**, not a report. The skill
reads recent commits, identifies what changed in user-facing surfaces, and updates the
relevant `SKILL.md` and `references/*.md` files in place.

This is a sibling skill to `phoenix-docs-gap-audit`. The docs-gap-audit produces a *report*
about gaps in `docs/phoenix/`; this skill produces *edits* to `.agents/skills/`. Skills are
loaded into agent context every time the user asks a question that triggers them, so a
stale skill teaches every future agent the wrong API. That makes drift here strictly
worse than drift in human-facing docs — humans can sanity-check; agents can't.

## Targets — the three skills this audit owns

```
.agents/skills/phoenix-tracing/SKILL.md
.agents/skills/phoenix-tracing/references/*.md
.agents/skills/phoenix-cli/SKILL.md
.agents/skills/phoenix-evals/SKILL.md
.agents/skills/phoenix-evals/references/*.md
```

Do not touch any other skill directory. If a change clearly belongs in a skill outside
these three (e.g. `phoenix-server`, `phoenix-frontend`), note it in the run summary and
skip — those skills are internal and have their own owners.

## Source mapping — which code feeds which skill

| Source area | Skill |
|---|---|
| `packages/phoenix-otel/` (Python) | `phoenix-tracing` |
| `js/packages/phoenix-otel/` (TS) | `phoenix-tracing` |
| OpenInference semantic conventions, span attributes, instrumentation patterns | `phoenix-tracing` |
| `js/packages/phoenix-cli/` (commands, flags, output JSON shape) | `phoenix-cli` |
| `packages/phoenix-evals/` (Python) | `phoenix-evals` |
| `js/packages/phoenix-evals/` (TS) | `phoenix-evals` |
| New evaluators, eval templates, experiment APIs | `phoenix-evals` |
| `packages/phoenix-client/` (Python) | depends on what's exposed — see below |
| `js/packages/phoenix-client/` (TS) | depends on what's exposed — see below |
| Server REST/GraphQL (`src/phoenix/server/api/`) | depends on what's exposed — see below |

The generic clients and the server APIs are cross-cutting. Map them by the *feature* they
expose, not the file they live in:

- A client method that creates spans / sets attributes → `phoenix-tracing`
- A client method that runs evaluations or experiments → `phoenix-evals`
- A new REST/GraphQL endpoint that the CLI wraps (or should wrap) → `phoenix-cli`
- A new attribute on a span returned by the API → `phoenix-cli` (JSON shape doc) and
  potentially `phoenix-tracing` (if it's an OpenInference attribute)

A single feature can — and often does — span multiple skills. That's fine. Make all the
edits; cross-reference between skills only when the user genuinely needs to read both.

## Workflow

### Phase 1: Gather commits

Default window is the last 7 days on `origin/main`. The user may override. Translate
their phrasing into a concrete range before running anything.

**Always audit `origin/main`, not the local `main` branch.** Local `main` is routinely
stale by dozens of commits — auditing the stale tip silently misses everything that
shipped after the last `git pull`.

```bash
git fetch origin main --quiet

# Default 7-day window
git log --since="7 days ago" origin/main --no-merges --pretty=format:"%h %s" --name-status

# Tag range if the user specified one
git log <prev-tag>..<current-tag> --no-merges --pretty=format:"%h %s" --name-status

# Sanity check
git rev-list --count main..origin/main
```

Save the raw list. Note the audited SHA in the run summary so a reader can reproduce.

### Phase 2: Triage to user-facing surfaces

Commit messages lie or under-report. Use them as an index, not a source of truth. Split
the list into three buckets:

- **Audit candidates** — anything that changes what the Python clients, TypeScript
  clients, CLI, REST/GraphQL APIs, or instrumentation packages do from the user's
  perspective. New methods, new flags, new commands, new attributes, new env vars,
  renamed parameters, behavior changes, deprecations, breaking changes.
- **Skip** — internal refactors with no public surface, dep bumps, test-only changes,
  CI/build changes, formatting, frontend-only changes (those belong to other skills),
  release-please bookkeeping (`chore(main): release …`), and **feature flags** (env
  vars named `*_DANGEROUSLY_*`, `*_EXPERIMENTAL_*`, intentionally undocumented escape
  hatches). Feature flags are deliberately kept out of public skills.
- **Unclear** — when you cannot tell from the message and changed paths. Default to
  reading the diff. Cheap, and catches features hidden behind `refactor:` prefixes.

Group related commits that implement one logical feature across server + SDK + CLI. Audit
them as one unit.

**Breadth before depth.** Enumerate every audit candidate in a flat list before going
deep on any one. The goal is a *complete* sweep, not the single juiciest finding.

For each candidate, in the same one-liner, **tag the cross-cutting concept(s) it most
likely affects**, even if the commit's file path doesn't say so. The four concepts:

- **tracing** — spans, attributes, instrumentation, OpenInference, otel
- **evals** — evaluators, experiments, datasets, prompts
- **cli** — CLI commands, flags, JSON output shape
- **none** — internal/refactor/dep/frontend-only/feature-flag

Once a candidate is tagged with `tracing` / `evals` / `cli`, you have committed to a
hypothesis: there is potentially a skill edit here. The only way to legitimately drop
the candidate later is to read the diff and find that the change is internal, or
already documented, or genuinely user-irrelevant. "I don't see the relevant package in
the path" is not a sufficient reason.

Only after this tagged list exists do you expand each entry into edits.

### Phase 3: Locate the real code

For every candidate, open the actual changed files. Commit messages routinely omit:

- New optional parameters added to existing functions
- New exported symbols added alongside a refactor
- New CLI flags, JSON output fields, error codes
- Behavior changes in existing code paths
- Schema changes that change the shape returned by the CLI or REST API

Read enough of each file to answer:

1. **What is the public surface?** Exact symbol names, paths, command names, attribute
   keys. Write them down.
2. **What is the behavior?** What the resulting code does, not what the commit said.
3. **Why would a user reach for it?** If the code doesn't make this clear, flag it —
   the skill needs a usage rationale, not just a signature.
4. **What does the example look like?** Draft a real, runnable example using the
   current signature. Verify imports.

**Do not trust a commit's file path to dictate the skill it belongs to.** An evaluator
change often lives in `packages/phoenix-client/`, not `packages/phoenix-evals/`. A span
attribute lands in the server or a client, not in `phoenix-otel`. For every audit
candidate, scan **all** client/SDK directories — Python and TypeScript, generic client
and topical packages — and map each new symbol to the skill that documents the feature
it exposes, per the source-mapping table. The easiest way to miss a finding is to stop
looking after the first package you find.

**Pair each Python change with its TypeScript mirror (and vice versa).** Nearly every
user-facing feature ships on both runtimes, usually in the same PR. When you locate a
Python change, grep the TS package equivalent for the same symbol family (same commit
SHA, or within a few commits). If the mirror is there, edit the `-typescript.md`
reference too. If it's genuinely Python-only or TS-only, say so in the run summary —
that itself is a finding worth noting.

### Phase 4: Map each finding to skill edits

For each finding, decide:

1. **Which target skill(s)** does it belong to? (Use the source mapping table above.)
2. **Which file(s) inside that skill?**
   - New cross-cutting concept → new `references/<slug>.md` file, plus a row in
     `SKILL.md`'s reference table and a link in the navigation section.
   - Update to an existing concept → edit the existing reference file.
   - Top-level navigation, workflow, or invocation change → edit `SKILL.md` directly.
3. **What is the edit?** A new section, a code-snippet replacement, a new row in a
   table, a renamed parameter, a deleted reference to a removed feature.

Reference file naming follows the existing patterns inside each skill — match what's
already there:

- `phoenix-tracing/references/`: prefix by category (`setup-*`, `instrumentation-*`,
  `span-*`, `production-*`, `attributes-*`) and suffix by language (`-python.md`,
  `-typescript.md`).
- `phoenix-evals/references/`: prefix by category (`evaluators-*`, `experiments-*`,
  `validation-*`, `production-*`, `fundamentals-*`) and suffix by language.
- `phoenix-cli`: single-file skill — most edits land directly in `SKILL.md`. Only add
  a `references/` directory if a topic has grown too large for inline (>40 lines).

When deleting a removed feature, remove every reference (cross-links in `SKILL.md`,
table rows, workflow steps), not just the most obvious one.

### Phase 5: Apply the patches

Edit the skill files in place. Use `Edit` for surgical changes; use `Write` for new
reference files. After each edit:

- **Verify the example runs against the current code.** Every code snippet must use
  imports, classnames, and parameter names that exist in the tree as of the audited
  SHA. If you can't verify, don't include the snippet.
- **Verify cross-links resolve.** If you add a new `references/foo.md`, also add it to
  the navigation tables in `SKILL.md`. Broken links in a skill make the agent waste
  tool calls trying to read missing files.
- **Quote signatures verbatim.** A docstring or method header is the source of truth.
  Don't paraphrase parameters.

For breaking changes (renames, removals), do the destructive edit and the additive edit
in the same pass. Removing the old reference without adding the new one leaves agents
flailing; adding the new one without removing the old one leaves them confused about
which is current.

### Phase 6: Write the run summary

After patches are applied, produce a single markdown summary on stdout. The GitHub
Actions wrapper reads this to populate the PR body. Do **not** write it to a file —
let it surface as the agent's final message.

```markdown
# Phoenix Skills Audit — <date range>

**Audited against:** `origin/main` at `<sha>`
**Commits analyzed:** N (M user-facing, K skipped)

## Edits applied

### phoenix-tracing
- `references/instrumentation-auto-python.md` — added section for new auto-instrumentor
  shipped in <commit>; example uses `<verified import path>`.
- `SKILL.md` — added row for the new reference file in the Quick Reference table.

### phoenix-cli
- `SKILL.md` — added `px experiment compare` subcommand documentation
  (commit `<sha>`); JSON shape grounded in `js/packages/phoenix-cli/src/commands/...`.
- `SKILL.md` — updated `--format` description; default changed in commit `<sha>`.

### phoenix-evals
- `references/evaluators-pre-built.md` — added entry for `<NewEvaluator>` from
  commit `<sha>`; example uses signature `<verified>`.

## Skipped commits

Brief list of commits intentionally excluded (deps, refactors, feature flags, frontend
changes that don't affect the three skills) so a reviewer can confirm nothing was
missed.

## Out-of-scope findings

Optional. If you saw a user-facing change that belongs in a different skill (e.g.
`phoenix-server`, `phoenix-frontend`), note it here so the maintainer knows — but do
not edit those skills.
```

## Grounding rules — do not skip

Every edit must be verifiable against the tree at the audited SHA. Skills are read by
agents that will not double-check; if you teach them an API that doesn't exist, every
downstream task that follows the skill is wrong.

- **Cite file paths and line numbers** in the run summary for the source code that
  motivated each edit.
- **Quote signatures verbatim.** If the code says `def foo(trace_id: str, *, kind: str = "LLM")`,
  the skill must say that — not `foo(trace_id, kind)`.
- **Examples are real.** Every snippet must use import paths, class names, and parameter
  names that exist in the current tree. Run a mental check: would `python -c "from X import Y"`
  succeed against this repo right now?
- **No invented APIs.** If unsure whether a symbol is exported, check the package's
  `index.ts` / `__init__.py` first.
- **Stale checks are textual.** Read the existing skill's snippet, then read the current
  source. If they diverge, replace the snippet exactly. Don't half-update it.
- **Rationale comes from the code or the PR.** If the *why* isn't evident, say so in the
  run summary as something the author needs to supply, and skip the rationale rather
  than inventing one.

When in doubt, read more code. The cost of an extra file read is tiny compared to the
cost of poisoning every future agent with a hallucinated API.

## Decision quick reference

| Question | Answer |
|---|---|
| Commit message says `refactor:` — skip? | Read the diff. Refactors often add exports. |
| Frontend-only change (`app/src/`) — does it affect any of the three skills? | Almost never. Skip and note in "out-of-scope findings". |
| New env var — feature flag? | Skip. Feature flags (`*_DANGEROUSLY_*`, `*_EXPERIMENTAL_*`) stay out of public skills. |
| New env var that controls a public surface? | Update the relevant skill's setup or environment section. |
| Server-only change (`src/phoenix/server/`) — relevant to the three skills? | Only if it changes what a client/CLI sees. A new GraphQL field consumed by the CLI is in scope; an internal server refactor is not. |
| Removed/renamed public symbol? | Edit the skill: remove the old reference, add the new one in the same pass. |
| New evaluator class? | Add to `phoenix-evals/references/evaluators-pre-built.md` (or create a topic-specific reference if the patterns are new). |
| New CLI subcommand? | Add to the relevant section of `phoenix-cli/SKILL.md`. Document the JSON shape if the command emits structured output. |
| New OpenInference attribute? | Add to `phoenix-tracing/references/attributes-*.md` and the relevant `span-*.md`. |
| Breaking change to an existing skill example? | High priority. Update the example *and* search the rest of the skill for adjacent uses of the old signature. |
| Feature has no apparent use case from reading the code? | Add the API entry but flag in the run summary that rationale is missing — don't invent motivation. |
| Python-only change — is there a TS mirror? | Check. Most features ship on both runtimes in the same PR; a Python-only change is the exception, not the rule. If confirmed Python-only, call it out in the run summary so someone can chase the TS side. |
| `SKILL.md` links to a `references/foo.md` that doesn't exist? | Remove the link. Broken cross-links teach nothing and waste tool calls. Don't add a "TODO" flag — just delete. |
| Python change lives in `packages/phoenix-client/` but conceptually belongs to tracing/evals? | Map it to the conceptual skill. File path is an implementation detail; the skill that documents the feature owns it. |

## Pre-submit checklist

Before exiting, walk through:

- [ ] Every edited code snippet uses symbols that exist in the tree at the audited SHA.
- [ ] Every new reference file is linked from its skill's `SKILL.md` (no orphan files).
- [ ] Every removed reference is also unlinked from `SKILL.md` (no broken cross-links).
- [ ] The run summary lists every edit, grouped by target skill, with the source commit SHA.
- [ ] Skipped commits are listed so a reviewer can confirm triage.
- [ ] **Every Phase-2 audit candidate tagged `tracing` / `evals` / `cli`** is either
      reflected in the edits, or the run summary states a concrete reason it was
      dropped (e.g., "PR #X already self-patched the skill", with the SHA). A tagged
      candidate that just disappears is a triage bug — go back and reconcile.
- [ ] No edits made outside `.agents/skills/phoenix-tracing/`, `.agents/skills/phoenix-cli/`,
      or `.agents/skills/phoenix-evals/`.
- [ ] No invented APIs, no invented imports, no placeholder values disguised as real code.

## Operating modes

This skill runs in two contexts:

- **Manual** — a developer asks "audit the skills" or "are the skills up to date".
  Apply the workflow above end-to-end, edit files, print the run summary, and let the
  user review the diff before committing.

- **CI (GitHub Actions)** — `.github/workflows/claude-skills-audit.yml` runs this skill
  weekly. The action commits the patches to a branch and opens a PR using the run
  summary as the PR body. The skill itself does not commit or push — that's the
  workflow's job. Just edit the files and emit the summary.

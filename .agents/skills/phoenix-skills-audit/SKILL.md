---
name: phoenix-skills-audit
description: >
  Audit recent changes to Phoenix's user-facing surfaces (Python clients, TypeScript
  clients, CLI, REST/GraphQL APIs) and patch the three external-facing agent skills,
  `phoenix-tracing`, `phoenix-cli`, and `phoenix-evals`, for what the CI example checks
  can't catch: features the skills don't mention, behavior changes behind an unchanged
  signature, stale facts in prose and tables, Python/TypeScript gaps, and outdated advice.
  Use this skill whenever a user asks to update those skills, sync the skills with recent
  changes, audit skill drift, or asks "are the skills up to date" or "do the skills need
  updating?". Default window is the last 7 days on `origin/main`; user may override.
metadata:
  internal: true
---

# Phoenix Skills Audit

Keep `phoenix-tracing`, `phoenix-cli`, and `phoenix-evals` truthful about what Phoenix
ships today. The output is patches to the skill files plus a run summary, or a summary
that says nothing needed to change.

Agents load these skills every time a question triggers them and don't double-check what
they read, so a stale skill teaches every future agent the wrong thing.

## What CI already checks

Every PR that touches `skills/` runs deterministic checks. Don't spend the audit on what
they catch:

| Check | Make target |
|---|---|
| Python examples type-check against the client packages | `check-skill-python-examples` |
| TypeScript examples type-check against the client packages | `check-skill-typescript-examples` |
| `px` commands and flags exist in the CLI | `check-skill-px-commands` |
| GraphQL examples validate against the schema | `check-skill-graphql-examples` |
| Filter conditions compile | `check-skill-filter-examples` |
| Links resolve, descriptions fit their budget | `skills` (lint in `scripts/sync_skills.py`) |

These checks only test what a skill already says. A renamed function, a removed flag, or
a broken link in an existing example fails CI on its own, including on the PR this audit
opens. If you edit an example, keep it consistent with the code, but you don't need to
trace every import by hand.

The checks exempt some code, and the audit still covers it by reading:

- **`**kwargs` arguments.** The Python check can't verify keyword arguments to functions
  that take `**kwargs`, such as `register`, `LLM`, and `ClassificationEvaluator`. Check
  those keywords against the source.
- **Skipped blocks.** Blocks tagged `no-check` and lines inside `# WRONG` or `# BAD`
  regions aren't checked.
- **Known-broken examples.** `KNOWN_BROKEN` in `scripts/ci/test_skill_*.py` lists
  examples that are stale but expected to fail. Each is a strict xfail, so fixing one
  fails CI until its entry is removed, and the CI workflow stages only skill files.
  Don't fix these in a CI run. List them under "Known-broken examples" in the run
  summary instead. In a manual run, fix the example and delete its entry in the same
  change.

## What the audit looks for

These five gaps pass every check above. They're the reason this audit exists.

1. **Missing features.** A new evaluator, CLI command, flag, client method, or
   instrumentation option shipped, and no skill mentions it.
2. **Behavior changes behind an unchanged signature.** A default changed, a parameter
   now means something different, or an output changed shape while the examples still
   type-check.
3. **Facts in prose and tables.** `px` JSON output field names, OpenInference attribute
   keys, environment variable names, version requirements, and evaluator tables
   (inputs, labels, direction). The checks read only code blocks.
4. **Python and TypeScript parity.** A feature shipped on both runtimes, and the skill
   covers only one. Or it shipped on one runtime, and the skill implies both.
5. **Outdated advice.** A skill still recommends a pattern after a better API replaced
   it, or keeps a workaround for a bug that's fixed. The old code still type-checks, so
   only reading catches it.

## Targets

```
skills/phoenix-tracing/SKILL.md
skills/phoenix-tracing/references/*.md
skills/phoenix-cli/SKILL.md
skills/phoenix-evals/SKILL.md
skills/phoenix-evals/references/*.md
```

Don't touch any other skill directory. If a change belongs in another skill (for example,
`phoenix-server` or `phoenix-frontend`), note it in the run summary and skip it. Copies
outside `skills/` are rebuilt by `make skills`.

## Source mapping

| Source area | Skill |
|---|---|
| `packages/phoenix-otel/`, `js/packages/phoenix-otel/` | `phoenix-tracing` |
| OpenInference semantic conventions, span attributes, instrumentation | `phoenix-tracing` |
| `js/packages/phoenix-cli/` (commands, flags, JSON output) | `phoenix-cli` |
| `packages/phoenix-evals/`, `js/packages/phoenix-evals/` | `phoenix-evals` |
| Evaluators, eval templates, experiment APIs | `phoenix-evals` |
| `packages/phoenix-client/`, `js/packages/phoenix-client/`, `src/phoenix/server/api/` | By feature, below |

Map the generic clients and server APIs by the feature they expose, not the file they
live in:

- A method that creates spans or sets attributes belongs to `phoenix-tracing`.
- A method that runs evaluations or experiments belongs to `phoenix-evals`.
- A REST or GraphQL endpoint that the CLI wraps, or a field the CLI returns, belongs to
  `phoenix-cli`.

One feature can touch several skills. Make all the edits.

## Workflow

### 1. Gather commits

Audit `origin/main`, not local `main`, which is often stale.

```bash
git fetch origin main --quiet
git log --since="7 days ago" origin/main --no-merges --pretty=format:"%h %s" --name-status
```

If the user names a tag range, use `git log <prev-tag>..<tag>` instead. Record the
audited SHA for the run summary.

### 2. Triage

Commit messages under-report. Use them as an index, and read the diff when the message
and paths don't settle it. Group commits that implement one feature across server, SDK,
and CLI.

Skip internal refactors with no public surface, dependency bumps, test and CI changes,
frontend-only changes, release bookkeeping (`chore(main): release …`), and feature flags
(`*_DANGEROUSLY_*`, `*_EXPERIMENTAL_*`). Feature flags stay out of public skills.

List every candidate before going deep on any one. Tag each with the skill it affects
(`tracing`, `evals`, `cli`) and the gap it's likely to cause (1 to 5 above). A tagged
candidate is dropped only after reading the diff shows it's internal, already covered,
or irrelevant to users.

### 3. Read the code

For each candidate, open the changed files and answer:

- What's the public surface: exact names, commands, attribute keys, output fields?
- What does it do now? Read the code, not the commit message.
- Why would a user reach for it? If the code and PR don't say, flag it in the summary
  instead of inventing a reason.
- Does the other runtime have a mirror? Check the matching Python or TypeScript package
  for the same feature, usually in the same PR.

Then search the three skills for every place that mentions the feature, in prose and
tables as well as code. Gaps 2, 3, and 5 hide in places a symbol search misses, so also
search for the concept ("default", the old parameter's meaning, the replaced pattern).

### 4. Patch

- An update to an existing concept goes in the existing reference file.
- A new concept gets a new `references/<slug>.md`, plus a row in `SKILL.md`'s reference
  table. Match the file naming already in that skill (`setup-*`, `span-*`,
  `evaluators-*`, `experiments-*`, with a `-python` or `-typescript` suffix).
  `phoenix-cli` is one file; add `references/` only for a topic over about 40 lines.
- For a rename or removal, remove the old text and add the new in the same pass.

### 5. Write the run summary

Print one markdown summary as your final message. In CI, the workflow prompt names a file to write it to instead, and uses it as the PR body.

```markdown
# Phoenix Skills Audit: <date range>

Audited `origin/main` at `<sha>`. Commits analyzed: N (M user-facing, K skipped).

## Edits

### phoenix-cli
- `SKILL.md`: documented `px experiment compare` (gap 1, `<sha>`); JSON fields from
  `js/packages/phoenix-cli/src/commands/...`.

## Known-broken examples

`KNOWN_BROKEN` entries that a change this week affects, and the fix each needs.

## Dropped candidates

Each tagged candidate with no edit, and why (for example, "PR #X updated the skill").

## Skipped commits

Short list, so a reviewer can confirm triage.

## Out of scope

User-facing changes that belong in other skills.
```

If nothing needs to change, still write the summary, and make its first line exactly
`NO_CHANGES`.

## Writing style

Skills are read by agents and maintained by people. Write like the existing docs:

- **Current state only.** No "previously", "no longer", or "now". When something is
  renamed or removed, rewrite the text as if the old behavior never existed. State a
  version-dependent fact as a requirement ("requires Phoenix server >= 20.4.0").
- **Bold sparingly.** Reserve it for bullet lead-ins.
- **Catalogs stay catalogs.** `phoenix-evals/references/evaluators-pre-built.md` gets a
  table row per evaluator (name, inputs, labels, direction), never a section per item.
  Prose there is only for choosing between items and short gotchas.
- **One example per pattern.** State a naming convention once instead of showing a
  snippet for every entry.
- **Explain scenarios, not predicates.** When behavior branches, lead each case with the
  real situation, then the field-level test for it.

## Operating modes

- **Manual.** A developer asks to audit the skills. Run the workflow, edit files, print
  the summary, and let them review the diff.
- **CI.** `.github/workflows/claude-skills-audit.yml` runs this weekly. The workflow
  commits the edits and opens a PR with the summary as its body, and opens nothing when
  there are no edits. Don't commit or push.

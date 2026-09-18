# @arizeai/oxlint-plugin-jev

> **Status: experiment.** Private workspace package. Nothing here is published or
> wired into the repo's `pnpm lint` yet.

An [oxlint JS plugin](https://oxc.rs/docs/guide/usage/linter/js-plugins.html) that
asks [TypeSafe's jev](https://docs.typesafe.ai/introduction) whether a file's use of
Phoenix, OpenInference and OpenTelemetry follows the guidance Phoenix already ships
in its agent skills (`.agents/skills/phoenix-tracing`). It is a linter for the
class of mistakes a regex or a type checker cannot see, but a person reading the
docs would: flushing spans only on the happy path, declaring a `CHAIN` span around
what is really a retriever, wrapping `withSpan` in a session helper the docs tell you
not to write.

## How it works

```
file ──► ImportDeclaration scan ──► imports none of the target packages? ──► done (free)
              │
              ▼
        AST fact extraction (deterministic)
              │  register() calls + literal options, span wrappers + declared kind,
              │  shutdown()/forceFlush() calls, process.on() handlers, exports,
              │  instrumented LLM libraries, manuallyInstrument() calls
              ▼
        per-check precheck ──► clear-cut? report or skip without jev
              │
              ▼
        ONE jev request per file
          state     = { file, code, facts, guidance: <sections from bundled skills> }
          questions = every applicable check's Noul/Choice questions (run in parallel)
              │  sha256(request) → node_modules/.cache/oxlint-jev  (re-lints are free)
              │  sync bridge: worker thread + Atomics.wait (rules must be synchronous)
              ▼
        decide() maps probabilities → context.report()  with a citation to the skill file
```

Three design rules, all borrowed from TypeSafe's own
[how-to-build guidance](https://docs.typesafe.ai/concepts/how-to-build-with-system-one):

1. **Code decides everything it can.** The import gate, the fact extraction and the
   prechecks are plain AST work. jev is only asked the judgement calls that remain.
2. **The policy goes in `state`, not in the model's memory.** Each check names the
   skill files it enforces. Those files are copied whole into the request, so the model
   judges against what Phoenix ships today, and every finding cites them. Nothing inside
   the markdown is parsed by code; the only coupling is the file path, verified at build.
3. **Questions are atomic and reviewable.** All questions and thresholds live in
   [`src/checks.ts`](src/checks.ts). That is the file to review when a check misfires.

### The checks

| Check                          | Trigger                                                                    | Deterministic part                                                                                       | What jev is asked                                                                                                                                                                                                  |
| ------------------------------ | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `flush-before-exit`            | `register()` from `@arizeai/phoenix-otel`                                  | Skip if `batch: false` or the provider is exported. Report outright if nothing can ever flush.           | Noul: is the provider flushed on **every** exit path (success, error, signals)?                                                                                                                                    |
| `span-kind-matches-body`       | `withSpan` / `trace*` with a known kind                                    | Extract declared kind and the wrapped statement.                                                         | Choice over the nine OpenInference kinds (criteria = first paragraph of each `span-*.md`); report if it disagrees with the declared kind at confidence ≥ `minConfidence`.                                          |
| `no-session-wrapper`           | `withSpan` in a file mentioning `session.id`                               | —                                                                                                        | Noul: is there a helper whose job is to inject `session.id` for callers?                                                                                                                                           |
| `no-sensitive-span-attributes` | `withSpan` / `trace*` with `attributes`, `processInput` or `processOutput` | Hardcoded literal values are decided in code and never sent (a long one is reported as a pasted secret). | One Noul **per attribute**: does this value denote personal, health, financial or secret data? Plus one Noul: does `processInput`/`processOutput` serialize a whole record? Suppressed when masking is configured. |
| `esm-manual-instrumentation`   | `register()` plus an import of an instrumentable LLM library               | Skip if no such library.                                                                                 | Choice: `explicitly_instrumented` / `native_telemetry` / `relies_on_import_order`.                                                                                                                                 |

### Bundled guidance

`pnpm build` runs [`scripts/copy-skills.mjs`](scripts/copy-skills.mjs), which copies
the cited skill files from `.agents/skills/phoenix-tracing` into `skills/` (git-ignored,
shipped in the tarball), writes `skills/manifest.json` with the source commit, and then
runs `verifyGuidance` so a renamed or removed skill file fails the build rather than a
user's lint. Copying rather than symlinking is deliberate: symlinks do not survive
`npm pack`, and the manifest makes every finding traceable to the exact guidance text it
was judged against. The loader falls back to the repo's `.agents/skills` when running
unbuilt.

Guidance is cited **by file, never by heading**. An earlier version sliced `##` sections
out of the markdown and took "the first paragraph after the H1" as a span-kind summary.
That worked but derived structure from prose, so a heading rename in a docs PR would have
been an invisible breaking change. Whole-file citation costs tokens (the suite went from
51k to 144k input tokens, about $0.006) and changed no judgement; the largest request is
16.5k tokens against jev's 32k limit for state plus the longest question.

### What leaves the machine

Nothing from the linted file is sent verbatim. Before a request is built, a redaction
pass ([`src/redact.ts`](src/redact.ts)) rewrites the source from the AST:

| Source                                                                               | Sent as                  | Why                                                         |
| ------------------------------------------------------------------------------------ | ------------------------ | ----------------------------------------------------------- |
| string literal values, template quasis                                               | `"<str:N>"` (N = length) | where a pasted key, a test SSN or a real name would sit     |
| numeric literals with ≥ 7 digits                                                     | `<num:N>`                | card numbers, ids                                           |
| property keys, import sources, directives, computed member keys, type-level literals | kept                     | structure, not data; `"metadata.patient_dob"` is the signal |
| values of the `kind` / `name` / `type` span options                                  | kept                     | needed to judge span usage                                  |
| identifiers, member expressions, call shapes, comments                               | kept                     | what the questions are about                                |

Hardcoded values under `attributes` are additionally excluded from the per-attribute
questions altogether: nothing flows at runtime, so there is nothing to ask, and the
deterministic side reports a long one as a likely pasted secret. The tests assert that
the fixture's `sk-live-…` key and other literals appear nowhere in `state.code` or
`state.facts`. Set `redact: "off"` in the rule options to disable this (not recommended).
Comments are currently kept; stripping them is a one-line follow-up if needed.

## Running it

```bash
cd js && pnpm --filter @arizeai/oxlint-plugin-jev build
```

| Mode   | How                                                                | What happens                                                                                                        |
| ------ | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| live   | `TYPESAFE_API_KEY=… pnpm demo` with `OXLINT_JEV_MODE=live`         | Real calls to `https://api.typesafe.ai/v1/systemone`, cached on disk.                                               |
| record | `pnpm demo` (default)                                              | No network. Writes every request that _would_ be sent to `node_modules/.cache/oxlint-jev/requests/` for inspection. |
| mock   | `OXLINT_JEV_MODE=mock OXLINT_JEV_MOCK_FILE=test/mock-answers.json` | Canned answers; what the tests use.                                                                                 |
| off    | default when `TYPESAFE_API_KEY` is unset                           | Plugin is a no-op after one stderr notice.                                                                          |

Other knobs: `OXLINT_JEV_MODEL` (default `jev-latest`), `OXLINT_JEV_BASE_URL`,
`OXLINT_JEV_CACHE_DIR`, `OXLINT_JEV_SKILLS_DIR`, `OXLINT_JEV_QUIET`.

To wire it into a project's oxlint config:

```jsonc
{
  "jsPlugins": [{ "name": "jev", "specifier": "@arizeai/oxlint-plugin-jev" }],
  "rules": {
    "jev/guidance": ["warn", { "threshold": 0.75, "minConfidence": 0.6 }],
  },
}
```

`oxlint-jev` (the package `bin`) lints only changed files that import a target
package: `git diff` against `--base` (default `origin/main`) plus working-tree and
untracked files, filtered by a cheap import regex, then handed to oxlint.

## What the experiments showed

Everything below was measured in this repo with oxlint 1.79.0 and, for the live runs,
`jev-1.13.0` via `jev-latest`.

**oxlint's JS plugin API is sufficient.** ESLint-style visitors, `Program:exit`,
`context.options` (with a mandatory `meta.schema`), `context.filename` / `cwd` /
`sourceCode.getText` / `getAncestors` all work. Module-level state persists across files
in a run. Plugin resolution by relative path and by package name both work.

**A synchronous rule can block on an HTTP call.** Rules cannot be async, so the plugin
posts the request to a worker thread and blocks on `Atomics.wait`. Measured overhead in
the first probe was ~36 ms per call including worker start-up; `execFileSync` of a child
node process worked too but cost ~56 ms per call. Against the real API, linting the
fixtures plus every app in `js/examples/apps` (12 jev requests) took 3.3 s wall clock;
the second run was all cache hits and made no requests. A downed server produces one
"guidance checks skipped" diagnostic rather than a crash.

**Payloads are small and cheap.** The final live run (15 requests: all fixtures plus every
app in `js/examples/apps`, five checks, whole-file guidance) used 144,415 input tokens in
total and cost about **$0.006** at $0.042 per million tokens. State ranged 3.1k–10.7k
tokens; the span-kind Choice question, which carries all nine `span-*.md` files as
criteria, is 5.8k. Worst case is 16.5k of the 32k "state plus longest question" budget.
The content-hash cache makes unchanged files free.

**jev agrees with the human answer key on every fixture, with wide margins.**

| Fixture                     | Question                                       | jev                                   | Human key              | Reported?    |
| --------------------------- | ---------------------------------------------- | ------------------------------------- | ---------------------- | ------------ |
| `bad-flush-success-only.ts` | flushes on every exit path?                    | noul **0.04**                         | no                     | yes (p=0.96) |
| `good-flush.ts`             | flushes on every exit path?                    | noul 0.84                             | yes                    | no           |
| `simple-processor.ts`       | flushes on every exit path?                    | noul 0.83                             | n/a (no batching)      | no           |
| `span-kind-mismatch.ts`     | kind of `vectorStore.similaritySearch` wrapper | RETRIEVER, conf **1.00**              | RETRIEVER              | yes          |
| `span-kind-mismatch.ts`     | kind of RAG pipeline wrapper                   | CHAIN, conf 0.88                      | CHAIN                  | no           |
| `session-wrapper.ts`        | wrapper injecting session.id?                  | noul **0.98**                         | yes                    | yes          |
| `esm-import-order.ts`       | how is OpenAI instrumented?                    | relies_on_import_order, conf **1.00** | relies_on_import_order | yes          |
| `bad-no-flush.ts`           | —                                              | (deterministic)                       | violation              | yes (p=1.00) |

**On the real example apps, 5 of 6 judgements were right and one is arguable.**

| File                                           | Question                            | jev                          | Assessment                                                                                                          |
| ---------------------------------------------- | ----------------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `langchain-quickstart/src/index.ts`            | flushes on every exit path?         | noul 0.07 → reported         | **Correct.** `forceFlush()` runs only at the end of `main()`; the `catch` exits without flushing.                   |
| `langchain-quickstart/src/index.ts`            | how is LangChain instrumented?      | explicitly_instrumented 0.74 | Correct (`manuallyInstrument(CallbackManagerModule)`).                                                              |
| `ai-sdk-agent/instrumentation.ts`              | how is the AI SDK instrumented?     | native_telemetry 0.97        | Correct (`registerTelemetry` from `ai`).                                                                            |
| `phoenix-experiment-runner/instrumentation.ts` | how is OpenAI instrumented?         | explicitly_instrumented 1.00 | Correct.                                                                                                            |
| `eve-agent/agent/instrumentation.ts`           | flushes on every exit path?         | noul 0.69 → not reported     | Correct outcome (Simple processor, nothing to flush), but low margin.                                               |
| `cli-agent-starter-kit/src/ui/interaction.ts`  | kind of the `cli.interaction` spans | LLM 0.93 / 0.74 → reported   | **Arguable.** Bodies are `agent.generate(...)`. The sessions guidance models this root span as CHAIN by convention. |

The `cli.interaction` rows are the most instructive result. The first live run judged
both spans `LLM` because the request contained only the wrapper quick-reference. Adding
the CHAIN spec and the sessions "Key Points" section moved both answers to `AGENT` (0.45
and 0.77). Adding one more sentence of real guidance — a wrapper that only delegates to
an LLM/agent client is the CHAIN boundary, and the LLM span comes from
auto-instrumentation — moved them to `CHAIN` (0.86 and 0.80) while leaving the genuine
`RETRIEVER` mismatch at 1.00. Two takeaways:

- **Guidance in `state` steers the model, measurably.** The same code with more of the
  shipped policy produced a different, better-aligned distribution. That is the argument
  for bundling the skill files rather than relying on the model's priors.
- **Keep facts in `state`, keep questions minimal.** Appending "(It is declared
  `CHAIN`.)" to the span-kind question, information already present in
  `code.calls[i].declared_kind`, dropped two correct CHAIN answers from 0.87 → 0.67 and
  0.81 → 0.63. Reverting it restored them. Mentioning a candidate answer in the question
  acts as an anchor, even when redundant.
- **The request schema is part of the contract.** `state.code` is a fixed
  `{ redaction, text, calls }`; every check points into `code.calls[i]` by index rather
  than emitting its own view of the same call. Making this change altered no judgement
  and left total tokens flat (144k → 144k, redistributed from span-heavy files to
  `register()`-only files), so it is schema hygiene rather than cost reduction. It exists
  so that adding a check never changes what jev sees for existing ones.
- **Question wording is the tuning surface.** Every misfire so far was fixed by adding
  a sentence of _true_ guidance to `state` or by splitting a question, never by changing
  a threshold. That is the right order: thresholds paper over ambiguity, guidance removes it.

**Deterministic prechecks need to be conservative.** The first run of `flush-before-exit`
flagged three real example files. All three were false positives: two pass `batch: false`
and one supplies a `Simple` span processor, cases the guidance explicitly exempts. The fix
was to extract `register()`'s literal options and either skip (`batch: false`) or hand the
ambiguous case (custom `spanProcessors`) to jev with the facts attached. The general lesson
is that code should only short-circuit the unambiguous cases and let jev own the rest.

## Open questions

- **Per-check thresholds.** `threshold` / `minConfidence` are rule-wide today; the ESM
  answers sit at 0.97–1.00 while flush answers for correct code sit at 0.70–0.85, so the
  checks want different gates.
- **Who owns the checks.** Today `checks.ts` cites skill files; the questions live in the
  plugin. The sounder end state is probably the inverse: a small machine-readable manifest
  next to the skill that lists its checks, cited files and question text, with the plugin
  as a generic engine. Then a docs edit and its question edit land in the same PR.
- **Comments.** Kept today because they carry intent; a `// patient John Doe` comment would
  leave the machine. Stripping them via `sourceCode.getAllComments()` is a small follow-up.
- **Cross-file facts.** `instrumentation.ts` exporting `provider` for `agent.ts` to shut down
  is skipped today. A cheap follow-up is a pre-pass that records exports per file and feeds
  them into `facts`.
- **Python.** The same shape (import gate → facts → guidance-in-state → atomic questions)
  applies to `arize-phoenix-otel`; the skills already ship `*-python.md` twins of every
  reference used here.
- **Where the plugin runs.** Because the cache is content-addressed, running it in
  pre-commit on changed files (`oxlint-jev`) and in CI on the whole tree costs about the same.

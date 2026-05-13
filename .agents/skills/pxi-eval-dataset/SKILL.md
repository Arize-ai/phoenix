---
name: pxi-eval-dataset
description: >-
  Generate synthetic evaluation datasets for the PXI eval harness
  (tests/pxi/evals/). Use whenever the user asks to create, author, draft,
  expand, or audit an eval dataset for a PXI tool, skill, or behavior —
  including phrases like "write evals for <tool>", "test PXI behavior",
  "synthetic dataset for PXI", "cover this tool with eval examples",
  or "find gaps in our PXI eval coverage". Inspects whichever evaluators
  currently live under tests/pxi/evals/evaluators/ at use time and pauses
  to recommend a new evaluator if the behavior under test can't be
  scored by what already exists.
license: Apache-2.0
metadata:
  author: ehutton@arize.com
  version: "0.1.0"
  internal: true
---

# pxi-eval-dataset

Produce a small, well-targeted YAML dataset that drops into
`tests/pxi/evals/datasets/<name>.yaml`, runs through
`tests/pxi/evals/run_experiment.py`, and is scored by deterministic
code evaluators under `tests/pxi/evals/evaluators/`.

The aim is a **minimal but representative** set of synthetic examples —
think unit tests, not a benchmark. 10–50 examples, each covering a
distinct dimension. Add more only when a new example tests something no
existing example does.

Every example must be scorable by deterministic / heuristic / code logic.

---

## Workflow

### 1. Identify the target

Confirm with the user what's under test: a specific PXI tool name (e.g.
`set_time_range`), a skill, or a higher-level behavior. For tools:

- Read the tool definition at
  `src/phoenix/server/agents/toolsets/external/tools/<name>.py` — the
  `ToolDefinition`'s description and `parameters_json_schema` are what
  the LLM actually sees.
- Search the phoenix src for any server-side implementation function
  that backs the tool. (External tools execute browser-side and may
  have none — that's fine, the docstring + schema are the spec.)
- Read `src/phoenix/server/agents/toolsets/__init__.py::build_toolset`
  and `src/phoenix/server/agents/toolsets/external/__init__.py::build_external_toolset`
  to learn the availability conditions — which `ChatContext` must be
  present for the tool to be exposed (e.g. `set_spans_filter` only
  exists when `deps.contexts.project` is set).

### 2. Survey the evaluators that currently exist

List `tests/pxi/evals/evaluators/` and read each module. For every
evaluator, note:

- the evaluator name and `@create_evaluator(...)` decorator,
- what fields it consumes from `expected` (e.g. `expected.tools.required`,
  `expected.tool_call_args[<tool>]`),
- its score / label semantics and any helpful failure metadata,
- the class of assertion it supports (tool selection, tool arguments,
  assistant text, multi-call sequencing, ...).

Also peek at `tests/pxi/evals/test_evaluators.py` for canonical input
shapes.

**Do NOT hard-code knowledge of which evaluators exist** — re-read the
directory every time. The set will grow.

### 3. Match the target to the evaluators — pause if a gap exists

Decide whether the behavior under test can be scored by what's there
today.

- **Yes** → continue. The chosen evaluator names go in the dataset's
  `evaluators:` field (required, top-level). The runner uses ONLY the
  listed evaluators; unrelated ones are not invoked, so the dashboard
  stays free of vacuous passes from evaluators that don't apply to
  this dataset. Available names live in
  `tests/pxi/evals/evaluators/__init__.py` (`EVALUATORS_BY_NAME`).
- **No** → stop and summarize the gap to the user. Propose the shape
  of a new evaluator:
  - name (snake_case),
  - the `expected.<field>` it would read,
  - score / label semantics,
  - whether it's tool-call-shaped, text-shaped, structural, etc.

  Then ask: "Should I add this evaluator before we generate examples?"
  If yes:
  - implement it under `tests/pxi/evals/evaluators/<file>.py`,
  - add unit-test coverage to `tests/pxi/evals/test_evaluators.py`,
  - export it from `tests/pxi/evals/evaluators/__init__.py`,
  - then continue.

  If no, scope the dataset down to assertions the existing evaluators
  can score, and tell the user what coverage that costs.

### 4. Enumerate coverage dimensions

Walk this checklist for the target. For each row, write down which
queries you'll add to cover it. Skip rows that don't apply (e.g.
booleans on a tool with no boolean field).

- **Parameter coverage** — every required field, every optional field,
  every meaningful field combination.
- **Value coverage** — every enum literal; for strings: empty,
  whitespace, special characters, very long; for numbers: zero,
  negative, boundary; for booleans: both polarities.
- **Combination coverage** — fields that interact (e.g. a filter
  condition paired with a scope toggle, two args that must agree).
- **Negative coverage** — queries where the tool should NOT be called.
- **Ambiguity coverage** — borderline queries that test correctness
  under uncertainty.

Polarity and difficulty targets are stated once in step 5 below; aim
for those across the whole dataset, not within each row.

If you cannot fill at least 10 rows, the target is probably too
narrow — confirm scope with the user.

### 5. Draft queries

For each coverage dimension, write one or more queries that feel like
they came from a real Phoenix user. Mix across:

- **Voice:** imperative ("show me LLM spans"), declarative ("I want
  to see only errors"), question ("what spans took over 5s?"),
  fragment ("LLM only").
- **Polish:** clean prose, terse fragments, casual typos,
  abbreviations, incomplete sentences.
- **Personas:** new user setting up Phoenix on a new project; engineer
  debugging an agent or RAG pipeline; PM exploring trace quality; AI
  engineer writing evals; annotator marking traces; researcher
  exploring trends. Sample across them — don't sound like one author.
- **Difficulty:** ~30% obvious, ~50% moderate, ~20% ambiguous /
  tricky.
- **Polarity:** at least 30% negative (tool should NOT be called).

Anti-patterns to avoid:

- Don't paraphrase the tool's docstring.
- Don't use technical jargon a real user wouldn't reach for.
- Don't write 20 minor variations of the same intent.

### 6. Annotate expected outputs — subprocess annotation

**Ground truth must be generated in a fresh subprocess, not inline.**
When annotation happens in the same context that drafted the queries, the
agent builds a prior from its own examples: it anchors on condition
patterns it established early, collapses ambiguous cases into overconfident
annotations, and fills in `tool_call_args` based on what earlier examples
"look like" rather than what the tool spec actually says. This is context
rot — annotation signal weakens as the dataset grows.

The remedy: annotate each example in a **separate subprocess** (use the
`Agent` tool) whose context contains only the tool spec and the single
query. Each annotation is an independent reasoning trace from the spec.

#### Subprocess context (include all three, nothing else)

1. **Tool spec** — the full `ToolDefinition`: description,
   `parameters_json_schema`, any backing-implementation docstring,
   and the availability conditions from step 1.
2. **Evaluator contract** — copy the schema reference from this skill
   (what each `expected` field means, subset-match semantics). Add the
   explicit instruction: *if you are unsure about an arg value, omit the
   key rather than guessing.*
3. **Single query** — just the `input.query` string, plus the
   `metadata.difficulty` label if already assigned.

Task instruction for the subprocess:
> "Given this tool spec and query, output the complete `expected:` block.
> Reason step-by-step from the spec. Do NOT invent a plausible-looking
> value that the spec does not imply — omit the key instead."

Use `claude-sonnet-4-5` for annotation subprocesses.

#### Annotation rules (apply these in every subprocess)

- Use `tools.required` for the must-be-called tool(s).
- Use `tools.forbidden` (or `tools.exact_match: true`) for negative
  cases or strict-no-extras cases.
- For a **pure-negative** case (no tool should be called at all),
  set `tools.forbidden` to the list of tools that must not fire and
  omit `tools.required` entirely. Do not supply `tool_call_args`.
- Use `tool_call_args[<tool>]` only when argument correctness matters;
  leave it off for "any args are fine" cases — especially **ambiguous**
  cases where you want to assert the tool fires but not pin its args.
- Add `metadata.category` for every example so coverage gaps are easy
  to spot later. Pick a flat string taxonomy and reuse the same
  category strings across related examples — don't invent a new tag
  per example. Existing datasets are a useful pattern reference.

#### How many opinions, and which models

| Difficulty | Opinions | Models |
|---|---|---|
| `obvious`, pure-negative | **1** | `claude-sonnet-4-5` |
| `moderate`, `tricky`, ambiguous | **3** | `claude-sonnet-4-5` + `claude-opus-4-5` + `o3-mini` |

Cross-model diversity (different families, different training) catches
single-model biases that seed-level diversity misses. Run all three
annotation subprocesses **in parallel** — send a single `Agent` tool
message with three calls. **Do not share context between them.**

#### Orchestrator subprocess (required when N > 1)

After the N annotation subprocesses return, run a **fourth fresh
subprocess** as the orchestrator. Its job is to merge the N candidates
into a single `expected:` block, with authority to drop spec-invalid
proposals.

**Orchestrator subprocess context:**

- The tool spec (same as the annotation subprocess)
- All N candidate `expected:` blocks (anonymized — do not tell the
  orchestrator which model produced which proposal; this prevents
  reputation bias)
- The query
- The decision table below

**Orchestrator decision rules** (applied per-tool to
`tool_call_args[<tool>]`):

| Situation | Resolution |
|---|---|
| All N proposals agree (after value normalization) | Single dict |
| Distinct proposals, **all** spec-valid per `parameters_json_schema` | Variant list of all spec-valid dicts (see below) |
| Distinct proposals, **some** spec-invalid | Drop invalid; emit remaining (single dict or variant list) |
| Distinct proposals, **none** clearly spec-valid | Omit `tool_call_args[<tool>]` entirely (ambiguity convention) |
| Proposals disagree on whether the tool should fire at all | Use majority for `tools.required` / `forbidden`; omit `tool_call_args`; set `metadata.flags: [multi_correct]` |

The orchestrator must justify any "spec-invalid" rejection against a
specific clause of the tool spec. It does NOT vote: it adjudicates
against the spec.

#### Confidence metadata — surface noisy annotations

After orchestration, write the annotation provenance into the example's
metadata. This makes noisy / low-confidence ground truth easy to audit
later.

```yaml
metadata:
  category: preset
  annotation:
    agreement: high     # high | medium | low — see rule below
    n_opinions: 3       # number of annotation subprocesses run
    n_variants: 2       # number of variant dicts in the final tool_call_args list
```

**Agreement categorization rule:**

- **`high`** — all N opinions produced equivalent `expected:` blocks
  (equal `tools.{required,forbidden}` lists after sorting, and per-tool
  `tool_call_args` dicts equal after applying `_normalize_arg_value`
  from `tests/pxi/evals/evaluators/tools.py` to each value).
- **`medium`** — majority (≥⌈N/2⌉) agreed; minority differed but the
  orchestrator was able to merge (as variants) or drop (as spec-invalid).
- **`low`** — no majority; the orchestrator either fell back to
  omit-args or made a judgment call with weak signal.

For single-opinion examples (`obvious` / pure-negative), use
`agreement: high` and `n_opinions: 1`.

**Why this matters:** an `agreement: low` example may still have a
correct ground truth, but it's a candidate for human review — the
models hedged, which can indicate either a genuinely ambiguous query
or a spec the LLMs interpreted differently. A follow-up audit script
can flag these for inspection.

**Equality-detection caveat:** the heuristic catches DSL clause
reordering (because it reuses `_normalize_arg_value`) but does NOT
catch semantically-equivalent rewrites (e.g. `latency_ms >= 5000` vs
`latency_ms > 4999`). Such cases will surface as `agreement: medium`
or `low`, which is arguably the right signal — the model hedged.

#### Multiple-correct arg shapes: variant lists

When more than one set of arguments is reasonable per the spec, write
`tool_call_args[<tool>]` as a **list of dicts** instead of a single
dict. The observed call passes if any variant matches under the same
subset rules as the single-dict form. This lets each variant pin a
different combination of keys (e.g. a preset variant vs. a custom
variant with `startTime`):

```yaml
tool_call_args:
  set_time_range:
    - { timeRangeKey: 1d }                  # preset variant
    - { timeRangeKey: 7d }                  # preset variant
    - { timeRangeKey: custom }              # custom range, key omitted
```

Use variants for genuinely-ambiguous queries (e.g. "show me recent
traces" — `15m`, `1h`, `12h`, `1d`, `7d`, `30d` are all defensible).
Do not use variants to paper over agent inconsistency on queries
that have one clear correct answer.

### 7. Save and validate

Save to `tests/pxi/evals/datasets/<name>.yaml`. Then:

```bash
# Parse + validate schema:
uv run python -c "from tests.pxi.evals.datasets import load_dataset; load_dataset('<name>')"

# Run the experiment end-to-end against the real PXI agent:
uv run python tests/pxi/evals/run_experiment.py --dataset <name>
```

Inspect evaluator scores per example. Iterate on:

- examples that fail in ways that suggest the _example_ is wrong, not
  the agent (re-read the tool docstring),
- examples that all pass trivially (probably duplicate coverage —
  delete or harden),
- gaps the agent surfaces (e.g. an enum value not represented).

For local-only experimentation use the harness env vars (see
`tests/pxi/evals/README.md`). There is no `--limit` flag — keep the
dataset small while iterating, or commit a temporary copy.

**YAML gotchas that cost an iteration if you miss them:**

- The dataset validator uses `ConfigDict(extra="forbid")` on
  `EvalDataset`, so a typo in a top-level key (`example` instead of
  `examples`) raises rather than being silently ignored.
- Quote any scalar that begins with `"`, `[`, `{`, `:`, `*`, `&`, `!`,
  or `%`, and any value containing a leading/trailing colon or `#` —
  e.g. `condition: "status_code == 'ERROR'"`. Plain DSL strings without
  punctuation can stay unquoted, but quoting consistently is cheaper
  than diagnosing a parser error.
- Example `id`s must be unique across the dataset; duplicate ids fail
  validation with the offending ids listed.

---

## Dataset schema reference

The canonical shape, modeled on
`tests/pxi/evals/datasets/set_spans_filter.yaml`:

```yaml
dataset_name: set_spans_filter # required, non-empty
description: PXI eval suite for ... # optional
evaluators: # required, non-empty list of evaluator names
  - correct_tools_called # see tests/pxi/evals/evaluators/__init__.py
  - set_spans_filter_args_match # for valid names
examples: # required, non-empty list
  # Positive case with argument assertion.
  - id: llm-spans-only # required, unique, stable
    input:
      query: Show me only LLM spans. # required, the user-facing prompt
    expected: # required object
      tools: # required object
        required: [set_spans_filter] # tool(s) that MUST be called
        forbidden: [set_time_range] # tool(s) that must NOT be called
        # exact_match: true             # optional: forbid any extra tools
      tool_call_args: # optional
        set_spans_filter: # any tool name from `required`
          condition: span_kind == 'LLM' # subset match: extra keys in
          rootSpansOnly: false # the observed call are fine
    metadata: # optional but recommended
      category: span_kind

  # Ambiguous case — assert the tool fires, do NOT pin args.
  - id: ambiguous-fast-spans
    input:
      query: show me fast spans
    expected:
      tools:
        required: [set_spans_filter]
      # tool_call_args omitted on purpose — any args are acceptable.
    metadata:
      category: ambiguity

  # Pure-negative case — tool must NOT fire at all.
  - id: negative-greeting
    input:
      query: "hey, what can you do?"
    expected:
      tools:
        forbidden: [set_spans_filter]
      # `required` omitted on purpose — nothing must be called.
    metadata:
      category: negative_chitchat

  # Variant-list case — multiple arg shapes are acceptable.
  - id: variant-recent-traces
    input:
      query: show me the most recent traces
    expected:
      tools:
        required: [set_time_range]
      tool_call_args:
        set_time_range: # list of dicts; any-of match across variants
          - { timeRangeKey: 15m }
          - { timeRangeKey: 1h }
          - { timeRangeKey: 12h }
          - { timeRangeKey: 1d }
          - { timeRangeKey: 7d }
          - { timeRangeKey: 30d }
    metadata:
      category: ambiguity
```

Validator is in `tests/pxi/evals/datasets.py`. Matching semantics in
`tests/pxi/evals/evaluators/tools.py`:

- **Subset match** on `tool_call_args`: an observed call passes if it
  has every expected key with a matching value; extra keys are ignored.
- **Variant match** when `tool_call_args[<tool>]` is a list of dicts:
  the observed call passes if ANY variant matches. Use for genuinely
  ambiguous queries where multiple arg shapes are equally correct.
- **Any-of match** when a tool is called multiple times: ANY call can
  satisfy the expected args.
- **Order-independent conjunctions**: string values joined with `and`
  are normalized to a frozenset, so
  `"span_kind == 'LLM' and latency_ms >= 5000"` matches
  `"latency_ms >= 5000 and span_kind == 'LLM'"`. Pure-`or` expressions
  are normalized the same way; mixed `and`/`or` fall back to exact
  string comparison.

---

## Out of scope (today)

- **Multi-turn evaluation** — the harness invokes the agent once per
  example. If the behavior under test is conversational, raise that as
  a separate task before writing examples.

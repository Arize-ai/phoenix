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

The remedy: annotate each example in a **separate subprocess** whose
context contains the full PXI toolset, the author's design intent for
the query, and the schema contract. Each annotation is an independent
reasoning trace from the toolset spec.

**Prepare once, reuse across examples.** Before launching annotation
subprocesses, extract the full toolset spec once (see section 1 below)
and cache it. Every annotation subprocess across the dataset reuses the
same toolset block; only the query and design-intent block change
per-example.

#### Subprocess context (four sections, in this order)

1. **Full toolset spec** — the complete toolset the PXI agent sees at
   runtime, **NOT just the tool under test**. For each tool, include the
   name, description, and `parameters_json_schema`. The annotator has
   to decide whether the right answer is the focal tool, a different
   tool, or no tool at all — and cannot do that without seeing every
   tool's spec. This is the single biggest hedge against annotator
   hallucination: with only one tool visible, the annotator will
   force-fit it to ambiguous or negative queries.

   Source the toolset from `build_toolset` and `build_external_toolset`
   in `src/phoenix/server/agents/toolsets/` (and
   `src/phoenix/server/agents/toolsets/external/`). The eval harness
   configures `ChatContext` such that all external tools are available
   — see `tests/pxi/evals/agent_task.py`. List every tool that survives
   that filtering, not just the focal one.

   **Mark the focal tool explicitly** at the top of this section
   (`★ FOCAL TOOL: <name> — this dataset evaluates this tool's
   behavior`). The annotator's job is still to reason from the spec for
   whichever tool best fits the query, but the highlight tells them
   which tool's evaluator family will judge the answer.

2. **Evaluator contract** — provide the dataset-specific
   expected-block schema derived from the selected evaluators (what
   each `expected` field means, matching semantics, and which fields
   may be omitted or expressed as variants). Add the explicit
   instruction: *if you are unsure about a value, omit the key rather
   than guessing.*

3. **Query and design intent** — the `input.query` string, plus the
   dataset author's framing if assigned:

   - `difficulty: obvious | moderate | tricky`
   - `polarity: positive | negative`
   - `category: <coverage dimension>` (the taxonomy from step 4 —
     parameter, value, combination, negative, ambiguity, plus any
     finer-grained category like `span_kind`, `status`, `latency`,
     `negative_chitchat`, `negative_wrong_tool`, etc.)
   - Any `notes:` the author wrote

   Frame this for the annotator as the dataset author's **intent**, NOT
   ground truth. The annotator should reason from the toolset spec and
   may disagree with the author — that disagreement is one of the most
   valuable signals this protocol produces, because it surfaces
   mis-classified queries.

4. **Task instruction** (goal-oriented, adapt only the schema
   reference):

   > "Your goal: determine the correct `expected:` block for this
   > dataset example — the expected output needed to validate whether
   > the PXI agent took the right actions in response to the user's
   > query, given the full toolset spec, evaluation goal, evaluator
   > set, and expected-block schema.
   >
   > Constraints:
   >
   > - Follow the expected-block schema provided for this dataset. The
   >   schema is determined by the evaluation goal and selected
   >   evaluators; do not assume every dataset validates only tool
   >   selection or tool arguments.
   > - When the schema includes tool expectations, consider every tool
   >   in the toolset spec, not just the focal one. The right answer may
   >   be the focal tool, a different tool, or no tool at all.
   > - Use only values directly implied by the relevant spec and the
   >   query. Omit any key whose value the spec doesn't determine —
   >   don't invent a plausible default.
   > - The author's design intent (`difficulty`, `polarity`,
   >   `category`, `notes`) is a hint, not ground truth. If your
   >   reading of the spec contradicts the author's labeled polarity,
   >   output what the spec implies and record the disagreement in
   >   `metadata.notes`.
   > - Return exactly one best `expected:` block. If multiple outputs
   >   seem valid, choose the single strongest answer and mention the
   >   alternatives in your brief reasoning; the orchestrator decides
   >   later whether variants belong in the final example.
   >
   > Output format (exactly two parts, in this order):
   >
   > 1. **Brief reasoning** — one or two sentences explaining which
   >    expected output you concluded should be used and why. Just
   >    enough that an orchestrator comparing three independent
   >    annotations can see where you agree or diverge with the others.
   > 2. **The `expected:` block as YAML** matching the schema
   >    reference provided in this prompt. No other prose."

   This frames the task as a goal with constraints, not a procedural
   recipe. Cross-model fan-out is only useful if each annotator
   reasons independently — prescribing the exact reasoning steps
   collapses that diversity. The brief-reasoning requirement gives
   the orchestrator enough signal to adjudicate disagreements
   without dictating how each annotator gets there.

#### Expected-block schema and annotation rules

Before launching annotation subprocesses, define the expected-block
schema for this dataset from the evaluation goal and selected
evaluators. Include that schema verbatim in every annotation prompt.
For example, a dataset that validates tool selection and tool
arguments may use `expected.tools` and `expected.tool_call_args`, while
another dataset may validate response text, refusal behavior, or some
other evaluator-specific field.

When the schema includes tool expectations, use these conventions:

- Use `tools.required` for the must-be-called tool(s).
- Use `tools.exact_match: true` for strict-no-extras cases.
- For a **pure-negative** case where no tool should be called, set
  `tools.required: []` and `tools.exact_match: true`. Do not enumerate
  every tool in `tools.forbidden`; the tool list can grow and make
  that brittle. Do not supply `tool_call_args`.
- Use `tool_call_args[<tool>]` only when argument correctness matters;
  leave it off for "any args are fine" cases — especially **ambiguous**
  cases where you want to assert the tool fires but not pin its args.

#### How many opinions, and which models

Collect **three independent opinions for every dataset example**:
Sonnet, Opus, and Codex. Even obvious and pure-negative examples get
the full fan-out so the dataset has a consistent annotation provenance
and easy-to-audit agreement metadata.

Cross-model diversity — different families, different training, and
(for Codex) different agent runtime — catches single-model biases that
seed-level diversity misses.

**How each opinion is invoked.** The Claude Code `Agent` tool is
Anthropic-only, so the OpenAI-side opinion comes from Codex via a
Bash wrapper. Using Codex (rather than a one-shot Chat Completions
call) gives the OpenAI annotator the same kind of environment access
a Claude subagent has — sandbox-constrained file reads, repo
navigation, the ability to double-check its reading of the toolset
against the actual source. This keeps the three opinions
genuinely symmetric.

| Opinion | Invocation |
|---|---|
| Sonnet | `Agent` tool, `model: "sonnet"` |
| Opus | `Agent` tool, `model: "opus"` |
| Codex | `Bash` tool, piping the prompt into `tests/pxi/evals/annotate_via_codex.sh` |

The Codex wrapper at `tests/pxi/evals/annotate_via_codex.sh` reads a
prompt on stdin and writes Codex's final message to stdout. It runs
`codex exec` with `--sandbox read-only` (the annotator can read the
repo but cannot modify anything), `--ephemeral` (no session
persistence between invocations), and `--skip-git-repo-check`.
Authentication is whatever Codex is already configured with
(`codex login status`); no `OPENAI_API_KEY` plumbing required. Example
invocation:

```bash
cat /tmp/annotation_prompt.txt | tests/pxi/evals/annotate_via_codex.sh
# Or pin a specific model:
cat /tmp/annotation_prompt.txt | tests/pxi/evals/annotate_via_codex.sh --model o3
```

**Run all three opinions in parallel.** Send a single message
containing two `Agent` tool calls (Sonnet, Opus) **and** one `Bash`
tool call (the Codex wrapper) — they will run concurrently. **Do not
share context between them.**

#### Orchestrator subprocess (required)

After the three annotation subprocesses return, run a **fourth fresh
subprocess** as the orchestrator. Its job is to merge the candidates
into a single `expected:` block, with authority to drop spec-invalid
proposals. Use a separate subprocess so the orchestrator sees
anonymized candidate blocks and cannot be biased by knowing which
model produced which annotation.

**Orchestrator subprocess context:**

- The **full toolset spec** (same as the annotation subprocess — focal
  tool marked, all other available tools included). The orchestrator
  needs this to judge "spec-valid" claims, especially for negative
  cases where the right answer is a non-focal tool.
- The query and design intent block (same as the annotation subprocess
  — `difficulty`, `polarity`, `category`, `notes`). The orchestrator
  should also be willing to override the author's polarity if the
  toolset spec and the majority of annotation opinions disagree with
  it; flag any such override with `metadata.notes: 'orchestrator
  overrode author polarity'`.
- All three candidate `expected:` blocks (anonymized — do not tell the
  orchestrator which model produced which proposal; this prevents
  reputation bias)
- The dataset-specific expected-block schema

**Orchestrator decision rules:**

- Merge portions of the `expected:` block where the models agree.
- Drop any value that is invalid under the tool spec, evaluator
  contract, or dataset-specific expected-block schema. Justify each
  rejection against a specific clause.
- Where models disagree but multiple outputs are valid and the schema
  supports variants, include variants only for the specific fields
  where variants are meaningful.
- Where variants do not make sense for the field, use the majority
  answer.
- Where there is no valid majority and the schema allows omission,
  omit the disputed optional field rather than over-constraining the
  expected output.
- For tool-call argument variants, keep at most three variants. If
  there are many valid argument shapes, prefer omitting
  `tool_call_args[<tool>]` so the evaluator checks tool selection
  without pinning arbitrary arguments.

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
```

**Agreement categorization rule:**

- **`high`** — all three opinions produced equivalent `expected:` blocks
  (equal `tools.{required,forbidden}` lists after sorting, and per-tool
  `tool_call_args` dicts equal after applying `_normalize_arg_value`
  from `tests/pxi/evals/evaluators/tools.py` to each value).
- **`medium`** — majority agreed; minority differed but the
  orchestrator was able to merge (as variants) or drop (as spec-invalid).
- **`low`** — no majority; the orchestrator either fell back to
  omit-args or made a judgment call with weak signal.

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
traces" when only a small number of choices are defensible). Keep the
list to at most three variants. If there are many valid choices, omit
the argument assertion instead. Do not use variants to paper over
agent inconsistency on queries that have one clear correct answer.

### 7. Save and validate

Save to `tests/pxi/evals/datasets/<name>.yaml`. Then:

```bash
# Parse + validate schema:
uv run python -c "from tests.pxi.evals.datasets import load_dataset; load_dataset('<name>')"

# Run the experiment end-to-end against the real PXI agent:
uv run python tests/pxi/evals/run_experiment.py --dataset <name>
```

Run the experiment end-to-end and **triage every failure** before
calling the dataset done. Don't assume a failed example means a
broken agent — eval suites have three plausible failure sources, and
mixing them up is the easiest way to ship bad ground truth or chase
phantom agent regressions.

#### Failure triage — three categories

For each failed example, classify the failure into one bucket:

| Category | What it looks like | What to do |
|---|---|---|
| **Dataset / annotation issue** | Agent's actual output is valid and reasonable per the toolset spec, but doesn't match the dataset's `expected:` block. The dataset author (or annotation protocol) was wrong, too strict, or missed a valid variant. | Fix the dataset: relax the expectation, add a variant via the variant-list syntax, omit `tool_call_args` if the case is ambiguous, or correct an outright wrong annotation. Note in `metadata.notes` if a polarity flip is involved. |
| **Genuine agent issue** | The harness caught a real problem — the agent called the wrong tool, missed a tool, hallucinated arg values, or violated the spec. | Leave the example as-is; the failure is doing its job. Surface the failure to whoever owns the agent's behavior (file an issue, add to the regression log). |
| **Harness / evaluator issue** | The evaluator's matching logic, the runner's plumbing, or the Phoenix-side experiment integration is broken. Symptom: the agent's output and the expected block agree by any reasonable reading, but the evaluator labels it failing — or vice versa. | Fix the evaluator or harness, add a unit test in `test_evaluators.py` covering the case, then re-run. Do NOT paper over a harness bug by editing the dataset. |

#### Triage workflow

1. Pull the failed example's `id`, observed tool calls, and evaluator
   label from the experiment output (the runner prints these per
   evaluator).
2. Re-read the focal tool's `parameters_json_schema` and the
   relevant evaluator code to decide which category the failure
   belongs in. The categorization is not always obvious — when
   genuinely uncertain, prefer "harness/evaluator issue" and read the
   evaluator first, since a broken evaluator silently corrupts both
   of the other categories.
3. Record the triage decision per failed example before fixing
   anything. A short list — `{example_id: category}` — is enough.
   Without this list, the fix loop tends to oscillate (fix dataset →
   evaluator flips on a different example → "fix" evaluator → first
   example breaks again).
4. Fix in order: **harness/evaluator issues first**, **dataset issues
   second**, **leave genuine agent issues for last** (or escalate
   rather than fixing them yourself).
5. Re-run the full experiment after each batch of fixes. Stop when
   the only remaining failures are genuine agent issues.

#### Other things to look for during validation

- Examples that all pass trivially (probably duplicate coverage —
  delete or harden).
- Coverage gaps the agent surfaces (e.g. an enum value not
  represented in any example).
- Examples flagged `annotation.agreement: low` in metadata — these
  are exactly the candidates for human review even if they passed.

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

Reference the live datasets in `tests/pxi/evals/datasets/` for current
dataset shapes, examples, and naming conventions. Do not copy a schema
from this skill into prompts. Instead, derive the expected-block schema
from the selected evaluators and include that schema in each
annotation and orchestration prompt.

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

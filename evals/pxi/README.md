# PXI Evals

This tree is the canonical home for PXI-specific eval work. The harness runs
live-model PXI server-side evals as Phoenix experiments.

## Layout

- `harness/` runs live PXI agent experiments against Phoenix datasets.
- `datasets/` stores YAML datasets shared by harness and CI workflows.
- `evaluators/` stores experiment evaluators over `(output, expected)` pairs.
- `online_evals/` evaluates already-ingested PXI traces and annotates them.
- `trace_ingest/` is reserved for future trace-to-dataset tooling.

Fast unit coverage for the harness and evaluators lives under
`tests/unit/pxi/evals/`.

## Online production evals

The online runner evaluates recent `pxi.turn` traces after ingestion. It uses
annotations as its checkpoint: before hydrating a trace or invoking an
evaluator, it skips turn roots that already carry the evaluator's annotation
name and identifier. The default 48-hour overlap therefore recovers from
missed scheduled runs without evaluating the same turn twice.

Trace evaluators live in `evals/pxi/online_evals/evaluators/`; run the CLI
with `--help` to list what is currently registered. They remain separate from
`evals.pxi.evaluators` because the latter implements the experiment contract
over `(output, expected)` pairs, while online evaluators consume a hydrated
`(root_span, trace_spans)` pair and produce root-span annotations.

All LLM evaluators share one judge configuration:
`PHOENIX_AGENTS_EVALS_PROVIDER` / `PHOENIX_AGENTS_EVALS_MODEL`, defaulting to
OpenAI `gpt-5.5`. Supported providers are `openai` (`OPENAI_API_KEY`),
`anthropic` (`ANTHROPIC_API_KEY`), and `google`
(`GOOGLE_GENERATIVE_AI_API_KEY`). Unknown provider names and a missing
matching API key fail once at startup, before trace discovery.

Evaluators consume a trace-shaped input and attach their result as a span
annotation on the trace's root `pxi.turn` span. The runner does not create or
update project annotation configs; configure display or optimization metadata
in Phoenix separately when needed.

Annotation identifiers are evaluator-specific versioned checkpoints. Increment
an evaluator's `vN` identifier whenever its scoring semantics or rubric
changes; the next overlapping run then backfills recent roots under the new
identity without overwriting the previous series. The runner appends
`provider:model` to every LLM evaluator's identifier, so a judge change
creates a distinct result series automatically. Only the runner's own
evaluator annotation names are consulted for checkpointing — human feedback
and other annotations never suppress a run.

Sampling is deterministic and keyed on the trace alone: evaluators with equal
sample rates select exactly the same traces, and a lower-rate evaluator's
selection is a strict subset of a higher-rate one's, so sampled traces are
never partially annotated.

Run them locally against the standard Phoenix client environment variables:

```bash
PHOENIX_PROJECT=pxi_dev \
uv run python -m evals.pxi.online_evals.run --dry-run
```

The runner waits five minutes before considering a turn settled and evaluates
all applicable turns by default, running evaluations concurrently (bounded at
8 in flight) so LLM judge calls are not serialized. An evaluator exception is
contained to that turn: it is logged, counted in the summary's `errors`, and
the run continues (the process exits non-zero so scheduled runs surface the
failure). Structural trace anomalies (a tool span that does not descend from
the turn root, missing ancestors, cycles) are deliberately loud: post-settle
traces are expected to be complete, so an anomaly signals dropped spans or a
tracing regression rather than a skippable turn. Revisit and downgrade to
skip-with-warning if these prove noisy in practice.

The scheduled workflow runs twice daily at 00:17 and 12:17 UTC and can also be
started manually. The CLI entrypoint above supports local runs at any time.
Workflow logs contain aggregate counts, not trace inputs or outputs.

Scheduled judge configuration comes from the
`PHOENIX_AGENTS_EVALS_PROVIDER` and `PHOENIX_AGENTS_EVALS_MODEL` GitHub
repository variables, defaulting to `openai` and `gpt-5.5`. Store the matching
provider credential in the correspondingly named Actions secret (the workflow
currently maps `OPENAI_API_KEY` and `ANTHROPIC_API_KEY`; add the mapping when
onboarding another provider). Phoenix and provider credentials are exposed
only to the final evaluation step.

The initial scheduled project is `pxi_dev`. The Phoenix Cloud production PXI
traces are in `pxi_phoenix_cloud`; add that project only after validating the
runner on new-format development traces.

### Adding an online evaluator

An evaluator is an async function that receives the root span and every
hydrated span in its trace. It returns a `phoenix.evals` `Score`, or `None`
when the turn is not applicable:

```python
from collections.abc import Sequence

from phoenix.client.__generated__ import v1
from phoenix.evals.evaluators import Score


async def evaluate(root: v1.Span, spans: Sequence[v1.Span]) -> Score | None:
    if not spans:
        return None
    return Score(score=1.0, label="example", explanation="why")
```

Declare an `EvaluatorSpec` with a name, the expected root span name, the
evaluate function, annotator kind, sampling rate, and a versioned identifier.
The annotator kind is required rather than defaulted: declare every evaluator
explicitly as `"CODE"` or `"LLM"` because it also controls judge credential
validation and model-specific checkpointing.
LLM evaluators (`annotator_kind="LLM"`) automatically share the judge
configuration from `evals/pxi/online_evals/judge.py`: the runner validates
the judge credentials at startup and appends `provider:model` to their
checkpoint identifier.

Register the spec in `evals/pxi/online_evals/evaluators/__init__.py` and add
focused coverage under `tests/unit/pxi/evals/online_evals/`. Runner-level tests
should assert the exact persisted annotation shape as well as failure,
not-applicable, sampling, and checkpoint behavior relevant to the evaluator.

## Run Locally

There are two ways to run the evals:

- The **pytest suite** (`pytest evals/pxi -c evals/pxi/pytest.ini`) is what CI
  runs and gates on — see [Pytest Harness and Aggregate Gate](#pytest-harness-and-aggregate-gate).
- `evals/pxi/harness/run_experiment.py` is the single-dataset runner with the
  richest local failure output (full per-example report to your terminal). It
  remains the best way to debug one dataset by hand.

To run a single dataset through `run_experiment.py`, start Phoenix, then:

```bash
uv run python evals/pxi/harness/run_experiment.py --dataset set_spans_filter
```

For the in-app link suite:

```bash
uv run python -m evals.pxi.harness.run_experiment --dataset in_app_links
```

The default invocation runs the `regression` split. Use `--splits` for manual
experimentation:

```bash
uv run python -m evals.pxi.harness.run_experiment --dataset set_spans_filter --splits dev val
```

`--fail-on-regression` exits nonzero only when an evaluator fails on a
`regression` example. The runner prints a stdout summary and the Phoenix
experiment URL.

## Failure Reports

The console summary keeps its compact, truncated tables -- that is the
glance tier. For full-fidelity output there are two flags:

### `--print-report` (local use)

Pass `--print-report` to dump the full Markdown failure report to stdout at
the end of the run. No-op when all examples pass.

```bash
uv run python -m evals.pxi.harness.run_experiment \
  --dataset set_spans_filter --print-report
```

This is the recommended way to see full failure details locally: inputs,
expected outputs, the agent's actual tool calls, per-evaluator
scores/labels/explanations, and a Phoenix trace link -- all in one place in
your terminal without writing any files.

### `--report-dir DIR` (artifact use)

Pass `--report-dir` to write two files per dataset run:

- **`<dataset>.report.json`** -- machine-readable: run metadata (experiment
  name and URL, git sha/branch, model, provider, splits, timestamp) plus one
  record per *failed or errored* example with the full untruncated `input`,
  `expected`, `actual_output` (including every tool call the agent made),
  per-evaluator score/label/explanation/error, any `task_error`, and a
  per-example trace URL (`<base-url>/redirects/traces/<trace_id>`) when the
  run was traced. Passing examples contribute to counts only.
- **`<dataset>.report.md`** -- the same content as agent-friendly Markdown:
  a digest table up top, one section per failed example (message histories
  collapsed under `<details>`), and a repro footer with the exact local
  command. The whole report is wrapped in sentinel markers
  (`===== BEGIN PXI EVAL REPORT: <dataset> =====` / `===== END ... =====`)
  so it can be grepped out of a CI log. Paste this into a coding agent to
  diagnose and fix the failure -- it is self-sufficient context.

These files are the richest local artifact for a single dataset. CI itself no
longer drives `run_experiment.py`; it runs the pytest suite and gate (see
[CI](#ci)) and renders its own report. Both paths embed log content the same
way: GitHub Actions interprets any line starting with `::` as a workflow
command (e.g. `::endgroup::` closes a log group, `::error::` creates an
annotation), so the workflow writes the report to a file and `cat`s it inside a
`::stop-commands::` block to suspend command processing while it logs. See
`.github/workflows/pxi-evals.yml` for the full pattern.

If a report would exceed GitHub's embedding limits (~1 MiB for step
summaries, ~64 KiB per log line), the Markdown tier falls back to its digest
plus a pointer at the JSON artifact; the JSON file never truncates example
data. The one deliberate redaction in both tiers: the static system prompt
that pydantic_ai repeats under `messages[].instructions` (~55 KB per model
request) is replaced with a placeholder -- it is product prompt, not example
data, and the full text is always viewable via the trace URL.

The runner checks `/healthz` against whichever Phoenix URL is configured
(default `http://localhost:6006`, or `PHOENIX_COLLECTOR_ENDPOINT` /
`OTEL_EXPORTER_OTLP_ENDPOINT` if set) before uploading anything. To use a
shared Phoenix endpoint:

```bash
export PHOENIX_COLLECTOR_ENDPOINT=https://your-phoenix.example.com
export PHOENIX_API_KEY=...
uv run python evals/pxi/harness/run_experiment.py --dataset set_spans_filter
```

Task errors (exception type plus a truncated message, no stack traces) are
uploaded to Phoenix as part of the experiment task output. Avoid pasting
credentials into request URLs while debugging against a shared Phoenix.

The task output stores the serialized Pydantic AI messages from the PXI agent
run. Tool evaluators read `tool-call` parts from those messages, so tool
selection and tool-argument checks cover every tool call emitted during the
turn.

## Pytest Harness and Aggregate Gate

The whole dataset tree also runs as parametrized pytest tests, each example a
`@pytest.mark.phoenix` item recorded to a Phoenix experiment. The tests never
assert: they record one datapoint per `(example, evaluator)` to a
`pxi-eval-results.json` artifact, and a standalone gate decides pass/fail from
that artifact against `thresholds.yaml`. This is what CI runs.

```bash
# Run the regression split and write pxi-eval-results.json
uv run pytest evals/pxi -c evals/pxi/pytest.ini -m regression

# Decide pass/fail (exit nonzero on a breach or an invalid/partial run)
uv run python -m evals.pxi.gate pxi-eval-results.json --thresholds evals/pxi/thresholds.yaml
```

`pytest.ini` is a complete, self-contained config: `pytest -c <file>` replaces
the root config rather than inheriting it, so it declares everything the eval
run needs (async mode, session loop scope, import mode, the split markers) and
omits the root suite's `--doctest-modules`. Set `PXI_EVAL_RESULTS_PATH` to
control where the artifact is written (default: `pxi-eval-results.json` in the
current directory).

### Thresholds

`thresholds.yaml` sets a per-split minimum pass-rate, with optional
per-dataset/per-evaluator overrides. Every split a dataset can carry
(`regression`, `dev`, `holdout`, `val`) is enumerated: a `(evaluator, split)`
datapoint with no matching policy and no explicit `gating: false` is treated as
a breach, not a silent pass. Regression must hold at 100%; `dev`/`holdout` are
lenient; `val` is recorded but non-gating. Relaxing a threshold lowers the
gate's bar, so call it out in the PR description rather than bundling it with
unrelated edits.

The gate also **fails closed on an incomplete run**: a missing, malformed, or
partial `pxi-eval-results.json` (collection/setup errors, fewer completed items
than collected, or a nonzero pytest session status) exits nonzero before any
threshold is compared, so "the gate passed" always means "a complete run
passed". When `PHOENIX_API_KEY` is set (i.e. CI), it additionally fails closed
if the plugin recorded nothing — bootstrap failure degrades to a warning in the
plugin, so without this a green gate could mean "recorded nothing to Phoenix".
Local runs with no key skip this check, since recording is optional there.

### Regression gate vs. full-collection sync

The marker you pass picks the trade-off:

- **`-m regression`** runs only the regression split. The phoenix-client plugin
  treats a marker-filtered run as a partial collection and **appends** to the
  Phoenix dataset without pruning removed examples. This is the cheap PR gate.
- **No marker** (`pytest evals/pxi -c evals/pxi/pytest.ini`) is a full
  collection: the plugin update-syncs the dataset and **prunes** examples that
  no longer exist in the YAML. Run this against `main` after merge to keep the
  Phoenix dataset authoritative — it runs every split's live-model examples, so
  it costs more than the regression gate.

## Model Configuration

The task uses Phoenix agent env vars for model selection:

```bash
export PHOENIX_AGENTS_ASSISTANT_PROVIDER=OPENAI
export PHOENIX_AGENTS_ASSISTANT_MODEL=gpt-5.4
```

Provider credentials are read from the normal provider env vars, such as
`OPENAI_API_KEY` or `ANTHROPIC_API_KEY`.

The docs MCP toolset follows the same production gates as the Phoenix server:
the agent assistant must not be disabled, and external resources must be
allowed. The assistant is on by default; external resources must be opted in:

```bash
export PHOENIX_ALLOW_EXTERNAL_RESOURCES=true
```

If either gate fails, the experiment still runs but the agent does not
receive docs MCP tools.

## Datasets

Datasets live in `evals/pxi/datasets/*.yaml`. Each file has:

- `dataset_name`
- optional `description`
- `evaluators`
- `examples`

Each example needs a stable `id`, exactly one split in a list-shaped `splits`
field, and whatever `input`, `expected`, and `metadata` shape its evaluators
consume. For the current tool-call evaluators, examples commonly use
`input.messages`, `expected.tools`, and expected tool arguments under
`expected.tool_call_args`.

Example IDs must be unique because the runner uses them for stable upserts.
Use `splits: [regression]` for a regression example.

Every dataset example must declare list-shaped `splits: [...]`, even when the
example belongs to only one split:

```yaml
examples:
  - id: llm-spans
    splits: [regression]
    input:
      messages:
        - role: user
          content: Show me only LLM spans.
```

Split meanings:

| Split | Size | Purpose |
| --- | --- | --- |
| `regression` | Small, 10-50 examples | Fast held-out regression gate; default for the harness. |
| `dev` | Larger, about 100+ examples | Manual experimentation, ablations, and failure analysis. |
| `val` | Small, 10-50 examples | Optimizer scoring signal. |
| `holdout` | Any size | Reserved as a held-out test set for final comparisons and tests of generalization. |

Each example belongs to exactly one split. The runner passes the YAML `splits`
list through to the Phoenix client upload payload.

## Inputs

Every example declares `input.messages` as a single ordered conversation
prefix. The trailing entry decides which step of the agent loop the harness
scores:

- **Last entry is `role: user`.** That turn becomes the user prompt; everything
  before it is replayed as message history. The default case -- "user asks,
  what does the agent do?"
- **Last entry is `role: tool`.** The harness runs the agent with `user_prompt
  = None` and the full list as message history, so the agent picks up
  mid-loop from a primed tool return. Lets a dataset isolate one step of
  behavior ("given the bash output below, what does the agent emit next?")
  without a synthetic user follow-up.
- **Last entry is `role: assistant`.** Rejected -- nothing remains to score.

Examples may also include `input.contexts`, which uses the same camelCase
shape as the browser agent API (`app`, `project`, `graphql`, etc.) so
server-side evals can exercise realistic page state without launching
Playwright.

A plain example -- user asks, agent decides:

```yaml
input:
  contexts:
    - type: project
      projectNodeId: UHJvamVjdDoxMg==
      spanFilter: "status_code == 'ERROR'"
      rootSpansOnly: false
  messages:
    - role: user
      content: Keep the error filter, but only show root spans.
```

A primed-tool-history example -- the agent has already issued a `bash` call
to inspect recent traces, and the harness scores whatever action it emits
next (typically a `set_spans_filter` call referencing the dates that came
back in the tool return):

```yaml
input:
  contexts:
    - type: project
      projectNodeId: UHJvamVjdDoxMg==
      spanFilter: "span_kind == 'LLM'"
      rootSpansOnly: false
  messages:
    - role: user
      content: Show me only the latest traces in this project.
    - role: assistant
      tool_calls:
        - id: t1
          name: bash
          args:
            command: "phoenix-gql --query '...recent spans by startTime desc...'"
    - role: tool
      tool_call_id: t1
      name: bash
      content: |
        {"data":{"node":{"spans":{"edges":[
          {"node":{"startTime":"2026-04-03T18:42:11Z"}},
          {"node":{"startTime":"2026-04-03T18:41:58Z"}}
        ]}}}}
```

Schema notes:

- An assistant turn may carry `content`, `tool_calls`, or both. Real PXI
  traces show no assistant text between tool calls, so primed-tool examples
  should omit narration unless you're deliberately testing narration
  behavior.
- Each tool call needs a local string `id` (any value; not interpreted by
  the agent) plus `name` and `args`. Every assistant `tool_calls` entry
  MUST be followed later by a `role: tool` entry whose `tool_call_id` and
  `name` match. `tool_call_id` values must be unique across the whole list.
- Primed messages are fed to the model verbatim via pydantic_ai's message
  types; the model cannot distinguish a primed tool call from one that
  was actually executed.

## Matcher Vocabulary

The `tool_call_args_match` evaluator compares expected args to observed args
with subset semantics (extra observed keys are ignored). Each expected value
is either a literal (compared by `==`) or a **matcher object** -- a dict
whose top-level keys are all in this vocabulary:

| Matcher | Meaning |
|---|---|
| `equals: <value>` | Explicit equality (same as a bare literal). |
| `contains_all: [<str>, ...]` | Observed must be a string containing every substring. Use this for clause-order-invariant DSL matching (`["span_kind == 'LLM'", "latency_ms >= 5000"]` matches either ordering). |
| `contains_any: [<str>, ...]` | Observed must be a string containing at least one substring. |
| `not_contains: [<str>, ...]` | Observed must be a string containing none of the substrings. |
| `any: true` | The key must be present in observed args; value is unconstrained. |
| `non_empty: true` | The key must be present and contain non-whitespace text. |
| `absent: true` | The key must not be present in observed args. |

To leave an arg entirely unconstrained, just omit it from `expected` --
subset matching ignores observed keys you don't mention. Use `any: true`
only when presence itself matters, and `non_empty: true` when required string
content matters. Use `absent: true` when omission itself is the behavior under
test.

For efficiency-focused examples, add `expected.budgets.max_tool_calls` and
enable the `tool_call_count_within_limit` evaluator. Bash-first examples can
use `bash_command_substrings_match` to check command intent without requiring
exact shell syntax.

## Manual CI

`expected.tools` may also include `exact_match: true`, which switches
`correct_tools_called` from "all required tools must be called" to "the
observed tool sequence must equal the required sequence" (no extras, no
duplicates, same order).

`expected.tool_call_args` holds either one expected arg map per tool name or a
list of acceptable arg maps. The match is intentionally permissive in three ways:

1. **Subset match per call.** A call passes when *all* expected `(key, value)`
   pairs are present; the observed call may carry extra arg keys that the
   dataset doesn't mention.
2. **Any-of match across multiple calls.** When a tool is called more than once
   in a turn, the check passes if *any* of those calls satisfies the expected
   pairs.
3. **Variant match across expected shapes.** When a tool has a list of expected
   arg maps, any variant can satisfy the expectation.

Literal values compare with `==`. For order-invariant string matching, use the
matcher vocabulary above. For example, `contains_all: ["span_kind == 'LLM'",
"latency_ms >= 5000"]` accepts either clause order without making every string
literal order-insensitive. Use `absent: true` for keys that must be omitted
despite subset matching otherwise allowing extra observed keys.

Tool arg keys must match the tool's exact JSON schema, including camelCase. For
`set_spans_filter` that means `condition` and `rootSpansOnly`;
`root_spans_only` will silently fail arg-match.

## Evaluators

Code evaluators live in `evals/pxi/evaluators/` and use
`@create_evaluator(name=..., kind="code")` from `phoenix.evals`. Experiment
evaluators can bind `output`, `input`, `expected`, and `metadata`. Simple
`bool`, `int`, or `float` returns are converted into Phoenix scores, while dict
returns can include labels, explanations, and metadata for debugging.

## What Belongs Here

Use Python server evals for model-facing PXI behavior that can be measured from
the server-owned agent output, including tool selection and deferred tool
arguments. Use Playwright when the behavior depends on browser rendering,
frontend dispatch, page state transitions, or visual/UI assertions.

## CI

The `PXI Evals` GitHub Actions workflow runs live regression evals against
Phoenix Cloud. It runs on PRs that change `evals/**` or
`src/phoenix/server/agents/**`, and maintainers can also run it manually from
the Actions tab.

On a PR the job runs `pytest evals/pxi -c evals/pxi/pytest.ini -m regression`
to record `pxi-eval-results.json`, then `python -m evals.pxi.gate` decides the
job's red/green from that artifact against `thresholds.yaml`. The gate runs
even when pytest exits nonzero, so a crashed or partial run fails closed rather
than passing on incomplete data. Phoenix connectivity is checked up front so an
unreachable collector reports as an infrastructure failure rather than a pile
of agent setup errors.

A manual `workflow_dispatch` run takes a `mode` input:

- `regression` (default) — the same regression gate the PR job runs.
- `full` — a full-collection run (no split filter) that prune-syncs the Phoenix
  dataset, dropping examples no longer in the YAML. Dispatch this against `main`
  after a dataset change merges; it runs every split's live-model examples, so
  it costs more than the regression gate.

### Reading a CI failure

Failure output is published through three channels, ranked by how you (or a
coding agent) consume it:

1. **Job log (primary, agents).** When the gate fails, the report is embedded
   in the log under a collapsed `PXI EVAL REPORT (agent-readable)` group,
   wrapped in `===== BEGIN/END PXI EVAL REPORT =====` sentinels and a
   `::stop-commands::` block. It carries the gate's exact breach list, the
   per-`(dataset, evaluator, split)` pass-rate table, and session health.
   Retrieval from a red check is two commands:

   ```bash
   gh pr checks <pr-number>           # find the failing run id from its URL
   gh run view <run-id> --log-failed  # the agent-readable report
   ```

   For the specific failing examples (inputs, the agent's tool calls,
   per-evaluator explanations, and a trace link), open the Phoenix UI: find the
   dataset under test and pick this run's experiment — the most recent one
   matching the PR branch and run time. (The `Run PXI eval suite` step log
   confirms how many experiments were recorded but does not print their URLs.)
2. **Step summary (humans).** The run's summary page shows the gate verdict and
   the same report inside a `<details>` block for browser copy-paste.
3. **Artifact (programmatic).** `pxi-eval-results.json` and the rendered report
   are uploaded as the `pxi-eval-reports-<run-id>` artifact on every run:

   ```bash
   gh run download <run-id> -n pxi-eval-reports-<run-id>
   ```

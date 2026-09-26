# PXI Online Evals

This tree holds the online evals that score PXI traces after ingestion. The
offline PXI eval datasets and their evaluators live in `evals/harbor/pxi/` and
run under Harbor; see `evals/harbor/README.md`, "The PXI eval datasets".

## Layout

- `online_evals/` evaluates already-ingested PXI traces and annotates them.

Unit coverage lives under `tests/unit/pxi/evals/online_evals/`.

## Online production evals

The online runner evaluates recent PXI spans after ingestion. It uses
annotations as checkpoints: before hydrating a trace or invoking an evaluator,
it skips targets that already carry the evaluator's annotation name and
identifier. The default 48-hour overlap recovers missed scheduled runs without
evaluating the same target twice.

Trace evaluators live in `evals/pxi/online_evals/evaluators/`; run the CLI
with `--help` to list what is currently registered. They remain separate from
`evals.harbor.pxi.evaluators` because the latter implements the experiment contract
over `(output, expected)` pairs, while online evaluators consume a hydrated
`(target_span, trace_spans)` pair and annotate the target span.

Each evaluator declares a `SpanSelector`; evaluators with the same selector
share a discovery query:

- **Root targets** — `tool_count_per_turn` and `user_friction` select
  `names=("pxi.turn",)`, `span_kinds=("AGENT",)`, `parent_id="null"`, so they
  score and annotate one turn root per trace. They share a single query.
- **TOOL targets** — `suggestion_accepted` selects on the approval attribute
  `pxi.approval.source="user"` with `span_kinds=("TOOL",)` and no parent
  restriction, so it annotates individual tool spans anywhere inside a turn.
  It names no tools at all.

Sampling is keyed on `trace_id`, so all targets within a turn are sampled
together.

All LLM evaluators share one judge configuration:
`PHOENIX_AGENTS_EVALS_PROVIDER` / `PHOENIX_AGENTS_EVALS_MODEL`, defaulting to
OpenAI `gpt-5.5`. Supported providers are `openai` (`OPENAI_API_KEY`),
`anthropic` (`ANTHROPIC_API_KEY`), and `google`
(`GOOGLE_GENERATIVE_AI_API_KEY`). Unknown provider names and a missing
matching API key fail once at startup, before trace discovery.

Evaluators consume a trace-shaped input and attach their result as a span
annotation on their target span. The runner does not create or update project
annotation configs; configure display or optimization metadata in Phoenix
separately when needed.

### `suggestion_accepted`

A deterministic CODE evaluator that records manual decisions on approval-gated
PXI suggestions. It annotates each TOOL span separately because a turn can
contain multiple decisions.

| Recorded outcome | Annotation |
|---|---|
| `pxi.approval.decision = "rejected"` | `rejected` / `0.0` |
| `pxi.approval.decision = "accepted"` | `accepted` / `1.0` |
| anything else | *no annotation* |

Approval-gated tools add `approval: {decision, source}` to their output. The
server promotes it to `pxi.approval.decision` and `pxi.approval.source`, which
the evaluator uses for discovery and classification.

The evaluator does not annotate:

- automatic accepts (`pxi.approval.source: "auto"`, i.e. bypass edit permission);
- still-pending approvals, cancellations, and errored tools — all unmarked;
- unknown or malformed decisions.

Annotations contain only `{"tool_name": ...}`. Discovery does not depend on a
tool-name allowlist, so new tools are covered when they emit the marker.

Spans recorded before the marker shipped cannot be discovered or backfilled.

`submit_code_evaluator_draft` and `submit_llm_evaluator_draft` remain
unmeasured because their dialog decisions are not written to tool output.
Accept/reject rates therefore exclude them until
[#15033](https://github.com/Arize-ai/phoenix/issues/15033) is resolved.

Preview it without writing anything:

```bash
PHOENIX_PROJECT=pxi_dev \
uv run python -m evals.pxi.online_evals.run --eval suggestion_accepted --dry-run
```

Annotation identifiers are evaluator-specific versioned checkpoints. Increment
an evaluator's `vN` identifier whenever its scoring semantics or rubric
changes; the next overlapping run then backfills recent targets under the new
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

The runner waits five minutes before considering a target settled and evaluates
all applicable targets by default, running evaluations concurrently (bounded at
8 in flight) so LLM judge calls are not serialized. An evaluator exception is
contained to that target: it is logged, counted in the summary's `errors`, and
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

An evaluator is an async function that receives one target span and every
hydrated span in its trace. It returns a `phoenix.evals` `Score`, or `None`
when the target is not applicable:

```python
from collections.abc import Sequence

from phoenix.client.__generated__ import v1
from phoenix.evals.evaluators import Score


async def evaluate(target: v1.Span, spans: Sequence[v1.Span]) -> Score | None:
    if not spans:
        return None
    return Score(score=1.0, label="example", explanation="why")
```

Declare an `EvaluatorSpec` with a name, selector, evaluate function, annotator
kind, sampling rate, and versioned identifier. Use `PXI_TURN_ROOT_SELECTOR` for
turn-level evaluators. The annotator kind controls judge credential validation
and model-specific checkpointing.
LLM evaluators (`annotator_kind="LLM"`) automatically share the judge
configuration from `evals/pxi/online_evals/judge.py`: the runner validates
the judge credentials at startup and appends `provider:model` to their
checkpoint identifier.

Register the spec in `evals/pxi/online_evals/evaluators/__init__.py` and add
focused coverage under `tests/unit/pxi/evals/online_evals/`. Runner-level tests
should assert the exact persisted annotation shape as well as failure,
not-applicable, sampling, and checkpoint behavior relevant to the evaluator.

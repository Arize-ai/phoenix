# PXI Optimization Loop

Use this when changing PXI behavior that is judged on the **assistant's output** (which tool it picks, what its text says, how it formats links) rather than purely on schema/wiring. The harness lives at `tests/pxi/evals/`; this guide is the loop you run *around* it.

## When To Use This Loop

Trigger this loop when a change touches:

- `src/phoenix/server/agents/prompts.py` (system-prompt rules or tool guidance).
- Tool descriptions / `when_to_use` lines that steer model behavior.
- Anything where "did this fix the failure or push it sideways?" is a real question.

Pure schema or wiring changes (new tool registration, type fix, refactor) do **not** need this loop — the existing unit tests are enough.

## The Loop

The loop is human-in-the-loop on purpose. **Never** silently iterate on prompts and re-run; surface each step to the user and wait for acknowledgement before the next change.

1. **Collect tough examples.** Write the prompts that *fail today* into a dataset YAML under `tests/pxi/evals/datasets/<topic>.yaml`. Cover adversarial cases, not just happy paths — ambiguous queries, queries that look like the wrong tool, queries that span multiple Phoenix areas. A dataset that only contains golden inputs proves nothing.
2. **Characterize failure modes.** Run the dataset against the current agent. For each failing case, name *why* it failed (e.g. "bare URL", "called bash on a definitional question", "leaked internal preview host"). Group similar failures — these become evaluator labels.
3. **Decide how to grade.** Pick an evaluator shape for each failure mode:
   - **Code evaluator** (`kind="code"`) when the property is mechanically checkable — URL prefixes, tool names called, argument shapes, link syntax. Prefer these; they're deterministic and cheap.
   - **LLM-as-judge** (`kind="llm"`) only when the property is genuinely linguistic (tone, helpfulness, hedging). Spell out the rubric in the prompt.
   Each evaluator returns `{score, label, explanation, metadata}` — distinct `label` values per failure mode let you read the experiment summary and see the failure distribution at a glance.
4. **Propose the change.** Write up: (a) the failure modes you observed, (b) the proposed prompt or tool change, (c) which evaluator labels it should move. **Stop here and surface this to the user.** Do not edit `prompts.py` until they acknowledge the diagnosis. The most expensive mistake is fixing the wrong failure mode.
5. **Re-run after acknowledgement.** Apply the change, re-run `run_experiment.py --dataset <topic>`, and report the label distribution before/after. Flag any new failure modes introduced — a fix that resolves one label by creating another is not a fix.
6. **Loop or land.** If failures remain and the diagnosis is unchanged, return to step 4 with a tightened proposal. If failures remain but the diagnosis has shifted, return to step 2 — don't keep proposing changes against a stale theory.

## File Layout

| File | Role |
| --- | --- |
| `tests/pxi/evals/datasets/<topic>.yaml` | Inputs + expectations. `dataset_name` matches the file stem. Examples have `input`, `expected`, and `metadata.category` for grouping. |
| `tests/pxi/evals/evaluators/<property>.py` | One code evaluator per scored property. Export both `evaluate_<property>` (pure function, easy to unit-test) and a `@create_evaluator(name=..., kind="code")` wrapper. |
| `tests/pxi/evals/evaluators/__init__.py` | Re-export the `@create_evaluator`-decorated function so `run_experiment.py` can import it. |
| `tests/pxi/evals/run_experiment.py` | Wires evaluators into the evaluator list passed to `evaluate_experiment`. Run with `--dataset <stem>`. |
| `tests/pxi/evals/test_evaluators.py` | Unit tests for the evaluator's labels — exercise every failure path you defined. |

## Conventions

- **Dataset name vs. evaluator name.** Datasets are named for the *inputs* (`documentation_questions`, `set_spans_filter`). Evaluators are named for the *property scored* (`documentation_links`, `correct_tools_called`, `tool_call_args_match`). They don't have to share a name and usually shouldn't — one dataset is often scored by several evaluators.
- **`not_applicable` label.** When an evaluator is wired into the global evaluator list but a given dataset's `expected` block doesn't carry its inputs, return `{"score": 1.0, "label": "not_applicable"}`. This lets evaluators stack without polluting unrelated suites.
- **Label precedence.** When multiple failure modes could fire on the same example, document the precedence in the evaluator's docstring (most-actionable first) and short-circuit in that order. Mixed labels are unreadable in summaries.
- **Metadata over prose.** Put URLs, tool names, and offending values into `metadata`. The `explanation` field is for humans skimming a failure; structured `metadata` is for filtering and trend analysis.

## Anti-Patterns

- **Don't** edit the prompt and re-run without first naming the failure modes you expect to move. You will end up chasing whichever case ran most recently.
- **Don't** delete failing examples to make the experiment green. If an example no longer reflects desired behavior, change its `expected` — and call that out in the PR.
- **Don't** reach for an LLM-as-judge evaluator when a regex or set membership check works. Code evaluators are reproducible across model versions; LLM judges aren't.
- **Don't** add only easy cases. A dataset that the agent already passes 100% on the first try is not protecting against regressions — it's confirming the status quo.

## Verification

- `uv run pytest tests/pxi/evals/test_evaluators.py` for evaluator unit tests.
- `uv run python -m tests.pxi.evals.run_experiment --dataset <topic>` against a local Phoenix for the full loop.

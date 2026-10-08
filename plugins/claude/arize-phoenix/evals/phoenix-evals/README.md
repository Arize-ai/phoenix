# phoenix-evals plugin evals

Behavioral tests for the `phoenix-evals` skill, run with `claude plugin eval`. They check
that the skill fires when a user needs help building, running, or validating evaluators, stays
quiet when the request belongs to another Phoenix skill, and that the evaluator or plan it
produces follows the skill's principles (uses `phoenix.evals` / `@arizeai/phoenix-evals`, code
first for deterministic checks, discrete labels over Likert scales, validates judges against
labeled data, gives runnable experiment and CI guidance).

These cases live in their own group directory so they can be selected apart from the
`phoenix-cli` cases in the sibling flat directories. Every input runs with the plugin and
without it, so the headline number is Δ (with-plugin minus without-plugin), not raw pass rate.

## Cases


| Case                          | Fire? | Lang       | What it checks                                                                                 |
| ----------------------------- | ----- | ---------- | ---------------------------------------------------------------------------------------------- |
| `01-rag-groundedness-judge`   | yes   | Python     | Builds a `ClassificationEvaluator` LLM judge with discrete labels; recommends validation       |
| `02-json-schema-code-eval`    | yes   | Python     | Code-first: a deterministic `@create_evaluator(kind="code")`, no LLM for a deterministic check |
| `03-run-evaluator-experiment` | yes   | Python     | Runnable `run_experiment` over a dataset with a task and evaluators                            |
| `04-validate-judge-labels`    | yes   | Python     | Measures judge/human agreement (confusion matrix, TPR/TNR) against a bar                       |
| `05-faithfulness-ci-gate`     | yes   | Python     | pytest `@pytest.mark.phoenix` gate: hard invariants asserted, LLM signal gated on an aggregate |
| `06-ts-relevance-judge`       | yes   | TypeScript | `createClassificationEvaluator` from `@arizeai/phoenix-evals`, discrete choices                |
| `07-neg-elixir-phoenix`       | no    | —          | Name collision: Elixir Phoenix + ExUnit "evaluate" — the evals skill must not fire             |
| `08-neg-generic-metric-q`     | no    | —          | A one-off BLEU question needing no Phoenix evaluator guidance                                  |




## Run

From the plugin directory (`plugins/claude/arize-phoenix`):

```bash
claude plugin eval . \
  --tag phoenix-evals \
  --ablation with-without \
  --judge-model claude-sonnet-5 \
  --allow-tools Write "Read(//$(git rev-parse --show-toplevel)/.agents/skills/**)"
```

Iterate on one case with `--case 06-ts-relevance-judge --runs 1`. The fire cases write a file
(`--allow-tools Write`) and the graders read it back via `target: {source: file, path: ...}`;
no case runs the file or reaches a live Phoenix, so no mock is needed.

## Grader conventions

Deterministic graders first (`file_exists`, `regex` over the written file and the final
message), then one `llm` grader **per claim** at `weight: 0.5` — the runner's judge fails
combined rubrics, so each claim is graded in isolation. `skill-fired` is reported under ablation
but not scored. The two negatives use `skill-not-used` (`tool: Skill`, `input_match: phoenix-evals`, `min: 0`, `max: 0`, `arm: both`); the match is the narrow `phoenix-evals`
because this suite asserts the `phoenix-evals` skill specifically stays quiet, not that no Phoenix skill fires at all.

## Record to Phoenix

A small post-processing script replays a run's JSON into Phoenix as an experiment (one dataset per suite, one example per case, each grader's pass/fail visible on its case). Point it at a running Phoenix:

```bash
cd plugins/claude/arize-phoenix
claude plugin eval . --tag phoenix-evals --ablation with-without \
  --judge-model claude-sonnet-5 --trust-plugin --no-publish \
  --json /tmp/pe.json \
  --allow-tools Write "Read(//$(git rev-parse --show-toplevel)/.agents/skills/**)"
# run with the project's Python (needs arize-phoenix-client): uv run, or the venv directly
uv run python evals/record_to_phoenix.py /tmp/pe.json   # or: ../../../.venv/bin/python …
```

`--endpoint` defaults to `$PHOENIX_COLLECTOR_ENDPOINT`, else `http://localhost:6006`.

Re-running upserts the dataset (stable example ids = case names) and adds a new experiment, so
runs accumulate for comparison over time. The script is generic; pass `--dataset-name` to record
another suite. CI auto-recording (a persistent Phoenix + secrets, as in `pxi-evals.yml`) is not
wired yet.
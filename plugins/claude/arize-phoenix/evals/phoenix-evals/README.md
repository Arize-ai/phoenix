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

## Baseline

Measured Oct 2026 in CI (3 runs per case, `--ablation with-without`, agent `claude-opus-4-8`,
`--judge-model claude-sonnet-5`): mean Δ **+0.44** over the fire cases (`-neg-` excluded). A
full run cost $18.93 and took 27 minutes.

| Case                             | With | Without | Δ     |
| -------------------------------- | ---- | ------- | ----- |
| `01-rag-groundedness-judge`      | 0.97 | 0.50    | +0.47 |
| `02-json-schema-code-eval`       | 1.00 | 1.00    | 0.00  |
| `03-run-evaluator-experiment`    | 0.89 | 0.44    | +0.44 |
| `04-validate-judge-labels`       | 0.94 | 0.56    | +0.39 |
| `05-faithfulness-ci-gate`        | 0.93 | 0.44    | +0.48 |
| `06-ts-relevance-judge`          | 1.00 | 0.29    | +0.71 |
| `09-fix-legacy-llm-classify`     | 1.00 | 0.83    | +0.17 |
| `10-fix-hallucination-threshold` | 1.00 | 0.13    | +0.87 |
| `07-neg-elixir-exunit`           | 1.00 | 1.00    | 0.00  |
| `08-neg-generic-metric-q`        | 1.00 | 1.00    | 0.00  |
| `11-neg-export-traces-dataframe` | 0.67 | 1.00    | −0.33 |

`02` is a regression guard only (both arms pass). `11` scored 0.67 only because its answer
regex accepted just `get_spans_dataframe`; it now also accepts `query_spans`, and the skill
never fired in either arm. The CI gate in `.github/workflows/plugin-evals.yml` is
`min_delta: 0.30`, `gate: block` — wider headroom than phoenix-cli's 0.10 because this is a
single measurement. Re-measure whenever the cases or the skill change materially.

## Cases


| Case                          | Fire? | Lang       | What it checks                                                                                 |
| ----------------------------- | ----- | ---------- | ---------------------------------------------------------------------------------------------- |
| `01-rag-groundedness-judge`   | yes   | Python     | Builds a `ClassificationEvaluator` LLM judge with discrete labels; recommends validation       |
| `02-json-schema-code-eval`    | yes   | Python     | Code evaluator via `@create_evaluator`: closed schema (extra keys fail), bool rejected as `age`, binds `output` |
| `03-run-evaluator-experiment` | yes   | Python     | Uploads the examples with `create_dataset`, binds `output`/`expected`, `run_experiment` with `repetitions` and an `experiment_name` |
| `04-validate-judge-labels`    | yes   | Python     | TPR/TNR against the bar, human–human agreement as the ceiling, class balance, 80 < 100 examples, inspects FP/FN |
| `05-faithfulness-ci-gate`     | yes   | Python     | pytest plugin (`phoenix.client.pytest`, stable `ids`): the model decides to assert the invariants and log faithfulness per case |
| `06-ts-relevance-judge`       | yes   | TypeScript | `createClassificationEvaluator` from `@arizeai/phoenix-evals`, discrete choices                |
| `07-neg-elixir-exunit`        | no    | —          | Name collision: Elixir Phoenix + ExUnit "evaluate" — the evals skill must not fire             |
| `08-neg-generic-metric-q`     | no    | —          | Corpus BLEU over 500 translations: a batch metric question that still needs no Phoenix evaluator |
| `09-fix-legacy-llm-classify`  | yes   | Python     | Migrates pasted legacy `llm_classify`/`OpenAIModel` code to the 2.0 `ClassificationEvaluator` + `evaluate_dataframe` API |
| `10-fix-hallucination-threshold` | yes | Python   | Fixes a pasted 2.0 check: `metrics` import, `_score` dict before `.mean()`, `context` ignored by `HallucinationEvaluator`, inverted threshold |
| `11-neg-export-traces-dataframe` | no  | —        | Pull spans into a dataframe just to look: `get_spans_dataframe`, no evaluator, the evals skill must not fire |




## Run

From the plugin directory (`plugins/claude/arize-phoenix`):

```bash
claude plugin eval . \
  --tag phoenix-evals \
  --ablation with-without \
  --judge-model claude-sonnet-5 \
  --allow-tools Write "Read(//$(pwd)/**)" "Read(//$(git rev-parse --show-toplevel)/.agents/skills/**)"
```

Iterate on one case with `--case 06-ts-relevance-judge --runs 1`. The fire cases write a file
(`--allow-tools Write`) and the graders read it back via `target: {source: file, path: ...}`;
no case runs the file or reaches a live Phoenix, so no mock is needed.

## Grader conventions

Deterministic graders first (`regex` over the written file and the final message; no
`file_exists`, since the prompt names the file and it would pass in both arms), then one `llm` grader **per claim** at `weight: 0.5` — the runner's judge fails
combined rubrics, so each claim is graded in isolation. `skill-fired` is reported under ablation
but not scored. The negatives use `skill-not-used` (`tool: Skill`, `input_match: phoenix-evals`, `min: 0`, `max: 0`, `arm: both`); the match is the narrow `phoenix-evals`
because this suite asserts the `phoenix-evals` skill specifically stays quiet, not that no Phoenix skill fires at all.

## Record to Phoenix

A small post-processing script replays a run's JSON into Phoenix as an experiment (one dataset per suite, one example per case, each grader's pass/fail visible on its case). Point it at a running Phoenix:

```bash
cd plugins/claude/arize-phoenix
claude plugin eval . --tag phoenix-evals --ablation with-without \
  --judge-model claude-sonnet-5 --trust-plugin --no-publish \
  --json /tmp/pe.json \
  --allow-tools Write "Read(//$(pwd)/**)" "Read(//$(git rev-parse --show-toplevel)/.agents/skills/**)"
# run with the project's Python (needs arize-phoenix-client): uv run, or the venv directly
uv run python evals/record_to_phoenix.py /tmp/pe.json   # or: ../../../.venv/bin/python …
```

`--endpoint` defaults to `$PHOENIX_ENDPOINT`, then `$PHOENIX_COLLECTOR_ENDPOINT`, else `http://localhost:6006`.

Re-running upserts the dataset (stable example ids = case names) and adds a new experiment, so
runs accumulate for comparison over time. The script is generic; pass `--dataset-name` to record
another suite. CI auto-recording (a persistent Phoenix + secrets, as in `pxi-evals.yml`) is not
wired yet.
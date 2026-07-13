# Integrations: pytest (Python)

Write evals as ordinary `pytest` tests that record to Phoenix as experiments and gate CI. Each marked test file → a dataset; each `parametrize` case → an example; each run → an experiment; the assert outcome → a `pass` annotation.

Requires `arize-phoenix-client>=2.10.0` (introduced `@pytest.mark.phoenix`).

## When to use vs `run_experiment`

Use the pytest plugin when each case needs different logic, you want a hard `assert` gate, or you already use pytest (keep fixtures, `parametrize`, `-k`, `pytest-xdist`, `pytest-asyncio`). Prefer `run_experiment` for large, homogeneous datasets scored the same way.

## Install

```bash
pip install "arize-phoenix-client[pytest]>=2.10.0" pytest
# add the evals extra if evaluators use arize-phoenix-evals:
pip install "arize-phoenix-client[pytest,evals]>=2.10.0" pytest
```

pytest discovers the plugin via its entry point — no `conftest.py` needed.

## Minimal suite

```python
import pytest
from phoenix.client.pytest import log_output

@pytest.mark.phoenix(dataset="qa-suite")
@pytest.mark.parametrize(
    "question,expected",
    [("Capital of France?", "Paris"), ("12 × 8?", "96")],
    ids=["geography", "arithmetic"],  # stable ids map reruns to the same example
)
def test_answers(question, expected):
    result = my_app(question)
    log_output(result)              # pytest warns on non-None return; log instead
    assert result == expected       # pass=True / pass=False annotation
```

Stable `parametrize` `ids` give each case a fixed identity so runs accumulate as experiments over a fixed example set instead of duplicating.

## The `@pytest.mark.phoenix` marker

| Argument | Description |
|---|---|
| `dataset` | Dataset/experiment name. Defaults to the test file's path relative to project root. |
| `evaluators` | Evaluators run automatically against every case (hoisted). |
| `repetitions` | Run each case N times to measure non-determinism (each is its own pytest item + experiment run). |

Dataset-name precedence: `PHOENIX_TEST_DATASET` env > `phoenix_dataset` in `pytest.ini` > marker `dataset=` > file path.

## Logging helpers

- `log_output(value)` — records the system output (any JSON-serializable value).
- `log_evaluation(name, score, label?, explanation?)` — records a named inline score.
- `evaluate(evaluator, **kwargs)` — runs an evaluator callable, records its result as an annotation, and returns it so you can `assert` on the score to gate the case.

Hoisted evaluators bind arguments **by parameter name**: `output` (from `log_output`), `input` (parametrized fields), `expected`/`reference`/`metadata` (parametrized fields of that name), `trace_id`. Any `arize-phoenix-evals` evaluator (`FaithfulnessEvaluator`, etc.) or any `run_experiment` function works unchanged. Every score is wrapped in its own evaluator span linked to the trace.

## Two kinds of checks: invariants vs. signals

The decision that shapes every eval suite is which checks gate CI and which only trend. Get this split right and the rest is plumbing.

- **Hard invariants** — exactly one acceptable behavior, verifiable in code (a required refusal, valid JSON, a tool that must fire). `assert` these. A failure records `pass=False` and turns CI red, like any unit test.
- **Quality signals** — answers that live on a spectrum with no single correct string (helpfulness, groundedness, tone). Score with an LLM judge and **`log_evaluation`/`evaluate` only** — do *not* `assert` per case. LLM output is non-deterministic, so one weak answer shouldn't break the build; watch the aggregate trend in Phoenix instead. Gate on the trend separately (e.g. a nightly threshold or `run_experiment`), not on every case.

Rule of thumb: assert the behavior you'd be embarrassed to ship broken; log everything else as a signal.

## LLM-as-a-judge inside a test

A judge is just an evaluator passed to `evaluate()` (or hoisted on the marker). The cleanest judge is a `create_classifier` from `arize-phoenix-evals`: it emits a label mapped to a numeric score plus an explanation, recorded as its own annotation under a linked evaluator span. `evaluate(judge, **kwargs)` fills the prompt-template variables from `kwargs` — pass the judge only what it needs to grade. The judge runs on its own model, configured independently of the system under test (see configuring the judge LLM).

```python
import time

import pytest
from phoenix.client.pytest import evaluate, log_evaluation, log_output
from phoenix.evals import LLM, create_classifier

# Judge reads just the question + response; the evaluate() kwargs fill these vars.
helpfulness = create_classifier(
    name="helpfulness",
    llm=LLM(provider="anthropic", model="claude-sonnet-4-6"),
    prompt_template=(
        "Question: {{question}}\n\nResponse: {{response}}\n\n"
        'Label "helpful" if it accurately answers the question, else "unhelpful".'
    ),
    choices={"helpful": 1.0, "unhelpful": 0.0},
)

CASES = [
    ("How do I get a refund?", False),
    ("What's the capital of France?", True),  # off-topic → must refuse
]

@pytest.mark.phoenix(dataset="support-bot")
@pytest.mark.parametrize("question,expect_refusal", CASES, ids=["refund", "offtopic"])
def test_support_response(question, expect_refusal):
    t0 = time.perf_counter()
    response = answer_question(question)
    log_output({"response": response})

    log_evaluation(name="latency_ms", score=(time.perf_counter() - t0) * 1000)  # CODE signal

    if expect_refusal:
        assert "I don't have information on that" in response  # hard invariant → gates CI
    else:
        # Quality signal — judged, NOT asserted. Helpfulness only means something
        # for answerable questions, so judge here; it trends in Phoenix.
        evaluate(helpfulness, question=question, response=response)
```

Refusal = invariant (asserted → gates CI); helpfulness + latency = signals (logged → trended). Judge only the cases where quality is meaningful. To gate CI on a judge anyway, capture its score and assert: `result = evaluate(judge, ...); assert result["score"] == 1.0` — reserve for invariants a code check can't express. For *groundedness*, add a `{{context}}` var and pass `context=...`, or use the pre-built `FaithfulnessEvaluator`.

## Environment variables

| Variable | Default | Purpose |
|---|---|---|
| `PHOENIX_COLLECTOR_ENDPOINT` | — | Phoenix server URL |
| `PHOENIX_API_KEY` | — | Bearer token |
| `PHOENIX_CLIENT_HEADERS` | — | Optional JSON headers |
| `PHOENIX_TEST_TRACKING` | `true` | Set `0`/`false` to run offline (tests execute, nothing uploaded) |
| `PHOENIX_TEST_REPETITIONS` | `1` | Default repetitions per marked test |
| `PHOENIX_TEST_DATASET` | _(file path)_ | Override dataset name for all collected tests |

Iterate locally without recording: `PHOENIX_TEST_TRACKING=0 pytest tests/evals/`.

## Dataset sync

- **Full run** (no filter): updates the dataset to match collected cases exactly, pruning examples for deleted tests.
- **Partial run** (`-k`, `-m`, a file, or `::node`): only appends, leaving unselected examples in place.

Two concurrent full runs writing the same dataset name can prune each other — give parallel CI jobs distinct names: `PHOENIX_TEST_DATASET=evals-${GIT_BRANCH}`.

## Parallel runs

`pytest -n auto` (pytest-xdist) is supported: the controller creates the dataset/experiment once and distributes IDs to workers. Exactly one experiment regardless of worker count.

## CI gate (GitHub Actions)

No extra config — pytest exits `1` on any failure. Uploads to Phoenix are best-effort (a Phoenix outage warns, never fails the build).

```yaml
name: eval-ci
on:
  pull_request:
jobs:
  evals:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"
      - run: pip install "arize-phoenix-client[pytest,evals]" pytest
      - name: Run eval suite
        env:
          PHOENIX_COLLECTOR_ENDPOINT: ${{ secrets.PHOENIX_COLLECTOR_ENDPOINT }}
          PHOENIX_API_KEY: ${{ secrets.PHOENIX_API_KEY }}
        run: pytest tests/evals/
```

# Gate CI with pytest

Write evals as ordinary `pytest` tests that record to Phoenix as experiments and gate CI. The plugin maps pytest onto Phoenix like this:

- Each marked test file becomes a dataset.
- Each `parametrize` case becomes an example.
- Each pytest run becomes an experiment.
- Each assert outcome becomes a `pass` annotation.

Requires `arize-phoenix-client>=2.10.0`, the version that introduced `@pytest.mark.phoenix`.

## When to use the plugin instead of `run_experiment`

Use the pytest plugin when each case needs different logic, when you want a hard `assert` gate, or when you already use pytest and want to keep fixtures, `parametrize`, `-k`, `pytest-xdist`, and `pytest-asyncio`. Prefer `run_experiment` for large datasets where every example is scored the same way.

## Install

```bash
pip install "arize-phoenix-client[pytest]>=2.10.0" pytest
# Add the evals extra if evaluators use arize-phoenix-evals:
pip install "arize-phoenix-client[pytest,evals]>=2.10.0" pytest
```

pytest discovers the plugin through its entry point, so you don't need a `conftest.py`.

## Minimal suite

```python
import pytest
from phoenix.client.pytest import log_output

@pytest.mark.phoenix(dataset="qa-suite")
@pytest.mark.parametrize(
    "question,expected",
    [("Capital of France?", "Paris"), ("12 × 8?", "96")],
    ids=["geography", "arithmetic"],  # Stable IDs map reruns to the same example.
)
def test_answers(question, expected):
    result = my_app(question)
    log_output(result)              # pytest warns when a test returns a value, so log it instead.
    assert result == expected       # Records pass=True or pass=False.
```

Stable `parametrize` `ids` give each case a fixed identity. Reruns then add experiments over the same set of examples instead of creating duplicate examples.

## The `@pytest.mark.phoenix` marker

| Argument | Description |
|---|---|
| `dataset` | The dataset and experiment name. Defaults to the test file's path relative to the project root. |
| `evaluators` | Evaluators that run automatically against every case. These are called hoisted evaluators. |
| `repetitions` | Runs each case N times to measure non-determinism. Each repetition is its own pytest item and its own experiment run. |

The dataset name comes from the first of these that is set: the `PHOENIX_TEST_DATASET` environment variable, `phoenix_dataset` in `pytest.ini`, the marker's `dataset=`, then the file path.

## Logging helpers

- `log_output(value)`: records the system output. Any JSON-serializable value works.
- `log_evaluation(name, score, label?, explanation?)`: records a named inline score.
- `evaluate(evaluator, **kwargs)`: runs an evaluator callable, records its result as an annotation, and returns the result so you can `assert` on the score to gate the case.

Hoisted evaluators bind arguments by parameter name:

- `output` comes from `log_output`.
- `input` holds the parametrized fields.
- `expected`, `reference`, and `metadata` come from parametrized fields with those names.
- `trace_id` is also available.

Any `arize-phoenix-evals` evaluator, such as `FaithfulnessEvaluator`, and any function that works with `run_experiment` work here unchanged. Each score is recorded in its own evaluator span, linked to the test's trace.

## Two kinds of checks: invariants and signals

Every eval suite has to decide which checks gate CI and which only show a trend. Most of the suite design follows from that split.

- **Hard invariants.** Behavior with exactly one acceptable outcome that code can verify, such as a required refusal, valid JSON, or a tool that must be called. `assert` these. A failure records `pass=False` and fails CI, like any unit test.
- **Quality signals.** Answers that can be better or worse with no single correct string, such as helpfulness, groundedness, or tone. Score them with an LLM judge and record them with `log_evaluation` or `evaluate` only. Don't `assert` on them per case. LLM output is non-deterministic, so one weak answer shouldn't break the build. Watch the aggregate trend in Phoenix instead, and gate on the trend separately, for example with a nightly threshold or `run_experiment`, not on every case.

As a rule of thumb, assert the behavior you'd be embarrassed to ship broken, and log everything else as a signal.

## LLM-as-a-judge inside a test

A judge is an evaluator that you pass to `evaluate()` or hoist on the marker. A `create_classifier` or `ClassificationEvaluator` from `arize-phoenix-evals` returns a label mapped to a numeric score, plus an explanation. Phoenix records the result as its own annotation under a linked evaluator span. `evaluate(judge, **kwargs)` fills the prompt-template variables from `kwargs`. Pass the judge only what it needs to grade. The judge runs on its own model, configured separately from the system under test. For setup, see phoenix-evals.

```python
import time

import pytest
from phoenix.client.pytest import evaluate, log_evaluation, log_output
from phoenix.evals import LLM, create_classifier

# The judge sees only the question and response, which the evaluate() kwargs fill in.
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
    ("What's the capital of France?", True),  # Off-topic, so the bot must refuse.
]

@pytest.mark.phoenix(dataset="support-bot")
@pytest.mark.parametrize("question,expect_refusal", CASES, ids=["refund", "offtopic"])
def test_support_response(question, expect_refusal):
    t0 = time.perf_counter()
    response = answer_question(question)
    log_output({"response": response})

    log_evaluation(name="latency_ms", score=(time.perf_counter() - t0) * 1000)  # Code-based signal.

    if expect_refusal:
        assert "I don't have information on that" in response  # Hard invariant that gates CI.
    else:
        # Quality signal: judged, not asserted. Helpfulness only means something
        # for answerable questions, so judge here and let it trend in Phoenix.
        evaluate(helpfulness, question=question, response=response)
```

In this test, the refusal is an invariant, so it's asserted and gates CI. Helpfulness and latency are signals, so they're logged and trended. Judge only the cases where quality is meaningful.

To gate CI on a judge anyway, capture its score and assert on it: `scores = evaluate(judge, ...); assert scores[0].score == 1.0`. A `phoenix.evals` evaluator returns a list of `Score` objects. Reserve this for invariants that a code check can't express.

To judge groundedness, add a `{{context}}` variable and pass `context=...`, or use the pre-built `FaithfulnessEvaluator`.

## Environment variables

| Variable | Default | Purpose |
|---|---|---|
| `PHOENIX_ENDPOINT` | none | Phoenix base URL |
| `PHOENIX_API_KEY` | none | Bearer token |
| `PHOENIX_CLIENT_HEADERS` | none | Optional JSON headers |
| `PHOENIX_TEST_TRACKING` | `true` | Set to `0` or `false` to run offline. Tests run, and nothing is uploaded. |
| `PHOENIX_TEST_REPETITIONS` | `1` | Default repetitions per marked test |
| `PHOENIX_TEST_DATASET` | _(file path)_ | Overrides the dataset name for all collected tests |

To iterate locally without recording, run `PHOENIX_TEST_TRACKING=0 pytest tests/evals/`.

## Dataset sync

- **Full run**, with no filter: updates the dataset to match the collected cases exactly, and prunes examples whose tests were deleted.
- **Partial run**, with `-k`, `-m`, a file, or `::node`: only appends, and leaves unselected examples in place.

Two concurrent full runs that write to the same dataset name can prune each other's examples. Give parallel CI jobs distinct names, for example `PHOENIX_TEST_DATASET=evals-${GIT_BRANCH}`.

## Parallel runs

The plugin supports `pytest -n auto` with pytest-xdist. The controller creates the dataset and experiment once and distributes their IDs to the workers, so a run produces exactly one experiment regardless of worker count.

## CI gate with GitHub Actions

The gate needs no extra configuration. pytest exits with `1` on any failure. Uploads to Phoenix are best-effort: if Phoenix is down, the plugin warns but never fails the build.

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
      - run: pip install "arize-phoenix-client[pytest,evals]>=2.10.0" pytest
      - name: Run eval suite
        env:
          PHOENIX_ENDPOINT: ${{ secrets.PHOENIX_ENDPOINT }}
          PHOENIX_API_KEY: ${{ secrets.PHOENIX_API_KEY }}
        run: pytest tests/evals/
```

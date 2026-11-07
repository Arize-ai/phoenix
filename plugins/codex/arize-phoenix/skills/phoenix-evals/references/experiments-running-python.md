# Experiments: Running Experiments in Python

Execute experiments with `run_experiment`.

## Basic Usage

```python
from phoenix.client import Client
from phoenix.client.experiments import run_experiment
from openai import OpenAI

client = Client()
openai_client = OpenAI()

# Replace these sample rows with your local QA examples.
qa_examples = [
    {"question": "What is 2+2?", "expected": "4"},
    {"question": "What is the capital of France?", "expected": "Paris"},
]
dataset = client.datasets.create_dataset(
    name="qa-test-v1",
    examples=[
        {"input": {"question": row["question"]}, "output": {"answer": row["expected"]}}
        for row in qa_examples
    ],
)

def my_task(example):
    response = openai_client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": example.input["question"]}],
    )
    return response.choices[0].message.content or ""

def exact_match(output, expected):
    return 1.0 if output.strip().lower() == expected["answer"].strip().lower() else 0.0

experiment = run_experiment(
    dataset=dataset,
    task=my_task,
    evaluators=[exact_match],
    experiment_name="qa-experiment-v1",
    repetitions=3,  # Average sampling noise from the LLM task on a small dataset
)
```

`expected` is the dataset example's entire `output` dictionary, not a flattened answer. Here, local `row["expected"]` is stored as `output["answer"]`, so the evaluator reads `expected["answer"]`. If you store it under `output["expected"]` instead, read `expected["expected"]`. When adapting an existing evaluator that takes two strings, wrap it as `def qa_evaluator(output, expected): return existing_evaluator(output, expected["answer"])` and pass the wrapper to `run_experiment`.

## Task Functions

```python
# Basic task
def task(example):
    return call_llm(example.input["question"])

# With context (RAG)
def rag_task(example):
    return call_llm(f"Context: {example.input['context']}\nQ: {example.input['question']}")
```

## Evaluator Parameters

| Parameter | Access |
| --------- | ------ |
| `output` | Task output |
| `expected` | Entire example output dictionary; select the key used when creating the dataset |
| `input` | Example input |
| `metadata` | Example metadata |

## Options

```python
experiment = run_experiment(
    dataset=dataset,
    task=my_task,
    evaluators=evaluators,
    experiment_name="my-experiment",
    dry_run=3,       # Test with 3 examples
    repetitions=3,   # Run each example 3 times
)
```

## Results

```python
print(experiment["experiment_id"])

for run in experiment["task_runs"]:
    print(run["output"])
```

`run_experiment` prints a summary by default. View aggregate scores and compare named experiments in the Phoenix UI. The returned `RanExperiment` is a dictionary with `task_runs` and `evaluation_runs`; it has no `aggregate_scores` or `runs` attributes.

## Stability

Single-run scores are noisy when either the task or the evaluator is non-deterministic — an LLM call, tool use, streaming output, an LLM-as-judge. On a small dataset, that per-run noise can swamp the signal from a prompt change.

Averaging over repetitions lets the score you report reflect the prompt rather than the sampling noise:

```python
run_experiment(
    # ...
    repetitions=3,
)
```

Things to consider:

- Reach for repetitions when the task or the evaluator is an LLM call and the dataset is small.
- Prefer repetitions when per-example cost is low and you mostly want to settle the score; prefer growing the dataset when you also need to cover more behaviors.
- Skip repetitions when both the task and the evaluator are deterministic (e.g. string comparison against a ground truth) — a single run is the answer.

Consider adding stability when:

- Repeat runs of the same experiment drift in ways that feel larger than the differences you're trying to measure.
- A prompt change flips example labels in ways that don't track with how the outputs actually changed.
- The judge's reasoning on the same output reads differently from one run to the next.

Repetitions are also what `repetitions=1` (default) silently relies on — don't trust a tuning decision based on a single 10-example run.

## Add Evaluations Later

```python
from phoenix.client.experiments import evaluate_experiment

evaluate_experiment(experiment=experiment, evaluators=[new_evaluator])
```

`evaluate_experiment` scores every run again and overwrites evaluations of the same name. To score only the runs still missing an evaluation, use `resume_evaluation` (below).

## Resume an Interrupted Experiment

When a run crashed, hit a provider outage, or was interrupted, finish it instead of starting over:

```python
client = Client()

# Re-runs the task only for (example, repetition) pairs with no successful run,
# then applies evaluators to runs missing that evaluation.
client.experiments.resume_experiment(
    experiment_id="experiment-id",
    task=my_task,
    evaluators=[exact_match],
)

# All tasks finished, but some evaluations are missing or failed —
# or you want to add a new evaluator to a finished experiment.
client.experiments.resume_evaluation(
    experiment_id="experiment-id",
    evaluators={"exact_match": exact_match},
)
```

- `resume_evaluation` matches evaluators to existing evaluations by name, so each evaluator should return a single result whose name matches its key. Evaluators that return a list of results re-run on every call.
- When `resume_experiment` replaces an errored run, the run keeps its ID; LLM and code evaluations on it are discarded and re-scored, human annotations are kept. Requires Phoenix server >= 20.21.3.
- Both also exist on `AsyncClient` (with a `concurrency` parameter).

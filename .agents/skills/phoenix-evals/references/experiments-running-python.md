# Experiments: Running Experiments in Python

Execute experiments with `run_experiment`.

## Basic Usage

```python
from phoenix.client import Client
from phoenix.client.experiments import run_experiment

client = Client()
dataset = client.datasets.get_dataset(name="qa-test-v1")

def my_task(example):
    return call_llm(example.input["question"])

def exact_match(output, expected):
    return 1.0 if output.strip().lower() == expected["answer"].strip().lower() else 0.0

experiment = run_experiment(
    dataset=dataset,
    task=my_task,
    evaluators=[exact_match],
    experiment_name="qa-experiment-v1",
)
```

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
| `expected` | Example expected output |
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
print(experiment.aggregate_scores)
# {'accuracy': 0.85, 'faithfulness': 0.92}

for run in experiment.runs:
    print(run.output, run.scores)
```

## Stability

Single-run scores are noisy when either the task or the evaluator is non-deterministic (an LLM call, tool use, streaming output, an LLM-as-judge). On a small dataset, run-to-run spread of 0.15-0.25 is common and will swamp the signal from a prompt change.

Average over repetitions so the score you report reflects the prompt, not the sampling noise:

```python
run_experiment(
    # ...
    repetitions=3,
)
```

Rules of thumb:

- **Always set `repetitions=3+`** when the task OR the evaluator is an LLM call, and the dataset has fewer than ~30 examples.
- **Repetitions over bigger datasets** when per-example cost is low. 10 examples × 3 reps stabilizes most judges; growing the dataset is more work and adds coverage, not stability.
- **Larger dataset over repetitions** when you need to cover more behaviors, not just reduce noise.
- **No repetitions needed** when task and evaluator are both deterministic (e.g., string comparison against a ground truth). One run is the answer.

Signals you need more stability:

- Two identical runs produce scores more than 0.10 apart.
- A prompt change flips an example between pass/fail but the outputs look equivalent.
- The judge's rationale contradicts itself across runs on the same output.

Repetitions are also what `repetitions=1` (default) silently relies on — don't trust a tuning decision based on a single 10-example run.

## Add Evaluations Later

```python
from phoenix.client.experiments import evaluate_experiment

evaluate_experiment(experiment=experiment, evaluators=[new_evaluator])
```

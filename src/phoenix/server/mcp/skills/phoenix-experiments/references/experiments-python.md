# Experiments in Python

## Run an experiment

```python
from openai import OpenAI

from phoenix.client import Client
from phoenix.evals import LLM, ClassificationEvaluator, create_evaluator

client = Client()
openai_client = OpenAI()
dataset = client.datasets.get_dataset(dataset="recipe-faq")


def answer(input):
    response = openai_client.chat.completions.create(
        model="gpt-6-luna",
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": input["question"]},
        ],
    )
    return response.choices[0].message.content or ""


@create_evaluator(name="under_100_words")
def under_100_words(output: str) -> bool:
    return len(output.split()) <= 100


matches_reference = ClassificationEvaluator(
    name="matches_reference",
    llm=LLM(provider="openai", model="gpt-4o"),
    prompt_template=(
        "Reference answer: {{expected.answer}}\nCandidate answer: {{output}}\n"
        '"match": the candidate gives the same decision and facts as the reference.\n'
        '"mismatch": it contradicts the reference or leaves out its decision.'
    ),
    choices={"match": 1.0, "mismatch": 0.0},
)

experiment = client.experiments.run_experiment(
    dataset=dataset,
    task=answer,
    evaluators=[under_100_words, matches_reference],
    experiment_name="system-prompt-v2",
    experiment_description="Asks for shorter answers in the system prompt",
    experiment_metadata={"prompt_version": "v2", "model": "gpt-6-luna"},
    repetitions=3,
)
```

`dataset` must be a `Dataset` object from `get_dataset` or `create_dataset`, not a
name.

### Task and evaluator arguments

Phoenix passes values by parameter name:

| Name | Value |
| ---- | ----- |
| `input` | the example's `input` dict |
| `expected` (or `reference`) | the example's reference `output` dict |
| `metadata` | the example's `metadata` dict |
| `example` | the whole example |
| `output` | the task's return value (evaluators only) |

A task with one parameter that isn't one of these names gets `input`. `expected` is
the whole output dict, so read `expected["answer"]`, not `expected`. Evaluators from
`phoenix.evals` read template variables and parameters the same way; use dotted
paths such as `{{expected.answer}}` or `bind_evaluator` to reach nested keys.

Plain functions also work as evaluators. They can return a bool, a number, a label
string, a dict with `score`, `label`, and `explanation`, or a `Score`.

### Options

| Option | Default | Use |
| ------ | ------- | --- |
| `repetitions` | 1 | Runs each example several times. Consider 3 or more when nondeterminism matters to the decision. |
| `dry_run` | `False` | `True` or a number runs that many examples without recording anything. |
| `timeout` | 60 | Seconds per task call. |
| `retries` | 3 | Retries for a failing task call. |
| `rate_limit_errors` | none | Exception types to back off on, such as `openai.RateLimitError`. |
| `print_summary` | `True` | Prints per-evaluator results when the run ends. |

`AsyncClient().experiments.run_experiment` takes the same arguments plus
`concurrency` (default 3), and accepts async tasks.

## Test a prompt stored in Phoenix

To try a new version of a prompt the app loads from Phoenix, create the version,
then run the task with it:

```python
from phoenix.client.types import PromptVersion

baseline = client.prompts.get(prompt_identifier="recipe-answer", tag="production")
candidate = client.prompts.create(
    name="recipe-answer",
    version=PromptVersion(
        [{"role": "system", "content": NEW_SYSTEM_PROMPT}, {"role": "user", "content": "{{question}}"}],
        model_name="gpt-6-luna",
        model_provider="OPENAI",
    ),
)


def answer_with(prompt_version):
    def task(input):
        formatted = prompt_version.format(variables={"question": input["question"]})
        response = openai_client.chat.completions.create(**formatted)
        return response.choices[0].message.content or ""

    return task


client.experiments.run_experiment(
    dataset=dataset,
    task=answer_with(candidate),
    evaluators=[under_100_words, matches_reference],
    experiment_name="recipe-answer-candidate",
    experiment_metadata={"prompt_version_id": candidate.id},
    repetitions=3,
)
```

Record the prompt version ID in `experiment_metadata` so readers know which version
each experiment ran. Tag the new version (`client.prompts.tags.create(...)`) only
when the user decides to ship it.

## Read the results

`run_experiment` returns a `RanExperiment` dict:

| Key | Holds |
| --- | ----- |
| `experiment_id`, `dataset_id`, `dataset_version_id` | IDs |
| `task_runs` | one dict per run: `id`, `dataset_example_id`, `repetition_number`, `output`, `error` |
| `evaluation_runs` | one object per evaluation: `experiment_run_id`, `name`, `result` (`score`, `label`, `explanation`), `error` |

It has no `aggregate_scores` or `pass_rate`. Compute rates from `evaluation_runs`;
see [compare-experiments](compare-experiments.md).

```python
experiment = client.experiments.get_experiment(experiment_id="EXPERIMENT_ID")
all_for_dataset = client.experiments.list(dataset_id=dataset.id)
```

## Add evaluations later, or finish an interrupted run

```python
client.experiments.evaluate_experiment(experiment=experiment, evaluators=[new_check])

client.experiments.resume_experiment(
    experiment_id="EXPERIMENT_ID", task=answer, evaluators=[under_100_words]
)
client.experiments.resume_evaluation(
    experiment_id="EXPERIMENT_ID", evaluators=[matches_reference]
)
```

- `evaluate_experiment` scores every run again and replaces evaluations with the same
  name.
- `resume_experiment` reruns only the runs that are missing or failed, then fills in
  missing evaluations. On servers older than 20.21.3, a replaced run keeps its stale evaluations.
- `resume_evaluation` runs evaluators only where that evaluation is missing or
  failed, matching by evaluator name.

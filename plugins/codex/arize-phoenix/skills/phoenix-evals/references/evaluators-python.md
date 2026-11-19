# Evaluators in Python

Every evaluator has a name, takes a dict of inputs, and returns a list of `Score`
objects. The same evaluator works in `evaluate_dataframe`, in `run_experiment`, and
in the pytest plugin.

## Code evaluators

Decorate a function with `create_evaluator`. Its parameter names are the input keys
it reads.

```python
import json
import re

from phoenix.evals import create_evaluator


@create_evaluator(name="has_citation")
def has_citation(output: str) -> bool:
    return bool(re.search(r"\[\d+\]", output))


@create_evaluator(name="valid_json")
def valid_json(output: str) -> dict:
    try:
        json.loads(output)
        return {"score": 1.0, "label": "valid"}
    except json.JSONDecodeError as error:
        return {"score": 0.0, "label": "invalid", "explanation": str(error)}
```

The return value becomes a `Score`:

| Return | Result |
| ------ | ------ |
| `bool` | `score` 1.0 or 0.0, `label` `"True"` or `"False"` |
| `int` or `float` | `score` |
| Short `str` (3 words or fewer) | `label` |
| Longer `str` | `explanation` |
| `dict` with `score`, `label`, `explanation`, `metadata` | those fields |
| `Score` | as is |

`create_evaluator` takes `name`, `direction` (`"maximize"` by default,
`"minimize"`, or `"neutral"`), and `kind` (`"code"` by default). It never calls a
model, so a function marked `kind="llm"` must make the call itself. For a model-graded check, use
`ClassificationEvaluator`.

`phoenix.client.experiments` also exports a `create_evaluator`, with a different
signature, for experiment-only evaluators. Import from `phoenix.evals` unless you
need the client one.

## LLM classification evaluators

`ClassificationEvaluator` renders a prompt template, asks the model to pick one
label with structured output, and maps the label to a score.

```python
from phoenix.evals import LLM, ClassificationEvaluator

GROUNDED_TEMPLATE = """You are checking whether an answer is supported by its sources.

<sources>{{context}}</sources>
<answer>{{output}}</answer>

"grounded": every factual claim in the answer appears in the sources.
"ungrounded": at least one factual claim is missing from or contradicts the sources.
A refusal or "I don't know" with no factual claims is "grounded"."""

grounded = ClassificationEvaluator(
    name="grounded",
    llm=LLM(provider="openai", model="gpt-4o"),
    prompt_template=GROUNDED_TEMPLATE,
    choices={"grounded": 1.0, "ungrounded": 0.0},
)

scores = grounded.evaluate({"context": "Paris is in France.", "output": "Paris is in France."})
print(scores[0].label, scores[0].score, scores[0].explanation)
```

- Template variables use `{{name}}` (Mustache). Each variable is a key the evaluator
  reads from its input.
- `choices` is a list of labels, a dict of label to score, or a dict of label to a
  `(score, description)` tuple.
- `include_explanation=True` (the default) asks the model for a short explanation
  before the label.
- `direction="minimize"` marks an evaluator where 1.0 is the bad outcome, such as
  `{"leaks_pii": 1.0, "clean": 0.0}`.
- `prompt_template` also accepts a list of `{"role": ..., "content": ...}` messages.
  To reuse a prompt stored in Phoenix, convert it with
  `phoenix_prompt_to_prompt_template`.
- Unknown keyword arguments go to the LLM client. A typo such as
  `include_explanations=True` raises only when the first request runs.

`create_classifier(name=..., prompt_template=..., llm=..., choices=...)` is a shorter
factory for the same object. The two are interchangeable; use the class when you need
`include_explanation`, `input_schema`, or a message-list template.

### Decision models

Any `ClassificationEvaluator`, including the pre-built ones, accepts a
`DecisionModel` in place of `LLM`. A decision model picks a label directly instead of
generating text. It's cheaper and faster for high-volume labeling, but returns no
explanation and can't reason step by step.

```python
from phoenix.evals import ClassificationEvaluator, DecisionModel

sentiment = ClassificationEvaluator(
    name="sentiment",
    llm=DecisionModel(provider="typesafe", model="jev-latest"),
    prompt_template="Classify the sentiment: {{text}}",
    choices={"positive": 1.0, "neutral": 0.5, "negative": 0.0},
)
```

`metadata["probabilities"]` on the returned score maps each label to its probability.
This example requires `pip install typesafe-sdk`.

## Map your field names to the evaluator's

An evaluator reads keys by name. When your data uses other names, bind a mapping
instead of renaming your data. Values are keys, dotted paths into nested dicts, or
functions.

```python
from phoenix.evals import bind_evaluator

bound = bind_evaluator(
    evaluator=grounded,
    input_mapping={
        "context": "retrieved_text",
        "output": "response.answer",
        "input": lambda row: row["question"].strip(),
    },
)
```

`bind_evaluator` returns a copy. `grounded.bind(input_mapping)` changes the evaluator
in place.

## Scores

`Score` has `name`, `score`, `label`, `explanation`, `metadata`, `direction`, and
`kind`. Every field except `name` is optional. Use `score.to_dict()` when you need a
plain dict, for example to return a score from an experiment task.

`evaluate()` and `async_evaluate()` return a list because one evaluator can produce
several scores (for example, precision, recall, and F1). Read `scores[0]` for
single-score evaluators.

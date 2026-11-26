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

NumPy scalars such as `np.int64`, `np.float32`, and `np.bool_` become Python
values first, including inside tuples and a dict's `score`, so values computed with
NumPy or pandas need no cast.

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

- Template variables use `{{name}}` (Mustache). Each top-level variable is a key the
  evaluator reads from its input. See the next section for lists and nested fields.
- `choices` is a list of labels or a dict of label to score.
- `include_explanation=True` (the default) asks the model for a short explanation
  before the label.
- `direction="minimize"` marks an evaluator where 1.0 is the bad outcome, such as
  `{"leaks_pii": 1.0, "clean": 0.0}`.
- `prompt_template` also accepts a list of `{"role": ..., "content": ...}` messages.
  To reuse a prompt stored in Phoenix, convert it with
  `phoenix_prompt_to_prompt_template`.
- Unknown keyword arguments go to the LLM client. A typo such as
  `include_explanations=True` raises only when the first request runs.

Prefer the `ClassificationEvaluator` class. `create_classifier` is a shortcut that
builds the same object from a subset of its options, without `include_explanation`,
`input_schema`, or a message-list template.

### Format structured inputs in the template

Templates support full Mustache, so a template can loop over a list and read nested
fields. This turns structured data, such as a session's turns, into a transcript the
judge can read, without preformatting the data in code:

```python
from phoenix.evals import LLM, ClassificationEvaluator

RESOLVED_TEMPLATE = """You are checking whether a support conversation resolved the customer's issue.

<conversation>
{{#turns}}
{{role}}: {{content}}
{{/turns}}
</conversation>

"resolved": the customer's last request was answered or completed.
"unresolved": the conversation ends with a request still open."""

resolved = ClassificationEvaluator(
    name="resolved",
    llm=LLM(provider="openai", model="gpt-4o"),
    prompt_template=RESOLVED_TEMPLATE,
    choices={"resolved": 1.0, "unresolved": 0.0},
)
resolved.evaluate(
    {
        "turns": [
            {"role": "user", "content": "Where is my order?"},
            {"role": "assistant", "content": "It arrives Tuesday."},
        ]
    }
)
```

`{{#turns}}...{{/turns}}` repeats once per item, and `{{reply.text}}` reads a nested
key. Combine this with an input mapping, described below, when the list lives under a
different name in your data.

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
Decision models come from several providers, such as OpenAI and TypeSafe, and each
needs its provider's SDK. To see which providers are installed and configured, run
`show_decision_provider_availability()` from `phoenix.evals.decision`. See
[Configuring the decision model](https://arize.com/docs/phoenix/evaluation/how-to-evals/configuring-the-decision-model).

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

## Evaluate a dataframe

`evaluate_dataframe` and `async_evaluate_dataframe` run evaluators over every row of
a pandas dataframe whose column names match the evaluators' input names, or that an
input mapping adapts. They work on any records, such as an exported file, a dataset,
or spans read from Phoenix.

```python
import pandas as pd

from phoenix.evals import async_evaluate_dataframe

eval_df = pd.DataFrame(
    {
        "context": ["Paris is in France.", "Rome is in Italy."],
        "output": ["Paris is in France.", "Rome is in Spain."],
    }
)
results_df = await async_evaluate_dataframe(
    dataframe=eval_df,
    evaluators=[grounded, has_citation],
    concurrency=5,
    exit_on_error=False,
)
```

- `concurrency` defaults to 3. `evaluate_dataframe` is the synchronous version,
  without `concurrency`.
- Both retry a failing row up to `max_retries` times (default 10). With
  `exit_on_error=True`, the default, the run stops at the first row that runs out
  of retries. Pass `False` to keep going and count the failures.
- The result is a copy of the input, with the same index, and two columns per score:

| Column | Holds |
| ------ | ----- |
| `{score_name}_score` | a dict: `{"name", "score", "label", "explanation", "direction", ...}` |
| `{evaluator_name}_execution_details` | a dict: `{"status", "exceptions", "execution_seconds"}`; `status` is `COMPLETED`, `COMPLETED WITH RETRIES`, `FAILED`, or `DID NOT RUN` |

The score columns hold dicts, so `results_df["grounded_score"].mean()` fails. Read
the fields out, and count the rows that didn't run:

```python
labels = results_df["grounded_score"].apply(lambda s: s.get("label") if isinstance(s, dict) else None)
failed = results_df[labels == "ungrounded"]
errored = results_df[
    results_df["grounded_execution_details"].apply(lambda d: d.get("status") in ("FAILED", "DID NOT RUN"))
]
```

See [Batch evaluations](https://arize.com/docs/phoenix/evaluation/how-to-evals/batch-evaluations)
for concurrency and rate limits, and the
[Phoenix evals docs](https://arize.com/docs/phoenix/evaluation/llm-evals) for the
full API.

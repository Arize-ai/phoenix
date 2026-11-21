# Pre-built evaluators

Pre-built evaluators are LLM judges with tested prompts for common failures. Import
them from `phoenix.evals.metrics` in Python (`<Name>Evaluator`, constructed with
`llm=`) and from `@arizeai/phoenix-evals` in TypeScript (`create<Name>Evaluator`,
constructed with `model:`). Use one only when its definition matches the failure you
care about, and check it against human labels like any other judge.

## LLM judges

The set of pre-built judges grows with each release, so list what your installed
version has instead of relying on a fixed list. This prints each judge's inputs,
labels with their scores, and direction:

```python
import inspect
import warnings
from typing import Any, cast

from phoenix.evals import LLM, ClassificationEvaluator, metrics

llm = LLM(provider="openai", model="gpt-4o")
for name in metrics.__all__:
    evaluator_class = getattr(metrics, name)
    if not (inspect.isclass(evaluator_class) and issubclass(evaluator_class, ClassificationEvaluator)):
        continue
    with warnings.catch_warnings(record=True) as caught:
        warnings.simplefilter("always")
        evaluator = cast(Any, evaluator_class)(llm=llm)
    if any(issubclass(warning.category, DeprecationWarning) for warning in caught):
        continue
    inputs = list(evaluator.input_schema.model_json_schema()["properties"])
    print(name, inputs, evaluator.label_score_map, evaluator.direction)
```

In TypeScript, the judges are the `create<Name>Evaluator` exports of
`@arizeai/phoenix-evals`. Input names are snake_case in Python and camelCase in
TypeScript, so `available_tools` is `availableTools`. For `minimize` evaluators, 1.0
is the bad outcome. The [pre-built metrics docs](https://arize.com/docs/phoenix/evaluation/pre-built-metrics)
describe what each judge checks.

```python
from phoenix.evals import LLM
from phoenix.evals.metrics import FaithfulnessEvaluator

faithfulness = FaithfulnessEvaluator(llm=LLM(provider="openai", model="gpt-4o"))
scores = faithfulness.evaluate(
    {"input": "Where is Paris?", "output": "Paris is in France.", "context": "Paris is in France."}
)
```

```typescript
import { openai } from "@ai-sdk/openai";
import { createFaithfulnessEvaluator } from "@arizeai/phoenix-evals";

const faithfulness = createFaithfulnessEvaluator({ model: openai("gpt-4o") });
const result = await faithfulness.evaluate({
  input: "Where is Paris?",
  output: "Paris is in France.",
  context: "Paris is in France.",
});
```

### Inputs are open-ended

The input names describe a role, not a fixed field. Choose what goes in each one from
your data and the goal of the eval. `input` can be the last user message or the whole
conversation so far. `output` can be a final reply, or everything the system did in
response, including tool calls. Use an input mapping to fill each input from your
records (see [evaluators-python](evaluators-python.md)).

### Start from a pre-built prompt

A pre-built judge doesn't have to be used as is. To change its definitions, edge
cases, or inputs, copy its prompt into your own `ClassificationEvaluator` and edit
it there:

```python
from phoenix.evals import LLM, ClassificationEvaluator
from phoenix.evals.metrics import FaithfulnessEvaluator

print(FaithfulnessEvaluator.PROMPT.template)

support_faithfulness = ClassificationEvaluator(
    name="support_faithfulness",
    llm=LLM(provider="openai", model="gpt-4o"),
    prompt_template=FaithfulnessEvaluator.PROMPT.template,
    choices=FaithfulnessEvaluator.CHOICES,
)
```

Replace `prompt_template` with your edited copy of the messages, and keep the labels
in `choices` in step with the labels the prompt names. In TypeScript, the factories
accept `name`, `choices`, `promptTemplate`, `optimizationDirection`, and
`inputMapping` overrides directly.

## Code metrics

| Metric | Python (`phoenix.evals.metrics`) | TypeScript (`@arizeai/phoenix-evals/code`) |
| ------ | -------------------------------- | ------------------------------------------ |
| Exact string match, no normalization | `exact_match` (inputs `output`, `expected`) | none; write a `createEvaluator` |
| Regex match | `MatchesRegex(pattern=..., name=None)` | none; write a `createEvaluator` |
| Precision, recall, F-beta over a list of labels | `PrecisionRecallFScore(beta=1.0, average="macro", positive_label=None)` | `createPrecisionEvaluator`, `createRecallEvaluator`, `createF1Evaluator`, `createFBetaEvaluator`, `createPrecisionRecallFScoreEvaluators` |

The precision and recall metrics take the whole sequence of expected and predicted
labels at once, not one row.

```python
from phoenix.evals.metrics import MatchesRegex, exact_match

iso_date = MatchesRegex(pattern=r"\d{4}-\d{2}-\d{2}", name="iso_date")
print(exact_match.evaluate({"output": "Paris", "expected": "Paris"})[0].score)  # 1.0
print(iso_date.evaluate({"output": "Due 2026-11-18"})[0].score)  # 1.0
```

## Notes on specific evaluators

- **Faithfulness versus hallucination.** Both check whether a response is
  supported by a source of truth. They differ in what that source is.
  Faithfulness judges against a separately supplied `context`, such as
  retrieved documents, so use it for RAG. Hallucination judges against the
  conversation itself. Its `input` holds the full history the assistant saw,
  including tool calls and results, and it has no `context` field. Use it for
  multi-turn agents and chat.
- **Completeness scores finished work across the whole conversation.** The
  judge lists every request the user made in any turn and marks each one
  `fulfilled`, `withdrawn`, or `unfulfilled`. It labels the conversation
  `incomplete` if any request that wasn't withdrawn is unfulfilled, so pass the
  full history in `conversation`, not only the final turn. Fulfilled means the
  deliverable is visible in the record: an answer that covers every part asked
  for, an artifact with every required component, or an action whose success
  shows up in a tool result. A refusal, an "I don't know", a clarifying
  question, or a promise counts as unfulfilled. The judge doesn't check
  correctness, so a wrong answer that was delivered still counts as complete.
  For agent traces, include tool calls and results. Matching tool evidence
  overrides the assistant's claim, and without it the judge has to take the
  assistant's word. The `explanation` is an `INTENTIONS:` block with one line
  per request, giving its `state` and a `reason_code` of `pending`, `blocked`,
  `failed`, or `ignored`. Parse it to see which request was dropped and why.
- **PII detection screens the whole record.** Put everything in the single
  `conversation` field, including system instructions, tool calls and results,
  and retrieved documents, not only what the user saw. The judge's
  `explanation` is a structured `FINDINGS:` block, or `FINDINGS: none`, that
  you can parse for per-instance categories. The judge deliberately doesn't
  flag placeholders and redactions, such as `[REDACTED]`, `555-01xx` numbers,
  `example.com` addresses, or anything marked as a sample, so don't build test
  cases out of dummy identifiers.

## Retrieval relevance

`RetrievalRelevanceEvaluator` works with any retrieval source and judges whether the
retrieved information helps address the request. If any meaningful part of it does,
the label is `relevant`. Each result carries an `explanation` from the judge.

Two field choices change what you measure without raising an error:

- `input` should be the user's request, for example the trace root's `input.value`,
  not a reformulated tool argument or a generated SQL query.
- `context` sets the scope. Pass one document to score that document, or join all
  returned items into one value to score the retrieval step as a whole.

Relevance isn't correctness. Outdated or later-contradicted information still
scores `relevant` if it was about the right subject. A failed retrieval, such as an
error, a timeout, or "no results found", scores `irrelevant`.

```python
from phoenix.evals import LLM
from phoenix.evals.metrics import RetrievalRelevanceEvaluator

relevance_eval = RetrievalRelevanceEvaluator(llm=LLM(provider="openai", model="gpt-6-luna"))
scores = relevance_eval.evaluate({
    "input": "What is the capital of France?",
    "context": "Paris is the capital and largest city of France.",
})
print(scores[0].label)  # "relevant"
```

```typescript
import { createRetrievalRelevanceEvaluator } from "@arizeai/phoenix-evals";
import { openai } from "@ai-sdk/openai";

const evaluator = createRetrievalRelevanceEvaluator({ model: openai("gpt-6-luna") });
const result = await evaluator.evaluate({
  input: "What is the capital of France?",
  context: "Paris is the capital and largest city of France.",
});
console.log(result.label); // "relevant"
```

`RetrievalRelevanceEvaluator` forwards keyword arguments other than `llm`, such as
`max_tokens`, to the model client. Like every pre-built judge, it takes an `LLM` that
supports tool calling or structured output, or a `DecisionModel`.

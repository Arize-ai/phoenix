# Evaluators: Pre-Built

Use for exploration only. Validate before production.

## Python

```python
from phoenix.evals import LLM
from phoenix.evals.metrics import FaithfulnessEvaluator

llm = LLM(provider="openai", model="gpt-4o")
faithfulness_eval = FaithfulnessEvaluator(llm=llm)
```

**Note**: `HallucinationEvaluator` is deprecated. Use `FaithfulnessEvaluator` instead.
It uses "faithful"/"unfaithful" labels with score 1.0 = faithful.

## TypeScript

```typescript
import { createHallucinationEvaluator } from "@arizeai/phoenix-evals";
import { openai } from "@ai-sdk/openai";

const hallucinationEval = createHallucinationEvaluator({ model: openai("gpt-4o") });
```

## Available (2.0)

Every entry below is importable from `phoenix.evals.metrics` (Python) or
`@arizeai/phoenix-evals` (TypeScript).

| Evaluator | TypeScript | Type | Description |
| --------- | ---------- | ---- | ----------- |
| `FaithfulnessEvaluator` | `createFaithfulnessEvaluator` | LLM | Is the response faithful to the context? |
| `CorrectnessEvaluator` | `createCorrectnessEvaluator` | LLM | Is the response correct? |
| `DocumentRelevanceEvaluator` | `createDocumentRelevanceEvaluator` | LLM | Are retrieved documents relevant? |
| `ConcisenessEvaluator` | `createConcisenessEvaluator` | LLM | Is the response concise? |
| `RefusalEvaluator` | `createRefusalEvaluator` | LLM | Did the model refuse to answer? |
| `ToxicityEvaluator` | `createToxicityEvaluator` | LLM | Is the text toxic — hateful, demeaning, abusive, or threatening? |
| `UserFrictionEvaluator` | `createUserFrictionEvaluator` | LLM | Does the latest user message express friction with the assistant's preceding behavior? |
| `ToolSelectionEvaluator` | `createToolSelectionEvaluator` | LLM | Did the agent select the right tool? |
| `ToolInvocationEvaluator` | `createToolInvocationEvaluator` | LLM | Did the agent invoke the tool correctly? |
| `ToolResponseHandlingEvaluator` | `createToolResponseHandlingEvaluator` | LLM | Did the agent handle the tool response well? |
| `MatchesRegex` | — | Code | Does output match a regex pattern? |
| `PrecisionRecallFScore` | `createPrecisionRecallFScoreEvaluators` | Code | Precision/recall/F-score metrics |
| `exact_match` | — | Code | Exact string match |

`HallucinationEvaluator` / `createHallucinationEvaluator` are deprecated aliases
kept for backwards compatibility; the Python class emits a `DeprecationWarning`.
Use `FaithfulnessEvaluator` instead.

There is no `phoenix.evals.legacy` module. The evals 1.0 evaluators (`QAEvaluator`,
`RelevanceEvaluator`, `SummarizationEvaluator`) were removed in
`arize-phoenix-evals` 3.0.0 — there is no import path for them. Rewrite against the
table above.

### Toxicity

Classifies one piece of text (a model output or a user input) as `toxic` or
`non-toxic`, scoring 1.0 for toxic. Direction is `minimize`.

```python
from phoenix.evals import LLM
from phoenix.evals.metrics import ToxicityEvaluator

llm = LLM(provider="openai", model="gpt-4o-mini")
toxicity_eval = ToxicityEvaluator(llm=llm)

scores = toxicity_eval.evaluate({"text": "You are a worthless idiot."})
print(scores[0].label)  # "toxic"
```

```typescript
import { createToxicityEvaluator } from "@arizeai/phoenix-evals";
import { openai } from "@ai-sdk/openai";

const evaluator = createToxicityEvaluator({ model: openai("gpt-4o-mini") });
const result = await evaluator.evaluate({ text: "You are a worthless idiot." });
console.log(result.label); // "toxic" or "non-toxic"
```

### User Friction

Detects corrections, retries, frustration, and challenges directed at the
assistant's preceding behavior. Labels are `friction` / `no_friction`, scoring 1.0
for friction. Direction is `minimize`.

Both inputs are required: `conversation` carries the history *before* the target
message, and the message being classified is passed separately so the judge cannot
confuse it with earlier turns. Note the field name differs by runtime —
`user_message` in Python, `userMessage` in TypeScript.

```python
from phoenix.evals import LLM
from phoenix.evals.metrics import UserFrictionEvaluator

llm = LLM(provider="openai", model="gpt-4o-mini")
user_friction_eval = UserFrictionEvaluator(llm=llm)

scores = user_friction_eval.evaluate({
    "conversation": "User: Show orders from this week.\nAssistant: Here are last month's orders.",
    "user_message": "No, I asked for this week.",
})
print(scores[0].label)  # "friction"
```

```typescript
import { createUserFrictionEvaluator } from "@arizeai/phoenix-evals";
import { openai } from "@ai-sdk/openai";

const evaluator = createUserFrictionEvaluator({ model: openai("gpt-4o-mini") });
const result = await evaluator.evaluate({
  conversation:
    "User: Show recent orders.\nAssistant: Here are last month's orders.",
  userMessage: "No, I asked for this week.",
});
console.log(result.label); // "friction"
```

A `no_friction` label does not prove the user was satisfied — users often abandon
conversations without saying why. Do not read it as a success metric.

**TypeScript**: `PrecisionRecallFScore` is also available via `@arizeai/phoenix-evals/code`
as `createPrecisionEvaluator`, `createRecallEvaluator`, `createF1Evaluator`,
`createFBetaEvaluator`, and `createPrecisionRecallFScoreEvaluators` — see
[evaluators-code-typescript.md](evaluators-code-typescript.md).

## When to Use

| Situation | Recommendation |
| --------- | -------------- |
| Exploration | Find traces to review |
| Find outliers | Sort by scores |
| Production | Validate first (>80% human agreement) |
| Domain-specific | Build custom |

## Exploration Pattern

```python
from phoenix.evals import evaluate_dataframe

results_df = evaluate_dataframe(dataframe=traces, evaluators=[faithfulness_eval])

# Score columns contain dicts — extract numeric scores
scores = results_df["faithfulness_score"].apply(
    lambda x: x.get("score", 0.0) if isinstance(x, dict) else 0.0
)
low_scores = results_df[scores < 0.5]   # Review these
high_scores = results_df[scores > 0.9]  # Also sample
```

## Validation Required

```python
from sklearn.metrics import classification_report

print(classification_report(human_labels, evaluator_results["label"]))
# Target: >80% agreement
```

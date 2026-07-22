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

## Available

| Evaluator | Type | Description |
| --------- | ---- | ----------- |
| `FaithfulnessEvaluator` | LLM | Is the response faithful to the context? |
| `CorrectnessEvaluator` | LLM | Is the response correct? |
| `ConcisenessEvaluator` | LLM | Is the response concise and free of unnecessary content? |
| `DocumentRelevanceEvaluator` | LLM | Are retrieved documents relevant? |
| `RefusalEvaluator` | LLM | Did the model refuse or decline to answer? |
| `UserFrictionEvaluator` | LLM | Did the latest user message express friction with the assistant's preceding behavior? |
| `ToolSelectionEvaluator` | LLM | Did the agent select the right tool? |
| `ToolInvocationEvaluator` | LLM | Did the agent invoke the tool correctly? |
| `ToolResponseHandlingEvaluator` | LLM | Did the agent handle the tool response well? |
| `MatchesRegex` | Code | Does output match a regex pattern? |
| `PrecisionRecallFScore` | Code | Precision/recall/F-score metrics |
| `exact_match` | Code | Exact string match |

All LLM evaluators are imported from `phoenix.evals.metrics` and constructed with an
`LLM` instance, e.g. `UserFrictionEvaluator(llm=llm)`.

### `UserFrictionEvaluator` input shape

Unlike single-response evaluators, `UserFrictionEvaluator` expects the conversation
history and the target user message as **separate** fields, so the judge does not
confuse an earlier turn with the message under evaluation:

```python
from phoenix.evals import LLM
from phoenix.evals.metrics import UserFrictionEvaluator

llm = LLM(provider="openai", model="gpt-4o-mini")
user_friction_eval = UserFrictionEvaluator(llm=llm)

scores = user_friction_eval.evaluate({
    "conversation": (
        "User: Show orders from this week.\n"
        "Assistant: Here are last month's orders."
    ),
    "user_message": "No, I asked for this week.",
})
# -> Score(name='user_friction', label='friction', score=1.0, ...)
```

Labels are `friction` / `no_friction` (score 1.0 = friction). Note that `no_friction`
does not prove satisfaction — users often abandon conversations without saying why.

Legacy evaluators (`HallucinationEvaluator`, `QAEvaluator`, `RelevanceEvaluator`,
`ToxicityEvaluator`, `SummarizationEvaluator`) are in `phoenix.evals.legacy` and deprecated.

**TypeScript**: the LLM evaluators ship as factory functions from
`@arizeai/phoenix-evals` — `createFaithfulnessEvaluator`, `createCorrectnessEvaluator`,
`createConcisenessEvaluator`, `createDocumentRelevanceEvaluator`,
`createRefusalEvaluator`, `createUserFrictionEvaluator`, `createToolSelectionEvaluator`,
`createToolInvocationEvaluator`, and `createToolResponseHandlingEvaluator`. Each takes a
`model` and returns an evaluator whose `.evaluate()` returns a classification result:

```typescript
import { createUserFrictionEvaluator } from "@arizeai/phoenix-evals";
import { openai } from "@ai-sdk/openai";

const userFriction = createUserFrictionEvaluator({ model: openai("gpt-4o-mini") });
const result = await userFriction.evaluate({
  conversation: "User: Show recent orders.\nAssistant: Here are last month's orders.",
  userMessage: "No, I asked for this week.",
});
// result.label === "friction"
```

`PrecisionRecallFScore` is also available via `@arizeai/phoenix-evals/code`
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

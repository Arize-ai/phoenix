# Evaluators: Pre-Built

Use for exploration only. Validate before production.

Pre-built evaluators are importable from `phoenix.evals.metrics` (Python) and
`@arizeai/phoenix-evals` (TypeScript). They cover RAG quality (faithfulness,
correctness, document relevance), response quality (conciseness, refusal),
safety (toxicity), conversation signals (user friction), agent tool use
(tool selection, invocation, response handling), and code-based checks
(regex match, exact match, precision/recall/F-score). Naming follows
`<Name>Evaluator` in Python and `create<Name>Evaluator` in TypeScript —
enumerate the module exports for the full list.

## Python

```python
from phoenix.evals import LLM
from phoenix.evals.metrics import FaithfulnessEvaluator

llm = LLM(provider="openai", model="gpt-4o")
faithfulness_eval = FaithfulnessEvaluator(llm=llm)
```

## TypeScript

```typescript
import { createFaithfulnessEvaluator } from "@arizeai/phoenix-evals";
import { openai } from "@ai-sdk/openai";

const faithfulnessEval = createFaithfulnessEvaluator({ model: openai("gpt-4o") });
```

Before using an evaluator, check its required input fields and score direction —
some score toward 1.0 for the *bad* outcome and are meant to be minimized
(e.g., toxicity, user friction). Input field names follow the runtime's
convention: snake_case in Python, camelCase in TypeScript.

Code-based evaluators (precision/recall/F-score) are also available in
TypeScript via `@arizeai/phoenix-evals/code` — see
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

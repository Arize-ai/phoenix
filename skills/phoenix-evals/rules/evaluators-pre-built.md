# Evaluators: Pre-Built

Use for exploration only. Validate before production.

## Python

```python
from phoenix.evals import HallucinationEvaluator, QAEvaluator, RelevanceEvaluator, LLM

llm = LLM(provider="openai", model="gpt-4o")
hallucination_eval = HallucinationEvaluator(llm)
```

## TypeScript

```typescript
import { createHallucinationEvaluator } from "@arizeai/phoenix-evals";
import { openai } from "@ai-sdk/openai";

const hallucinationEval = createHallucinationEvaluator({ model: openai("gpt-4o") });
```

## Available

Hallucination, QA, Relevance, Toxicity, Faithfulness, Summarization.

## When to Use

| Situation | Recommendation |
| --------- | -------------- |
| Exploration | Find traces to review |
| Find outliers | Sort by scores |
| Production | Validate first (>80% human agreement) |
| Domain-specific | Build custom |

## Exploration Pattern

```python
results = run_evals(traces, [hallucination_eval])
low_scores = results[results["score"] < 0.5]   # Review these
high_scores = results[results["score"] > 0.9]  # Also sample
```

## Validation Required

```python
from sklearn.metrics import classification_report

print(classification_report(human_labels, evaluator_results["label"]))
# Target: >80% agreement
```

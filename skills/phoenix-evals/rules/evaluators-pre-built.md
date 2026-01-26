# Evaluators: Pre-Built Phoenix Evaluators

Pre-built evaluators are starting points, not production-ready solutions. Always validate against human labels.

## Quick Start

```python
from phoenix.evals import HallucinationEvaluator, QAEvaluator, RelevanceEvaluator, LLM

llm = LLM(provider="openai", model="gpt-4o")
hallucination_eval = HallucinationEvaluator(llm)
```

```typescript
import { createHallucinationEvaluator } from "@arizeai/phoenix-evals";
import { openai } from "@ai-sdk/openai";

const hallucinationEval = createHallucinationEvaluator({ model: openai("gpt-4o") });
```

## Available Evaluators

See the official documentation for the complete, up-to-date list:

- **Python:** [Phoenix Evals API Reference](https://arize-phoenix.readthedocs.io/projects/evals/en/latest/)
- **TypeScript:** [@arizeai/phoenix-evals Reference](https://arize-ai.github.io/phoenix/modules/_arizeai_phoenix-evals.html)

Common evaluators include: Hallucination, QA, Relevance, Toxicity, Faithfulness, Summarization.

## When to Use

| Situation | Recommendation |
| --------- | -------------- |
| Quick exploration | Use pre-built as-is |
| Production | Customize and validate first |
| Domain-specific | Build custom from scratch |

## Validation Required

```python
from sklearn.metrics import classification_report

# Always compare to human labels before production use
print(classification_report(human_labels, evaluator_results["label"]))
# Target: >80% agreement with humans
```

## Key Principle

Pre-built evaluators rarely work well out-of-box for specific tasks. Use them to explore, then customize or build your own based on your error analysis findings.

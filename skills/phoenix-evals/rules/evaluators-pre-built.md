# Evaluators: Pre-Built Phoenix Evaluators

Pre-built evaluators are **exploration tools, not production solutions**.

## Warning: Illusion of Confidence

Generic evaluators (helpfulness, quality, coherence) create false confidence:

- High scores don't mean your system works for your use case
- They measure abstract qualities that may not matter for your application
- They can't catch domain-specific failures you haven't discovered yet

**The abuse of generic metrics is endemic.** Many eval vendors promote off-the-shelf metrics that waste time and create unjustified confidence.

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
| Initial exploration | Use to find interesting traces to review |
| Understanding data | Sort by scores to find outliers |
| **Production** | **Never without validation and customization** |
| Domain-specific | Build custom from scratch |

## Validation Required

```python
from sklearn.metrics import classification_report

# ALWAYS compare to human labels before any production use
print(classification_report(human_labels, evaluator_results["label"]))
# Target: >80% agreement with humans
# If below 70%, the evaluator is not ready
```

## Using Pre-Built as Exploration Tools

Pre-built evaluators can help find interesting traces:

```python
# Use scores to sort, not to judge
results = run_evals(traces, [hallucination_eval])
low_scores = results[results["score"] < 0.5]  # Candidates for review
high_scores = results[results["score"] > 0.9]  # Also review some

# Then do error analysis on these samples
# Build custom evaluators based on what you find
```

## Key Principle

Pre-built evaluators are for exploration, not judgment. Use them to find traces worth reviewing, then build custom evaluators based on your error analysis findings.

**See Also:** [fundamentals-anti-patterns](fundamentals-anti-patterns.md) for the generic metrics trap.

# Fundamentals: Evaluator Types

Three types of evaluators: code-based, LLM-as-judge, and human.

## Overview

| Type | Speed | Cost | Nuance | Use Case |
| ---- | ----- | ---- | ------ | -------- |
| **Code** | Fast | Cheap | Low | Objective checks, regex, assertions |
| **LLM** | Medium | Medium | High | Subjective quality, complex criteria |
| **Human** | Slow | Expensive | Highest | Ground truth, calibration, edge cases |

## Code-Based Evaluators

Deterministic checks without LLM. Use for: exact match, regex, JSON validation, format checks.

```python
from phoenix.evals import create_evaluator

@create_evaluator(name="has_citation", kind="CODE")
def has_citation(output: str) -> float:
    return 1.0 if re.search(r'\[\d+\]', output) else 0.0
```

## LLM-as-Judge Evaluators

Use LLM to evaluate subjective criteria. Requires calibration against human labels.

```python
from phoenix.evals import ClassificationEvaluator, LLM

helpfulness = ClassificationEvaluator(
    name="helpfulness",
    prompt_template="...",  # See evaluators-llm-python for templates
    llm=LLM(provider="openai", model="gpt-4o"),
    choices={"not_helpful": 0, "helpful": 1}
)
```

## Human Evaluators

Gold standard for ground truth. Use for calibrating LLM judges and edge cases.

## Decision Framework

1. **Code first** - Use for all objective, deterministic criteria
2. **LLM for nuance** - Only when code can't capture the criteria
3. **Human for truth** - For calibration and edge cases

**See Also:** [evaluators-overview](evaluators-overview.md) for when to automate.

# Fundamentals: Overview

Evals are the scientific method applied to AI products.

## What Are Evals?

**Structured tests** for measuring AI system performance. NOT generic benchmarks—application-specific tests you implement throughout development.

## The Process

1. **Observe** - Examine inputs, outputs, user interactions
2. **Annotate** - Label samples of successes and failures
3. **Hypothesize** - Why do failures occur?
4. **Experiment** - Test hypotheses with controlled changes
5. **Measure** - Quantify outcomes
6. **Iterate** - Refine and repeat

## Eval-Driven Development

Define success criteria before building features:

```python
# 1. Define success
success_criteria = "Response contains accurate info from retrieved documents"

# 2. Create dataset from real failures
dataset = client.datasets.create_dataset(name="faithfulness-eval", examples=failing_examples)

# 3. Run baseline, make change, compare
baseline = run_experiment(dataset, task=current_prompt, evaluators=[faithfulness_eval])
improved = run_experiment(dataset, task=new_prompt, evaluators=[faithfulness_eval])
```

## When to Start

**Now.** 20-50 tasks from real failures is enough. The longer you wait, the harder it gets.

## Key Principles

| Principle | Description |
| --------- | ----------- |
| Process > Tools | Fixing your process matters more than tool choice |
| Start Early | Small datasets are fine to begin |
| Scientific Method | Observe → Hypothesize → Experiment → Measure |

**See Also:** [error-analysis-overview](error-analysis-overview.md) for the 60-80% rule on time investment.

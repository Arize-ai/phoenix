# Fundamentals: Model Selection

Don't default to model switching as your improvement strategy.

## When to Consider Model Changes

```
Performance Issue?
       │
       ▼
Does error analysis suggest model is the problem?
    NO  → Fix prompts, retrieval, or tools first
    YES → Is it a capability gap (not prompt/data issue)?
          YES → Consider model change
          NO  → Fix the actual problem
```

**Key insight:** Most failures are prompt, retrieval, or data issues—not model limitations.

## Judge Model Selection

For LLM-as-judge evaluators:

| Principle | Rationale |
| --------- | --------- |
| Start with capable models | Establish baseline accuracy first |
| Optimize cost later | Once criteria are stable, test cheaper models |
| Same model is fine | Judge does different task (scoped binary classification) |

```python
# Start with capable model
judge = ClassificationEvaluator(
    llm=LLM(provider="openai", model="gpt-4o"),  # Start here
    ...
)

# After validation, test cheaper alternatives
judge_cheap = ClassificationEvaluator(
    llm=LLM(provider="openai", model="gpt-4o-mini"),  # Test this
    ...
)
# Compare TPR/TNR on same test set
```

## Same Model for Judge: Usually Fine

Using the same model family for both task and evaluation is acceptable because:

1. **Different task** - Judge does scoped binary classification, not open-ended generation
2. **Validation matters more** - TPR/TNR on test set determines quality, not model choice
3. **Focus on criteria** - Clear pass/fail definitions matter more than model diversity

## What Error Analysis Should Reveal

Before switching models, error analysis should show:

- Consistent failures on tasks within model capabilities
- Failures that persist after prompt optimization
- Capability gaps (e.g., reasoning, math, code) not addressable by prompting

## Anti-Pattern: Model Shopping

```python
# BAD: Trying models without understanding failures
for model in ["gpt-4o", "claude-3", "gemini-pro"]:
    results = run_experiment(dataset, task, model)
    # Hope one works better...

# GOOD: Understand failures first
failures = analyze_errors(results)
# "Model often ignores retrieved context" → Fix prompt
# "Model can't do multi-step math" → Maybe try better model
```

## Key Principle

Error analysis first, model changes last. Most improvements come from better prompts, retrieval, or data—not model switching.

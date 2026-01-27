# Fundamentals: Anti-Patterns

Common mistakes that undermine evaluation efforts.

## 1. Generic Metrics Trap

**Problem:** Using pre-built "quality" or "helpfulness" scores that don't measure YOUR failure modes.

**Fix:** Build evaluators for failures discovered through error analysis.

## 2. Vibe-Based Evals

**Problem:** "It seems like it's working" - no quantification, no baselines.

**Fix:** Measure everything with experiments:
```python
baseline = run_experiment(dataset, old_prompt, evaluators)
improved = run_experiment(dataset, new_prompt, evaluators)
print(f"Improvement: {improved.pass_rate - baseline.pass_rate:+.1%}")
```

## 3. Ignoring Human Feedback

**Problem:** Assuming LLM judges are correct without calibration.

**Fix:** Always validate against human labels. Target >80% TPR/TNR.

## 4. Outsourcing Error Analysis

**Problem:** Delegating review loses product intuition.

**Fix:** Do error analysis yourself. Review 100+ traces personally.

## 5. Premature Automation

**Problem:** Building evaluators for imagined problems.

**Fix:** Let observed failures drive what you automate.

## 6. Saturation Blindness

**Problem:** 100% pass rate = no signal for improvement.

**Fix:** Keep capability evals challenging (50-80% pass). Graduate passing cases to regression suite.

## 7. Similarity Metrics Trap

**Problem:** Using BERTScore, ROUGE, cosine similarity to evaluate LLM outputs.

**Why it fails:** These metrics measure surface-level text similarity, not correctness or quality. A factually wrong response can score high if it uses similar words.

**Fix:** Use application-specific evaluators. Similarity metrics are useful for retrieval/search, not generation quality.

```python
# BAD: Generic similarity
score = bertscore(output, reference)  # High score ≠ correct answer

# GOOD: Specific criteria
correct_facts = check_facts_against_source(output, context)
answers_question = llm_judge(output, question)
```

## 8. Model Switching as Default Fix

**Problem:** Trying different models hoping one works better, without understanding failures.

**Fix:** Error analysis first. Most failures are prompt, retrieval, or data issues—not model limitations.

```python
# BAD: Model shopping
for model in models:
    results = test(model)  # Hope one works...

# GOOD: Understand first
failures = analyze_errors(results)
# Then decide if model change is warranted
```

**See Also:** [fundamentals-model-selection](fundamentals-model-selection.md)

## 9. Premature Prompt Optimization

**Problem:** Using automated prompt optimizers before understanding your failures.

**Fix:** Automated optimization hill-climbs metrics but can't discover new failure modes. Do error analysis first to understand what "good" means for your application.

## Summary

| Anti-Pattern | Fix |
| ------------ | --- |
| Generic metrics | Application-specific evaluators |
| Vibe-based | Quantify with experiments |
| Ignoring humans | Calibrate against human labels |
| Outsourcing analysis | Do it yourself |
| Premature automation | Evidence-based building |
| Saturation | Keep evals challenging |
| Similarity metrics | Use for retrieval, not generation |
| Model switching | Error analysis first |
| Premature optimization | Understand failures before automating |

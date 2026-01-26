# Validation: Building Golden Datasets

Creating ground truth datasets for evaluator validation.

## What Is a Golden Dataset?

Examples with verified, expert-labeled ground truth:

```python
golden_example = {
    "input": "What is the capital of France?",
    "output": "Paris is the capital.",
    "ground_truth_label": "correct",
    "annotator": "domain_expert",
}
```

## Building Process

1. **Sample** - Production successes, failures, negative feedback, edge cases
2. **Balance** - Target ~50/50 pass/fail
3. **Annotate** - Domain expert labels (benevolent dictator)
4. **Document** - Clear criteria and edge case handling

## Requirements

| Requirement | Target |
| ----------- | ------ |
| Size | 100+ examples |
| Balance | ~50/50 for binary |
| Coverage | Edge cases + failure modes |
| Annotator | Domain expert |

## Quality Assurance

```python
# Spot-check with second reviewer
disagreements = spot_check(golden_dataset, n=20)
# Expect >90% agreement
```

## Versioning

- Don't modify existing versions
- Create new version for updates
- Document changes between versions

```python
# GOOD
golden_v2 = golden_v1 + [new_examples]

# BAD
golden_v1.append(new_example)  # Never modify!
```

## Checklist

- [ ] 100+ examples
- [ ] ~50/50 balance
- [ ] Edge cases included
- [ ] Expert-annotated
- [ ] Documented criteria
- [ ] Spot-checked
- [ ] Versioned

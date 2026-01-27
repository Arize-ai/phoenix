# Fundamentals: Scores

Score anatomy and why binary is better than Likert scales.

## Score Structure

| Property | Required | Description |
| -------- | -------- | ----------- |
| `name` | Yes | Evaluator name |
| `kind` | Yes | `"code"`, `"llm"`, or `"human"` |
| `score` | No* | Numeric value (typically 0-1) |
| `label` | No* | Categorical outcome ("pass", "fail") |
| `explanation` | No | Rationale for result |

*At least one of `score` or `label` required.

## Binary > Likert

**Avoid 1-5 scales.** Problems: subjective boundaries, annotator inconsistency, middle-value defaulting.

**Use pass/fail.** Benefits: forces decisions, faster annotation, clearer criteria, easier calibration.

```python
# BAD: "Rate helpfulness 1-5"
# GOOD: Binary with clear criteria
choices = {"helpful": 1.0, "not_helpful": 0.0}

# BETTER: Multiple binary checks
evaluators = [
    AnswersQuestion(),    # Yes/No
    UsesContext(),        # Yes/No
    NoHallucination(),    # Yes/No
]
```

## Designing Criteria

1. **Be explicit** - Define exactly what pass/fail means
2. **Use examples** - Show examples of each label in prompts
3. **Define edges** - Specify how to handle ambiguous cases

```python
TEMPLATE = """
"faithful" means ALL claims are supported by context.
"unfaithful" means ANY claim is NOT in context.

Edge cases:
- "I don't know" when context lacks info → faithful
- Paraphrase preserving meaning → faithful
- Added inference → unfaithful (be strict)
"""
```

## Key Principle

Start with pass/fail. Add nuance only when binary proves insufficient.

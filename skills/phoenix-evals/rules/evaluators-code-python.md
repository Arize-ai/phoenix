# Evaluators: Code Evaluators in Python

Deterministic evaluators without LLM. Fast, cheap, reproducible.

## Basic Pattern

```python
import re
import json
from phoenix.evals import create_evaluator

@create_evaluator(name="has_citation", kind="code")
def has_citation(output: str) -> bool:
    return bool(re.search(r'\[\d+\]', output))

@create_evaluator(name="json_valid", kind="code")
def json_valid(output: str) -> bool:
    try:
        json.loads(output)
        return True
    except json.JSONDecodeError:
        return False
```

## Parameter Binding

| Parameter | Description |
| --------- | ----------- |
| `output` | Task output |
| `input` | Example input |
| `expected` | Expected output |
| `metadata` | Example metadata |

```python
@create_evaluator(name="matches_expected", kind="code")
def matches_expected(output: str, expected: dict) -> bool:
    return output.strip() == expected.get("answer", "").strip()
```

## Common Patterns

- **Regex**: `re.search(pattern, output)`
- **JSON schema**: `jsonschema.validate()`
- **Keywords**: `keyword in output.lower()`
- **Length**: `len(output.split())`
- **Similarity**: `editdistance.eval()` or Jaccard

## Return Types

| Return type | Result |
| ----------- | ------ |
| `bool` | `True` → score=1.0, label="True"; `False` → score=0.0, label="False" |
| `float`/`int` | Used as the `score` value directly |
| `str` (short, ≤3 words) | Used as the `label` value |
| `str` (long, ≥4 words) | Used as the `explanation` value |
| `dict` with `score`/`label`/`explanation` | Mapped to Score fields directly |
| `Score` object | Used as-is |

## Important: kind="code" Only

The `@create_evaluator` decorator is for **code-based** evaluators only.
Do NOT set `kind="llm"` — it won't magically call an LLM.
For LLM-based evaluation, use `create_classifier()` or `ClassificationEvaluator`.

## Pre-Built

```python
from phoenix.experiments.evaluators import ContainsAnyKeyword, JSONParseable, MatchesRegex

evaluators = [
    ContainsAnyKeyword(keywords=["disclaimer"]),
    JSONParseable(),
    MatchesRegex(pattern=r"\d{4}-\d{2}-\d{2}"),
]
```

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

## Pre-Built Evaluators

```python
from phoenix.experiments.evaluators import ContainsAnyKeyword, JSONParseable, MatchesRegex

evaluators = [
    ContainsAnyKeyword(keywords=["disclaimer"]),
    JSONParseable(),
    MatchesRegex(pattern=r"\d{4}-\d{2}-\d{2}"),
]
```

**Library Reference:** [Phoenix Evals Python](https://arize-phoenix.readthedocs.io/projects/evals/en/latest/)

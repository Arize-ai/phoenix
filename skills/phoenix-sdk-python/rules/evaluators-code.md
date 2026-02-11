# Code-Based Evaluators

Deterministic evaluators that don't use an LLM. Fast, cheap, and reproducible.

## Creating a Code Evaluator

Use the `@create_evaluator` decorator:

```python
from phoenix.evals import create_evaluator

@create_evaluator(name="has_citation", kind="code")
def has_citation(output: str) -> bool:
    """Returns True if the output contains a citation."""
    return bool(re.search(r'\[\d+\]', output))
```

### Decorator Parameters

| Parameter | Type | Description |
| --------- | ---- | ----------- |
| `name` | `str` | Name of the evaluator (used in result column names) |
| `kind` | `str` | Must be `"code"` for code-based evaluators |
| `direction` | `str` | `"maximize"` (default) or `"minimize"` |

### Function Parameters

The decorated function receives data from each row of the DataFrame.
Parameter names must match column names in the DataFrame:

| Parameter | Maps to column |
| --------- | -------------- |
| `output` | `output` column (the response to evaluate) |
| `input` | `input` column (the user query) |
| `expected` | `expected` column (expected answer, if present) |
| `metadata` | `metadata` column |

```python
# Evaluator using both input and output
@create_evaluator(name="budget_check", kind="code")
def budget_check(input: str, output: str) -> bool:
    budget = extract_budget(input)
    if budget is None:
        return True  # No budget constraint
    prices = extract_prices(output)
    return all(p <= budget for p in prices)
```

### Return Types

| Return type | Result |
| ----------- | ------ |
| `bool` | `True` → score=1.0, label="True"; `False` → score=0.0, label="False" |
| `float`/`int` | Used as the `score` value directly |
| `str` (short, ≤3 words) | Used as the `label` value |
| `str` (long, ≥4 words) | Used as the `explanation` value |
| `dict` with `score`/`label`/`explanation` | Mapped to Score fields directly |
| `Score` object | Used as-is |

## Using the Evaluator

### With evaluate_dataframe (batch)

```python
from phoenix.evals import evaluate_dataframe

results_df = evaluate_dataframe(
    dataframe=df,  # Must have columns matching function params
    evaluators=[has_citation],
)
```

### Direct function call (single item)

```python
# Still callable as a regular function
result = has_citation(output="See reference [1] for details")
# Returns: True (the raw function return value)

# Or use the evaluator API
scores = has_citation.evaluate({"output": "See reference [1]"})
# Returns: [Score(name="has_citation", score=1.0, label="True", ...)]
```

## Common Patterns

```python
import re
import json

# Regex matching
@create_evaluator(name="has_date", kind="code")
def has_date(output: str) -> bool:
    return bool(re.search(r'\d{4}-\d{2}-\d{2}', output))

# JSON validation
@create_evaluator(name="valid_json", kind="code")
def valid_json(output: str) -> bool:
    try:
        json.loads(output)
        return True
    except json.JSONDecodeError:
        return False

# Keyword presence
@create_evaluator(name="has_disclaimer", kind="code")
def has_disclaimer(output: str) -> bool:
    return "disclaimer" in output.lower()

# Numeric score (not just bool)
@create_evaluator(name="word_count", kind="code")
def word_count(output: str) -> int:
    return len(output.split())

# Using input + output together
@create_evaluator(name="mentions_query_topic", kind="code")
def mentions_query_topic(input: str, output: str) -> bool:
    keywords = [w for w in input.lower().split() if len(w) > 3]
    return any(kw in output.lower() for kw in keywords)
```

## Important: kind="code" Only

The `@create_evaluator` decorator is for **code-based** evaluators only.
Do NOT set `kind="llm"` — it won't magically call an LLM.
For LLM-based evaluation, use `create_classifier()` or `ClassificationEvaluator`.

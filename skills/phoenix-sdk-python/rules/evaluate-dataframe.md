# Batch Evaluation with evaluate_dataframe

## Function Signature

```python
from phoenix.evals import evaluate_dataframe

results_df = evaluate_dataframe(
    dataframe=df,              # pandas DataFrame with columns matching evaluator params
    evaluators=[eval1, eval2], # List of evaluators
    exit_on_error=False,       # Optional: stop on first error
    max_retries=3,             # Optional: retry failed LLM calls
)
```

## CRITICAL: Result Column Format

`evaluate_dataframe` returns the original DataFrame with added columns.
**Result columns contain dicts, NOT raw numbers.**

For each evaluator named `"foo"`, two columns are added:

| Column | Type | Contents |
| ------ | ---- | -------- |
| `foo_score` | `dict` | `{"name": "foo", "score": 1.0, "label": "True", "explanation": "...", "metadata": {...}, "kind": "code", "direction": "maximize"}` |
| `foo_execution_details` | `dict` | `{"status": "COMPLETED", "exceptions": [], "execution_seconds": 0.001}` |

### Extracting Numeric Scores

```python
# WRONG — this will fail or produce unexpected results
score = results_df["relevance"].mean()                    # KeyError!
score = results_df["relevance_score"].mean()              # Tries to average dicts!

# RIGHT — extract the numeric score from each dict
scores = results_df["relevance_score"].apply(
    lambda x: x.get("score", 0.0) if isinstance(x, dict) else 0.0
)
mean_score = scores.mean()
```

### Extracting Labels

```python
labels = results_df["relevance_score"].apply(
    lambda x: x.get("label", "") if isinstance(x, dict) else ""
)
```

### Extracting Explanations (LLM evaluators)

```python
explanations = results_df["relevance_score"].apply(
    lambda x: x.get("explanation", "") if isinstance(x, dict) else ""
)
```

### Finding Failures

```python
scores = results_df["relevance_score"].apply(
    lambda x: x.get("score", 0.0) if isinstance(x, dict) else 0.0
)
failed_mask = scores < 0.5
failures = results_df[failed_mask]
```

## Helper Pattern

To avoid repeating the extraction logic:

```python
def extract_scores(results_df, eval_name):
    """Extract numeric scores from evaluate_dataframe results."""
    score_col = f"{eval_name}_score"
    if score_col not in results_df.columns:
        return None
    return results_df[score_col].apply(
        lambda x: x.get("score", 0.0) if isinstance(x, dict) else 0.0
    )

# Usage
scores = extract_scores(results_df, "relevance")
mean = float(scores.mean()) if scores is not None else 0.0
```

## Preparing DataFrames for Evaluation

Evaluators receive each row as a dict. Column names must match the evaluator's
expected parameter names:

```python
# If your evaluator function has params (input, output):
@create_evaluator(name="check", kind="code")
def check(input: str, output: str) -> bool:
    ...

# Your DataFrame must have 'input' and 'output' columns:
df = df.rename(columns={
    "attributes.input.value": "input",
    "attributes.output.value": "output",
})
```

## Async Version

For better throughput with LLM evaluators:

```python
from phoenix.evals import async_evaluate_dataframe

results_df = await async_evaluate_dataframe(
    dataframe=df,
    evaluators=[llm_evaluator],
    concurrency=5,  # Max concurrent LLM calls
)
```

## DO NOT use run_evals

```python
# WRONG — legacy 1.0 API
from phoenix.evals import run_evals
results = run_evals(dataframe=df, evaluators=[eval1])

# RIGHT — current 2.0 API
from phoenix.evals import evaluate_dataframe
results_df = evaluate_dataframe(dataframe=df, evaluators=[eval1])
```

Key differences:
- `run_evals` returns a **list** of DataFrames (one per evaluator)
- `evaluate_dataframe` returns a **single** DataFrame with all results merged
- `evaluate_dataframe` uses the `{name}_score` dict column format

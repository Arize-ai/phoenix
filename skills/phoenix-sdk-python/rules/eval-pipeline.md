# Complete Evaluation Pipeline

End-to-end recipe for building an evaluation script that fetches traces from Phoenix and runs evaluators. Use this as your starting template — do NOT fall back to training data patterns.

## Full Working Template

```python
#!/usr/bin/env python3
"""Evaluation pipeline: fetch traces from Phoenix, run evaluators, report results."""

import json
import os
import sys

import pandas as pd
from phoenix.client import Client                    # NOT: from phoenix import Client
from phoenix.evals import (
    create_evaluator,          # Decorator for code-based evaluators
    create_classifier,         # Factory for LLM classification evaluators
    evaluate_dataframe,        # Batch evaluate a DataFrame
)
from phoenix.evals.llm import LLM                    # NOT: AnthropicModel, OpenAIModel


# --- Step 1: Connect to Phoenix ---

def get_phoenix_client() -> Client:
    """Create a Phoenix client from environment variables."""
    # The OTEL collector endpoint and the Client base URL are DIFFERENT.
    # Collector: https://app.phoenix.arize.com/v1/traces  (for sending traces)
    # Client:    https://app.phoenix.arize.com             (for fetching data)
    collector = os.environ.get("PHOENIX_COLLECTOR_ENDPOINT", "")
    base_url = collector.rstrip("/")
    if base_url.endswith("/v1/traces"):
        base_url = base_url[: -len("/v1/traces")]

    api_key = os.environ.get("PHOENIX_API_KEY", "")

    return Client(base_url=base_url, api_key=api_key)  # NOT: Client() or Client(endpoint=...)


# --- Step 2: Fetch traces ---

def fetch_traces(client: Client, project_name: str, limit: int = 100) -> pd.DataFrame:
    """Fetch root spans from Phoenix."""
    df = client.spans.get_spans_dataframe(       # NOT: client.get_spans_dataframe(...)
        project_identifier=project_name,          # NOT: project_name=
        root_spans_only=True,                     # Essential for evaluation
        limit=limit,                              # NOT: start_time/end_time filters
    )
    if df is None or df.empty:
        return pd.DataFrame()
    return df


# --- Step 3: Prepare data for evaluators ---

def prepare_eval_dataframe(df: pd.DataFrame) -> pd.DataFrame:
    """Extract input/output columns and parse JSON outputs."""
    # Root span output is often JSON — extract the answer text
    def extract_answer(output_value):
        if not isinstance(output_value, str):
            return str(output_value) if output_value is not None else ""
        try:
            parsed = json.loads(output_value)
            if isinstance(parsed, dict):
                # Common keys: "answer", "result", "output", "response"
                for key in ("answer", "result", "output", "response"):
                    if key in parsed:
                        return str(parsed[key])
        except (json.JSONDecodeError, TypeError):
            pass
        return output_value

    result = pd.DataFrame()
    result["input"] = df["attributes.input.value"].fillna("")
    result["output"] = df["attributes.output.value"].fillna("").apply(extract_answer)
    result["trace_id"] = df["context.trace_id"] if "context.trace_id" in df.columns else ""
    return result[result["input"].str.len() > 0]  # Drop rows with no input


# --- Step 4: Define evaluators ---

# Code-based evaluator (deterministic — use for anything you CAN check with code)
@create_evaluator(name="has_answer", kind="code")
def has_answer(output: str) -> bool:
    """Check that the response is non-empty."""
    return len(output.strip()) > 10

# LLM-based classifier (use ONLY for subjective judgments)
def make_relevance_classifier() -> object:
    llm = LLM(provider="anthropic", model="claude-sonnet-4-20250514")  # NOT: AnthropicModel(...)
    return create_classifier(
        name="relevance",
        prompt_template="""Is this response relevant to the user's question?

<question>{input}</question>
<response>{output}</response>

Answer (relevant/irrelevant):""",
        llm=llm,
        choices={"relevant": 1.0, "irrelevant": 0.0},
    )


# --- Step 5: Run evaluations ---

def run_evaluations(eval_df: pd.DataFrame, evaluators: list) -> pd.DataFrame:
    """Run all evaluators via evaluate_dataframe."""
    return evaluate_dataframe(                    # NOT: run_evals() or evaluator.evaluate()
        dataframe=eval_df,
        evaluators=evaluators,
        exit_on_error=False,
    )


# --- Step 6: Extract results ---

def extract_eval_results(results_df: pd.DataFrame, eval_name: str) -> dict:
    """Extract score and failed examples from evaluate_dataframe results."""
    score_col = f"{eval_name}_score"
    if score_col not in results_df.columns:
        return {"score": 0.0, "num_samples": 0, "failed_examples": []}

    # Result columns contain DICTS, not raw numbers
    scores = results_df[score_col].apply(
        lambda x: x.get("score", 0.0) if isinstance(x, dict) else 0.0
    )

    mean_score = float(scores.mean()) if len(scores) > 0 else 0.0

    # Collect failed examples
    failed_mask = scores < 0.5
    failed_examples = []
    for idx in results_df[failed_mask].head(3).index:
        row = results_df.loc[idx]
        failed_examples.append({
            "query": str(row.get("input", "")),
            "response_snippet": str(row.get("output", ""))[:200],
            "reason": f"{eval_name} check failed",
        })

    return {
        "score": mean_score,
        "num_samples": len(scores),
        "failed_examples": failed_examples,
    }


# --- Putting it all together ---

def main():
    project_name = os.environ.get("PHOENIX_PROJECT_NAME", "default")

    client = get_phoenix_client()
    traces_df = fetch_traces(client, project_name)

    if traces_df.empty:
        print("No traces found", file=sys.stderr)
        # Handle gracefully — output empty results, don't crash
        return

    eval_df = prepare_eval_dataframe(traces_df)
    print(f"Evaluating {len(eval_df)} traces", file=sys.stderr)

    evaluators = [has_answer, make_relevance_classifier()]
    results_df = run_evaluations(eval_df, evaluators)

    for eval_name in ["has_answer", "relevance"]:
        result = extract_eval_results(results_df, eval_name)
        print(f"{eval_name}: {result['score']:.2f} ({result['num_samples']} samples)", file=sys.stderr)
```

## Key Points This Template Enforces

| Step | Correct Pattern | Common Mistake |
|------|----------------|----------------|
| Import Client | `from phoenix.client import Client` | `from phoenix import Client` |
| Create client | `Client(base_url=..., api_key=...)` | `Client()` or `Client(endpoint=...)` |
| Base URL | Strip `/v1/traces` from collector endpoint | Using collector endpoint directly |
| Fetch spans | `client.spans.get_spans_dataframe(...)` | `client.get_spans_dataframe(...)` |
| Project param | `project_identifier=` | `project_name=` (deprecated) |
| Limit results | `limit=100` | `start_time=now-1h` (misses data) |
| Parse output | Extract `answer` from JSON | Assume plain text |
| LLM wrapper | `LLM(provider="anthropic", model="...")` | `AnthropicModel(model="...")` |
| Run evals | `evaluate_dataframe(df, evaluators)` | `evaluator.evaluate(df)` or `run_evals()` |
| Read scores | `x.get("score", 0.0)` from dict | `.mean()` on dict column |

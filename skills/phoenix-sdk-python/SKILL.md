---
name: phoenix-sdk-python
description: Current Phoenix Python SDK patterns for client, evals, and tracing. Corrects common mistakes from outdated training data. Use when writing Python code that uses phoenix.client or phoenix.evals.
license: Apache-2.0
metadata:
  author: oss@arize.com
  version: "1.0.0"
  languages: Python
---

# Phoenix Python SDK

Correct, up-to-date patterns for the Phoenix Python SDK. This skill exists because LLMs frequently generate code using outdated Phoenix 1.0 patterns from their training data.

## Quick Reference

| Task | Files |
| ---- | ----- |
| **End-to-end eval pipeline (START HERE)** | **`eval-pipeline`** |
| Client setup & fetching spans | `client-setup` |
| Code-based evaluators | `evaluators-code` |
| LLM-based evaluators | `evaluators-llm` |
| Batch evaluation with DataFrames | `evaluate-dataframe` |
| Common mistakes to avoid | `common-mistakes` |

**If you are writing an evaluation script**, read `eval-pipeline` first — it has a complete working template that avoids all common pitfalls.

## CRITICAL: Avoid Outdated Patterns

**DO NOT USE** these legacy 1.0 patterns (common in training data):

| Outdated (1.0) | Current (2.0) |
| --------------- | ------------- |
| `OpenAIModel(model="gpt-4")` | `LLM(provider="openai", model="gpt-4o")` |
| `AnthropicModel(model="...")` | `LLM(provider="anthropic", model="...")` |
| `run_evals(dataframe, evaluators)` | `evaluate_dataframe(dataframe, evaluators)` |
| `llm_classify(dataframe, template, model, rails)` | `create_classifier(name, prompt_template, llm, choices)` |
| `HallucinationEvaluator(model)` | `FaithfulnessEvaluator(llm=llm)` or custom classifier |
| `QAEvaluator(model)` | Custom `create_classifier()` |
| `project_name=` in `get_spans_dataframe` | `project_identifier=` |
| `Client(endpoint="...")` | `Client(base_url="...", api_key="...")` |

## Correct Imports

```python
# Client
from phoenix.client import Client

# Evals 2.0 API
from phoenix.evals import (
    create_classifier,       # Factory for LLM classification evaluators
    create_evaluator,        # Decorator for code-based evaluators
    evaluate_dataframe,      # Batch evaluate a DataFrame
    ClassificationEvaluator, # LLM classification evaluator class
    LLMEvaluator,           # Base LLM evaluator class
    Score,                   # Score dataclass
)
from phoenix.evals.llm import LLM  # Provider-agnostic LLM wrapper

# Pre-built evaluators
from phoenix.evals.metrics import (
    FaithfulnessEvaluator,     # Checks faithfulness to context
    DocumentRelevanceEvaluator, # Checks document relevance
    CorrectnessEvaluator,      # Checks answer correctness
)
```

## Minimal Working Example

```python
import pandas as pd
from phoenix.client import Client
from phoenix.evals import create_evaluator, create_classifier, evaluate_dataframe
from phoenix.evals.llm import LLM

# 1. Fetch spans
client = Client(base_url="https://app.phoenix.arize.com/s/your-space", api_key="...")
df = client.spans.get_spans_dataframe(
    project_identifier="my-project",
    root_spans_only=True,
    limit=50,
)

# 2. Prepare data — rename columns for evaluators
df = df.rename(columns={
    "attributes.input.value": "input",
    "attributes.output.value": "output",
})

# 3. Code-based evaluator
@create_evaluator(name="has_answer", kind="code")
def has_answer(output: str) -> bool:
    return len(output.strip()) > 0

# 4. LLM-based classifier
llm = LLM(provider="openai", model="gpt-4o")
relevance = create_classifier(
    name="relevance",
    prompt_template="Is this response relevant?\n<question>{input}</question>\n<response>{output}</response>\nAnswer (relevant/irrelevant):",
    llm=llm,
    choices={"relevant": 1.0, "irrelevant": 0.0},
)

# 5. Run evaluations
results = evaluate_dataframe(dataframe=df, evaluators=[has_answer, relevance])

# 6. Extract scores (results are dicts, not raw numbers!)
scores = results["relevance_score"].apply(lambda x: x.get("score", 0.0))
print(f"Relevance: {scores.mean():.2f}")
```

## Key Principles

| Principle | Details |
| --------- | ------- |
| Results are dicts | `evaluate_dataframe` returns `{name}_score` columns containing Score dicts, not raw numbers |
| Template vars | Both `{input}` and `{{input}}` work in prompt templates |
| Code first | Use `@create_evaluator(kind="code")` for deterministic checks before resorting to LLM |
| LLM for nuance | Use `create_classifier()` only for subjective judgments |
| Root spans only | Always use `root_spans_only=True` when fetching spans for evaluation |

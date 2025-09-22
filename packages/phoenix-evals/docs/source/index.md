# Phoenix Evals Reference

Welcome to the Phoenix Evals Reference documentation. This package provides evaluation tools and utilities for LLM applications, including tools to determine relevance, toxicity, hallucination detection, and much more.

## Features

Phoenix Evals provides **lightweight, composable building blocks** for writing and running evaluations:

- **Works with your preferred model SDKs** via adapters (OpenAI, LiteLLM, LangChain)
- **Powerful input mapping and binding** for working with complex data structures
- **Several pre-built metrics** for common evaluation tasks like hallucination detection
- **Evaluators are natively instrumented** via OpenTelemetry tracing for observability and dataset curation
- **Blazing fast performance** - achieve up to 20x speedup with built-in concurrency and batching
- **Tons of convenience features** to improve the developer experience!

## Installation

Install the Phoenix Evals package using pip:

```bash
pip install 'arize-phoenix-evals>=2.0.0' openai
```

## Quick Start

```python
from phoenix.evals import create_classifier
from phoenix.evals.llm import LLM

# Create an LLM instance
llm = LLM(provider="openai", model="gpt-4o")

# Create an evaluator
evaluator = create_classifier(
    name="helpfulness",
    prompt_template="Rate the response to the user query as helpful or not:\n\nQuery: {input}\nResponse: {output}",
    llm=llm,
    choices={"helpful": 1.0, "not_helpful": 0.0},
)

# Simple evaluation
scores = evaluator.evaluate({"input": "How do I reset?", "output": "Go to settings > reset."})
scores[0].pretty_print()

# With input mapping for nested data
scores = evaluator.evaluate(
    {"data": {"query": "How do I reset?", "response": "Go to settings > reset."}},
    input_mapping={"input": "data.query", "output": "data.response"}
)
scores[0].pretty_print()
```

## Core Functions

The main evaluation functions that power the package:

- **`create_classifier`**: Create LLM-based classification evaluators
- **`create_evaluator`**: Create custom evaluators from functions
- **`bind_evaluator`**: Bind evaluators with input mappings
- **`evaluate_dataframe`**: Evaluate dataframes with multiple evaluators
- **Legacy functions**: `llm_classify`, `llm_generate`, and `run_evals` (available in `phoenix.evals.legacy`)

## Usage Examples

```python
import pandas as pd
from phoenix.evals import create_classifier, evaluate_dataframe
from phoenix.evals.llm import LLM

# Create an LLM instance
llm = LLM(provider="openai", model="gpt-4o")

# Create evaluators
relevance_evaluator = create_classifier(
    name="relevance",
    prompt_template="Is the response relevant to the query?\n\nQuery: {input}\nResponse: {output}",
    llm=llm,
    choices={"relevant": 1.0, "irrelevant": 0.0},
)

helpfulness_evaluator = create_classifier(
    name="helpfulness",
    prompt_template="Is the response helpful?\n\nQuery: {input}\nResponse: {output}",
    llm=llm,
    choices={"helpful": 1.0, "not_helpful": 0.0},
)

# Prepare your dataframe
df = pd.DataFrame([
    {"input": "How do I reset my password?", "output": "Go to settings > account > reset password."},
    {"input": "What's the weather like?", "output": "I can help you with password resets."},
])

# Evaluate the dataframe
results_df = evaluate_dataframe(
    dataframe=df,
    evaluators=[relevance_evaluator, helpfulness_evaluator],
)

print(results_df.head())
```

## External Links

- [Main Phoenix Documentation](https://arize.com/docs/phoenix)
- [Python Reference](https://arize-phoenix.readthedocs.io/)
- [GitHub Repository](https://github.com/Arize-ai/phoenix)

## API Reference

```{toctree}
:maxdepth: 2
:caption: API Reference

api/evals
api/legacy
```

## Indices and tables

- {ref}`genindex`
- {ref}`modindex`
- {ref}`search`

# Phoenix Evals Reference

Welcome to the Phoenix Evals Reference documentation. This package provides evaluation tools and utilities for LLM applications, including tools to determine relevance, toxicity, hallucination detection, and much more.

## Installation

Install the Phoenix Evals package using pip:

```bash
pip install arize-phoenix-evals
```

## Quick Start

```python
import os
from phoenix.evals import (
    RAG_RELEVANCY_PROMPT_TEMPLATE,
    RAG_RELEVANCY_PROMPT_RAILS_MAP,
    OpenAIModel,
    llm_classify,
)

# Set your API key
os.environ["OPENAI_API_KEY"] = "your-openai-key"

# Create a model
model = OpenAIModel(model="gpt-4", temperature=0.0)

# Prepare your dataset
import pandas as pd

df = pd.DataFrame([
    {
        "reference": "The Eiffel Tower is located in Paris, France. It was constructed in 1889 as the entrance arch to the 1889 World's Fair.",
        "query": "Where is the Eiffel Tower located?",
        "response": "The Eiffel Tower is located in Paris, France.",
    },
    {
        "reference": "The Great Wall of China is over 13,000 miles long. It was built over many centuries by various Chinese dynasties to protect against nomadic invasions.",
        "query": "How long is the Great Wall of China?",
        "response": "The Great Wall of China is approximately 13,171 miles (21,196 kilometers) long.",
    },
    {
        "reference": "The Amazon rainforest is the largest tropical rainforest in the world. It covers much of northwestern Brazil and extends into Colombia, Peru and other South American countries.",
        "query": "What is the largest tropical rainforest?",
        "response": "The Amazon rainforest is the largest tropical rainforest in the world. It is home to the largest number of plant and animal species in the world.",
    },
])

# Evaluate your data
rails = list(RAG_RELEVANCY_PROMPT_RAILS_MAP.values())
results = llm_classify(df, model, RAG_RELEVANCY_PROMPT_TEMPLATE, rails)
```

## Core Functions
The main evaluation functions that power the package:
- **`llm_classify`**: Classify data using LLM-based evaluation
- **`llm_generate`**: Generate synthetic data or prompt an LLM over a dataframe of variables
- **`run_evals`**: Run evaluation suites

## Usage Examples

### Hallucination and QA Evaluation
```python
from phoenix.evals import HallucinationEvaluator, QAEvaluator, OpenAIModel, run_evals

# Prepare columns as required by evaluators
# for `hallucination_evaluator` the input df needs to have columns 'output', 'input', 'context'
# for `qa_evaluator` the input df needs to have columns 'output', 'input', 'reference'
df["context"] = df["reference"]
df.rename(columns={"query": "input", "response": "output"}, inplace=True)

# Set up evaluators
eval_model = OpenAIModel(model="gpt-4o")
hallucination_evaluator = HallucinationEvaluator(eval_model)
qa_evaluator = QAEvaluator(eval_model)

# Run evaluations
hallucination_eval_df, qa_eval_df = run_evals(
    dataframe=df,
    evaluators=[hallucination_evaluator, qa_evaluator],
    provide_explanation=True
)

# Combine results to analyze your evaluations 
results_df = df.copy()
results_df["hallucination_eval"] = hallucination_eval_df["label"]
results_df["hallucination_explanation"] = hallucination_eval_df["explanation"]
results_df["qa_eval"] = qa_eval_df["label"]
results_df["qa_explanation"] = qa_eval_df["explanation"]
results_df.head()
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
```

## Indices and tables

- {ref}`genindex`
- {ref}`modindex`
- {ref}`search` 
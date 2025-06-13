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

### RAG Relevance Evaluation
```python
from phoenix.evals import RelevanceEvaluator, OpenAIModel

model = OpenAIModel(model="gpt-4")
evaluator = RelevanceEvaluator(model=model)

# Example queries and documents
queries = [
    "What are the health benefits of green tea?",
    "How does photosynthesis work?"
]
documents = [
    "Green tea contains antioxidants that may improve health.",
    "Photosynthesis is the process by which plants convert sunlight into energy."
]

# Evaluate relevance of documents to queries
results = evaluator.evaluate(
    input=queries,
    reference=documents
)

### Hallucination Detection
```python
from phoenix.evals import HallucinationEvaluator, OpenAIModel

model = OpenAIModel(model="gpt-4")
evaluator = HallucinationEvaluator(model=model)

# Example input data
questions = [
    "What is the capital of France?",
    "Who wrote 'Pride and Prejudice'?"
]
responses = [
    "The capital of France is Paris.",
    "Pride and Prejudice was written by Jane Austen."
]
contexts = [
    "France's capital city is Paris.",
    "'Pride and Prejudice' is a novel by Jane Austen."
]

# Check for hallucinations in responses
results = evaluator.evaluate(
    input=questions,
    output=responses,
    reference=contexts
)
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
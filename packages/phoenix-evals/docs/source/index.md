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

# Evaluate your data
rails = list(RAG_RELEVANCY_PROMPT_RAILS_MAP.values())
results = llm_classify(df, model, RAG_RELEVANCY_PROMPT_TEMPLATE, rails)
```

## Package Structure

Phoenix Evals organizes its functionality into several key components:

### Core Functions
The main evaluation functions that power the package:
- **`llm_classify`**: Classify data using LLM-based evaluation
- **`llm_generate`**: Generate text-based evaluations
- **`run_evals`**: Run comprehensive evaluation suites

### Evaluators
Pre-built evaluators for common evaluation tasks:
- **`RelevanceEvaluator`**: Assess relevance of retrieved documents
- **`HallucinationEvaluator`**: Detect hallucinations in responses
- **`ToxicityEvaluator`**: Identify toxic content
- **`QAEvaluator`**: Evaluate question-answering quality
- **`SummarizationEvaluator`**: Assess summarization quality
- **`SQLEvaluator`**: Validate SQL query generation

### Models
Support for multiple LLM providers:
- **`OpenAIModel`**: OpenAI GPT models
- **`AnthropicModel`**: Anthropic Claude models
- **`GeminiModel`**: Google Gemini models
- **`VertexAIModel`**: Google Vertex AI models
- **`BedrockModel`**: AWS Bedrock models
- **`LiteLLMModel`**: Universal provider interface
- **`MistralAIModel`**: Mistral AI models

### Templates
Prompt templates for evaluation tasks:
- **`PromptTemplate`**: Base template class
- **`ClassificationTemplate`**: Templates for classification tasks
- Pre-built templates like `RAG_RELEVANCY_PROMPT_TEMPLATE`

### Utilities
Helper functions for evaluation workflows:
- **`download_benchmark_dataset`**: Access benchmark datasets
- **`compute_precisions_at_k`**: Calculate precision metrics

## Usage Examples

### RAG Relevance Evaluation
```python
from phoenix.evals import RelevanceEvaluator, OpenAIModel

model = OpenAIModel(model="gpt-4")
evaluator = RelevanceEvaluator(model=model)

# Evaluate relevance of documents to queries
results = evaluator.evaluate(
    input=queries,
    reference=documents
)
```

### Hallucination Detection
```python
from phoenix.evals import HallucinationEvaluator, OpenAIModel

model = OpenAIModel(model="gpt-4")
evaluator = HallucinationEvaluator(model=model)

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
# arize-phoenix-evals

<p align="center">
    <a href="https://pypi.org/project/arize-phoenix-evals/">
        <img src="https://img.shields.io/pypi/v/arize-phoenix-evals" alt="PyPI Version">
    </a>
    <a href="https://arize-phoenix.readthedocs.io/projects/evals/en/latest/index.html">
        <img src="https://img.shields.io/badge/docs-blue?logo=readthedocs&logoColor=white" alt="Documentation">
    </a>
    <img referrerpolicy="no-referrer-when-downgrade" src="https://static.scarf.sh/a.png?x-pxid=8e8e8b34-7900-43fa-a38f-1f070bd48c64&page=packages/phoenix-evals/README.md" />
</p>

Phoenix Evals provides **lightweight, composable building blocks** for writing and running evaluations on LLM applications, including tools to determine relevance, toxicity, hallucination detection, and much more.

## Features

- **Works with your preferred model SDKs** via adapters (OpenAI, LiteLLM, LangChain)
- **Powerful input mapping and binding** for working with complex data structures
- **Several pre-built metrics** for common evaluation tasks like hallucination detection
- **Evaluators are natively instrumented** via OpenTelemetry tracing for observability and dataset curation
- **Blazing fast performance** - achieve up to 20x speedup with built-in concurrency and batching
- **Tons of convenience features** to improve the developer experience!

## Installation

Install Phoenix Evals 2.0 using pip:

```shell
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

## Pre-Built Evaluators

The `phoenix.evals.metrics` module provides ready-to-use evaluators for common tasks:

| Evaluator | Class | Description |
| --------- | ----- | ----------- |
| Faithfulness | `FaithfulnessEvaluator` | Detects hallucinations — checks if output is grounded in context |
| Conciseness | `ConcisenessEvaluator` | Evaluates whether the response is appropriately concise |
| Correctness | `CorrectnessEvaluator` | Checks if the output is factually correct |
| Document Relevance | `DocumentRelevanceEvaluator` | Measures how relevant a retrieved document is to a query |
| Refusal | `RefusalEvaluator` | Detects whether the model refused to answer |
| Tool Invocation | `ToolInvocationEvaluator` | Checks whether the correct tool was called with the right arguments |
| Tool Selection | `ToolSelectionEvaluator` | Evaluates whether the right tool was selected for the task |
| Tool Response Handling | `ToolResponseHandlingEvaluator` | Evaluates how well the model uses a tool's response |
| Exact Match | `exact_match` | Checks for exact string equality between output and expected |
| Regex Match | `MatchesRegex` | Checks whether the output matches a regular expression |
| Precision/Recall | `PrecisionRecallFScore` | Computes precision, recall, and F-score for classification tasks |

```python
from phoenix.evals.llm import LLM
from phoenix.evals.metrics import FaithfulnessEvaluator, exact_match, MatchesRegex

llm = LLM(provider="openai", model="gpt-4o")

# LLM-powered faithfulness evaluator
faithfulness = FaithfulnessEvaluator(llm=llm)
scores = faithfulness.evaluate({
    "input": "What is the capital of France?",
    "context": "Paris is the capital of France.",
    "output": "The capital of France is Berlin.",
})
scores[0].pretty_print()
# Score(name='faithfulness', score=0.0, label='unfaithful', explanation='...')

# Code-based exact match
match_result = exact_match({"output": "Paris", "expected": "Paris"})

# Regex match
regex_result = MatchesRegex(pattern=r"^\d{4}-\d{2}-\d{2}$").evaluate({
    "output": "2024-03-15"
})
```

## LLM Providers

The `LLM` class supports multiple AI providers:

```python
from phoenix.evals.llm import LLM

# OpenAI
llm = LLM(provider="openai", model="gpt-4o")

# Anthropic
llm = LLM(provider="anthropic", model="claude-3-5-sonnet-20241022")

# Google Gemini
llm = LLM(provider="google", model="gemini-1.5-pro")

# LiteLLM (unified interface for 100+ providers)
llm = LLM(provider="litellm", model="gpt-4o")
```

## Evaluating Dataframes

```python
import pandas as pd
from phoenix.evals import create_classifier, evaluate_dataframe, async_evaluate_dataframe
from phoenix.evals.llm import LLM

# Create an LLM instance
llm = LLM(provider="openai", model="gpt-4o")

# Create multiple evaluators
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

# Synchronous evaluation
results_df = evaluate_dataframe(
    dataframe=df,
    evaluators=[relevance_evaluator, helpfulness_evaluator],
)
print(results_df.head())

# Async evaluation (up to 20x faster with large dataframes)
import asyncio
results_df = asyncio.run(async_evaluate_dataframe(
    dataframe=df,
    evaluators=[relevance_evaluator, helpfulness_evaluator],
))
```

## Documentation

- **[Full Documentation](https://arize-phoenix.readthedocs.io/projects/evals/en/latest/index.html)** - Complete API reference and guides
- **[Phoenix Docs](https://arize.com/docs/phoenix)** - Detailed use-cases and examples
- **[OpenInference](https://github.com/Arize-ai/openinference)** - Auto-instrumentation libraries for frameworks

## Community

Join our community to connect with thousands of AI builders:

- 🌍 Join our [Slack community](https://join.slack.com/t/arize-ai/shared_invite/zt-3r07iavnk-ammtATWSlF0pSrd1DsMW7g).
- 📚 Read the [Phoenix documentation](https://arize.com/docs/phoenix).
- 💡 Ask questions and provide feedback in the _#phoenix-support_ channel.
- 🌟 Leave a star on our [GitHub](https://github.com/Arize-ai/phoenix).
- 🐞 Report bugs with [GitHub Issues](https://github.com/Arize-ai/phoenix/issues).
- 𝕏 Follow us on [𝕏](https://twitter.com/ArizePhoenix).
- 🗺️ Check out our [roadmap](https://github.com/orgs/Arize-ai/projects/45) to see where we're heading next.

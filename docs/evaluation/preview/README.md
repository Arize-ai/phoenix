# phoenix-evals preview module

The preview module provides lightweight, composable building blocks for writing, running, and composing LLM and heuristic evaluations. It focuses on simple primitives with strong defaults and clear ergonomics.

- Imports live under `phoenix.evals.preview`.
- Works with your preferred model SDKs via adapters (OpenAI, LiteLLM, LangChain).
- Includes templating utilities and pre-built metrics/evaluators.
- Features powerful input mapping and binding for complex data structures.

Sections
- Core evaluators and scoring: see `evaluators.md`
- Prompt templating: see `templating.md`
- LLM wrapper and adapters: see `llm.md`
- Built-in metrics and LLM evaluators: see `metrics.md`

## Quick start
```python
from phoenix.evals.preview import create_classifier
from phoenix.evals.preview.llm import LLM

llm = LLM(provider="openai", model="gpt-4o", client="openai")

evaluator = create_classifier(
    name="helpfulness",
    prompt_template="Rate the response to the user query as helpful or not:\n\nQuery: {input}\nResponse: {output}",
    llm=llm,
    choices={"helpful": 1.0, "not_helpful": 0.0},
)

# Simple evaluation
scores = evaluator({"input": "How do I reset?", "output": "Go to settings > reset."})
scores[0].pretty_print()

# With input mapping for nested data
scores = evaluator(
    {"data": {"query": "How do I reset?", "response": "Go to settings > reset."}},
    input_mapping={"input": "data.query", "output": "data.response"}
)
scores[0].pretty_print()
```

## Installation notes
- Install `openai`, `litellm`, or `langchain` only if you use those adapters. The library detects availability automatically.
- Set your provider's API keys in the environment as usual for the chosen SDK.


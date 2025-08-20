### LLM wrapper and adapters

The preview LLM wrapper unifies text, structured output, and classification across providers by delegating to installed SDKs via adapters.

Public API
- Classes: `LLM`, `AsyncLLM`
- Helpers: `show_provider_availability()`, `generate_classification_schema(labels, include_explanation=True, description=None)`

LLM
- Constructor: `LLM(provider: str, model: str, client: str | None = None)`
- Methods:
  - `generate_text(prompt: str | MultimodalPrompt, **kwargs) -> str`
  - `generate_object(prompt: str | MultimodalPrompt, schema: dict, **kwargs) -> dict`
  - `generate_classification(prompt: str | MultimodalPrompt, labels: list[str] | dict[str,str], include_explanation: bool = True, description: str | None = None, **kwargs) -> dict`

AsyncLLM mirrors the same methods with async variants.

Providers and clients
- OpenAI: client="openai" (requires `openai`)
- LiteLLM: client="litellm" (requires `litellm`) for OpenAI/Anthropic style models
- LangChain: client="langchain" (requires `langchain` + provider packages)
- Run `show_provider_availability()` to see what’s enabled in your environment.

Object generation methods
- Adapters may use structured output (response_format/json_schema), tool calling, or fallback automatically. You usually don’t need to select a method; the adapter chooses based on capabilities.

Examples
1) Text generation
```python
from phoenix.evals.preview.llm import LLM, show_provider_availability

show_provider_availability()
llm = LLM(provider="openai", model="gpt-4o", client="openai")
print(llm.generate_text("Say hello to Phoenix!"))
```

2) Structured output
```python
from phoenix.evals.preview.llm import LLM

llm = LLM(provider="openai", model="gpt-4o", client="openai")
schema = {
  "type": "object",
  "properties": {
    "label": {"type": "string", "enum": ["yes", "no"]},
    "explanation": {"type": "string"},
  },
  "required": ["label"]
}
obj = llm.generate_object("Answer yes or no with optional explanation.", schema)
```

3) Classification convenience
```python
from phoenix.evals.preview.llm import LLM

llm = LLM(provider="openai", model="gpt-4o", client="openai")
result = llm.generate_classification(
    prompt="Is this helpful?", labels=["yes", "no"], include_explanation=True
)
print(result)  # {"label": "yes", "explanation": "..."}
```


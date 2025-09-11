# LLM wrapper and adapters

The preview LLM wrapper unifies text, structured output, and classification across providers by delegating to installed SDKs via adapters.

It allows you to invoke models using the keyword arguments you are already familiar with. 

### Public API
- Classes: `LLM`
- Helpers: `show_provider_availability()`, `generate_classification_schema(labels, include_explanation=True, description=None)`

### LLM
- Constructor: `LLM(provider: str, model: str, client: str | None = None)`
- Sync Methods:
  - `generate_text(prompt: str | MultimodalPrompt, **kwargs) -> str`
  - `generate_object(prompt: str | MultimodalPrompt, schema: dict, method: str, **kwargs) -> dict`
  - `generate_classification(prompt: str | MultimodalPrompt, labels: list[str] | dict[str,str], include_explanation: bool = True, description: str | None = None, **kwargs) -> dict`
- Async Methods:
  - `async_generate_text(prompt: str | MultimodalPrompt, **kwargs) -> str`
  - `async_generate_object(prompt: str | MultimodalPrompt, schema: dict, method: str, **kwargs) -> dict`
  - `async_generate_classification(prompt: str | MultimodalPrompt, labels: list[str] | dict[str,str], include_explanation: bool = True, description: str | None = None, **kwargs) -> dict`

The LLM class provides both synchronous and asynchronous methods for all operations. Use the sync methods (without the 'a' prefix) for synchronous code, and the async methods (with the 'a' prefix) for asynchronous code.

### Providers and clients
- OpenAI: client="openai" (requires `openai`)
- LiteLLM: client="litellm" (requires `litellm`) for OpenAI/Anthropic style models
- LangChain: client="langchain" (requires `langchain` + provider packages)
- Run `show_provider_availability()` to see what's enabled in your environment.

### Object generation methods
- You can specify the object generation method: either structured output (response_format/json_schema) or tool calling. You usually don't need to select a method; the adapter chooses based on capabilities with the "auto" method.

## Examples
1) Text generation
```python
from phoenix.evals.preview.llm import LLM, show_provider_availability

show_provider_availability()
llm = LLM(provider="openai", model="gpt-4o")
print(llm.generate_text("Say hello to Phoenix!"))
```

2) Structured output
```python
from phoenix.evals.preview.llm import LLM

llm = LLM(provider="anthropic", model="claude-3-7-sonnet-20250219")
schema = {
  "type": "object",
  "properties": {
    "label": {"type": "string", "enum": ["yes", "no"]},
    "explanation": {"type": "string"},
  },
  "required": ["label"]
}
obj = llm.generate_object("Answer yes or no with optional explanation.", schema)
# returns {"label": "yes", "explanation": "..."}
```

3) Classification convenience
```python
from phoenix.evals.preview.llm import LLM

llm = LLM(provider="openai", model="gpt-4o", client="langchain") # can specify SDK
result = llm.generate_classification(
    prompt="Is this helpful?", labels=["yes", "no"], include_explanation=True
)
# returns {"label": "yes", "explanation": "..."}
```

4) Async usage
```python
import asyncio
from phoenix.evals.preview.llm import LLM

async def main():
    llm = LLM(provider="openai", model="gpt-4o")
    
    # Async text generation
    text = await llm.async_generate_text("Say hello to Phoenix!")
    print(text)
    
    # Async structured output
    schema = {
        "type": "object",
        "properties": {
            "label": {"type": "string", "enum": ["yes", "no"]},
            "explanation": {"type": "string"},
        },
        "required": ["label"]
    }
    obj = await llm.async_generate_object("Answer yes or no with optional explanation.", schema)
    print(obj)
    
    # Async classification
    result = await llm.async_generate_classification(
        prompt="Is this helpful?", labels=["yes", "no"], include_explanation=True
    )
    print(result)

asyncio.run(main())
```


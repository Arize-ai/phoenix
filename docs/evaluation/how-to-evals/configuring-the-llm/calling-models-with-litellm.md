# Calling models with LiteLLM

The [LiteLLM](https://github.com/BerriAI/litellm) SDK provides a unified wrapper to call many different LLMs with the OpenAI format. We provide a `LiteLLM` passthrough to call arbitrary models using their interface by setting `provider="litellm"`. When doing so, the model needs to be a fully qualified model name which includes the LiteLLM provider route alongside the model name: `{provider_route}/{model_name}` . More information on how to call specific providers and their models can be found in the [LiteLLM documentation](https://docs.litellm.ai/docs/providers).

```python
from phoenix.evals.llm import LLM

# set vertex credentials in your env
LLM(
    provider="litellm",
    model="vertex_ai/gemini-2.5-pro",
)

llm.generate_text("hello, how are you today?")
```

---
description: Configure and run LiteLLM for evals
---

# LiteLLM Evals

{% hint style="info" %}
Need to install the extra dependency `litellm>=1.0.3`
{% endhint %}

```python
class LiteLLMModel(BaseEvalModel):
    model: str = "gpt-3.5-turbo"
    """The model name to use."""
    temperature: float = 0.0
    """What sampling temperature to use."""
    max_tokens: int = 256
    """The maximum number of tokens to generate in the completion."""
    top_p: float = 1
    """Total probability mass of tokens to consider at each step."""
    num_retries: int = 6
    """Maximum number to retry a model if an RateLimitError, OpenAIError, or
    ServiceUnavailableError occurs."""
    request_timeout: int = 60
    """Maximum number of seconds to wait when retrying."""
    model_kwargs: Dict[str, Any] = field(default_factory=dict)
    """Model specific params"""
```

You can choose among [multiple models](https://docs.litellm.ai/docs/providers) supported by LiteLLM. Make sure you have set the right environment variables set prior to initializing the model. For additional information about the environment variables for specific model providers visit: [LiteLLM provider specific params](https://docs.litellm.ai/docs/completion/input#provider-specific-params)

Here is an example of how to initialize `LiteLLMModel` for llama3 using ollama.

```python
import os

from phoenix.evals import LiteLLMModel

os.environ["OLLAMA_API_BASE"] = "http://localhost:11434"

model = LiteLLMModel(model="ollama/llama3")
```

{% embed url="https://colab.research.google.com/github/Arize-ai/phoenix/blob/main/tutorials/evals/local_llm.ipynb" %}
How to use Ollama with LiteLLMModel
{% endembed %}

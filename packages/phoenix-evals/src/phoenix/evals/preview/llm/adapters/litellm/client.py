from typing import Any


class LiteLLMClient:
    """
    Lightweight wrapper class that encapsulates LiteLLM provider and model information.

    Since LiteLLM doesn't have a traditional client object, this wrapper acts as the
    "client" that our adapter pattern expects, storing the provider, model, and
    configuration needed for LiteLLM calls.
    """

    def __init__(self, provider: str, model: str, **kwargs: Any):
        self.provider = provider
        self.model = model

        if provider == "litellm":
            self.model_string = model
        else:
            self.model_string = f"{provider}/{model}"

        self.config = kwargs

    def __repr__(self) -> str:
        return (
            f"LiteLLMClient(provider='{self.provider}', model='{self.model}', "
            f"model_string='{self.model_string}')"
        )

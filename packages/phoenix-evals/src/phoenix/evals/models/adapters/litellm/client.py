"""
LiteLLM client wrapper for the Universal LLM Wrapper system.
"""

from typing import Any, Dict


class LiteLLMClient:
    """
    Lightweight wrapper class that encapsulates LiteLLM provider and model information.

    Since LiteLLM doesn't have a traditional client object, this wrapper acts as the
    "client" that our adapter pattern expects, storing the provider, model, and
    configuration needed for LiteLLM calls.
    """

    def __init__(self, provider: str, model: str, **kwargs):
        """
        Initialize the LiteLLM client wrapper.

        Args:
            provider: The LiteLLM provider name (e.g., "cohere", "groq", "together_ai")
            model: The model name (e.g., "command-r-plus", "mixtral-8x7b-32768")
            **kwargs: Additional configuration options (temperature, max_tokens, etc.)
        """
        self.provider = provider
        self.model = model

        # Format model string for LiteLLM (provider/model format)
        if provider == "litellm":
            # For generic litellm provider, assume model is already in correct format
            self.model_string = model
        else:
            self.model_string = f"{provider}/{model}"

        # Store configuration options
        self.config = kwargs

    def __repr__(self) -> str:
        """String representation of the client."""
        return f"LiteLLMClient(provider='{self.provider}', model='{self.model}', model_string='{self.model_string}')"

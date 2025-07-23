"""
Factory functions for creating OpenAI clients.
"""

from typing import Any


class OpenAIClientWrapper:
    """Wrapper to store model name with OpenAI client."""

    def __init__(self, client: Any, model: str):
        self.client = client
        self.model = model

    def __getattr__(self, name: str) -> Any:
        """Delegate all attribute access to the wrapped client."""
        return getattr(self.client, name)


def create_openai_client(model: str, is_async: bool, **kwargs: Any) -> Any:
    """Factory function to create sync OpenAI clients."""
    try:
        from openai import OpenAI

        if is_async:
            client = AsyncOpenAI(**kwargs)
        else:
            client = OpenAI(**kwargs)

        return OpenAIClientWrapper(client, model)
    except ImportError:
        raise ImportError("OpenAI package not installed. Run: pip install openai")

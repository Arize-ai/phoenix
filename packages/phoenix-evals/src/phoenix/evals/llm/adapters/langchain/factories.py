"""
Factory functions for creating LangChain clients.
"""

from typing import Any


def create_openai_langchain_client(model: str, is_async: bool = False, **kwargs: Any) -> Any:
    """Factory function to create LangChain OpenAI clients."""
    try:
        from langchain_openai import ChatOpenAI

        return ChatOpenAI(model=model, **kwargs)
    except ImportError:
        raise ImportError(
            "LangChain OpenAI package not installed. Run: pip install langchain-openai"
        )


def create_anthropic_langchain_client(model: str, is_async: bool = False, **kwargs: Any) -> Any:
    """Factory function to create LangChain Anthropic clients."""
    try:
        from langchain_anthropic import ChatAnthropic

        return ChatAnthropic(model=model, **kwargs)
    except ImportError:
        raise ImportError(
            "LangChain Anthropic package not installed. Run: pip install langchain-anthropic"
        )

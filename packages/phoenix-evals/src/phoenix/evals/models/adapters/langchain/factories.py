"""
Factory functions for creating LangChain clients.
"""

from typing import Any


def _create_langchain_client(model: str, **kwargs) -> Any:
    """Factory function to create LangChain clients."""
    try:
        from langchain_openai import ChatOpenAI

        # Default to ChatOpenAI for now, could be extended to support other LangChain models
        return ChatOpenAI(model=model, **kwargs)
    except ImportError:
        try:
            from langchain.llms import OpenAI

            return OpenAI(model_name=model, **kwargs)
        except ImportError:
            raise ImportError(
                "LangChain package not installed. Run: pip install langchain langchain-openai"
            )


def _create_openai_langchain_client(model: str, **kwargs) -> Any:
    """Factory function to create LangChain OpenAI clients."""
    try:
        from langchain_openai import ChatOpenAI
        return ChatOpenAI(model=model, **kwargs)
    except ImportError:
        raise ImportError("LangChain OpenAI package not installed. Run: pip install langchain-openai")


def _create_anthropic_langchain_client(model: str, **kwargs) -> Any:
    """Factory function to create LangChain Anthropic clients."""
    try:
        from langchain_anthropic import ChatAnthropic
        return ChatAnthropic(model=model, **kwargs)
    except ImportError:
        raise ImportError("LangChain Anthropic package not installed. Run: pip install langchain-anthropic")

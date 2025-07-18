"""
Utility functions for the Universal LLM Wrapper system.
"""

from typing import Any, List, Optional, Tuple

from .core.registries import _adapter_registry, _provider_registry


def list_available_adapters() -> List[Tuple[str, int]]:
    """
    List all registered adapters with their priorities.

    Returns:
        List of tuples containing (adapter_name, priority)
    """
    return _adapter_registry.list_adapters()


def list_available_providers() -> List[str]:
    """
    List all available providers for client instantiation.

    Returns:
        List of provider names
    """
    return _provider_registry.list_providers()


def get_adapter_for_client(client: Any) -> Optional[str]:
    """
    Get the name of the adapter that would be used for a given client.

    Args:
        client: The client object to check

    Returns:
        Name of the matching adapter, or None if no adapter matches
    """
    adapter_class = _adapter_registry.find_adapter(client)
    if adapter_class is None:
        return None

    # Find the adapter name from the registry
    for registration in _adapter_registry._adapters:
        if registration.adapter_class == adapter_class:
            return registration.name
    return adapter_class.__name__


def create_example_openai_adapter() -> str:
    """
    Return example code for creating an OpenAI adapter with provider support.

    This is a utility function to help users understand how to extend
    the system with new adapters.
    """
    return '''
def _create_openai_client(model: str, **kwargs) -> Any:
    """Factory function to create OpenAI clients."""
    try:
        from openai import OpenAI
        return OpenAI(**kwargs)
    except ImportError:
        raise ImportError("OpenAI package not installed. Run: pip install openai")

@register_adapter(
    identifier=lambda client: client.__class__.__module__.startswith("openai"),
    priority=20,
    name="openai",
    provider="openai",
    client_factory=_create_openai_client,
    dependencies=["openai"]
)
class OpenAIAdapter(BaseLLMAdapter):
    """Adapter for OpenAI client objects."""

    def generate_text(self, prompt, instruction=None, **kwargs):
        # Implementation for OpenAI text generation
        messages = [{"role": "user", "content": prompt}]
        if instruction:
            messages.insert(0, {"role": "system", "content": instruction})

        response = self.client.chat.completions.create(
            model=kwargs.get("model", "gpt-3.5-turbo"),
            messages=messages,
            **{k: v for k, v in kwargs.items() if k != "model"}
        )
        return response.choices[0].message.content

    async def agenerate_text(self, prompt, instruction=None, **kwargs):
        # Implementation for async OpenAI text generation
        return self.generate_text(prompt, instruction, **kwargs)

    def generate_object(self, prompt, schema, instruction=None, **kwargs):
        # Implementation for OpenAI structured output
        import json
        structured_prompt = self._build_structured_instruction(prompt, schema, instruction)
        text = self.generate_text(structured_prompt, None, **kwargs)
        try:
            data = json.loads(text)
            return StructuredOutput(data=data, schema=schema)
        except json.JSONDecodeError:
            return StructuredOutput(data={}, schema=schema)

    async def agenerate_object(self, prompt, schema, instruction=None, **kwargs):
        # Implementation for async OpenAI structured output
        return self.generate_object(prompt, schema, instruction, **kwargs)
'''


def create_example_anthropic_adapter() -> str:
    """
    Return example code for creating an Anthropic adapter with provider support.
    """
    return '''
def _create_anthropic_client(model: str, **kwargs) -> Any:
    """Factory function to create Anthropic clients."""
    try:
        from anthropic import Anthropic
        return Anthropic(**kwargs)
    except ImportError:
        raise ImportError("Anthropic package not installed. Run: pip install anthropic")

@register_adapter(
    identifier=lambda client: client.__class__.__module__.startswith("anthropic"),
    priority=20,
    name="anthropic",
    provider="anthropic",
    client_factory=_create_anthropic_client,
    dependencies=["anthropic"]
)
class AnthropicAdapter(BaseLLMAdapter):
    """Adapter for Anthropic client objects."""

    def generate_text(self, prompt, instruction=None, **kwargs):
        # Implementation for Anthropic text generation
        messages = [{"role": "user", "content": prompt}]
        if instruction:
            messages.insert(0, {"role": "user", "content": instruction})

        response = self.client.messages.create(
            model=kwargs.get("model", "claude-3-sonnet-20240229"),
            messages=messages,
            max_tokens=kwargs.get("max_tokens", 1000),
            **{k: v for k, v in kwargs.items() if k not in ["model", "max_tokens"]}
        )
        return response.content[0].text

    async def agenerate_text(self, prompt, instruction=None, **kwargs):
        # Implementation for async Anthropic text generation
        return self.generate_text(prompt, instruction, **kwargs)

    def generate_object(self, prompt, schema, instruction=None, **kwargs):
        # Implementation for Anthropic structured output
        import json
        structured_prompt = self._build_structured_instruction(prompt, schema, instruction)
        text = self.generate_text(structured_prompt, None, **kwargs)
        try:
            data = json.loads(text)
            return StructuredOutput(data=data, schema=schema)
        except json.JSONDecodeError:
            return StructuredOutput(data={}, schema=schema)

    async def agenerate_object(self, prompt, schema, instruction=None, **kwargs):
        # Implementation for async Anthropic structured output
        return self.generate_object(prompt, schema, instruction, **kwargs)
'''

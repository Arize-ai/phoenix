import pytest

from phoenix.client.__generated__ import v1
from phoenix.client.types.prompts import OpenAIPrompt, PromptVersion


@pytest.mark.parametrize("has_id", [False, True])
def test_from_dict_preserves_prompt_version_data(has_id: bool) -> None:
    data: v1.PromptVersionData | v1.PromptVersion = {
        "model_provider": "OPENAI",
        "model_name": "gpt-4o",
        "template_type": "CHAT",
        "template_format": "MUSTACHE",
        "template": {"type": "chat", "messages": [{"role": "user", "content": "Hi {{name}}"}]},
        "invocation_parameters": {"type": "openai", "openai": {"temperature": 0.2}},
        "metadata": {"team": "support"},
        "description": "Greeting",
        "tools": {
            "type": "tools",
            "tools": [{"type": "function", "function": {"name": "get_weather"}}],
            "tool_choice": {"type": "zero_or_more"},
        },
    }
    if has_id:
        data = v1.PromptVersion(**data, id="version-1", created_at="2026-11-24T00:00:00+00:00")

    prompt = PromptVersion.from_dict(data)

    assert prompt.id == ("version-1" if has_id else None)
    assert prompt.metadata == {"team": "support"}
    formatted = prompt.format(variables={"name": "Ada"})
    assert formatted["model"] == "gpt-4o"
    assert formatted["messages"] == [{"role": "user", "content": "Hi Ada"}]
    assert formatted["temperature"] == 0.2
    assert formatted["tools"] == [{"type": "function", "function": {"name": "get_weather"}}]


def test_minimax_prompt_uses_openai_format() -> None:
    prompt = PromptVersion(
        [{"role": "user", "content": "Hello"}],
        model_name="MiniMax-M3",
        model_provider="MINIMAX",
    )

    assert isinstance(prompt.format(), OpenAIPrompt)


def test_from_openai_carries_version_metadata() -> None:
    metadata = {"agent": "support", "dependencies": ["retriever"]}

    prompt = PromptVersion.from_openai(
        {"model": "gpt-4o", "messages": [{"role": "user", "content": "Hello"}]},
        metadata=metadata,
    )

    assert prompt.metadata == metadata


def test_from_anthropic_carries_version_metadata() -> None:
    metadata = {"agent": "support"}

    prompt = PromptVersion.from_anthropic(
        {
            "model": "claude-opus-4-5",
            "max_tokens": 1024,
            "messages": [{"role": "user", "content": "Hello"}],
        },
        metadata=metadata,
    )

    assert prompt.metadata == metadata


def test_from_google_genai_carries_version_metadata() -> None:
    from google.genai import types as genai_types

    metadata = {"agent": "support"}

    prompt = PromptVersion.from_google_genai(
        "gemini-2.5-pro",
        [genai_types.Content(role="user", parts=[genai_types.Part(text="Hello")])],
        metadata=metadata,
    )

    assert prompt.metadata == metadata


def test_omitted_version_metadata_defaults_to_empty() -> None:
    prompt = PromptVersion.from_openai(
        {"model": "gpt-4o", "messages": [{"role": "user", "content": "Hello"}]},
    )

    assert prompt.metadata == {}

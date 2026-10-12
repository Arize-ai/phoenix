from phoenix.client.types.prompts import OpenAIPrompt, PromptVersion


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

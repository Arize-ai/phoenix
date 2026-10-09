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


def test_custom_provider_id_round_trips_through_dumps_and_loads() -> None:
    prompt = PromptVersion(
        [{"role": "user", "content": "Hello"}],
        model_name="my-model",
        model_provider="OPENAI",
        custom_provider_id="R2VuZXJhdGl2ZU1vZGVsQ3VzdG9tUHJvdmlkZXI6MQ==",
    )

    dumped = prompt._dumps()  # pyright: ignore[reportPrivateUsage]
    assert dumped.get("custom_provider_id") == "R2VuZXJhdGl2ZU1vZGVsQ3VzdG9tUHJvdmlkZXI6MQ=="

    loaded = PromptVersion._loads(dumped)  # pyright: ignore[reportPrivateUsage]
    assert loaded.custom_provider_id == "R2VuZXJhdGl2ZU1vZGVsQ3VzdG9tUHJvdmlkZXI6MQ=="


def test_custom_provider_id_is_omitted_when_unset() -> None:
    prompt = PromptVersion(
        [{"role": "user", "content": "Hello"}],
        model_name="gpt-4o",
    )

    assert prompt.custom_provider_id is None
    assert "custom_provider_id" not in prompt._dumps()  # pyright: ignore[reportPrivateUsage]

from phoenix.client.types.prompts import OpenAIPrompt, PromptVersion


def test_minimax_prompt_uses_openai_format() -> None:
    prompt = PromptVersion(
        [{"role": "user", "content": "Hello"}],
        model_name="MiniMax-M3",
        model_provider="MINIMAX",
    )

    assert isinstance(prompt.format(), OpenAIPrompt)


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

from openinference.semconv.trace import OpenInferenceLLMProviderValues

from phoenix.server.api.types.GenerativeProvider import GenerativeProvider, GenerativeProviderKey


class TestGenerativeProvider:
    def test_infer_model_provider_from_model_name(self) -> None:
        provider = GenerativeProvider._infer_model_provider_from_model_name("gpt-3")
        assert provider == GenerativeProviderKey.OPENAI

        provider = GenerativeProvider._infer_model_provider_from_model_name("claude-v1")
        assert provider == GenerativeProviderKey.ANTHROPIC

        provider = GenerativeProvider._infer_model_provider_from_model_name("unknown-model")
        assert provider is None

    def test_get_model_provider_from_attributes(self) -> None:
        attributes = {"llm": {"provider": OpenInferenceLLMProviderValues.OPENAI.value}}
        provider = GenerativeProvider.get_model_provider_from_attributes(attributes)
        assert provider == GenerativeProviderKey.OPENAI

        attributes = {"llm": {"model_name": "claude-v1"}}
        provider = GenerativeProvider.get_model_provider_from_attributes(attributes)
        assert provider == GenerativeProviderKey.ANTHROPIC

        attributes = {"llm": {"provider": "UnknownProvider"}}
        provider = GenerativeProvider.get_model_provider_from_attributes(attributes)
        assert provider is None

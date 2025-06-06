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

    async def test_credential_requirements_for_ollama(self) -> None:
        """Test that OLLAMA provider returns empty credential requirements"""
        provider = GenerativeProvider(name="Ollama", key=GenerativeProviderKey.OLLAMA)
        requirements = await provider.credential_requirements()
        assert requirements == []

    async def test_credential_requirements_for_other_providers(self) -> None:
        """Test that other providers return their credential requirements"""
        # Test OpenAI
        provider = GenerativeProvider(name="OpenAI", key=GenerativeProviderKey.OPENAI)
        requirements = await provider.credential_requirements()
        assert len(requirements) == 1
        assert requirements[0].env_var_name == "OPENAI_API_KEY"
        assert requirements[0].is_required is True

        # Test Anthropic
        provider = GenerativeProvider(name="Anthropic", key=GenerativeProviderKey.ANTHROPIC)
        requirements = await provider.credential_requirements()
        assert len(requirements) == 1
        assert requirements[0].env_var_name == "ANTHROPIC_API_KEY"
        assert requirements[0].is_required is True

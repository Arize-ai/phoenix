from typing import cast

import pytest
from openinference.semconv.trace import OpenInferenceLLMProviderValues

from phoenix.server.api.types.GenerativeProvider import (
    GenerativeProvider,
    GenerativeProviderKey,
)
from tests.unit.graphql import AsyncGraphQLClient


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

    async def test_credentials_set_for_providers(
        self,
        gql_client: AsyncGraphQLClient,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        """
        Integration test for the credentialsSet field on modelProviders.

        Tests scenarios in a single function to minimize server initialization:
        1. No credential requirements (OLLAMA) → True
        2. No credentials set → False
        3. Env var set → True
        4. Database secret set → True
        5. Partial multi-credentials (AWS) → False
        6. All multi-credentials set → True
        """
        query = """
            query {
                modelProviders {
                    key
                    credentialsSet
                }
            }
        """

        mutation = """
            mutation UpsertOrDelete($input: UpsertOrDeleteSecretsMutationInput!) {
                upsertOrDeleteSecrets(input: $input) {
                    upsertedSecrets { key }
                    deletedIds
                }
            }
        """

        async def get_credentials_set(provider_key: str) -> bool:
            result = await gql_client.execute(query=query)
            assert not result.errors, f"GraphQL errors: {result.errors}"
            assert result.data is not None
            for provider in result.data["modelProviders"]:
                if provider["key"] == provider_key:
                    return cast(bool, provider["credentialsSet"])
            raise ValueError(f"Provider {provider_key} not found")

        async def upsert_secret(key: str, value: str) -> None:
            result = await gql_client.execute(
                query=mutation,
                variables={"input": {"secrets": [{"key": key, "value": value}]}},
            )
            assert not result.errors, f"Upsert failed: {result.errors}"

        async def delete_secrets(keys: list[str]) -> None:
            result = await gql_client.execute(
                query=mutation,
                variables={"input": {"secrets": [{"key": key, "value": None} for key in keys]}},
            )
            assert not result.errors, f"Delete failed: {result.errors}"

        # Clear env vars and secrets upfront
        for key in ("OPENAI_API_KEY", "AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY"):
            monkeypatch.delenv(key, raising=False)
        await delete_secrets(["OPENAI_API_KEY", "AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY"])

        # 1. No credential requirements (OLLAMA) → True
        assert await get_credentials_set("OLLAMA") is True

        # 2. No credentials set → False
        assert await get_credentials_set("OPENAI") is False

        # 3. Env var set → True
        monkeypatch.setenv("OPENAI_API_KEY", "test-key")
        assert await get_credentials_set("OPENAI") is True

        # 4. Database secret set (no env var) → True
        monkeypatch.delenv("OPENAI_API_KEY")
        await upsert_secret("OPENAI_API_KEY", "test-key")
        assert await get_credentials_set("OPENAI") is True

        # 5. Partial multi-credentials (AWS needs 2 required keys) → False
        assert await get_credentials_set("AWS") is False
        monkeypatch.setenv("AWS_ACCESS_KEY_ID", "test-key")  # Only 1 of 2
        assert await get_credentials_set("AWS") is False

        # 6. All multi-credentials set (mixed env + db) → True
        await upsert_secret("AWS_SECRET_ACCESS_KEY", "test-key")
        assert await get_credentials_set("AWS") is True

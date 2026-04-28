import base64
from dataclasses import dataclass
from typing import Any, cast

import pytest
from fastapi import HTTPException

from phoenix.db.types.model_provider import (
    AnthropicCustomProviderConfig,
    AzureOpenAICustomProviderConfig,
    OpenAICustomProviderConfig,
)
from phoenix.server.agents.chat_params import (
    BuiltInProviderChatSearchParams,
    CustomProviderChatSearchParams,
)
from phoenix.server.agents.model_factory import (
    _get_pydantic_ai_model_from_generative_model_custom_provider,
    azure_endpoint_to_base_url,
    build_chat_model,
)
from phoenix.server.types import DbSessionFactory


@dataclass
class _ProviderRecord:
    config: bytes


class TestBuildChatModel:
    async def test_returns_404_for_missing_custom_provider(self, db: DbSessionFactory) -> None:
        params = CustomProviderChatSearchParams(
            provider_type="custom",
            provider_id=_global_id("GenerativeModelCustomProvider", "999999"),
            model_name="gpt-4o-mini",
        )

        async with db() as session:
            with pytest.raises(HTTPException) as exc_info:
                await build_chat_model(params, session=session, decrypt=lambda value: value)

        assert exc_info.value.status_code == 404
        assert exc_info.value.detail == "Custom provider not found."

    async def test_builtin_openai_requires_credentials_when_no_custom_base_url(
        self,
        db: DbSessionFactory,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        monkeypatch.delenv("OPENAI_API_KEY", raising=False)
        monkeypatch.delenv("OPENAI_BASE_URL", raising=False)
        params = BuiltInProviderChatSearchParams(
            provider_type="builtin",
            provider="OPENAI",
            model_name="gpt-4o-mini",
        )

        async with db() as session:
            with pytest.raises(HTTPException) as exc_info:
                await build_chat_model(params, session=session, decrypt=lambda value: value)

        assert exc_info.value.status_code == 400
        assert "OPENAI_API_KEY" in exc_info.value.detail


class TestCustomProviderModels:
    def test_azure_endpoint_to_base_url_adds_openai_v1_suffix(self) -> None:
        assert (
            azure_endpoint_to_base_url("https://azure.example.test")
            == "https://azure.example.test/openai/v1/"
        )
        assert (
            azure_endpoint_to_base_url("https://azure.example.test/openai/v1/")
            == "https://azure.example.test/openai/v1/"
        )

    async def test_custom_provider_decrypt_failure_becomes_http_400(self) -> None:
        with pytest.raises(HTTPException) as exc_info:
            await _get_pydantic_ai_model_from_generative_model_custom_provider(
                provider_record=_ProviderRecord(config=b"ciphertext"),
                model_name="gpt-4o-mini",
                decrypt=_raise_value_error,
            )

        assert exc_info.value.status_code == 400
        assert exc_info.value.detail == "Failed to decrypt custom provider config."

    async def test_custom_provider_parse_failure_becomes_http_400(self) -> None:
        with pytest.raises(HTTPException) as exc_info:
            await _get_pydantic_ai_model_from_generative_model_custom_provider(
                provider_record=_ProviderRecord(config=b"not-json"),
                model_name="gpt-4o-mini",
                decrypt=lambda value: value,
            )

        assert exc_info.value.status_code == 400
        assert exc_info.value.detail == "Failed to parse custom provider config."

    async def test_openai_family_custom_providers_disable_sdk_retries(
        self,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        import openai

        class DummyAsyncOpenAI:
            def __init__(self, **kwargs: Any) -> None:
                self.kwargs = kwargs
                self.base_url = kwargs.get("base_url", "https://example.test/v1")

        monkeypatch.setattr(openai, "AsyncOpenAI", DummyAsyncOpenAI)

        openai_config = OpenAICustomProviderConfig(
            openai_authentication_method={"type": "api_key", "api_key": "sk-test-openai"},
            openai_client_kwargs={
                "base_url": "https://openai.example.test/v1",
                "organization": "org-1",
                "project": "project-1",
            },
            openai_api_type="responses",
        )
        openai_model = await _get_pydantic_ai_model_from_generative_model_custom_provider(
            provider_record=_ProviderRecord(config=openai_config.model_dump_json().encode()),
            model_name="gpt-4o-mini",
            decrypt=lambda value: value,
        )
        assert cast(Any, openai_model)._provider.client.kwargs["max_retries"] == 0

        azure_config = AzureOpenAICustomProviderConfig(
            azure_openai_authentication_method={"type": "api_key", "api_key": "azure-test-key"},
            azure_openai_client_kwargs={"azure_endpoint": "https://azure.example.test"},
            openai_api_type="responses",
        )
        azure_model = await _get_pydantic_ai_model_from_generative_model_custom_provider(
            provider_record=_ProviderRecord(config=azure_config.model_dump_json().encode()),
            model_name="gpt-4o-mini",
            decrypt=lambda value: value,
        )
        assert cast(Any, azure_model)._provider.client.kwargs["max_retries"] == 0

    async def test_anthropic_custom_provider_disables_sdk_retries(
        self,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        import anthropic

        class DummyAsyncAnthropic:
            def __init__(self, **kwargs: Any) -> None:
                self.kwargs = kwargs

        monkeypatch.setattr(anthropic, "AsyncAnthropic", DummyAsyncAnthropic)

        anthropic_config = AnthropicCustomProviderConfig(
            anthropic_authentication_method={"type": "api_key", "api_key": "sk-test-anthropic"},
            anthropic_client_kwargs={"base_url": "https://anthropic.example.test"},
        )
        anthropic_model = await _get_pydantic_ai_model_from_generative_model_custom_provider(
            provider_record=_ProviderRecord(config=anthropic_config.model_dump_json().encode()),
            model_name="claude-3-5-sonnet-20241022",
            decrypt=lambda value: value,
        )
        assert cast(Any, anthropic_model)._provider.client.kwargs["max_retries"] == 0


def _global_id(type_name: str, node_id: str) -> str:
    return base64.b64encode(f"{type_name}:{node_id}".encode()).decode()


def _raise_value_error(_: bytes) -> bytes:
    raise ValueError("boom")

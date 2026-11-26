import base64
import json
from dataclasses import dataclass
from types import SimpleNamespace
from typing import Any, cast
from unittest.mock import AsyncMock

import httpx2
import pytest
from openai.types.chat import ChatCompletion
from pydantic_ai.exceptions import UserError
from pydantic_ai.messages import ImageUrl, ModelRequest, UserPromptPart, VideoUrl
from pydantic_ai.models import ModelRequestParameters

from phoenix.db.types.model_provider import (
    AnthropicCustomProviderConfig,
    AzureOpenAICustomProviderConfig,
    ModelProvider,
    OpenAICustomProviderConfig,
)
from phoenix.server.agents.exceptions import (
    ProviderConfigError,
    ProviderCredentialsError,
    ProviderNotFoundError,
)
from phoenix.server.agents.model_factory import (
    _get_pydantic_ai_model_from_generative_model_custom_provider,
    azure_endpoint_to_base_url,
    build_model,
)
from phoenix.server.agents.model_selection import (
    BuiltInProviderModelSelection,
    CustomProviderModelSelection,
)
from phoenix.server.types import DbSessionFactory


@dataclass
class _ProviderRecord:
    config: bytes


class TestBuildModel:
    @pytest.mark.parametrize("model_name", ["MiniMax-M3", "MiniMax-M2.7"])
    async def test_builtin_minimax_preserves_text_requests(
        self,
        db: DbSessionFactory,
        monkeypatch: pytest.MonkeyPatch,
        model_name: str,
    ) -> None:
        monkeypatch.setenv("MINIMAX_API_KEY", "test-key")
        model = await build_model(
            BuiltInProviderModelSelection(
                provider_type="builtin",
                provider=ModelProvider.MINIMAX,
                model_name=model_name,
            ),
            db=db,
            decrypt=lambda value: value,
        )
        create = AsyncMock(
            return_value=ChatCompletion(
                id="test-completion",
                created=0,
                model=model_name,
                object="chat.completion",
                choices=[
                    {
                        "index": 0,
                        "finish_reason": "stop",
                        "message": {"role": "assistant", "content": "Done."},
                    }
                ],
            )
        )
        monkeypatch.setattr(cast(Any, model)._provider.client.chat.completions, "create", create)
        await model.request(
            [ModelRequest(parts=[UserPromptPart(content="Hello.")])], None, ModelRequestParameters()
        )
        assert create.call_args.kwargs["messages"] == [{"role": "user", "content": "Hello."}]

    @pytest.mark.parametrize(
        "content",
        [
            ImageUrl(url="https://example.test/image.png"),
            VideoUrl(url="https://example.test/video.mp4"),
        ],
    )
    async def test_builtin_minimax_rejects_media_for_text_model(
        self,
        db: DbSessionFactory,
        monkeypatch: pytest.MonkeyPatch,
        content: Any,
    ) -> None:
        monkeypatch.setenv("MINIMAX_API_KEY", "test-key")
        model = await build_model(
            BuiltInProviderModelSelection(
                provider_type="builtin",
                provider=ModelProvider.MINIMAX,
                model_name="MiniMax-M2.7",
            ),
            db=db,
            decrypt=lambda value: value,
        )
        with pytest.raises(UserError, match="not supported by this MiniMax model"):
            await model.request(
                [ModelRequest(parts=[UserPromptPart(content=[content])])],
                None,
                ModelRequestParameters(),
            )

    @pytest.mark.parametrize(
        "video_url",
        ["https://example.test/video.mp4", "mm_file://video-file", "data:video/mp4;base64,AA=="],
    )
    async def test_builtin_minimax_serializes_media(
        self,
        db: DbSessionFactory,
        monkeypatch: pytest.MonkeyPatch,
        video_url: str,
    ) -> None:
        monkeypatch.setenv("MINIMAX_API_KEY", "test-key")
        params = BuiltInProviderModelSelection(
            provider_type="builtin",
            provider=ModelProvider.MINIMAX,
            model_name="MiniMax-M3",
        )
        model = await build_model(params, db=db, decrypt=lambda value: value)
        payloads: list[dict[str, Any]] = []

        def respond(request: httpx2.Request) -> httpx2.Response:
            payloads.append(json.loads(request.content))
            return httpx2.Response(
                200,
                json={
                    "id": "test-completion",
                    "created": 0,
                    "model": "MiniMax-M3",
                    "object": "chat.completion",
                    "choices": [
                        {
                            "index": 0,
                            "finish_reason": "stop",
                            "message": {"role": "assistant", "content": "Done."},
                        }
                    ],
                },
            )

        async with httpx2.AsyncClient(transport=httpx2.MockTransport(respond)) as client:
            monkeypatch.setattr(cast(Any, model)._provider.client, "_client", client)
            await model.request(
                [
                    ModelRequest(
                        parts=[
                            UserPromptPart(
                                content=[
                                    "Compare these.",
                                    ImageUrl(
                                        url="data:image/png;base64,AA==",
                                        vendor_metadata={"max_long_side_pixel": 1024},
                                    ),
                                    VideoUrl(
                                        url=video_url,
                                        vendor_metadata={
                                            "fps": 2,
                                            "detail": "default",
                                            "max_long_side_pixel": 720,
                                        },
                                    ),
                                ]
                            )
                        ]
                    )
                ],
                None,
                ModelRequestParameters(),
            )
        assert len(payloads) == 1
        assert payloads[0]["messages"] == [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": "Compare these."},
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": "data:image/png;base64,AA==",
                            "max_long_side_pixel": 1024,
                        },
                    },
                    {
                        "type": "video_url",
                        "video_url": {
                            "url": video_url,
                            "fps": 2,
                            "detail": "default",
                            "max_long_side_pixel": 720,
                        },
                    },
                ],
            }
        ]

    async def test_returns_404_for_missing_custom_provider(self, db: DbSessionFactory) -> None:
        params = CustomProviderModelSelection(
            provider_type="custom",
            provider_id=_global_id("GenerativeModelCustomProvider", "999999"),
            model_name="gpt-4o-mini",
        )

        with pytest.raises(ProviderNotFoundError) as exc_info:
            await build_model(params, db=db, decrypt=lambda value: value)

        assert exc_info.value.status_code == 404
        assert str(exc_info.value) == "Custom provider not found."

    async def test_builtin_openai_requires_credentials_when_no_custom_base_url(
        self,
        db: DbSessionFactory,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        monkeypatch.delenv("OPENAI_API_KEY", raising=False)
        monkeypatch.delenv("OPENAI_BASE_URL", raising=False)
        params = BuiltInProviderModelSelection(
            provider_type="builtin",
            provider="OPENAI",
            model_name="gpt-4o-mini",
        )

        with pytest.raises(ProviderCredentialsError) as exc_info:
            await build_model(params, db=db, decrypt=lambda value: value)

        assert exc_info.value.status_code == 400
        assert "OPENAI_API_KEY" in str(exc_info.value)

    async def test_builtin_minimax_uses_configured_endpoint(
        self,
        db: DbSessionFactory,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        monkeypatch.setenv("MINIMAX_API_KEY", "test-key")
        monkeypatch.setenv("MINIMAX_BASE_URL", "https://api.minimaxi.com/v1")
        params = BuiltInProviderModelSelection(
            provider_type="builtin",
            provider=ModelProvider.MINIMAX,
            model_name="MiniMax-M3",
        )

        model = await build_model(params, db=db, decrypt=lambda value: value)

        assert str(cast(Any, model)._provider.client.base_url) == "https://api.minimaxi.com/v1/"


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
        with pytest.raises(ProviderConfigError) as exc_info:
            await _get_pydantic_ai_model_from_generative_model_custom_provider(
                provider_record=_ProviderRecord(config=b"ciphertext"),
                model_name="gpt-4o-mini",
                decrypt=_raise_value_error,
            )

        assert exc_info.value.status_code == 400
        assert str(exc_info.value) == "Failed to decrypt custom provider config."

    async def test_custom_provider_parse_failure_becomes_http_400(self) -> None:
        with pytest.raises(ProviderConfigError) as exc_info:
            await _get_pydantic_ai_model_from_generative_model_custom_provider(
                provider_record=_ProviderRecord(config=b"not-json"),
                model_name="gpt-4o-mini",
                decrypt=lambda value: value,
            )

        assert exc_info.value.status_code == 400
        assert str(exc_info.value) == "Failed to parse custom provider config."

    async def test_openai_family_custom_providers_disable_sdk_retries(
        self,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        import openai

        class DummyAsyncOpenAI:
            def __init__(self, **kwargs: Any) -> None:
                self.kwargs = kwargs
                self.base_url = kwargs.get("base_url", "https://example.test/v1")
                # pydantic-ai reads the resource attribute matching the model class
                # while constructing the model, so a stand-in client must expose the
                # attribute for every ``openai_api_type`` under test.
                self.chat = SimpleNamespace(completions=object())
                self.responses = object()

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


class TestSecretResolutionErrorTranslation:
    """Regression: a stored secret that cannot be decrypted used to bubble up
    as ``BadRequest`` from ``playground_clients._resolve_secrets`` and reach
    FastAPI as an unhandled exception (500). It must surface as
    ``ProviderConfigError`` so the chat router maps it to a 400."""

    async def test_decrypt_failure_during_secret_lookup_surfaces_as_provider_config_error(
        self,
        db: DbSessionFactory,
    ) -> None:
        from phoenix.db import models as db_models
        from phoenix.server.encryption import EncryptionService

        encryption = EncryptionService()
        async with db() as session:
            session.add(
                db_models.Secret(key="OPENAI_API_KEY", value=encryption.encrypt(b"sk-stored"))
            )
            await session.commit()

        params = BuiltInProviderModelSelection(
            provider_type="builtin",
            provider="OPENAI",
            model_name="gpt-4o-mini",
        )

        def _decrypt_fails(_: bytes) -> bytes:
            raise ValueError("decrypt failed")

        with pytest.raises(ProviderConfigError) as exc_info:
            await build_model(params, db=db, decrypt=_decrypt_fails)

        assert exc_info.value.status_code == 400
        assert "OPENAI_API_KEY" in str(exc_info.value)


def _global_id(type_name: str, node_id: str) -> str:
    return base64.b64encode(f"{type_name}:{node_id}".encode()).decode()


def _raise_value_error(_: bytes) -> bytes:
    raise ValueError("boom")

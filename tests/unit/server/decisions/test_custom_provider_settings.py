from typing import Any

import pytest
import sqlalchemy as sa

from phoenix.db import models
from phoenix.db.types import model_provider as mp
from phoenix.server.api.helpers.decision_clients import OllamaDecisionClient
from phoenix.server.decisions.validation import validate_decision_custom_provider
from phoenix.server.encryption import EncryptionService
from phoenix.server.types import DbSessionFactory
from tests.unit.server.decision_client_factories import resolved_base_url


@pytest.mark.parametrize(
    ("configured", "expected"),
    [
        ("http://localhost:11434/v1", "http://localhost:11434"),
        ("http://localhost:11434/v1/", "http://localhost:11434"),
        ("http://localhost:11434", "http://localhost:11434"),
        ("http://ollama.internal:8080/v1", "http://ollama.internal:8080"),
    ],
)
async def test_ollama_drops_its_chat_v1(
    db: DbSessionFactory, configured: str, expected: str
) -> None:
    assert await resolved_base_url(db, OllamaDecisionClient, base_url=configured) == expected


def test_names_are_cleaned() -> None:
    served = mp.ModelsOfType(names=(" jev-latest ", "", "jev-latest"))
    assert served.names == ("jev-latest",)


def test_a_config_stored_with_model_settings_still_parses() -> None:
    config = mp.GenerativeModelCustomerProviderConfig.model_validate(
        {
            "type": "openai",
            "openai_authentication_method": {"api_key": "sk"},
            "model_names": ["qwen3-coder"],
            "decision_models": {"base_url": "https://elsewhere.example", "model_names": ["luna"]},
        }
    )
    assert isinstance(config.root, mp.OpenAICustomProviderConfig)


@pytest.mark.parametrize(
    ("sdk", "servable", "default"),
    [
        ("openai", {"CHAT", "DECISION"}, {"CHAT"}),
        ("azure_openai", {"CHAT", "DECISION"}, {"CHAT"}),
        ("anthropic", {"CHAT"}, {"CHAT"}),
        ("aws_bedrock", {"CHAT"}, {"CHAT"}),
        ("google_genai", {"CHAT", "DECISION"}, {"CHAT"}),
        ("typesafe", {"DECISION"}, {"DECISION"}),
    ],
)
def test_what_each_sdk_can_serve_and_serves_by_default(
    sdk: Any, servable: set[mp.ModelTypeKey], default: set[mp.ModelTypeKey]
) -> None:
    assert mp.servable_model_types(sdk) == servable
    assert mp.default_provider_models(sdk).types() == default


async def test_a_typesafe_client_factory_uses_only_the_providers_settings(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("TYPESAFE_BASE_URL", "https://server.example")
    config = mp.TypeSafeCustomProviderConfig(
        typesafe_authentication_method=mp.AuthenticationMethodApiKey(api_key="ts"),
        typesafe_client_kwargs=mp.TypeSafeClientKwargs(
            base_url="https://proxy.example/v1", default_headers={"X-A": "1"}
        ),
    )
    factory = config.get_client_factory(extra_headers={"X-B": "2"})
    async with factory() as client:
        assert client._config.base_url == "https://proxy.example/v1"
        assert dict(client._config.default_headers or {}) == {"x-a": "1", "x-b": "2"}
    assert factory.rate_limit_key == mp.typesafe_rate_limit_key("ts", "https://proxy.example/v1")


async def test_a_typesafe_provider_without_a_base_url_uses_the_sdks_default(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("TYPESAFE_BASE_URL", "https://server.example")
    monkeypatch.setenv("TYPESAFE_API_KEY", "server-key")
    config = mp.TypeSafeCustomProviderConfig(
        typesafe_authentication_method=mp.AuthenticationMethodApiKey(api_key="ts"),
    )
    async with config.get_client_factory()() as client:
        assert client._config.base_url == "https://api.typesafe.ai"


@pytest.mark.parametrize(
    "config",
    [
        pytest.param(
            mp.OpenAICustomProviderConfig(
                openai_authentication_method=mp.AuthenticationMethodApiKey(api_key="sk"),
            ),
            id="openai",
        ),
        pytest.param(
            mp.AzureOpenAICustomProviderConfig(
                azure_openai_authentication_method=mp.AuthenticationMethodApiKey(api_key="az"),
                azure_openai_client_kwargs=mp.AzureOpenAIClientKwargs(
                    azure_endpoint="https://resource.openai.azure.com"
                ),
            ),
            id="azure_openai",
        ),
        pytest.param(
            mp.AnthropicCustomProviderConfig(
                anthropic_authentication_method=mp.AuthenticationMethodApiKey(api_key="ak"),
            ),
            id="anthropic",
        ),
    ],
)
async def test_a_custom_providers_client_does_not_follow_redirects(config: Any) -> None:
    async with config.get_client_factory()() as client:
        assert client.max_retries == 0
        assert client._client.follow_redirects is False


@pytest.mark.parametrize("transport", ["httpx", "aiohttp"])
async def test_google_genai_does_not_follow_redirects(
    monkeypatch: pytest.MonkeyPatch, transport: str
) -> None:
    from aiohttp import web
    from aiohttp.test_utils import TestServer
    from google.genai import _api_client, errors

    monkeypatch.setattr(_api_client, "has_aiohttp", transport == "aiohttp")
    source_api_keys: list[str | None] = []
    destination_requests: list[str] = []

    async def destination(request: web.Request) -> web.Response:
        destination_requests.append(request.path)
        return web.json_response({})

    destination_app = web.Application()
    destination_app.router.add_route("*", "/{path:.*}", destination)
    async with TestServer(destination_app) as destination_server:

        async def redirect(request: web.Request) -> web.Response:
            source_api_keys.append(request.headers.get("x-goog-api-key"))
            return web.Response(
                status=307,
                headers={"Location": str(destination_server.make_url("/redirected"))},
                content_type="application/json",
                text='{"error": {"message": "redirect"}}',
            )

        source_app = web.Application()
        source_app.router.add_route("*", "/{path:.*}", redirect)
        async with TestServer(source_app) as source_server:
            google = mp.GoogleGenAICustomProviderConfig(
                google_genai_authentication_method=mp.AuthenticationMethodApiKey(api_key="gk"),
                google_genai_client_kwargs=mp.GoogleGenAIClientKwargs(
                    http_options=mp.GoogleGenAIHttpOptions(
                        base_url=str(source_server.make_url("/"))
                    )
                ),
            )
            async with google.get_client_factory()() as client:
                with pytest.raises(errors.APIError) as error:
                    await client.models.generate_content(model="test-model", contents="hello")
                assert error.value.code == 307

    assert source_api_keys == ["gk"]
    assert destination_requests == []


async def test_typesafe_client_does_not_follow_redirects() -> None:
    typesafe = mp.TypeSafeCustomProviderConfig(
        typesafe_authentication_method=mp.AuthenticationMethodApiKey(api_key="ts"),
    )
    async with typesafe.get_client_factory()() as typesafe_client:
        assert typesafe_client._http_client.follow_redirects is False


async def test_azure_default_credentials_client_ignores_openai_env_vars(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("OPENAI_ORG_ID", "org-from-env")
    monkeypatch.setenv("OPENAI_PROJECT_ID", "proj-from-env")
    azure = mp.AzureOpenAICustomProviderConfig(
        azure_openai_authentication_method=mp.AuthenticationMethodDefaultCredentials(),
        azure_openai_client_kwargs=mp.AzureOpenAIClientKwargs(
            azure_endpoint="https://resource.openai.azure.com"
        ),
    )
    async with azure.get_client_factory()() as client:
        assert (client.organization, client.project) == (None, None)


@pytest.mark.postgres_only
async def test_validating_a_decision_version_holds_its_provider_against_patches(
    db: DbSessionFactory,
) -> None:
    async with db() as session:
        provider = models.GenerativeModelCustomProvider(
            name="decision-validation-lock",
            provider="openai",
            sdk="openai",
            config=EncryptionService().encrypt(b"{}"),
            model_types=models.provider_models_to_rows(
                mp.ProviderModels(chat=mp.ModelsOfType(), decision=mp.ModelsOfType())
            ),
        )
        session.add(provider)
        await session.flush()
        provider_id = provider.id

    version = models.DecisionVersion(
        custom_provider_id=provider_id, model_provider=mp.ModelProvider.OPENAI
    )
    async with db() as session:
        await validate_decision_custom_provider(session, version)
        # A patch locks the provider row FOR UPDATE; it must wait for the validated save.
        with pytest.raises(sa.exc.DBAPIError, match="could not obtain lock"):
            async with db() as patch_session:
                await patch_session.execute(
                    sa.select(models.GenerativeModelCustomProvider.id)
                    .where(models.GenerativeModelCustomProvider.id == provider_id)
                    .with_for_update(nowait=True)
                )

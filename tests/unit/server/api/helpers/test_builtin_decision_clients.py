"""The built-in decision clients for providers whose chat client lives elsewhere: Azure
OpenAI (OpenAI's Decisions API) and Fireworks (System One), plus Ollama's catalog."""

import json
from typing import Any, cast
from unittest.mock import MagicMock

import httpx
import httpx2
import pytest
import respx
from pydantic import SecretStr

from phoenix.db.types.decisions import (
    ChoiceOption,
    ChoiceQuestion,
    PredicateQuestion,
    ScaleLevel,
    ScaleQuestion,
)
from phoenix.server.api.exceptions import BadRequest
from phoenix.server.api.helpers.decision_clients import (
    DECISION_CLIENTS,
    AzureOpenAIDecisionClient,
    ChoiceAnswer,
    DecisionRateLimitError,
    DecisionRequest,
    FireworksDecisionClient,
    OllamaDecisionClient,
    PredicateAnswer,
    ScaleAnswer,
    get_decision_client,
)
from phoenix.server.api.input_types.GenerativeCredentialInput import GenerativeCredentialInput
from phoenix.server.api.types.GenerativeProvider import GenerativeProviderKey
from phoenix.server.types import DbSessionFactory
from phoenix.tracers import Tracer


@pytest.fixture(autouse=True)
def _route_sdk_http_through_respx(monkeypatch: pytest.MonkeyPatch) -> None:
    """Bridge httpx2 SDK transport to httpx so respx observes real SDK requests."""

    async def handle_request(
        transport: httpx2.AsyncHTTPTransport, request: httpx2.Request
    ) -> httpx2.Response:
        async with httpx.AsyncClient() as client:
            response = await client.request(
                request.method,
                str(request.url),
                headers=dict(request.headers),
                content=await request.aread(),
            )
        return httpx2.Response(
            response.status_code, headers=dict(response.headers), content=response.content
        )

    monkeypatch.setattr(httpx2.AsyncHTTPTransport, "handle_async_request", handle_request)


@pytest.fixture(autouse=True)
def _clear_provider_env(monkeypatch: pytest.MonkeyPatch) -> None:
    for name in (
        "AZURE_OPENAI_API_KEY",
        "AZURE_OPENAI_ENDPOINT",
        "FIREWORKS_API_KEY",
        "FIREWORKS_BASE_URL",
        "OPENAI_ORG_ID",
        "OPENAI_PROJECT_ID",
    ):
        monkeypatch.delenv(name, raising=False)


REQUEST = DecisionRequest(
    state={"complaint": "I was charged twice."},
    questions=[
        PredicateQuestion(type="predicate", name="refund", instructions="Refund requested?"),
        ChoiceQuestion(
            type="choice",
            name="team",
            instructions="Which team?",
            choices=[
                ChoiceOption(value="billing", description="Payments"),
                ChoiceOption(value="technical"),
            ],
        ),
        ScaleQuestion(
            type="scale",
            name="severity",
            instructions="How severe?",
            levels=[ScaleLevel(label="low", description="Minor"), ScaleLevel(label="high")],
        ),
    ],
)

EXPECTED_ANSWERS = {
    "refund": PredicateAnswer(probability=0.97),
    "team": ChoiceAnswer(
        choice="billing", confidence=0.8, probabilities={"billing": 0.9, "technical": 0.1}
    ),
    "severity": ScaleAnswer(expected_level=0.7, confidence=0.6, probabilities={0: 0.3, 1: 0.7}),
}

OPENAI_DECISION_RESPONSE = {
    "id": "dec_123",
    "object": "decision",
    "created_at": 1,
    "model": "gpt-6-luna",
    "answers": [
        {"type": "predicate", "name": "refund", "probability": 0.97},
        {
            "type": "choice",
            "name": "team",
            "choice": "billing",
            "confidence": 0.8,
            "probabilities": [
                {"value": "billing", "probability": 0.9},
                {"value": "technical", "probability": 0.1},
            ],
        },
        {
            "type": "score",
            "name": "severity",
            "score": 0.7,
            "confidence": 0.6,
            "probabilities": [
                {"value": 0, "label": "low", "probability": 0.3},
                {"value": 1, "label": "high", "probability": 0.7},
            ],
        },
    ],
    "usage": {
        "input_tokens": 40,
        "output_tokens": 3,
        "total_tokens": 43,
        "input_tokens_details": {"cached_tokens": 0, "cache_write_tokens": 0},
        "output_tokens_details": {"reasoning_tokens": 0},
    },
}

SYSTEM_ONE_RESPONSE = {
    "model": "accounts/fireworks/models/rune",
    "answers": {
        "refund": {"type": "noul", "noul": 0.97},
        "team": {
            "type": "choice",
            "choice": "billing",
            "confidence": 0.8,
            "probabilities": {"billing": 0.9, "technical": 0.1},
        },
        "severity": {
            "type": "score",
            "score": 0.7,
            "confidence": 0.6,
            "legend": {"0": "Minor", "1": "high"},
            "probabilities": {"0": 0.3, "1": 0.7},
        },
    },
    "usage": {"input_tokens": 128, "output_tokens": 3},
}


def _tracer() -> Tracer:
    return Tracer(span_cost_calculator=cast(Any, MagicMock()))


def _decision_span(tracer: Tracer) -> Any:
    (span,) = [
        span for span in tracer._self_exporter.get_finished_spans() if span.name == "Decision"
    ]
    return span


def _key(env_var_name: str) -> list[GenerativeCredentialInput]:
    return [GenerativeCredentialInput(env_var_name=env_var_name, value=SecretStr("test-key"))]


def test_registry_includes_azure_openai_and_fireworks() -> None:
    assert DECISION_CLIENTS[GenerativeProviderKey.AZURE_OPENAI] is AzureOpenAIDecisionClient
    assert DECISION_CLIENTS[GenerativeProviderKey.FIREWORKS] is FireworksDecisionClient
    assert AzureOpenAIDecisionClient.model_names == ("gpt-6-luna",)
    assert FireworksDecisionClient.model_names == ("accounts/fireworks/models/rune",)
    assert AzureOpenAIDecisionClient.credential_env_var() == "AZURE_OPENAI_API_KEY"
    assert FireworksDecisionClient.credential_env_var() == "FIREWORKS_API_KEY"
    assert AzureOpenAIDecisionClient.dependencies_are_installed()
    assert FireworksDecisionClient.dependencies_are_installed()


def test_ollama_lists_its_documented_decision_models_first() -> None:
    assert OllamaDecisionClient.model_names[:4] == ("nimble", "tev1", "clef", "clef-flash")
    assert len(set(OllamaDecisionClient.model_names)) == len(OllamaDecisionClient.model_names)


class TestAzureOpenAIBaseUrl:
    @pytest.mark.parametrize(
        "endpoint",
        [
            pytest.param("https://res.openai.azure.com", id="resource"),
            pytest.param("https://res.openai.azure.com/", id="trailing-slash"),
            pytest.param("https://res.openai.azure.com/openai/v1", id="v1-root"),
            pytest.param("https://res.openai.azure.com/openai/v1/", id="v1-root-slash"),
        ],
    )
    def test_the_endpoint_becomes_the_v1_root(
        self, monkeypatch: pytest.MonkeyPatch, endpoint: str
    ) -> None:
        monkeypatch.setenv("AZURE_OPENAI_ENDPOINT", endpoint)
        assert (
            AzureOpenAIDecisionClient.resolve_base_url(None)
            == "https://res.openai.azure.com/openai/v1"
        )

    def test_the_run_overrides_the_environment(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("AZURE_OPENAI_ENDPOINT", "https://env.openai.azure.com")
        assert (
            AzureOpenAIDecisionClient.resolve_base_url("https://run.openai.azure.com")
            == "https://run.openai.azure.com/openai/v1"
        )

    def test_there_is_no_default(self) -> None:
        assert AzureOpenAIDecisionClient.resolve_base_url(None) is None


class TestFireworksBaseUrl:
    def test_the_default_is_the_inference_root(self) -> None:
        assert (
            FireworksDecisionClient.resolve_base_url(None) == "https://api.fireworks.ai/inference"
        )

    @pytest.mark.parametrize(
        "configured",
        [
            pytest.param("https://fw.example/inference/v1", id="chat-style"),
            pytest.param("https://fw.example/inference/v1/", id="trailing-slash"),
            pytest.param("https://fw.example/inference", id="inference-root"),
        ],
    )
    def test_the_chat_variable_is_reduced_to_the_inference_root(
        self, monkeypatch: pytest.MonkeyPatch, configured: str
    ) -> None:
        monkeypatch.setenv("FIREWORKS_BASE_URL", configured)
        assert FireworksDecisionClient.resolve_base_url(None) == "https://fw.example/inference"


class TestMissingConfiguration:
    async def test_azure_without_an_endpoint_names_the_variable(self, db: DbSessionFactory) -> None:
        async with db() as session:
            with pytest.raises(BadRequest, match="Set AZURE_OPENAI_ENDPOINT"):
                await get_decision_client(
                    provider=GenerativeProviderKey.AZURE_OPENAI,
                    model_name="gpt-6-luna",
                    base_url=None,
                    credentials=None,
                    session=session,
                    decrypt=lambda value: value,
                )

    @pytest.mark.parametrize(
        "provider,env_var_name",
        [
            pytest.param(
                GenerativeProviderKey.AZURE_OPENAI, "AZURE_OPENAI_API_KEY", id="azure-openai"
            ),
            pytest.param(GenerativeProviderKey.FIREWORKS, "FIREWORKS_API_KEY", id="fireworks"),
        ],
    )
    async def test_without_a_key_names_the_variable(
        self,
        db: DbSessionFactory,
        monkeypatch: pytest.MonkeyPatch,
        provider: GenerativeProviderKey,
        env_var_name: str,
    ) -> None:
        monkeypatch.setenv("AZURE_OPENAI_ENDPOINT", "https://res.openai.azure.com")
        async with db() as session:
            with pytest.raises(BadRequest, match=f"Configure {env_var_name}"):
                await get_decision_client(
                    provider=provider,
                    model_name="model",
                    base_url=None,
                    credentials=None,
                    session=session,
                    decrypt=lambda value: value,
                )


class TestAzureOpenAIDecisions:
    async def test_posts_openai_decisions_to_the_azure_v1_endpoint(
        self, db: DbSessionFactory, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setenv("AZURE_OPENAI_ENDPOINT", "https://res.openai.azure.com/")
        async with db() as session:
            client = await get_decision_client(
                provider=GenerativeProviderKey.AZURE_OPENAI,
                model_name="my-luna-deployment",
                base_url=None,
                credentials=_key("AZURE_OPENAI_API_KEY"),
                session=session,
                decrypt=lambda value: value,
            )
        tracer = _tracer()
        with respx.mock(assert_all_called=True) as router:
            route = router.post("https://res.openai.azure.com/openai/v1/decisions").respond(
                200, json=OPENAI_DECISION_RESPONSE
            )
            response = await client.create(request=REQUEST, tracer=tracer)
        request = route.calls[0].request
        assert "api-version" not in request.url.params
        assert request.headers["authorization"] == "Bearer test-key"
        body = json.loads(request.content)
        assert body["model"] == "my-luna-deployment"
        assert json.loads(body["input"]) == {"complaint": "I was charged twice."}
        assert body["questions"] == [
            {"name": "refund", "type": "predicate", "instructions": "Refund requested?"},
            {
                "name": "team",
                "type": "choice",
                "instructions": "Which team?",
                "choices": [
                    {"value": "billing", "description": "Payments"},
                    {"value": "technical"},
                ],
            },
            {
                "name": "severity",
                "type": "score",
                "instructions": "How severe?",
                "levels": [{"label": "low", "description": "Minor"}, {"label": "high"}],
            },
        ]
        assert response.answers == EXPECTED_ANSWERS
        assert (response.model, response.input_tokens, response.output_tokens) == (
            "gpt-6-luna",
            40,
            3,
        )
        attributes = _decision_span(tracer).attributes
        assert attributes["decision.system"] == "openai"
        assert attributes["decision.provider"] == "azure"
        assert attributes["decision.request.model_name"] == "my-luna-deployment"

    async def test_an_error_names_azure_openai(self, db: DbSessionFactory) -> None:
        async with db() as session:
            client = await get_decision_client(
                provider=GenerativeProviderKey.AZURE_OPENAI,
                model_name="gpt-6-luna",
                base_url="https://res.openai.azure.com",
                credentials=_key("AZURE_OPENAI_API_KEY"),
                session=session,
                decrypt=lambda value: value,
            )
        with respx.mock:
            respx.post("https://res.openai.azure.com/openai/v1/decisions").respond(
                404, json={"error": {"message": "DeploymentNotFound"}}
            )
            with pytest.raises(BadRequest) as raised:
                await client.create(request=REQUEST, tracer=_tracer())
        assert str(raised.value) == (
            "Azure OpenAI decision request failed (HTTP 404). "
            "Check the base URL and the model name."
        )


class TestFireworksDecisions:
    async def test_posts_system_one_to_the_fireworks_inference_endpoint(
        self, db: DbSessionFactory
    ) -> None:
        async with db() as session:
            client = await get_decision_client(
                provider=GenerativeProviderKey.FIREWORKS,
                model_name="accounts/fireworks/models/rune",
                base_url=None,
                credentials=_key("FIREWORKS_API_KEY"),
                session=session,
                decrypt=lambda value: value,
            )
        tracer = _tracer()
        with respx.mock(assert_all_called=True) as router:
            route = router.post("https://api.fireworks.ai/inference/v1/systemone").respond(
                200, json=SYSTEM_ONE_RESPONSE
            )
            response = await client.create(request=REQUEST, tracer=tracer)
        request = route.calls[0].request
        assert request.headers["authorization"] == "Bearer test-key"
        assert json.loads(request.content) == {
            "model": "accounts/fireworks/models/rune",
            "state": {"complaint": "I was charged twice."},
            "questions": {
                "refund": {"type": "noul", "instructions": "Refund requested?"},
                "team": {
                    "type": "choice",
                    "instructions": "Which team?",
                    "criteria": {"billing": "Payments", "technical": None},
                },
                "severity": {
                    "type": "score",
                    "instructions": "How severe?",
                    "criteria": ["Minor", "high"],
                },
            },
        }
        assert response.answers == EXPECTED_ANSWERS
        assert (response.model, response.input_tokens, response.output_tokens) == (
            "accounts/fireworks/models/rune",
            128,
            3,
        )
        attributes = _decision_span(tracer).attributes
        assert attributes["decision.system"] == "typesafe"
        assert attributes["decision.provider"] == "fireworks"

    async def test_the_chat_base_url_variable_is_honored(
        self, db: DbSessionFactory, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setenv("FIREWORKS_BASE_URL", "https://fw-proxy.example/inference/v1")
        async with db() as session:
            client = await get_decision_client(
                provider=GenerativeProviderKey.FIREWORKS,
                model_name="accounts/fireworks/models/rune",
                base_url=None,
                credentials=_key("FIREWORKS_API_KEY"),
                session=session,
                decrypt=lambda value: value,
            )
        with respx.mock(assert_all_called=True) as router:
            router.post("https://fw-proxy.example/inference/v1/systemone").respond(
                200, json=SYSTEM_ONE_RESPONSE
            )
            await client.create(request=REQUEST, tracer=_tracer())

    async def test_a_rate_limit_names_fireworks(self, db: DbSessionFactory) -> None:
        async with db() as session:
            client = await get_decision_client(
                provider=GenerativeProviderKey.FIREWORKS,
                model_name="accounts/fireworks/models/rune",
                base_url=None,
                credentials=_key("FIREWORKS_API_KEY"),
                session=session,
                decrypt=lambda value: value,
            )
        with respx.mock:
            respx.post("https://api.fireworks.ai/inference/v1/systemone").respond(
                429, json={"error": "slow down"}
            )
            with pytest.raises(DecisionRateLimitError) as raised:
                await client.create(request=REQUEST, tracer=_tracer())
        assert str(raised.value) == (
            "Fireworks decision request failed (HTTP 429). "
            "The provider rate-limited the request. Wait and retry."
        )
        assert client.is_rate_limit_error(raised.value)

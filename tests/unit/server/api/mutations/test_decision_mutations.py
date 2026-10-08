import json
from typing import Any

import httpx
import pytest
import respx
from sqlalchemy import select

from phoenix.db import models
from phoenix.server.api.exceptions import BadRequest
from phoenix.server.api.helpers.decision_clients import (
    DECISION_CLIENT_REGISTRY,
    DecisionRequest,
    OpenAIDecisionClient,
)
from phoenix.server.api.types.GenerativeProvider import GenerativeProviderKey
from phoenix.server.types import DbSessionFactory
from tests.unit.graphql import AsyncGraphQLClient

QUESTIONS = {
    "department": {
        "type": "choice",
        "instructions": "Which team should handle this?",
        "criteria": {"billing": "Payments", "technical": "Bugs"},
    },
    "urgent": {"type": "noul", "instructions": "Is this urgent?"},
    "severity": {
        "type": "score",
        "instructions": "How severe is this?",
        "criteria": ["Low", "High"],
    },
}

MUTATION = """
mutation($input: CreateDecisionInput!) {
  createDecision(input: $input) {
    result error span { id spanKind attributes trace { traceId } }
  }
}
"""


@pytest.mark.parametrize("provider", ["OPENAI", "TYPESAFE"])
async def test_decision_execution(
    gql_client: AsyncGraphQLClient, db: DbSessionFactory, provider: str
) -> None:
    is_openai = provider == "OPENAI"
    model = "gpt-6-luna" if is_openai else "jev-latest"
    answers: Any = (
        [
            {"name": "department", "type": "choice", "choice": "billing", "confidence": 0.9},
            {"name": "urgent", "type": "predicate", "probability": 0.95},
            {"name": "severity", "type": "score", "score": 0.9},
        ]
        if is_openai
        else {
            "department": {"type": "choice", "choice": "billing", "confidence": 0.9},
            "urgent": {"type": "noul", "noul": 0.95},
            "severity": {"type": "score", "score": 0.9},
        }
    )
    endpoint = (
        "https://api.openai.com/v1/decisions"
        if is_openai
        else "https://api.typesafe.ai/v1/systemone"
    )
    with respx.mock(assert_all_called=True) as router:
        route = router.post(endpoint).mock(
            return_value=httpx.Response(
                200,
                json={
                    "model": model,
                    "answers": answers,
                    "usage": {"input_tokens": 123, "output_tokens": 0},
                },
            )
        )
        result = await gql_client.execute(
            MUTATION,
            variables={
                "input": {
                    "providerKey": provider,
                    "modelName": model,
                    "state": {"complaint": "I was charged twice."},
                    "questions": QUESTIONS,
                    "credentials": [
                        {
                            "envVarName": "OPENAI_API_KEY" if is_openai else "TYPESAFE_API_KEY",
                            "value": "test-key",
                        }
                    ],
                }
            },
        )
        assert result.data and not result.errors
        payload = result.data["createDecision"]
        assert payload["error"] is None
        assert payload["result"]["answers"]["department"]["choice"] == "billing"
        assert payload["span"]["spanKind"] == "decision"
        assert payload["span"]["trace"]["traceId"]
        body = json.loads(route.calls[0].request.content)
        assert route.calls[0].request.headers["authorization"] == "Bearer test-key"
        if is_openai:
            assert body["questions"][1]["type"] == "predicate"
            assert body["questions"][0]["choices"][0]["value"] == "billing"
            assert body["questions"][2]["levels"][1]["description"] == "High"
            assert json.loads(body["input"])["complaint"] == "I was charged twice."
        else:
            assert body["questions"] == QUESTIONS
            assert body["state"] == {"complaint": "I was charged twice."}
    async with db() as session:
        span = await session.scalar(select(models.Span).where(models.Span.span_kind == "DECISION"))
        assert span is not None
        assert span.attributes["decision"]["token_count"] == {"input": 123, "output": 0}
        assert "llm" not in span.attributes
        assert span.llm_token_count_prompt is None
        assert span.status_code == "OK"


@pytest.mark.parametrize("status", [401, 422, 429, 500])
async def test_provider_error_is_traced(gql_client: AsyncGraphQLClient, status: int) -> None:
    with respx.mock:
        respx.post("https://api.typesafe.ai/v1/systemone").respond(
            status, json={"error": "secret upstream detail"}
        )
        result = await gql_client.execute(
            MUTATION,
            variables={
                "input": {
                    "providerKey": "TYPESAFE",
                    "modelName": "jev-latest",
                    "state": "hello",
                    "questions": QUESTIONS,
                    "credentials": [{"envVarName": "TYPESAFE_API_KEY", "value": "test-key"}],
                }
            },
        )
    assert result.data and not result.errors
    payload = result.data["createDecision"]
    assert f"HTTP {status}" in payload["error"]
    assert "secret upstream detail" not in payload["error"]
    assert payload["span"] is not None
    assert payload["result"] is None


@pytest.mark.parametrize(
    "questions",
    [
        {},
        {"x": {"type": "chat", "instructions": "test"}},
        {"x": {"type": "choice", "instructions": "test", "criteria": {"one": None}}},
    ],
)
async def test_invalid_questions_do_not_call_provider(
    gql_client: AsyncGraphQLClient, questions: Any
) -> None:
    with respx.mock(assert_all_called=False):
        result = await gql_client.execute(
            MUTATION,
            variables={
                "input": {
                    "providerKey": "TYPESAFE",
                    "modelName": "jev-latest",
                    "state": "hello",
                    "questions": questions,
                }
            },
        )
    assert result.errors


async def test_custom_endpoint_cannot_exfiltrate_environment_key(
    gql_client: AsyncGraphQLClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("TYPESAFE_API_KEY", "server-key")
    with respx.mock:
        result = await gql_client.execute(
            MUTATION,
            variables={
                "input": {
                    "providerKey": "TYPESAFE",
                    "modelName": "jev-latest",
                    "state": "hello",
                    "questions": QUESTIONS,
                    "baseUrl": "https://untrusted.example/v1",
                }
            },
        )
    assert result.errors and "server-configured" in str(result.errors)


async def test_catalog_keeps_same_name_types_distinct(gql_client: AsyncGraphQLClient) -> None:
    result = await gql_client.execute("""query {
      llm: playgroundModels { name modelType providerKey }
      decision: playgroundModels(input: {providerKey: null, modelType: DECISION}) { name modelType providerKey }
      modelProviders { key dependenciesInstalled }
    }""")
    assert result.data and not result.errors
    assert all(model["modelType"] == "LLM" for model in result.data["llm"])
    assert all(model["modelType"] == "DECISION" for model in result.data["decision"])
    assert {model["providerKey"] for model in result.data["decision"]} == {"OPENAI", "TYPESAFE"}
    assert {
        provider["key"]: provider["dependenciesInstalled"]
        for provider in result.data["modelProviders"]
    }["TYPESAFE"]


def test_structured_noul_criteria_survive_openai_conversion() -> None:
    request = DecisionRequest(
        state="hello",
        questions={
            "urgent": {
                "type": "noul",
                "instructions": {"question": "Urgent?"},
                "criteria": {"true": "Time sensitive", "false": "Routine"},
            }
        },
    )
    client = OpenAIDecisionClient(
        model_name="gpt-6-luna", api_key="test", base_url="https://api.openai.com/v1"
    )
    body = client.build_request(request)
    assert "Time sensitive" in body["questions"][0]["instructions"]
    assert body["questions"][0]["type"] == "predicate"


@pytest.mark.parametrize(
    "response", [{}, {"answers": []}, {"answers": {"wrong": {"type": "noul", "noul": 0.5}}}]
)
async def test_invalid_provider_response_is_traced(
    gql_client: AsyncGraphQLClient, response: Any
) -> None:
    with respx.mock:
        respx.post("https://api.typesafe.ai/v1/systemone").respond(200, json=response)
        result = await gql_client.execute(
            MUTATION,
            variables={
                "input": {
                    "providerKey": "TYPESAFE",
                    "modelName": "jev-latest",
                    "state": "hello",
                    "questions": QUESTIONS,
                    "credentials": [{"envVarName": "TYPESAFE_API_KEY", "value": "test-key"}],
                }
            },
        )
    assert result.data and not result.errors
    assert (
        result.data["createDecision"]["error"] == "Decision provider returned an invalid response."
    )
    assert result.data["createDecision"]["span"] is not None


async def test_explicit_credentials_allow_compatible_endpoint(
    gql_client: AsyncGraphQLClient,
) -> None:
    with respx.mock:
        route = respx.post("https://compatible.example/v1/systemone").respond(
            200,
            json={
                "model": "custom-decision-model",
                "answers": {"urgent": {"type": "noul", "noul": 0.5}},
                "usage": {"input_tokens": 20, "output_tokens": 0},
            },
        )
        result = await gql_client.execute(
            MUTATION,
            variables={
                "input": {
                    "providerKey": "TYPESAFE",
                    "modelName": "custom-decision-model",
                    "state": "hello",
                    "questions": {"urgent": QUESTIONS["urgent"]},
                    "baseUrl": "https://compatible.example/v1",
                    "credentials": [{"envVarName": "TYPESAFE_API_KEY", "value": "request-key"}],
                }
            },
        )
        assert result.data and not result.errors
        assert result.data["createDecision"]["error"] is None
        assert route.calls[0].request.headers["authorization"] == "Bearer request-key"


def test_chat_guard_is_capability_based_not_provider_based() -> None:
    """Chat-only paths reject any provider without a registered chat client.

    OpenAI has both chat and decision clients, so it passes; TypeSafe has only
    a decision client, so it is rejected with a provider-agnostic message. No
    code path names TypeSafe to get this result.
    """
    from phoenix.server.api.helpers.playground_registry import (
        provider_supports_chat_completions,
        require_chat_provider,
    )

    assert provider_supports_chat_completions(GenerativeProviderKey.OPENAI)
    assert not provider_supports_chat_completions(GenerativeProviderKey.TYPESAFE)
    require_chat_provider(GenerativeProviderKey.OPENAI)
    with pytest.raises(BadRequest, match="decision models only"):
        require_chat_provider(GenerativeProviderKey.TYPESAFE)


def test_decision_registry_declares_capability_credentials_and_endpoints() -> None:
    """Each registered client carries everything the resolver needs; the resolver
    itself never branches on which provider it is building for."""
    assert DECISION_CLIENT_REGISTRY.supports_decisions(GenerativeProviderKey.TYPESAFE)
    assert DECISION_CLIENT_REGISTRY.supports_decisions(GenerativeProviderKey.OPENAI)
    assert not DECISION_CLIENT_REGISTRY.supports_decisions(GenerativeProviderKey.ANTHROPIC)
    assert set(DECISION_CLIENT_REGISTRY.list_models(GenerativeProviderKey.TYPESAFE)) == {
        "jev-latest",
        "jev-1.13.0",
        "jev-preview",
    }
    typesafe = DECISION_CLIENT_REGISTRY.get_client_class(GenerativeProviderKey.TYPESAFE)
    openai = DECISION_CLIENT_REGISTRY.get_client_class(GenerativeProviderKey.OPENAI)
    assert typesafe is not None and openai is not None
    # Credential names come from the provider's declared credential requirements.
    assert typesafe.credential_env_var() == "TYPESAFE_API_KEY"
    assert openai.credential_env_var() == "OPENAI_API_KEY"
    assert typesafe.resolve_base_url(None) == "https://api.typesafe.ai/v1"
    assert typesafe.resolve_base_url("https://proxy.example/v1") == "https://proxy.example/v1"
    assert openai.dependencies_are_installed()


async def test_decision_only_provider_is_listed_and_installed(
    gql_client: AsyncGraphQLClient,
) -> None:
    result = await gql_client.execute(
        "query { modelProviders { key dependenciesInstalled credentialRequirements { envVarName } } }"
    )
    assert result.data and not result.errors
    by_key = {p["key"]: p for p in result.data["modelProviders"]}
    assert by_key["TYPESAFE"]["dependenciesInstalled"] is True
    assert by_key["TYPESAFE"]["credentialRequirements"] == [{"envVarName": "TYPESAFE_API_KEY"}]
    # Listed once even though OpenAI is in both registries.
    assert [p["key"] for p in result.data["modelProviders"]].count("OPENAI") == 1

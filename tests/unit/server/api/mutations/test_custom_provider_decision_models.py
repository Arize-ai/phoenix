"""A custom provider's decision models: its decision client, endpoint, and endpoint check.

The check (PHX-1565) posts to the exact URL a run would and passes only on a recognized
rejection of its sentinel model, since a wrong path also answers 404, 405, or an HTML
page.
"""

import json
from typing import Any

import pytest
import respx
from strawberry.relay import GlobalID

from phoenix.db import models
from phoenix.server.types import DbSessionFactory
from tests.unit.graphql import AsyncGraphQLClient
from tests.unit.server.api.mutations.test_decision_mutations import (
    URGENT,
    _route_sdk_http_through_respx,  # noqa: F401  (autouse: respx sees the SDKs' requests)
    text_state,
)

API_KEY = "sk-decision-secret-123"

TEST_ENDPOINT = """
mutation ($input: GenerativeModelCustomerProviderConfigInput!) {
  testGenerativeModelCustomProviderDecisionEndpoint(input: $input) { error url }
}
"""

CREATE = """
mutation ($input: CreateGenerativeModelCustomProviderMutationInput!) {
  createGenerativeModelCustomProvider(input: $input) { provider { id } }
}
"""

PROVIDER = """
query ($id: ID!) {
  node(id: $id) {
    ... on GenerativeModelCustomProvider {
      decisionSdk
      modelTypes
      decision: modelNames(modelType: DECISION)
      config {
        __typename
        ... on OpenAICustomProviderConfig {
          decisionModels { decisionSdk baseUrl modelNames }
        }
        ... on AzureOpenAICustomProviderConfig {
          decisionModels { decisionSdk baseUrl modelNames }
        }
        ... on TypeSafeCustomProviderConfig {
          decisionModels { decisionSdk baseUrl modelNames }
        }
      }
    }
  }
}
"""

RUN = """
mutation ($input: RunDecisionInput!) {
  runDecision(input: $input) {
    result { model answers { name ... on PredicateAnswer { probability } } }
    error
  }
}
"""

SYSTEM_ONE_UNKNOWN_MODEL = {
    "detail": {"error_type": "api_usage_error", "message": "Unknown model: test-credential-check"}
}
OPENAI_UNKNOWN_MODEL = {
    "error": {
        "message": "The model `test-credential-check` does not exist or you do not have access.",
        "type": "invalid_request_error",
        "code": "model_not_found",
    }
}


def openai_config(
    *, base_url: str | None = None, decision: dict[str, Any] | None = None
) -> dict[str, Any]:
    config: dict[str, Any] = {
        "openaiAuthenticationMethod": {"apiKey": API_KEY},
        "openaiClientKwargs": {"defaultHeaders": {"X-Team": "decisions"}},
    }
    if base_url:
        config["openaiClientKwargs"]["baseUrl"] = base_url
    if decision is not None:
        config["decisionModels"] = decision
    return {"openai": config}


async def check(gql_client: AsyncGraphQLClient, config: dict[str, Any]) -> dict[str, Any]:
    result = await gql_client.execute(TEST_ENDPOINT, variables={"input": config})
    assert result.data and not result.errors, result.errors
    payload: dict[str, Any] = result.data["testGenerativeModelCustomProviderDecisionEndpoint"]
    return payload


async def create(gql_client: AsyncGraphQLClient, name: str, config: dict[str, Any]) -> str:
    result = await gql_client.execute(
        CREATE, variables={"input": {"name": name, "provider": "proxy", "clientConfig": config}}
    )
    assert result.data and not result.errors, result.errors
    return str(result.data["createGenerativeModelCustomProvider"]["provider"]["id"])


SYSTEM_ONE_URL = "https://api.typesafe.ai/v1/systemone"
DECISIONS_URL = "https://proxy.example/v1/decisions"


@pytest.mark.parametrize(
    ("decision_sdk", "url", "response", "passes", "reason"),
    [
        pytest.param(
            "TYPESAFE",
            SYSTEM_ONE_URL,
            {"status_code": 400, "json": SYSTEM_ONE_UNKNOWN_MODEL},
            True,
            None,
            id="system-one-unknown-model",
        ),
        pytest.param(
            "OPENAI",
            DECISIONS_URL,
            {"status_code": 404, "json": OPENAI_UNKNOWN_MODEL},
            True,
            None,
            id="openai-unknown-model",
        ),
        pytest.param(
            "TYPESAFE",
            SYSTEM_ONE_URL,
            {"status_code": 200, "json": {"hello": "world"}},
            False,
            "not a System One response",
            id="system-one-invalid-200",
        ),
        pytest.param(
            "OPENAI",
            DECISIONS_URL,
            {"status_code": 200, "json": {"hello": "world"}},
            False,
            "accepted the unknown model",
            id="openai-200",
        ),
        pytest.param(
            "TYPESAFE",
            SYSTEM_ONE_URL,
            {"status_code": 404, "json": {"detail": "Not Found"}},
            False,
            "HTTP 404 with a response that is not a decision API's",
            id="system-one-unrecognized-404",
        ),
        pytest.param(
            "OPENAI",
            DECISIONS_URL,
            {"status_code": 404, "json": {"error": {"message": "Unknown route"}}},
            False,
            "HTTP 404 with a response that is not a decision API's",
            id="openai-unrecognized-404",
        ),
        pytest.param(
            "TYPESAFE",
            SYSTEM_ONE_URL,
            {
                "status_code": 404,
                "text": "<!doctype html><html>test-credential-check not found</html>",
                "headers": {"content-type": "text/html"},
            },
            False,
            "HTML page",
            id="system-one-html-404",
        ),
        pytest.param(
            "OPENAI",
            DECISIONS_URL,
            {
                "status_code": 404,
                "text": "<html>Not found</html>",
                "headers": {"content-type": "text/html"},
            },
            False,
            "HTML page",
            id="openai-html-404",
        ),
        pytest.param(
            "TYPESAFE",
            SYSTEM_ONE_URL,
            {"status_code": 400},
            False,
            "empty response",
            id="system-one-empty-400",
        ),
        pytest.param(
            "OPENAI",
            DECISIONS_URL,
            {"status_code": 404},
            False,
            "HTTP 404",
            id="openai-empty-404",
        ),
        pytest.param(
            "TYPESAFE",
            SYSTEM_ONE_URL,
            {"status_code": 405, "text": "<html>Method Not Allowed</html>"},
            False,
            "HTTP 405",
            id="system-one-405",
        ),
        pytest.param(
            "OPENAI",
            DECISIONS_URL,
            {"status_code": 405, "json": {"error": "method not allowed"}},
            False,
            "HTTP 405",
            id="openai-405",
        ),
        pytest.param(
            "TYPESAFE",
            SYSTEM_ONE_URL,
            {"status_code": 401, "json": {"error": f"bad key {API_KEY}"}},
            False,
            "rejected the API key (HTTP 401)",
            id="system-one-bad-key",
        ),
        pytest.param(
            "OPENAI",
            DECISIONS_URL,
            {"status_code": 401, "json": {"error": {"message": f"Incorrect key {API_KEY}"}}},
            False,
            "rejected the API key (HTTP 401)",
            id="openai-bad-key",
        ),
        pytest.param(
            "OPENAI",
            DECISIONS_URL,
            {"status_code": 503, "json": {"error": "test-credential-check is warming up"}},
            False,
            "HTTP 503",
            id="openai-unavailable",
        ),
    ],
)
async def test_the_endpoint_check_accepts_only_a_rejection_of_its_model(
    gql_client: AsyncGraphQLClient,
    decision_sdk: str,
    url: str,
    response: dict[str, Any],
    passes: bool,
    reason: str | None,
) -> None:
    base_url = "https://api.typesafe.ai" if decision_sdk == "TYPESAFE" else None
    config = openai_config(
        base_url="https://proxy.example/v1",
        decision={"decisionSdk": decision_sdk, "baseUrl": base_url},
    )
    with respx.mock:
        route = respx.post(url).respond(**response)
        payload = await check(gql_client, config)
    assert route.call_count == 1
    sent = route.calls[0].request
    assert sent.headers["authorization"] == f"Bearer {API_KEY}"
    assert sent.headers["x-team"] == "decisions"
    assert json.loads(sent.content)["model"] == "test-credential-check"
    assert payload["url"] == url
    if passes:
        assert payload["error"] is None
    else:
        assert payload["error"] and reason and reason in payload["error"], payload["error"]
        assert url in payload["error"]
        assert API_KEY not in payload["error"]


@pytest.mark.parametrize(
    ("base_url", "url"),
    [
        pytest.param("https://api.typesafe.ai", SYSTEM_ONE_URL, id="root"),
        pytest.param("https://api.typesafe.ai/v1", SYSTEM_ONE_URL, id="v1-is-dropped-once"),
        pytest.param(
            "https://api.typesafe.ai/v1/v1", "https://api.typesafe.ai/v1/v1/systemone", id="v1-v1"
        ),
        pytest.param("https://example.com", "https://example.com/v1/systemone", id="elsewhere"),
    ],
)
async def test_the_check_posts_to_the_url_a_run_would(
    gql_client: AsyncGraphQLClient, db: DbSessionFactory, base_url: str, url: str
) -> None:
    config = openai_config(decision={"decisionSdk": "TYPESAFE", "baseUrl": base_url})
    with respx.mock:
        route = respx.post(url).respond(400, json=SYSTEM_ONE_UNKNOWN_MODEL)
        payload = await check(gql_client, config)
        assert payload == {"error": None, "url": url}
        provider_id = await create(gql_client, f"System One at {base_url}", config)
        route.respond(
            200,
            json={
                "model": "jev-latest",
                "answers": {"urgent": {"type": "noul", "noul": 0.25}},
                "usage": {"input_tokens": 3, "output_tokens": 0},
            },
        )
        result = await gql_client.execute(
            RUN,
            variables={
                "input": {
                    "connection": {"customProvider": {"id": provider_id}},
                    "modelName": "jev-latest",
                    **text_state("hello"),
                    "questions": [URGENT],
                }
            },
        )
    assert result.data and not result.errors, result.errors
    assert result.data["runDecision"]["error"] is None
    assert result.data["runDecision"]["result"]["answers"] == [
        {"name": "urgent", "probability": 0.25}
    ]
    assert route.call_count == 2
    assert route.calls[1].request.headers["authorization"] == f"Bearer {API_KEY}"


async def test_a_wrong_base_url_fails_the_check(gql_client: AsyncGraphQLClient) -> None:
    config = openai_config(
        decision={"decisionSdk": "TYPESAFE", "baseUrl": "https://api.typesafe.ai/v1/v1"}
    )
    with respx.mock:
        respx.post("https://api.typesafe.ai/v1/v1/systemone").respond(
            404, json={"detail": "Not Found"}
        )
        payload = await check(gql_client, config)
    assert payload["error"].startswith("POST https://api.typesafe.ai/v1/v1/systemone answered")


async def test_the_check_needs_decision_models_turned_on(gql_client: AsyncGraphQLClient) -> None:
    result = await gql_client.execute(TEST_ENDPOINT, variables={"input": openai_config()})
    assert result.errors
    assert "Turn on decision models" in result.errors[0].message


async def test_azure_runs_openai_decisions_on_its_v1_api(gql_client: AsyncGraphQLClient) -> None:
    config = {
        "azureOpenai": {
            "azureOpenaiAuthenticationMethod": {"apiKey": API_KEY},
            "azureOpenaiClientKwargs": {"azureEndpoint": "https://res.openai.azure.com"},
            "decisionModels": {"decisionSdk": "OPENAI"},
        }
    }
    with respx.mock:
        route = respx.post("https://res.openai.azure.com/openai/v1/decisions").respond(
            404, json=OPENAI_UNKNOWN_MODEL
        )
        payload = await check(gql_client, config)
    assert payload == {"error": None, "url": "https://res.openai.azure.com/openai/v1/decisions"}
    assert route.calls[0].request.headers["authorization"] == f"Bearer {API_KEY}"


async def test_azure_decisions_need_an_api_key(gql_client: AsyncGraphQLClient) -> None:
    config = {
        "azureOpenai": {
            "azureOpenaiAuthenticationMethod": {"defaultCredentials": True},
            "azureOpenaiClientKwargs": {"azureEndpoint": "https://res.openai.azure.com"},
            "decisionModels": {"decisionSdk": "OPENAI"},
        }
    }
    payload = await check(gql_client, config)
    assert payload["url"] is None
    assert "needs API key authentication" in payload["error"]


async def test_the_decision_client_and_names_round_trip(
    gql_client: AsyncGraphQLClient, db: DbSessionFactory
) -> None:
    provider_id = await create(
        gql_client,
        "OpenAI SDK, System One",
        openai_config(
            decision={
                "decisionSdk": "TYPESAFE",
                "baseUrl": "https://api.typesafe.ai",
                "modelNames": ["jev-latest", " ", "jev-1.14.0", "jev-latest"],
            }
        ),
    )
    result = await gql_client.execute(PROVIDER, variables={"id": provider_id})
    assert result.data and not result.errors, result.errors
    node = result.data["node"]
    assert node["decisionSdk"] == "TYPESAFE"
    assert node["modelTypes"] == ["LLM", "DECISION"]
    assert node["decision"] == ["jev-latest", "jev-1.14.0"]
    assert node["config"] == {
        "__typename": "OpenAICustomProviderConfig",
        "decisionModels": {
            "decisionSdk": "TYPESAFE",
            "baseUrl": "https://api.typesafe.ai",
            "modelNames": ["jev-latest", "jev-1.14.0"],
        },
    }
    async with db() as session:
        record = await session.get(
            models.GenerativeModelCustomProvider, int(GlobalID.from_id(provider_id).node_id)
        )
        assert record is not None and record.decision_sdk == "typesafe"

    # Turning decision models off clears the column; nothing uses the provider yet.
    result = await gql_client.execute(
        """mutation ($input: PatchGenerativeModelCustomProviderMutationInput!) {
          patchGenerativeModelCustomProvider(input: $input) { provider { modelTypes } }
        }""",
        variables={"input": {"id": provider_id, "clientConfig": openai_config()}},
    )
    assert result.data and not result.errors, result.errors
    assert result.data["patchGenerativeModelCustomProvider"]["provider"]["modelTypes"] == ["LLM"]


async def test_a_typesafe_provider_always_runs_system_one(gql_client: AsyncGraphQLClient) -> None:
    typesafe = {"typesafeAuthenticationMethod": {"apiKey": API_KEY}}
    provider_id = await create(gql_client, "TypeSafe", {"typesafe": typesafe})
    result = await gql_client.execute(PROVIDER, variables={"id": provider_id})
    assert result.data and not result.errors, result.errors
    assert result.data["node"]["config"]["decisionModels"] == {
        "decisionSdk": "TYPESAFE",
        "baseUrl": None,
        "modelNames": [],
    }
    result = await gql_client.execute(
        CREATE,
        variables={
            "input": {
                "name": "TypeSafe on OpenAI",
                "provider": "typesafe",
                "clientConfig": {
                    "typesafe": {**typesafe, "decisionModels": {"decisionSdk": "OPENAI"}}
                },
            }
        },
    )
    assert result.errors
    assert "runs decision models through typesafe" in result.errors[0].message

"""A custom provider's decision models: its decision client, endpoint, and endpoint check.

The check (PHX-1565) posts to the exact URL a run would and passes only on a recognized
rejection of its sentinel model, since a wrong path also answers 404, 405, or an HTML
page.
"""

import json
from datetime import datetime, timezone
from typing import Any

import pytest
import respx
import sqlalchemy as sa
from cryptography.fernet import Fernet
from sqlalchemy.exc import IntegrityError as PostgreSQLIntegrityError
from sqlean.dbapi2 import IntegrityError as SQLiteIntegrityError  # type: ignore[import-untyped]
from strawberry.relay import GlobalID

from phoenix.db import models
from phoenix.db.types import model_provider as mp
from phoenix.server.api.mutations.generative_model_custom_provider_mutations import (
    _credential_check_model,
)
from phoenix.server.encryption import EncryptionService
from phoenix.server.types import DbSessionFactory
from tests.unit.graphql import AsyncGraphQLClient
from tests.unit.server.api.mutations.test_decision_mutations import (
    CHECK_MODEL,
    URGENT,
    _pin_credential_check_model,  # noqa: F401  (autouse: canned rejections name the model)
    _route_sdk_http_through_respx,  # noqa: F401  (autouse: respx sees the SDKs' requests)
    text_state,
)

API_KEY = "sk-decision-secret-123"

TEST_ENDPOINT = """
mutation ($input: GenerativeModelCustomerProviderConfigInput!, $served: ProviderModelsInput) {
  testGenerativeModelCustomProviderCredentials(input: $input, models: $served) {
    error
    chat { error }
    decision { error }
  }
}
"""
DECISIONS_ONLY: dict[str, Any] = {"decision": {}}

CREATE = """
mutation ($input: CreateGenerativeModelCustomProviderMutationInput!) {
  createGenerativeModelCustomProvider(input: $input) { provider { id } }
}
"""

PROVIDER = """
query ($id: ID!) {
  node(id: $id) {
    ... on GenerativeModelCustomProvider {
      modelTypes
      decision: modelNames(modelType: DECISION)
      models {
        chat { names }
        decision { names }
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
    "detail": {
        "error_type": "api_usage_error",
        "message": "Unknown model: test-credential-check-0badc0de",
    }
}
OPENAI_UNKNOWN_MODEL = {
    "error": {
        "message": "The model `test-credential-check-0badc0de` does not exist or you do not have access.",
        "type": "invalid_request_error",
        "code": "model_not_found",
    }
}


def openai_config(*, base_url: str | None = None) -> dict[str, Any]:
    config: dict[str, Any] = {
        "openaiAuthenticationMethod": {"apiKey": API_KEY},
        "openaiClientKwargs": {"defaultHeaders": {"X-Team": "decisions"}},
    }
    if base_url:
        config["openaiClientKwargs"]["baseUrl"] = base_url
    return {"openai": config}


def typesafe_config(base_url: str) -> dict[str, Any]:
    return {
        "typesafe": {
            "typesafeAuthenticationMethod": {"apiKey": API_KEY},
            "typesafeClientKwargs": {
                "baseUrl": base_url,
                "defaultHeaders": {"X-Team": "decisions"},
            },
        }
    }


def decisions_config(decision_sdk: str) -> dict[str, Any]:
    if decision_sdk == "TYPESAFE":
        return typesafe_config("https://api.typesafe.ai")
    return openai_config(base_url="https://proxy.example/v1")


async def check(gql_client: AsyncGraphQLClient, config: dict[str, Any]) -> dict[str, Any]:
    result = await gql_client.execute(
        TEST_ENDPOINT, variables={"input": config, "served": DECISIONS_ONLY}
    )
    assert result.data and not result.errors, result.errors
    payload: dict[str, Any] = result.data["testGenerativeModelCustomProviderCredentials"]
    assert payload["chat"] is None
    assert payload["error"] == payload["decision"]["error"]
    decision: dict[str, Any] = payload["decision"]
    return decision


LLM_AND_DECISIONS: dict[str, Any] = {"chat": {}, "decision": {}}


async def create(
    gql_client: AsyncGraphQLClient,
    name: str,
    config: dict[str, Any],
    served: dict[str, Any] | None = None,
) -> str:
    input: dict[str, Any] = {"name": name, "provider": "proxy", "clientConfig": config}
    if served is not None:
        input["models"] = served
    result = await gql_client.execute(CREATE, variables={"input": input})
    assert result.data and not result.errors, result.errors
    return str(result.data["createGenerativeModelCustomProvider"]["provider"]["id"])


SYSTEM_ONE_URL = "https://api.typesafe.ai/v1/systemone"
OPENAI_DECISION: dict[str, Any] = {
    "model": "local-model",
    "answers": [{"name": "check", "type": "predicate", "probability": 0.5}],
    "usage": {
        "input_tokens": 3,
        "output_tokens": 0,
        "total_tokens": 3,
        "input_tokens_details": {"cached_tokens": 0, "cache_write_tokens": 0},
        "output_tokens_details": {"reasoning_tokens": 0},
    },
}
SYSTEM_ONE_DECISION: dict[str, Any] = {
    "model": "local-model",
    "answers": {"check": {"type": "noul", "noul": 0.5}},
    "usage": {"input_tokens": 3, "output_tokens": 0},
}
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
            "with a body that is not a decisions response",
            id="openai-invalid-200",
        ),
        pytest.param(
            "OPENAI",
            DECISIONS_URL,
            {"status_code": 200, "text": "<!doctype html><html></html>"},
            False,
            "with a body that is not a decisions response",
            id="openai-html-200",
        ),
        pytest.param(
            "OPENAI",
            DECISIONS_URL,
            {"status_code": 200, "json": OPENAI_DECISION},
            True,
            None,
            id="openai-ignores-the-model-name",
        ),
        pytest.param(
            "TYPESAFE",
            SYSTEM_ONE_URL,
            {"status_code": 200, "json": SYSTEM_ONE_DECISION},
            True,
            None,
            id="system-one-ignores-the-model-name",
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
                "text": "<!doctype html><html>test-credential-check-0badc0de not found</html>",
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
            {
                "status_code": 422,
                "json": {"detail": [{"input": {"model": "test-credential-check-0badc0de"}}]},
            },
            False,
            "HTTP 422",
            id="openai-validation-echo-422",
        ),
        pytest.param(
            "TYPESAFE",
            SYSTEM_ONE_URL,
            {
                "status_code": 422,
                "json": {"detail": "test-credential-check-0badc0de failed validation"},
            },
            False,
            "HTTP 422",
            id="system-one-validation-echo-422",
        ),
        pytest.param(
            "OPENAI",
            DECISIONS_URL,
            {
                "status_code": 404,
                "json": {"message": "no route for model test-credential-check-0badc0de"},
            },
            False,
            "HTTP 404 with a response that is not a decision API's",
            id="openai-router-echo-404",
        ),
        pytest.param(
            "TYPESAFE",
            SYSTEM_ONE_URL,
            {
                "status_code": 404,
                "json": {"message": "no route for model test-credential-check-0badc0de"},
            },
            False,
            "HTTP 404 with a response that is not a decision API's",
            id="system-one-router-echo-404",
        ),
        pytest.param(
            "OPENAI",
            DECISIONS_URL,
            {"status_code": 503, "json": {"error": "test-credential-check-0badc0de is warming up"}},
            False,
            "HTTP 503",
            id="openai-unavailable",
        ),
    ],
)
async def test_the_endpoint_check_accepts_a_rejection_of_its_model_or_a_decision(
    gql_client: AsyncGraphQLClient,
    decision_sdk: str,
    url: str,
    response: dict[str, Any],
    passes: bool,
    reason: str | None,
) -> None:
    config = decisions_config(decision_sdk)
    with respx.mock:
        route = respx.post(url).respond(**response)
        payload = await check(gql_client, config)
    assert route.call_count == 1
    sent = route.calls[0].request
    assert sent.headers["authorization"] == f"Bearer {API_KEY}"
    assert sent.headers["x-team"] == "decisions"
    assert json.loads(sent.content)["model"] == CHECK_MODEL
    if passes:
        assert payload["error"] is None
    else:
        assert payload["error"] and reason and reason in payload["error"], payload["error"]
        assert url in payload["error"]
        assert API_KEY not in payload["error"]


@pytest.mark.parametrize(
    ("decision_sdk", "url"),
    [
        pytest.param("TYPESAFE", SYSTEM_ONE_URL, id="system-one"),
        pytest.param("OPENAI", DECISIONS_URL, id="openai"),
    ],
)
async def test_the_check_redacts_the_api_key_from_an_unexpected_error(
    gql_client: AsyncGraphQLClient, decision_sdk: str, url: str
) -> None:
    config = decisions_config(decision_sdk)
    with respx.mock:
        respx.post(url).mock(side_effect=RuntimeError(f"proxy rejected {API_KEY}"))
        payload = await check(gql_client, config)
    assert payload == {"error": "The decision request failed: proxy rejected [REDACTED]"}


@pytest.mark.parametrize(
    ("decision_sdk", "env_var", "url"),
    [
        pytest.param("TYPESAFE", "TYPESAFE_BASE_URL", SYSTEM_ONE_URL, id="system-one"),
        pytest.param(
            "OPENAI", "OPENAI_BASE_URL", "https://api.openai.com/v1/decisions", id="openai"
        ),
    ],
)
async def test_without_a_base_url_the_check_goes_to_the_sdks_default(
    gql_client: AsyncGraphQLClient,
    monkeypatch: pytest.MonkeyPatch,
    decision_sdk: str,
    env_var: str,
    url: str,
) -> None:
    monkeypatch.setenv(env_var, "https://server.example")
    config = decisions_config(decision_sdk)
    connection = next(iter(config.values()))
    connection[f"{decision_sdk.lower()}ClientKwargs"].pop("baseUrl", None)
    with respx.mock:
        respx.post(url).respond(
            400 if decision_sdk == "TYPESAFE" else 404,
            json=SYSTEM_ONE_UNKNOWN_MODEL if decision_sdk == "TYPESAFE" else OPENAI_UNKNOWN_MODEL,
        )
        payload = await check(gql_client, config)
    assert payload == {"error": None}


@pytest.mark.parametrize(
    ("base_url", "url"),
    [
        pytest.param("https://api.typesafe.ai", SYSTEM_ONE_URL, id="root"),
        pytest.param(
            "https://proxy.example/v1", "https://proxy.example/v1/v1/systemone", id="v1-is-kept"
        ),
        pytest.param("https://example.com", "https://example.com/v1/systemone", id="elsewhere"),
    ],
)
async def test_the_check_posts_to_the_url_a_run_would(
    gql_client: AsyncGraphQLClient, db: DbSessionFactory, base_url: str, url: str
) -> None:
    config = typesafe_config(base_url)
    with respx.mock:
        route = respx.post(url).respond(400, json=SYSTEM_ONE_UNKNOWN_MODEL)
        payload = await check(gql_client, config)
        assert payload == {"error": None}
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
    config = typesafe_config("https://api.typesafe.ai/v1")
    with respx.mock:
        respx.post("https://api.typesafe.ai/v1/v1/systemone").respond(
            404, json={"detail": "Not Found"}
        )
        payload = await check(gql_client, config)
    assert payload["error"].startswith("POST https://api.typesafe.ai/v1/v1/systemone answered")


AZURE = {
    "azureOpenai": {
        "azureOpenaiAuthenticationMethod": {"apiKey": API_KEY},
        "azureOpenaiClientKwargs": {"azureEndpoint": "https://res.openai.azure.com"},
    }
}


@pytest.mark.parametrize(
    "config",
    [
        pytest.param(
            {"anthropic": {"anthropicAuthenticationMethod": {"apiKey": API_KEY}}}, id="anthropic"
        ),
        pytest.param(AZURE, id="azure"),
    ],
)
async def test_the_check_refuses_an_sdk_without_decisions(
    gql_client: AsyncGraphQLClient, config: dict[str, Any]
) -> None:
    result = await gql_client.execute(
        TEST_ENDPOINT, variables={"input": config, "served": DECISIONS_ONLY}
    )
    assert result.errors
    assert "can't serve decision models" in result.errors[0].message


@pytest.mark.parametrize("decision_sdk", ["OPENAI", "TYPESAFE"])
@pytest.mark.parametrize(
    "served",
    [
        pytest.param({}, id="empty"),
        pytest.param({"chat": None, "decision": None}, id="explicit-null-types"),
    ],
)
async def test_the_check_refuses_empty_models(
    gql_client: AsyncGraphQLClient, decision_sdk: str, served: dict[str, Any]
) -> None:
    result = await gql_client.execute(
        TEST_ENDPOINT, variables={"input": decisions_config(decision_sdk), "served": served}
    )
    assert result.errors
    assert "at least one model type" in result.errors[0].message


async def test_models_and_names_round_trip(
    gql_client: AsyncGraphQLClient, db: DbSessionFactory
) -> None:
    provider_id = await create(
        gql_client,
        "OpenAI decisions",
        openai_config(),
        {
            "chat": {},
            "decision": {"names": ["gpt-6-luna", " ", "gpt-6-luna-mini", "gpt-6-luna"]},
        },
    )
    result = await gql_client.execute(PROVIDER, variables={"id": provider_id})
    assert result.data and not result.errors, result.errors
    node = result.data["node"]
    assert node["modelTypes"] == ["CHAT", "DECISION"]
    assert node["decision"] == ["gpt-6-luna", "gpt-6-luna-mini"]
    assert node["models"] == {
        "chat": {"names": []},
        "decision": {"names": ["gpt-6-luna", "gpt-6-luna-mini"]},
    }
    result = await gql_client.execute(
        """mutation ($input: PatchGenerativeModelCustomProviderMutationInput!) {
          patchGenerativeModelCustomProvider(input: $input) { provider { modelTypes } }
        }""",
        variables={"input": {"id": provider_id, "models": {"chat": {}}}},
    )
    assert result.data and not result.errors, result.errors
    assert result.data["patchGenerativeModelCustomProvider"]["provider"]["modelTypes"] == ["CHAT"]


async def test_patching_models_preserves_an_unreadable_connection_config(
    gql_client: AsyncGraphQLClient, db: DbSessionFactory
) -> None:
    provider_id = await create(gql_client, "Unreadable provider", openai_config())
    encrypted_config = Fernet(Fernet.generate_key()).encrypt(b"{}")
    async with db() as session:
        record = await session.scalar(
            sa.select(models.GenerativeModelCustomProvider).where(
                models.GenerativeModelCustomProvider.name == "Unreadable provider"
            )
        )
        assert record is not None
        record_id = record.id
        record.config = encrypted_config
    result = await gql_client.execute(
        """mutation ($input: PatchGenerativeModelCustomProviderMutationInput!) {
          patchGenerativeModelCustomProvider(input: $input) { provider { modelTypes } }
        }""",
        variables={"input": {"id": provider_id, "models": {"chat": {}, "decision": {}}}},
    )
    assert result.data and not result.errors, result.errors
    assert result.data["patchGenerativeModelCustomProvider"]["provider"]["modelTypes"] == [
        "CHAT",
        "DECISION",
    ]
    async with db() as session:
        record = await session.get(models.GenerativeModelCustomProvider, record_id)
        assert record is not None
        assert record.config == encrypted_config


async def test_a_provider_serves_what_its_sdk_serves_by_default(
    gql_client: AsyncGraphQLClient,
) -> None:
    typesafe = {"typesafeAuthenticationMethod": {"apiKey": API_KEY}}
    provider_id = await create(gql_client, "TypeSafe", {"typesafe": typesafe})
    result = await gql_client.execute(PROVIDER, variables={"id": provider_id})
    assert result.data and not result.errors, result.errors
    assert result.data["node"]["modelTypes"] == ["DECISION"]
    assert result.data["node"]["models"] == {
        "chat": None,
        "decision": {"names": []},
    }
    provider_id = await create(gql_client, "OpenAI", openai_config())
    result = await gql_client.execute(PROVIDER, variables={"id": provider_id})
    assert result.data and not result.errors, result.errors
    assert result.data["node"]["modelTypes"] == ["CHAT"]
    assert result.data["node"]["decision"] == []


@pytest.mark.parametrize(
    ("config", "served", "message"),
    [
        pytest.param(
            {"anthropic": {"anthropicAuthenticationMethod": {"apiKey": API_KEY}}},
            LLM_AND_DECISIONS,
            "anthropic SDK can't serve decision models",
            id="anthropic-decisions",
        ),
        pytest.param(
            {"typesafe": {"typesafeAuthenticationMethod": {"apiKey": API_KEY}}},
            LLM_AND_DECISIONS,
            "typesafe SDK can't serve chat models",
            id="typesafe-chat",
        ),
        pytest.param(
            openai_config(),
            {"decision": {}},
            "openai SDK always serves chat models",
            id="openai-without-chat",
        ),
        pytest.param(
            AZURE,
            LLM_AND_DECISIONS,
            "azure_openai SDK can't serve decision models",
            id="azure-decision",
        ),
        pytest.param(
            {"typesafe": {"typesafeAuthenticationMethod": {"apiKey": API_KEY}}},
            {},
            "at least one model type",
            id="nothing",
        ),
    ],
)
async def test_a_provider_serves_only_what_its_sdk_can(
    gql_client: AsyncGraphQLClient,
    config: dict[str, Any],
    served: dict[str, Any],
    message: str,
) -> None:
    result = await gql_client.execute(
        CREATE,
        variables={
            "input": {
                "name": "p",
                "provider": "p",
                "clientConfig": config,
                "models": served,
            }
        },
    )
    assert result.errors and message in result.errors[0].message, result.errors


async def test_one_check_covers_each_model_type_the_provider_serves(
    gql_client: AsyncGraphQLClient,
) -> None:
    config = openai_config(base_url="https://proxy.example/v1")
    with respx.mock:
        respx.get("https://proxy.example/v1/models").respond(200, json={"data": []})
        respx.post("https://proxy.example/v1/decisions").respond(404, json={"detail": "Not Found"})
        result = await gql_client.execute(
            TEST_ENDPOINT, variables={"input": config, "served": LLM_AND_DECISIONS}
        )
        assert result.data and not result.errors, result.errors
        payload = result.data["testGenerativeModelCustomProviderCredentials"]
        assert payload["chat"] == {"error": None}
        assert payload["decision"]["error"].startswith(
            "POST https://proxy.example/v1/decisions answered"
        )
        assert payload["error"] == payload["decision"]["error"]

        result = await gql_client.execute(TEST_ENDPOINT, variables={"input": config})
        assert result.data and not result.errors, result.errors
        payload = result.data["testGenerativeModelCustomProviderCredentials"]
        assert payload == {"error": None, "chat": {"error": None}, "decision": None}


@pytest.mark.parametrize(
    "config",
    [
        pytest.param(openai_config(base_url="https://user:pw@proxy.example/v1"), id="openai"),
        pytest.param(typesafe_config("ftp://system-one.example"), id="typesafe"),
    ],
)
async def test_a_provider_whose_base_url_is_not_a_plain_http_url_is_not_saved(
    gql_client: AsyncGraphQLClient, config: dict[str, Any]
) -> None:
    """The rule is the same for chat and decision models, built-in and custom."""
    input = {"name": "bad-url", "provider": "proxy", "clientConfig": config}
    result = await gql_client.execute(CREATE, variables={"input": input})
    assert result.errors and "Base URL must be" in result.errors[0].message


async def test_removing_a_served_type_deletes_its_links_and_profiles(
    gql_client: AsyncGraphQLClient, db: DbSessionFactory
) -> None:
    provider_id = await create(
        gql_client,
        "OpenAI removable decisions",
        openai_config(),
        {
            "chat": {"names": ["gpt-4o"]},
            "decision": {"names": ["gpt-6-luna", "gpt-6-luna-mini"]},
        },
    )
    provider_rowid = int(GlobalID.from_id(provider_id).node_id)

    async with db() as session:
        decision_profile_ids = (
            await session.scalars(
                sa.select(models.CustomProviderModelProfile.model_profile_id).where(
                    models.CustomProviderModelProfile.provider_id == provider_rowid,
                    models.CustomProviderModelProfile.model_type == "decision",
                )
            )
        ).all()
        assert len(decision_profile_ids) == 2

    result = await gql_client.execute(
        """mutation ($input: PatchGenerativeModelCustomProviderMutationInput!) {
          patchGenerativeModelCustomProvider(input: $input) { provider { modelTypes } }
        }""",
        variables={"input": {"id": provider_id, "models": {"chat": {"names": ["gpt-4o"]}}}},
    )
    assert result.data and not result.errors, result.errors
    assert result.data["patchGenerativeModelCustomProvider"]["provider"]["modelTypes"] == ["CHAT"]

    async with db() as session:
        type_rows = (
            await session.scalars(
                sa.select(models.CustomProviderModelType.model_type).where(
                    models.CustomProviderModelType.provider_id == provider_rowid
                )
            )
        ).all()
        assert list(type_rows) == ["chat"]
        decision_links = (
            await session.scalars(
                sa.select(models.CustomProviderModelProfile).where(
                    models.CustomProviderModelProfile.provider_id == provider_rowid,
                    models.CustomProviderModelProfile.model_type == "decision",
                )
            )
        ).all()
        assert decision_links == []
        remaining_decision_profiles = (
            await session.scalars(
                sa.select(models.ModelProfile).where(
                    models.ModelProfile.id.in_(decision_profile_ids)
                )
            )
        ).all()
        assert remaining_decision_profiles == []
        provider = await session.get(models.GenerativeModelCustomProvider, provider_rowid)
        assert provider is not None
        assert provider.models == mp.ProviderModels(
            chat=mp.ModelsOfType(names=("gpt-4o",)),
            decision=None,
        )


async def test_renaming_to_a_taken_name_while_dropping_decisions_is_a_conflict(
    gql_client: AsyncGraphQLClient,
) -> None:
    await create(gql_client, "taken name", openai_config(), {"chat": {}})
    provider_id = await create(
        gql_client, "rename me", openai_config(), {"chat": {}, "decision": {}}
    )

    result = await gql_client.execute(
        """mutation ($input: PatchGenerativeModelCustomProviderMutationInput!) {
          patchGenerativeModelCustomProvider(input: $input) { provider { id } }
        }""",
        variables={"input": {"id": provider_id, "name": "taken name", "models": {"chat": {}}}},
    )
    assert result.errors
    assert "already exists" in result.errors[0].message


@pytest.mark.parametrize(
    ("sdk", "expected"),
    [
        ("openai", mp.ProviderModels(chat=mp.ModelsOfType())),
        ("azure_openai", mp.ProviderModels(chat=mp.ModelsOfType())),
        ("anthropic", mp.ProviderModels(chat=mp.ModelsOfType())),
        ("google_genai", mp.ProviderModels(chat=mp.ModelsOfType())),
        ("aws_bedrock", mp.ProviderModels(chat=mp.ModelsOfType())),
        ("typesafe", mp.ProviderModels(decision=mp.ModelsOfType())),
    ],
)
async def test_orm_provider_without_model_types_serves_sdk_default(
    db: DbSessionFactory,
    sdk: models.GenerativeModelSDK,
    expected: mp.ProviderModels,
) -> None:
    encrypted_config = EncryptionService().encrypt(b"{}")
    async with db() as session:
        provider = models.GenerativeModelCustomProvider(
            name=f"orm-default-{sdk}",
            provider=sdk,
            sdk=sdk,
            config=encrypted_config,
        )
        session.add(provider)
        await session.flush()
        provider_rowid = provider.id

    async with db() as session:
        reloaded = await session.get(models.GenerativeModelCustomProvider, provider_rowid)
        assert reloaded is not None
        assert reloaded.models == expected


async def test_models_only_patch_bumps_updated_at(
    gql_client: AsyncGraphQLClient, db: DbSessionFactory
) -> None:
    provider_id = await create(gql_client, "Models timestamp check", openai_config())
    provider_rowid = int(GlobalID.from_id(provider_id).node_id)
    initial_updated_at = datetime(2025, 1, 1, tzinfo=timezone.utc)

    async with db() as session:
        record = await session.get(models.GenerativeModelCustomProvider, provider_rowid)
        assert record is not None
        record.updated_at = initial_updated_at

    result = await gql_client.execute(
        """mutation ($input: PatchGenerativeModelCustomProviderMutationInput!) {
          patchGenerativeModelCustomProvider(input: $input) {
            provider { updatedAt models { chat { names } decision { names } } }
          }
        }""",
        variables={
            "input": {
                "id": provider_id,
                "models": {"chat": {"names": ["gpt-4o"]}, "decision": {"names": ["gpt-6-luna"]}},
            }
        },
    )
    assert result.data and not result.errors, result.errors
    async with db() as session:
        record = await session.get(models.GenerativeModelCustomProvider, provider_rowid)
        assert record is not None
        assert record.updated_at > initial_updated_at


async def test_db_rejects_crosswalk_without_served_type_row(db: DbSessionFactory) -> None:
    encrypted_config = EncryptionService().encrypt(b"{}")
    async with db() as session:
        provider = models.GenerativeModelCustomProvider(
            name="chat-only-fk-check",
            provider="openai",
            sdk="openai",
            config=encrypted_config,
        )
        profile = models.ModelProfile(model_type="decision", name="gpt-6-luna")
        session.add_all([provider, profile])
        await session.flush()
        provider_rowid = provider.id
        profile_id = profile.id

    with pytest.raises((PostgreSQLIntegrityError, SQLiteIntegrityError)):
        async with db() as session:
            await session.execute(
                sa.insert(models.CustomProviderModelProfile).values(
                    provider_id=provider_rowid,
                    model_type="decision",
                    model_profile_id=profile_id,
                    position=0,
                )
            )


async def test_db_rejects_crosswalk_whose_model_type_differs_from_profile(
    db: DbSessionFactory,
) -> None:
    encrypted_config = EncryptionService().encrypt(b"{}")
    async with db() as session:
        provider = models.GenerativeModelCustomProvider(
            name="mismatched-profile-fk-check",
            provider="openai",
            sdk="openai",
            config=encrypted_config,
        )
        profile = models.ModelProfile(model_type="decision", name="gpt-6-luna")
        session.add_all([provider, profile])
        await session.flush()
        provider_rowid = provider.id
        profile_id = profile.id

    with pytest.raises((PostgreSQLIntegrityError, SQLiteIntegrityError)):
        async with db() as session:
            await session.execute(
                sa.insert(models.CustomProviderModelProfile).values(
                    provider_id=provider_rowid,
                    model_type="chat",
                    model_profile_id=profile_id,
                    position=0,
                )
            )


@pytest.mark.parametrize(
    ("model_type", "name"),
    [
        pytest.param("embedding", "text-embedding-3-small", id="invalid-model-type"),
        pytest.param("chat", "", id="empty-name"),
        pytest.param("chat", "   ", id="blank-name"),
        pytest.param("chat", " gpt-4o", id="leading-space"),
        pytest.param("chat", "gpt-4o ", id="trailing-space"),
    ],
)
async def test_db_rejects_invalid_model_profile_type_or_name(
    db: DbSessionFactory, model_type: str, name: str
) -> None:
    with pytest.raises((PostgreSQLIntegrityError, SQLiteIntegrityError)):
        async with db() as session:
            await session.execute(
                sa.insert(models.ModelProfile).values(
                    model_type=model_type,
                    name=name,
                )
            )


async def test_db_rejects_invalid_custom_provider_model_type(db: DbSessionFactory) -> None:
    encrypted_config = EncryptionService().encrypt(b"{}")
    async with db() as session:
        provider = models.GenerativeModelCustomProvider(
            name="invalid-type-check",
            provider="openai",
            sdk="openai",
            config=encrypted_config,
        )
        session.add(provider)
        await session.flush()
        provider_rowid = provider.id

    with pytest.raises((PostgreSQLIntegrityError, SQLiteIntegrityError)):
        async with db() as session:
            await session.execute(
                sa.insert(models.CustomProviderModelType).values(
                    provider_id=provider_rowid,
                    model_type="embedding",
                )
            )


GEMINI_PROXY_URL = "https://gemini-proxy.example/v1beta/decisions"


def google_config(base_url: str = "https://gemini-proxy.example") -> dict[str, Any]:
    return {
        "googleGenai": {
            "googleGenaiAuthenticationMethod": {"apiKey": API_KEY},
            "googleGenaiClientKwargs": {
                "httpOptions": {"baseUrl": base_url, "headers": {"X-Team": "decisions"}}
            },
        }
    }


@pytest.mark.parametrize(
    ("response", "reason"),
    [
        pytest.param(
            {
                "status_code": 404,
                "json": {
                    "error": {
                        "message": "Requested model not found. See "
                        "https://ai.google.dev/gemini-api/docs/models for a list of available "
                        "models.",
                        "code": "not_found",
                    }
                },
            },
            None,
            id="rejects-the-model",
        ),
        pytest.param(
            {
                "status_code": 200,
                "json": {
                    "answers": {"check": {"type": "noul", "noul": 0.5}},
                    "usage": {"total_input_tokens": 3},
                },
            },
            None,
            id="single-model-server-answers",
        ),
        pytest.param(
            {
                "status_code": 404,
                "json": {
                    "error": {
                        "code": 404,
                        "message": "Requested model not found.",
                        "status": "NOT_FOUND",
                    }
                },
            },
            "HTTP 404 with a response that is not a decision API's",
            id="googles-generic-404",
        ),
        pytest.param(
            {
                "status_code": 403,
                "json": {"error": {"code": 403, "message": "API key not valid."}},
            },
            "rejected the API key (HTTP 403)",
            id="bad-key",
        ),
    ],
)
async def test_the_google_check_posts_to_gemini_decisions(
    gql_client: AsyncGraphQLClient, response: dict[str, Any], reason: str | None
) -> None:
    with respx.mock:
        route = respx.post(GEMINI_PROXY_URL).respond(**response)
        payload = await check(gql_client, google_config())
    assert route.call_count == 1
    sent = route.calls[0].request
    assert sent.headers["x-goog-api-key"] == API_KEY
    assert sent.headers["x-team"] == "decisions"
    assert json.loads(sent.content)["model"] == CHECK_MODEL
    if reason is None:
        assert payload["error"] is None
    else:
        assert payload["error"] and reason in payload["error"], payload["error"]
        assert GEMINI_PROXY_URL in payload["error"]
        assert API_KEY not in payload["error"]


async def test_a_google_provider_serves_decisions_with_its_own_connection(
    gql_client: AsyncGraphQLClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("GEMINI_API_KEY", "server-key")
    provider_id = await create(gql_client, "Gemini proxy", google_config(), LLM_AND_DECISIONS)
    result = await gql_client.execute(PROVIDER, variables={"id": provider_id})
    assert result.data and not result.errors, result.errors
    assert result.data["node"]["modelTypes"] == ["CHAT", "DECISION"]
    with respx.mock:
        route = respx.post(GEMINI_PROXY_URL).respond(
            200,
            json={
                "answers": {"urgent": {"type": "noul", "noul": 0.25}},
                "usage": {"total_input_tokens": 3, "total_output_tokens": 0},
            },
        )
        result = await gql_client.execute(
            RUN,
            variables={
                "input": {
                    "connection": {"customProvider": {"id": provider_id}},
                    "modelName": "gemini-decision-1",
                    **text_state("hello"),
                    "questions": [URGENT],
                }
            },
        )
    assert result.data and not result.errors, result.errors
    assert result.data["runDecision"]["error"] is None
    assert result.data["runDecision"]["result"] == {
        "model": "gemini-decision-1",
        "answers": [{"name": "urgent", "probability": 0.25}],
    }
    assert route.calls[0].request.headers["x-goog-api-key"] == API_KEY


def test_each_check_names_a_different_model(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.undo()
    first, second = _credential_check_model(), _credential_check_model()
    assert first.startswith("test-credential-check-") and second != first

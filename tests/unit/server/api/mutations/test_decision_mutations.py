import json
from typing import Any, cast
from unittest.mock import MagicMock

import httpx
import httpx2
import pytest
import respx
from sqlalchemy import select
from strawberry.relay import GlobalID

from phoenix.db import models
from phoenix.db.types import model_provider as mp
from phoenix.server.api.exceptions import BadRequest
from phoenix.server.api.helpers.decision_clients import (
    DECISION_CLIENTS,
    DecisionConnection,
    DecisionRateLimitError,
    DecisionRequest,
    DecisionTransientError,
    OllamaDecisionClient,
    OpenAIDecisionClient,
    TypeSafeDecisionClient,
)
from phoenix.server.api.types.GenerativeProvider import GenerativeProviderKey
from phoenix.server.types import DbSessionFactory
from phoenix.tracers import Tracer
from tests.unit.graphql import AsyncGraphQLClient


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


DEPARTMENT = {
    "choice": {
        "name": "department",
        "instructions": "Which team should handle this?",
        "choices": [
            {"value": "billing", "description": "Payments"},
            {"value": "technical", "description": "Bugs"},
        ],
    }
}
URGENT = {"predicate": {"name": "urgent", "instructions": "Is this urgent?"}}
SEVERITY = {
    "scale": {
        "name": "severity",
        "instructions": "How severe is this?",
        "levels": [{"label": "low", "description": "Low"}, {"label": "high"}],
    }
}
QUESTIONS = [DEPARTMENT, URGENT, SEVERITY]


def renamed(question: dict[str, Any], name: str) -> dict[str, Any]:
    """``question`` asked under a different name."""
    ((kind, body),) = question.items()
    return {kind: {**body, "name": name}}


def text_state(message: str) -> dict[str, Any]:
    """Run fields for one ``message`` input rendered as the whole text state."""
    return {
        "inputs": [{"name": "message"}],
        "state": {"text": {"template": "{{message}}", "templateFormat": "MUSTACHE"}},
        "inputValues": {"message": message},
    }


# Run fields whose state is the inputs object itself.
OBJECT_STATE = {
    "inputs": [{"name": "complaint"}],
    "state": {"object": True},
    "inputValues": {"complaint": "I was charged twice."},
}


# What System One receives for QUESTIONS: a scale level without a description sends its label.
TYPESAFE_QUESTIONS = {
    "department": {
        "type": "choice",
        "instructions": "Which team should handle this?",
        "criteria": {"billing": "Payments", "technical": "Bugs"},
    },
    "urgent": {"type": "noul", "instructions": "Is this urgent?"},
    "severity": {
        "type": "score",
        "instructions": "How severe is this?",
        "criteria": ["Low", "high"],
    },
}

# The normalized answers both providers' responses below reduce to.
NORMALIZED_ANSWERS = [
    {
        "__typename": "ChoiceAnswer",
        "name": "department",
        "choice": "billing",
        "confidence": 0.9,
        "probabilities": [
            {"value": "billing", "probability": 0.9},
            {"value": "technical", "probability": 0.1},
        ],
    },
    {"__typename": "PredicateAnswer", "name": "urgent", "probability": 0.95},
    {
        "__typename": "ScaleAnswer",
        "name": "severity",
        "expectedLevel": 0.9,
        "confidence": 0.9,
        "probabilities": [{"level": 0, "probability": 0.1}, {"level": 1, "probability": 0.9}],
    },
]

MUTATION = """
mutation($input: RunDecisionInput!) {
  runDecision(input: $input) {
    result {
      model
      usage { inputTokens outputTokens }
      answers {
        __typename
        name
        ... on PredicateAnswer { probability }
        ... on ChoiceAnswer { choice confidence probabilities { value probability } }
        ... on ScaleAnswer { expectedLevel confidence probabilities { level probability } }
      }
    }
    error
    span { id spanKind attributes trace { traceId } }
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
            {
                "name": "department",
                "type": "choice",
                "choice": "billing",
                "confidence": 0.9,
                "probabilities": [
                    {"value": "billing", "probability": 0.9},
                    {"value": "technical", "probability": 0.1},
                ],
            },
            {"name": "urgent", "type": "predicate", "probability": 0.95},
            {
                "name": "severity",
                "type": "score",
                "score": 0.9,
                "confidence": 0.9,
                "probabilities": [
                    {"label": "0", "value": 0, "probability": 0.1},
                    {"label": "1", "value": 1, "probability": 0.9},
                ],
            },
        ]
        if is_openai
        else {
            "department": {
                "type": "choice",
                "choice": "billing",
                "confidence": 0.9,
                "probabilities": {"billing": 0.9, "technical": 0.1},
            },
            "urgent": {"type": "noul", "noul": 0.95},
            "severity": {
                "type": "score",
                "score": 0.9,
                "confidence": 0.9,
                "legend": {"0": "Low", "1": "High"},
                "probabilities": {"0": 0.1, "1": 0.9},
            },
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
                    "usage": {
                        "input_tokens": 123,
                        "output_tokens": 0,
                        **(
                            {
                                "total_tokens": 123,
                                "input_tokens_details": {
                                    "cached_tokens": 0,
                                    "cache_write_tokens": 0,
                                },
                                "output_tokens_details": {"reasoning_tokens": 0},
                            }
                            if is_openai
                            else {}
                        ),
                    },
                },
            )
        )
        result = await gql_client.execute(
            MUTATION,
            variables={
                "input": {
                    "connection": {
                        "builtIn": {
                            "providerKey": provider,
                            "credentials": [
                                {
                                    "envVarName": "OPENAI_API_KEY"
                                    if is_openai
                                    else "TYPESAFE_API_KEY",
                                    "value": "test-key",
                                }
                            ],
                        }
                    },
                    "modelName": model,
                    **OBJECT_STATE,
                    "questions": QUESTIONS,
                }
            },
        )
        assert result.data and not result.errors
        payload = result.data["runDecision"]
        assert payload["error"] is None
        assert payload["result"]["answers"] == NORMALIZED_ANSWERS
        assert payload["result"]["model"] == model
        assert payload["result"]["usage"] == {"inputTokens": 123, "outputTokens": 0}
        assert payload["span"]["spanKind"] == "decision"
        assert payload["span"]["trace"]["traceId"]
        body = json.loads(route.calls[0].request.content)
        assert route.calls[0].request.headers["authorization"] == "Bearer test-key"
        if is_openai:
            assert body["questions"][1]["type"] == "predicate"
            assert body["questions"][0]["choices"][0]["value"] == "billing"
            assert body["questions"][2]["levels"] == [
                {"label": "low", "description": "Low"},
                {"label": "high"},
            ]
            assert json.loads(body["input"])["complaint"] == "I was charged twice."
        else:
            assert body["questions"] == TYPESAFE_QUESTIONS
            assert body["state"] == {"complaint": "I was charged twice."}
    async with db() as session:
        span = await session.scalar(select(models.Span).where(models.Span.span_kind == "DECISION"))
        assert span is not None
        assert span.attributes["decision"]["token_count"] == {"input": 123, "output": 0}
        assert "llm" not in span.attributes
        assert span.llm_token_count_prompt is None
        assert span.status_code == "OK"


@pytest.mark.parametrize(
    "status,hint",
    [
        (401, "Check the API key"),
        (422, "question configuration"),
        (429, "rate-limited"),
        (500, "unavailable"),
        (307, "redirected"),
    ],
)
@pytest.mark.parametrize("provider", ["OPENAI", "TYPESAFE"])
async def test_provider_error_is_traced(
    gql_client: AsyncGraphQLClient, db: DbSessionFactory, status: int, hint: str, provider: str
) -> None:
    is_openai = provider == "OPENAI"
    endpoint = (
        "https://api.openai.com/v1/decisions"
        if is_openai
        else "https://api.typesafe.ai/v1/systemone"
    )
    with respx.mock:
        route = respx.post(endpoint).respond(
            status,
            json={"error": "secret upstream detail"},
            headers={"Location": "https://redirect.example"} if status == 307 else {},
        )
        result = await gql_client.execute(
            MUTATION,
            variables={
                "input": {
                    "connection": {
                        "builtIn": {
                            "providerKey": provider,
                            "credentials": [
                                {
                                    "envVarName": "OPENAI_API_KEY"
                                    if is_openai
                                    else "TYPESAFE_API_KEY",
                                    "value": "test-key",
                                }
                            ],
                        }
                    },
                    "modelName": "gpt-6-luna" if is_openai else "jev-latest",
                    **text_state("hello"),
                    "questions": QUESTIONS,
                }
            },
        )
    assert route.call_count == (3 if status in (429, 500) else 1)
    assert result.data and not result.errors
    payload = result.data["runDecision"]
    assert payload["error"].startswith(
        f"{'OpenAI' if is_openai else 'TypeSafe'} decision request failed (HTTP {status})."
    )
    assert hint in payload["error"]
    assert "secret upstream detail" not in payload["error"]
    assert payload["span"] is not None
    assert payload["result"] is None
    # The span's status is the same user-facing message, not ``BadRequest: ...``.
    async with db() as session:
        span = await session.scalar(select(models.Span).where(models.Span.span_kind == "DECISION"))
        assert span is not None
        assert span.status_code == "ERROR"
        assert span.status_message == payload["error"]
        # Each adapter records the provider request before calling, so it survives a failure.
        sent = json.loads(span.attributes["input"]["value"])
        assert sent["model"] == ("gpt-6-luna" if is_openai else "jev-latest")
        assert sent["input" if is_openai else "state"] == "hello"
        assert len(sent["questions"]) == len(QUESTIONS)


@pytest.mark.parametrize(
    "questions",
    [
        pytest.param([], id="no-questions"),
        pytest.param([{"chat": {"name": "x", "instructions": "test"}}], id="unknown-type"),
        pytest.param([{**URGENT, **DEPARTMENT}], id="two-types"),
        pytest.param(
            [{"choice": {"name": "x", "instructions": "test", "choices": [{"value": "one"}]}}],
            id="one-choice",
        ),
        pytest.param(
            [{"predicate": {"name": "x", "instructions": {"question": "Urgent?"}}}],
            id="structured-instructions",
        ),
        pytest.param(
            [
                {
                    "choice": {
                        "name": "x",
                        "instructions": "test",
                        "choices": [{"value": "one"}, {"value": "one"}],
                    }
                }
            ],
            id="duplicate-choice",
        ),
        pytest.param(
            [
                {
                    "scale": {
                        "name": "x",
                        "instructions": "test",
                        "levels": [{"label": "a"}, {"label": " "}],
                    }
                }
            ],
            id="blank-level",
        ),
        pytest.param([URGENT, renamed(DEPARTMENT, "urgent")], id="duplicate-name"),
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
                    "connection": {
                        "builtIn": {
                            "providerKey": "TYPESAFE",
                        }
                    },
                    "modelName": "jev-latest",
                    **text_state("hello"),
                    "questions": questions,
                }
            },
        )
    assert result.errors


@pytest.mark.parametrize(
    "state,questions,expected",
    [
        ("   ", QUESTIONS, "State cannot be empty"),
        (
            "hello",
            [{"predicate": {"name": "q", "instructions": "  "}}],
            "Instructions for q cannot be empty",
        ),
        (
            "hello",
            [{"choice": {"name": "q", "instructions": "x", "choices": [{"value": "one"}]}}],
            "q needs 2 to 255 choices",
        ),
        (
            "hello",
            [URGENT, renamed(SEVERITY, "urgent")],
            "Question names must be unique: 'urgent' is repeated",
        ),
    ],
)
async def test_validation_messages_read_as_sentences(
    gql_client: AsyncGraphQLClient, state: Any, questions: Any, expected: str
) -> None:
    """Pydantic's report is reshaped: no `Value error,` prefix, no union branch tags in
    paths, and no leading colon for request-level problems."""
    result = await gql_client.execute(
        MUTATION,
        variables={
            "input": {
                "connection": {
                    "builtIn": {
                        "providerKey": "TYPESAFE",
                    }
                },
                "modelName": "jev-latest",
                **text_state(state),
                "questions": questions,
            }
        },
    )
    assert result.errors
    message = result.errors[0].message
    assert expected in message
    assert "Value error" not in message
    assert ".predicate." not in message and ".choice." not in message
    assert not message.startswith(":")


async def test_custom_endpoint_cannot_exfiltrate_environment_key(
    gql_client: AsyncGraphQLClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("TYPESAFE_API_KEY", "server-key")
    with respx.mock:
        result = await gql_client.execute(
            MUTATION,
            variables={
                "input": {
                    "connection": {
                        "builtIn": {
                            "providerKey": "TYPESAFE",
                            "baseUrl": "https://untrusted.example/v1",
                        }
                    },
                    "modelName": "jev-latest",
                    **text_state("hello"),
                    "questions": QUESTIONS,
                }
            },
        )
    assert result.errors and "server-configured" in str(result.errors)


async def test_catalog_keeps_same_name_types_distinct(gql_client: AsyncGraphQLClient) -> None:
    result = await gql_client.execute("""query {
      llm: playgroundModels { name modelType providerKey }
      decision: playgroundModels(input: {modelType: DECISION}) { name modelType providerKey }
      modelProviders { key dependenciesInstalled }
    }""")
    assert result.data and not result.errors
    assert all(model["modelType"] == "LLM" for model in result.data["llm"])
    assert all(model["modelType"] == "DECISION" for model in result.data["decision"])
    assert {model["providerKey"] for model in result.data["decision"]} == {
        "OPENAI",
        "TYPESAFE",
        "OLLAMA",
    }
    # ``providerKey`` is optional, so omitting it and passing null both work.
    omitted = await gql_client.execute(
        "query { playgroundModels(input: {}) { name } "
        "decision: playgroundModels(input: {providerKey: null, modelType: DECISION}) { name } }"
    )
    assert omitted.data and not omitted.errors
    assert {model["name"] for model in omitted.data["decision"]} == {
        model["name"] for model in result.data["decision"]
    }
    assert {
        provider["key"]: provider["dependenciesInstalled"]
        for provider in result.data["modelProviders"]
    }["TYPESAFE"]


def test_predicate_criteria_translate_for_each_provider() -> None:
    """System One takes the criteria as is; OpenAI has no criteria field, so they are
    folded into the instructions."""
    request = DecisionRequest.model_validate(
        {
            "state": "hello",
            "questions": [
                {
                    "type": "predicate",
                    "name": "urgent",
                    "instructions": "Urgent?",
                    "criteria": {"true": "Time sensitive", "false": "Routine"},
                },
                {"type": "predicate", "name": "spam", "instructions": "Spam?", "criteria": {}},
            ],
        }
    )
    openai_body = OpenAIDecisionClient(
        model_name="gpt-6-luna",
        connection=DecisionConnection(api_key="test", base_url="https://api.openai.com/v1"),
    )._build_request(request)
    urgent, spam = list(openai_body["questions"])
    assert urgent["type"] == "predicate"
    assert urgent["instructions"] == ("Urgent?\nTrue if: Time sensitive\nFalse if: Routine")
    assert spam["instructions"] == "Spam?"
    typesafe_body = TypeSafeDecisionClient(
        model_name="jev-latest",
        connection=DecisionConnection(api_key="test", base_url="https://api.typesafe.ai"),
    )._build_request(request)
    assert typesafe_body["questions"] == {
        "urgent": {
            "type": "noul",
            "instructions": "Urgent?",
            "criteria": {"true": "Time sensitive", "false": "Routine"},
        },
        "spam": {"type": "noul", "instructions": "Spam?"},
    }


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
                    "connection": {
                        "builtIn": {
                            "providerKey": "TYPESAFE",
                            "credentials": [
                                {"envVarName": "TYPESAFE_API_KEY", "value": "test-key"}
                            ],
                        }
                    },
                    "modelName": "jev-latest",
                    **text_state("hello"),
                    "questions": QUESTIONS,
                }
            },
        )
    assert result.data and not result.errors
    assert result.data["runDecision"]["error"] == "TypeSafe returned an invalid decision response."
    assert result.data["runDecision"]["span"] is not None


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
                    "connection": {
                        "builtIn": {
                            "providerKey": "TYPESAFE",
                            "baseUrl": "https://compatible.example",
                            "credentials": [
                                {"envVarName": "TYPESAFE_API_KEY", "value": "request-key"}
                            ],
                        }
                    },
                    "modelName": "custom-decision-model",
                    **text_state("hello"),
                    "questions": [URGENT],
                }
            },
        )
        assert result.data and not result.errors
        assert result.data["runDecision"]["error"] is None
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


def test_decision_clients_declare_capability_credentials_and_endpoints() -> None:
    """Each client carries everything the resolver needs; the resolver itself never
    branches on which provider it is building for."""
    # One client per provider: a second claiming the same provider would replace the first.
    assert DECISION_CLIENTS == {
        GenerativeProviderKey.TYPESAFE: TypeSafeDecisionClient,
        GenerativeProviderKey.OPENAI: OpenAIDecisionClient,
        GenerativeProviderKey.OLLAMA: OllamaDecisionClient,
    }
    assert TypeSafeDecisionClient.model_names == (
        "jev-latest",
        "jev-1.14.0",
        "jev-1.13.0",
        "jev-preview",
    )
    typesafe, openai = TypeSafeDecisionClient, OpenAIDecisionClient
    # Credential names come from the provider's declared credential requirements.
    assert typesafe.credential_env_var() == "TYPESAFE_API_KEY"
    assert openai.credential_env_var() == "OPENAI_API_KEY"
    assert typesafe.resolve_base_url(None) == "https://api.typesafe.ai"
    assert typesafe.resolve_base_url("https://proxy.example/v1") == "https://proxy.example/v1"
    assert openai.dependencies_are_installed()


async def test_decision_only_provider_is_listed_and_installed(
    gql_client: AsyncGraphQLClient,
) -> None:
    result = await gql_client.execute(
        """query {
          modelProviders {
            key dependenciesInstalled modelTypes
            credentialRequirements { envVarName }
          }
        }"""
    )
    assert result.data and not result.errors
    by_key = {provider["key"]: provider for provider in result.data["modelProviders"]}
    assert by_key["TYPESAFE"]["dependenciesInstalled"] is True
    assert by_key["TYPESAFE"]["credentialRequirements"] == [{"envVarName": "TYPESAFE_API_KEY"}]
    # Listed once even though OpenAI is in both registries.
    assert [provider["key"] for provider in result.data["modelProviders"]].count("OPENAI") == 1
    # Capability comes from registration, so the UI never names a provider.
    assert by_key["TYPESAFE"]["modelTypes"] == ["DECISION"]
    assert by_key["OPENAI"]["modelTypes"] == ["LLM", "DECISION"]
    assert by_key["ANTHROPIC"]["modelTypes"] == ["LLM"]


async def test_null_usage_is_an_invalid_provider_response(
    gql_client: AsyncGraphQLClient, db: DbSessionFactory
) -> None:
    """A null usage object violates the SDK response schema and is traced as a failure."""
    with respx.mock:
        respx.post("https://api.typesafe.ai/v1/systemone").respond(
            200,
            json={
                "model": "jev-latest",
                "answers": {"urgent": {"type": "noul", "noul": 0.5}},
                "usage": None,
            },
        )
        result = await gql_client.execute(
            MUTATION,
            variables={
                "input": {
                    "connection": {
                        "builtIn": {
                            "providerKey": "TYPESAFE",
                            "credentials": [
                                {"envVarName": "TYPESAFE_API_KEY", "value": "test-key"}
                            ],
                        }
                    },
                    "modelName": "jev-latest",
                    **text_state("hello"),
                    "questions": [URGENT],
                }
            },
        )
    assert result.data and not result.errors
    assert result.data["runDecision"]["error"] == "TypeSafe returned an invalid decision response."
    assert result.data["runDecision"]["result"] is None
    async with db() as session:
        span = await session.scalar(select(models.Span).where(models.Span.span_kind == "DECISION"))
        assert span is not None
        assert "token_count" not in span.attributes["decision"]


@pytest.fixture
def _allow_only_openai(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("PHOENIX_ALLOWED_PROVIDERS", "OPENAI")


@pytest.mark.usefixtures("_allow_only_openai")
async def test_provider_outside_allow_list_is_refused(gql_client: AsyncGraphQLClient) -> None:
    """``PHOENIX_ALLOWED_PROVIDERS`` gates decision execution as well as the catalog, and
    the refusal happens before the provider is contacted."""
    with respx.mock(assert_all_called=False):
        result = await gql_client.execute(
            MUTATION,
            variables={
                "input": {
                    "connection": {
                        "builtIn": {
                            "providerKey": "TYPESAFE",
                            "credentials": [
                                {"envVarName": "TYPESAFE_API_KEY", "value": "test-key"}
                            ],
                        }
                    },
                    "modelName": "jev-latest",
                    **text_state("hello"),
                    "questions": QUESTIONS,
                }
            },
        )
    assert result.errors and "not permitted" in str(result.errors)
    catalog = await gql_client.execute(
        "query { decision: playgroundModels(input: {providerKey: null, modelType: DECISION}) { providerKey } }"
    )
    assert catalog.data and not catalog.errors
    assert {model["providerKey"] for model in catalog.data["decision"]} == {"OPENAI"}


@pytest.mark.parametrize("provider", ["OPENAI", "TYPESAFE"])
@pytest.mark.parametrize(
    "case", ["empty", "type", "choice", "score", "probability", "confidence", "refusal"]
)
async def test_sdk_answer_validation(
    gql_client: AsyncGraphQLClient, db: DbSessionFactory, provider: str, case: str
) -> None:
    is_openai = provider == "OPENAI"
    question = URGENT
    answer: dict[str, Any] = {"type": "predicate" if is_openai else "noul"}
    if case == "empty":
        answer = {}
    elif case == "type":
        answer = {"type": "score", "score": 0.5, "confidence": 0.9}
        answer.update({"probabilities": [], **({} if is_openai else {"legend": {}})})
    elif case == "choice":
        question = renamed(DEPARTMENT, "urgent")
        answer = {
            "type": "choice",
            "choice": "unknown",
            "confidence": 0.9,
            "probabilities": [{"value": "unknown", "probability": 1.0}]
            if is_openai
            else {"unknown": 1.0},
        }
    elif case == "score":
        question = renamed(SEVERITY, "urgent")
        answer = {
            "type": "score",
            "score": 7.0,
            "confidence": 0.9,
            "probabilities": [{"label": "7", "value": 7, "probability": 1.0}]
            if is_openai
            else {"7": 1.0},
        }
        if not is_openai:
            answer["legend"] = {"7": "Unexpected level"}
    elif case == "probability":
        answer["probability" if is_openai else "noul"] = 1.5
    elif case == "confidence":
        question = renamed(DEPARTMENT, "urgent")
        probabilities = {"billing": 0.8, "technical": 0.2}
        answer = {
            "type": "choice",
            "choice": "billing",
            "confidence": 1.5,
            "probabilities": [{"value": v, "probability": p} for v, p in probabilities.items()]
            if is_openai
            else probabilities,
        }
    else:
        answer = {"type": "refusal"}
    usage: dict[str, Any] = {"input_tokens": 20, "output_tokens": 0}
    if is_openai:
        answer["name"] = "urgent"
        usage.update(
            {
                "total_tokens": 20,
                "input_tokens_details": {"cached_tokens": 0, "cache_write_tokens": 0},
                "output_tokens_details": {"reasoning_tokens": 0},
            }
        )
    response = {
        "model": "alias-resolved",
        "usage": usage,
        "answers": [answer] if is_openai else {"urgent": answer},
        "provider_extension": {"retained": True},
    }
    endpoint = (
        "https://api.openai.com/v1/decisions"
        if is_openai
        else "https://api.typesafe.ai/v1/systemone"
    )
    with respx.mock:
        respx.post(endpoint).respond(200, json=response)
        result = await gql_client.execute(
            MUTATION,
            variables={
                "input": {
                    "connection": {
                        "builtIn": {
                            "providerKey": provider,
                            "credentials": [
                                {
                                    "envVarName": "OPENAI_API_KEY"
                                    if is_openai
                                    else "TYPESAFE_API_KEY",
                                    "value": "request-key",
                                }
                            ],
                        }
                    },
                    "modelName": "custom-alias",
                    **text_state("hello"),
                    "questions": [question],
                }
            },
        )
    assert result.data and not result.errors
    payload = result.data["runDecision"]
    valid_refusal = is_openai and case == "refusal"
    if valid_refusal:
        assert payload["error"] is None
        assert payload["result"]["answers"] == [{"__typename": "RefusalAnswer", "name": "urgent"}]
    else:
        assert (
            payload["error"]
            == f"{'OpenAI' if is_openai else 'TypeSafe'} returned an invalid decision response."
        )
        assert payload["result"] is None
    async with db() as session:
        span = await session.scalar(select(models.Span).where(models.Span.span_kind == "DECISION"))
        assert span is not None
        assert span.status_code == ("OK" if valid_refusal else "ERROR")
        assert json.loads(span.attributes["output"]["value"]) == response


@pytest.mark.parametrize(
    "base_url", ["http://[::1", "https://host:badport", "https://host?x=1", "https://host#fragment"]
)
async def test_invalid_base_urls_fail_before_provider_call(
    gql_client: AsyncGraphQLClient, base_url: str
) -> None:
    with respx.mock:
        result = await gql_client.execute(
            MUTATION,
            variables={
                "input": {
                    "connection": {
                        "builtIn": {
                            "providerKey": "TYPESAFE",
                            "baseUrl": base_url,
                            "credentials": [
                                {"envVarName": "TYPESAFE_API_KEY", "value": "request-key"}
                            ],
                        }
                    },
                    "modelName": "jev-latest",
                    **text_state("hello"),
                    "questions": QUESTIONS,
                }
            },
        )
    assert result.errors and "Base URL must be" in result.errors[0].message


@pytest.mark.parametrize(
    "fields,message",
    [
        pytest.param(
            {**OBJECT_STATE, "inputValues": {}}, "Missing inputs: complaint", id="missing-value"
        ),
        pytest.param(
            {**OBJECT_STATE, "inputValues": {"complaint": "x", "other": 1}},
            "Undeclared inputs: other",
            id="undeclared-value",
        ),
        pytest.param(
            {**OBJECT_STATE, "inputValues": ["x"]}, "inputValues must be an object", id="array"
        ),
        pytest.param(
            {
                **text_state("x"),
                "state": {"text": {"template": "{{other}}", "templateFormat": "MUSTACHE"}},
            },
            "uses undeclared inputs: other",
            id="undeclared-template-variable",
        ),
        pytest.param(
            {
                **OBJECT_STATE,
                "state": {
                    "object": True,
                    "text": {"template": "{{complaint}}", "templateFormat": "MUSTACHE"},
                },
            },
            "",
            id="two-states",
        ),
    ],
)
async def test_invalid_inputs_fail_before_provider_call(
    gql_client: AsyncGraphQLClient, fields: dict[str, Any], message: str
) -> None:
    with respx.mock(assert_all_called=False) as router:
        route = router.post("https://api.typesafe.ai/v1/systemone")
        result = await gql_client.execute(
            MUTATION,
            variables={
                "input": {
                    "connection": {
                        "builtIn": {
                            "providerKey": "TYPESAFE",
                            "credentials": [
                                {"envVarName": "TYPESAFE_API_KEY", "value": "test-key"}
                            ],
                        }
                    },
                    "modelName": "jev-latest",
                    **fields,
                    "questions": [URGENT],
                }
            },
        )
    assert result.errors and message in result.errors[0].message
    assert not route.called


async def test_text_state_renders_structured_inputs_for_the_provider(
    gql_client: AsyncGraphQLClient,
) -> None:
    with respx.mock:
        route = respx.post("https://api.typesafe.ai/v1/systemone").respond(
            200,
            json={
                "model": "jev-latest",
                "answers": {"urgent": {"type": "noul", "noul": 0.5}},
                "usage": {"input_tokens": 20, "output_tokens": 0},
            },
        )
        result = await gql_client.execute(
            MUTATION,
            variables={
                "input": {
                    "connection": {
                        "builtIn": {
                            "providerKey": "TYPESAFE",
                            "credentials": [
                                {"envVarName": "TYPESAFE_API_KEY", "value": "test-key"}
                            ],
                        }
                    },
                    "modelName": "jev-latest",
                    "inputs": [{"name": "ticket"}, {"name": "plan"}],
                    "state": {
                        "text": {
                            "template": "Plan: {{plan}}\nTicket: {{ticket}}",
                            "templateFormat": "MUSTACHE",
                        }
                    },
                    "inputValues": {"ticket": {"body": "Refund?"}, "plan": "pro"},
                    "questions": [URGENT],
                }
            },
        )
    assert result.data and not result.errors
    assert result.data["runDecision"]["error"] is None
    body = json.loads(route.calls[0].request.content)
    assert body["state"] == 'Plan: pro\nTicket: {"body": "Refund?"}'


CREATE_CUSTOM_PROVIDER = """
mutation ($input: CreateGenerativeModelCustomProviderMutationInput!) {
  createGenerativeModelCustomProvider(input: $input) { provider { id } }
}
"""

CUSTOM_PROVIDER_MODELS = """
query ($id: ID!) {
  node(id: $id) {
    ... on GenerativeModelCustomProvider {
      sdk
      modelTypes
      chat: modelNames
      decision: modelNames(modelType: DECISION)
      config {
        __typename
        ... on TypeSafeCustomProviderConfig {
          typesafeClientKwargs { baseUrl defaultHeaders }
        }
      }
    }
  }
}
"""

TYPESAFE_PROVIDER_CONFIG = {
    "typesafe": {
        "typesafeAuthenticationMethod": {"apiKey": "ts-custom-key"},
        "typesafeClientKwargs": {
            "baseUrl": "https://system-one.example",
            "defaultHeaders": {"X-Team": "decisions"},
        },
    }
}


async def create_custom_provider(
    gql_client: AsyncGraphQLClient, name: str, provider: str, client_config: dict[str, Any]
) -> str:
    result = await gql_client.execute(
        CREATE_CUSTOM_PROVIDER,
        variables={"input": {"name": name, "provider": provider, "clientConfig": client_config}},
    )
    assert result.data and not result.errors, result.errors
    return str(result.data["createGenerativeModelCustomProvider"]["provider"]["id"])


async def test_custom_providers_declare_the_model_types_they_serve(
    gql_client: AsyncGraphQLClient,
) -> None:
    """A TypeSafe provider serves decisions only; an OpenAI one serves both."""
    typesafe_id = await create_custom_provider(
        gql_client, "System One proxy", "typesafe", TYPESAFE_PROVIDER_CONFIG
    )
    openai_id = await create_custom_provider(
        gql_client,
        "OpenAI proxy",
        "openai",
        {"openai": {"openaiAuthenticationMethod": {"apiKey": "sk-custom"}}},
    )
    result = await gql_client.execute(CUSTOM_PROVIDER_MODELS, variables={"id": typesafe_id})
    assert result.data and not result.errors, result.errors
    typesafe = result.data["node"]
    assert typesafe["sdk"] == "TYPESAFE"
    assert typesafe["modelTypes"] == ["DECISION"]
    assert typesafe["chat"] == []
    assert typesafe["decision"] == list(TypeSafeDecisionClient.model_names)
    assert typesafe["config"] == {
        "__typename": "TypeSafeCustomProviderConfig",
        "typesafeClientKwargs": {
            "baseUrl": "https://system-one.example",
            "defaultHeaders": {"X-Team": "decisions"},
        },
    }
    result = await gql_client.execute(CUSTOM_PROVIDER_MODELS, variables={"id": openai_id})
    assert result.data and not result.errors, result.errors
    openai = result.data["node"]
    assert openai["modelTypes"] == ["LLM", "DECISION"]
    assert openai["chat"] and openai["decision"] == list(OpenAIDecisionClient.model_names)


@pytest.mark.parametrize(
    ("status", "accepted"),
    [pytest.param(404, True, id="unknown-model"), pytest.param(401, False, id="bad-key")],
)
async def test_typesafe_credentials_are_checked_without_running_a_model(
    gql_client: AsyncGraphQLClient, status: int, accepted: bool
) -> None:
    with respx.mock:
        route = respx.post("https://system-one.example/v1/systemone").respond(
            status, json={"error": "rejected ts-custom-key"}
        )
        result = await gql_client.execute(
            """mutation ($input: GenerativeModelCustomerProviderConfigInput!) {
              testGenerativeModelCustomProviderCredentials(input: $input) { error }
            }""",
            variables={"input": TYPESAFE_PROVIDER_CONFIG},
        )
    assert result.data and not result.errors, result.errors
    assert route.call_count == 1
    sent = route.calls[0].request
    assert sent.headers["x-team"] == "decisions"
    assert json.loads(sent.content)["model"] == "test-credential-check"
    error = result.data["testGenerativeModelCustomProviderCredentials"]["error"]
    if accepted:
        assert error is None
    else:
        assert error and "ts-custom-key" not in error


def test_custom_provider_capabilities_come_from_the_sdk() -> None:
    """Prompts are chat templates, so no prompt provider accepts a TypeSafe provider."""
    assert not mp.sdk_offers_chat("typesafe") and mp.sdk_offers_decisions("typesafe")
    assert mp.sdk_offers_chat("openai") and mp.sdk_offers_decisions("openai")
    assert mp.sdk_offers_chat("anthropic") and not mp.sdk_offers_decisions("anthropic")
    assert not any(
        mp.is_sdk_compatible_with_model_provider("typesafe", provider)
        for provider in mp.ModelProvider
    )


def custom_provider_run(provider_id: str) -> dict[str, Any]:
    """Run fields for the urgent question over one message, on a custom provider."""
    return {
        "connection": {"customProvider": {"id": provider_id}},
        "modelName": "jev-latest",
        **text_state("hello"),
        "questions": [URGENT],
    }


async def test_typesafe_custom_provider_runs_with_its_own_connection(
    gql_client: AsyncGraphQLClient, db: DbSessionFactory, monkeypatch: pytest.MonkeyPatch
) -> None:
    """The stored key, endpoint, and headers are used; the server's key never is."""
    monkeypatch.setenv("TYPESAFE_API_KEY", "server-key")
    provider_id = await create_custom_provider(
        gql_client, "System One proxy", "system-one-proxy", TYPESAFE_PROVIDER_CONFIG
    )
    with respx.mock:
        route = respx.post("https://system-one.example/v1/systemone").respond(
            200,
            json={
                "model": "jev-latest",
                "answers": {"urgent": {"type": "noul", "noul": 0.5}},
                "usage": {"input_tokens": 20, "output_tokens": 0},
            },
        )
        result = await gql_client.execute(
            MUTATION, variables={"input": custom_provider_run(provider_id)}
        )
    assert result.data and not result.errors, result.errors
    assert result.data["runDecision"]["error"] is None
    sent = route.calls[0].request
    assert sent.headers["authorization"] == "Bearer ts-custom-key"
    assert sent.headers["x-team"] == "decisions"
    async with db() as session:
        span = await session.scalar(select(models.Span).where(models.Span.span_kind == "DECISION"))
        assert span is not None
        assert span.attributes["decision"]["system"] == "typesafe"
        # Who hosts it: the custom provider's own provider name.
        assert span.attributes["decision"]["provider"] == "system-one-proxy"


async def test_openai_custom_provider_runs_the_decisions_api(
    gql_client: AsyncGraphQLClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """A chat-capable OpenAI provider also runs decisions, without the server's
    organization leaking to its host."""
    monkeypatch.setenv("OPENAI_ORG_ID", "server-org")
    provider_id = await create_custom_provider(
        gql_client,
        "OpenAI proxy",
        "openai-proxy",
        {
            "openai": {
                "openaiAuthenticationMethod": {"apiKey": "sk-custom"},
                "openaiClientKwargs": {
                    "baseUrl": "https://openai-proxy.example/v1",
                    "project": "proj-decisions",
                    "defaultHeaders": {"X-Team": "decisions"},
                },
            }
        },
    )
    with respx.mock:
        route = respx.post("https://openai-proxy.example/v1/decisions").respond(
            200,
            json={
                "model": "gpt-6-luna",
                "answers": [{"name": "urgent", "type": "predicate", "probability": 0.5}],
                "usage": {
                    "input_tokens": 20,
                    "output_tokens": 0,
                    "total_tokens": 20,
                    "input_tokens_details": {"cached_tokens": 0, "cache_write_tokens": 0},
                    "output_tokens_details": {"reasoning_tokens": 0},
                },
            },
        )
        result = await gql_client.execute(
            MUTATION,
            variables={"input": {**custom_provider_run(provider_id), "modelName": "gpt-6-luna"}},
        )
    assert result.data and not result.errors, result.errors
    assert result.data["runDecision"]["error"] is None
    sent = route.calls[0].request
    assert sent.headers["authorization"] == "Bearer sk-custom"
    assert sent.headers["openai-project"] == "proj-decisions"
    assert sent.headers["x-team"] == "decisions"
    assert "openai-organization" not in sent.headers


async def test_custom_provider_without_decision_models_is_refused(
    gql_client: AsyncGraphQLClient,
) -> None:
    provider_id = await create_custom_provider(
        gql_client,
        "Anthropic proxy",
        "anthropic",
        {"anthropic": {"anthropicAuthenticationMethod": {"apiKey": "sk-ant"}}},
    )
    with respx.mock:
        result = await gql_client.execute(
            MUTATION, variables={"input": custom_provider_run(provider_id)}
        )
    assert result.errors
    assert "does not serve decision models" in result.errors[0].message


async def test_connection_must_name_exactly_one_target(gql_client: AsyncGraphQLClient) -> None:
    result = await gql_client.execute(
        MUTATION,
        variables={
            "input": {
                **custom_provider_run("not-an-id"),
                "connection": {
                    "builtIn": {"providerKey": "TYPESAFE"},
                    "customProvider": {"id": "R2VuZXJhdGl2ZU1vZGVsQ3VzdG9tUHJvdmlkZXI6MQ=="},
                },
            }
        },
    )
    assert result.errors


OLLAMA_RESPONSE = {
    "model": "nimble",
    "answers": {"urgent": {"type": "noul", "noul": 0.5}},
    "usage": {"input_tokens": 20, "output_tokens": 0},
}


def ollama_run(**built_in: Any) -> dict[str, Any]:
    return {
        "connection": {"builtIn": {"providerKey": "OLLAMA", **built_in}},
        "modelName": "nimble",
        **text_state("hello"),
        "questions": [URGENT],
    }


@pytest.mark.parametrize(
    "configured",
    [
        pytest.param("http://localhost:11434/v1", id="chat-style-root"),
        pytest.param("http://localhost:11434/", id="server-root"),
    ],
)
async def test_ollama_runs_decisions_with_the_chat_base_url(
    gql_client: AsyncGraphQLClient,
    db: DbSessionFactory,
    monkeypatch: pytest.MonkeyPatch,
    configured: str,
) -> None:
    """OLLAMA_BASE_URL names the OpenAI-compatible root for chat; System One's path
    starts at the server root, so one variable serves both. Ollama needs no key."""
    monkeypatch.setenv("OLLAMA_BASE_URL", configured)
    with respx.mock:
        route = respx.post("http://localhost:11434/v1/systemone").respond(200, json=OLLAMA_RESPONSE)
        result = await gql_client.execute(MUTATION, variables={"input": ollama_run()})
    assert result.data and not result.errors, result.errors
    assert result.data["runDecision"]["error"] is None
    assert route.calls[0].request.headers["authorization"] == "Bearer ollama"
    async with db() as session:
        span = await session.scalar(select(models.Span).where(models.Span.span_kind == "DECISION"))
        assert span is not None
        assert span.attributes["decision"]["system"] == "typesafe"
        assert span.attributes["decision"]["provider"] == "ollama"


async def test_ollama_base_url_can_come_from_the_run(gql_client: AsyncGraphQLClient) -> None:
    with respx.mock:
        route = respx.post("http://gpu-box:11434/v1/systemone").respond(200, json=OLLAMA_RESPONSE)
        result = await gql_client.execute(
            MUTATION, variables={"input": ollama_run(baseUrl="http://gpu-box:11434/v1")}
        )
    assert result.data and not result.errors, result.errors
    assert route.call_count == 1


async def test_ollama_requires_a_base_url(
    gql_client: AsyncGraphQLClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.delenv("OLLAMA_BASE_URL", raising=False)
    result = await gql_client.execute(MUTATION, variables={"input": ollama_run()})
    assert result.errors
    assert "Set OLLAMA_BASE_URL" in result.errors[0].message


@pytest.mark.parametrize("provider", ["OPENAI", "TYPESAFE"])
@pytest.mark.parametrize(
    ("status", "error_class"),
    [
        pytest.param(429, DecisionRateLimitError, id="rate-limit"),
        pytest.param(503, DecisionTransientError, id="transient"),
        pytest.param(400, BadRequest, id="permanent"),
    ],
)
async def test_failures_are_classified_for_a_retrying_caller(
    provider: str, status: int, error_class: type[BadRequest]
) -> None:
    """The experiment runner retries by failure kind, so with the SDK's own retries off
    each request goes out once and comes back typed."""
    client_class = OpenAIDecisionClient if provider == "OPENAI" else TypeSafeDecisionClient
    base_url = (
        "https://decisions.example/v1" if provider == "OPENAI" else "https://decisions.example"
    )
    endpoint = f"{base_url}/decisions" if provider == "OPENAI" else f"{base_url}/v1/systemone"
    client = client_class(
        model_name="model",
        connection=DecisionConnection(api_key="key", base_url=base_url, sdk_retries=False),
    )
    request = DecisionRequest.model_validate(
        {"state": "hello", "questions": [{"type": "predicate", "name": "q", "instructions": "?"}]}
    )
    with respx.mock:
        route = respx.post(endpoint).respond(status, json={"error": "no"})
        with pytest.raises(BadRequest) as raised:
            await client.create(
                request=request, tracer=Tracer(span_cost_calculator=cast(Any, MagicMock()))
            )
    assert type(raised.value) is error_class
    assert route.call_count == 1
    assert client.is_rate_limit_error(raised.value) is (error_class is DecisionRateLimitError)
    assert client.is_transient_error(raised.value) is (error_class is DecisionTransientError)


SAVE_DECISION = """
mutation ($input: CreateDecisionInput!) { createDecision(input: $input) { version { id } } }
"""

RUN_VERSION = """
mutation ($input: RunDecisionVersionInput!) {
  runDecisionVersion(input: $input) {
    result { model answers { name ... on PredicateAnswer { probability } } }
    error
    span { id }
  }
}
"""

URGENT_ANSWER = {
    "model": "jev-latest",
    "answers": {"urgent": {"type": "noul", "noul": 0.5}},
    "usage": {"input_tokens": 20, "output_tokens": 0},
}


async def save_version(gql_client: AsyncGraphQLClient, **version: Any) -> str:
    """Save the urgent question over one `ticket` input, the state being the ticket."""
    result = await gql_client.execute(
        SAVE_DECISION,
        variables={
            "input": {
                "name": "triage",
                "version": {
                    "inputs": [{"name": "ticket"}],
                    "state": {"input": "ticket"},
                    "questions": [URGENT],
                    "modelProvider": "TYPESAFE",
                    "modelName": "jev-latest",
                    **version,
                },
            }
        },
    )
    assert result.data and not result.errors, result.errors
    return str(result.data["createDecision"]["version"]["id"])


async def test_a_saved_version_runs_as_saved(
    gql_client: AsyncGraphQLClient, db: DbSessionFactory
) -> None:
    """Only the version and its input values are given; the definition and model come
    from the version, and credentials for a built-in provider from the call."""
    version_id = await save_version(gql_client)
    with respx.mock:
        route = respx.post("https://api.typesafe.ai/v1/systemone").respond(200, json=URGENT_ANSWER)
        result = await gql_client.execute(
            RUN_VERSION,
            variables={
                "input": {
                    "decisionVersionId": version_id,
                    "inputValues": {"ticket": {"subject": "Charged twice"}},
                    "credentials": [{"envVarName": "TYPESAFE_API_KEY", "value": "request-key"}],
                }
            },
        )
    assert result.data and not result.errors, result.errors
    payload = result.data["runDecisionVersion"]
    assert payload["error"] is None
    assert payload["result"] == {
        "model": "jev-latest",
        "answers": [{"name": "urgent", "probability": 0.5}],
    }
    assert payload["span"] is not None
    sent = route.calls[0].request
    assert sent.headers["authorization"] == "Bearer request-key"
    body = json.loads(sent.content)
    assert body["model"] == "jev-latest"
    assert body["state"] == {"subject": "Charged twice"}
    assert list(body["questions"]) == ["urgent"]


async def test_a_saved_version_runs_on_its_custom_provider(gql_client: AsyncGraphQLClient) -> None:
    provider_id = await create_custom_provider(
        gql_client, "System One proxy", "system-one-proxy", TYPESAFE_PROVIDER_CONFIG
    )
    version_id = await save_version(gql_client, customProviderId=provider_id)
    with respx.mock:
        route = respx.post("https://system-one.example/v1/systemone").respond(
            200, json=URGENT_ANSWER
        )
        result = await gql_client.execute(
            RUN_VERSION,
            variables={"input": {"decisionVersionId": version_id, "inputValues": {"ticket": "hi"}}},
        )
    assert result.data and not result.errors, result.errors
    assert result.data["runDecisionVersion"]["error"] is None
    assert route.calls[0].request.headers["authorization"] == "Bearer ts-custom-key"


async def test_a_saved_version_checks_its_input_values_before_calling(
    gql_client: AsyncGraphQLClient,
) -> None:
    version_id = await save_version(gql_client)

    async def error(input_values: Any, version: str = version_id) -> str:
        result = await gql_client.execute(
            RUN_VERSION,
            variables={"input": {"decisionVersionId": version, "inputValues": input_values}},
        )
        assert result.errors, result.data
        return result.errors[0].message

    with respx.mock:
        route = respx.post("https://api.typesafe.ai/v1/systemone").respond(200, json=URGENT_ANSWER)
        assert "keyed by input name" in await error(["hi"])
        assert "ticket" in await error({})
        assert "Decision version not found" in await error(
            {"ticket": "hi"}, str(GlobalID("DecisionVersion", "999"))
        )
    assert route.call_count == 0

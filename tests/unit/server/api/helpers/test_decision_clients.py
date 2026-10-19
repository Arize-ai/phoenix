from typing import Any, cast
from unittest.mock import MagicMock

import httpx2
import pytest

from phoenix.server.api.exceptions import BadRequest
from phoenix.server.api.helpers.decision_clients import (
    ChoiceAnswer,
    DecisionAnswer,
    DecisionConnection,
    DecisionRequest,
    DecisionTransientError,
    OllamaDecisionClient,
    OpenAIDecisionClient,
    PredicateAnswer,
    RefusalAnswer,
    ScaleAnswer,
    TypeSafeDecisionClient,
    _validated_base_url,
    describe_http_failure,
    get_decision_client,
    validate_answers,
)
from phoenix.server.api.types.GenerativeProvider import GenerativeProviderKey
from phoenix.tracers import Tracer

REQUEST = DecisionRequest.model_validate(
    {
        "state": "hello",
        "questions": [
            {"type": "predicate", "name": "urgent", "instructions": "Urgent?"},
            {
                "type": "choice",
                "name": "department",
                "instructions": "Which team?",
                "choices": [{"value": "billing"}, {"value": "technical"}],
            },
            {
                "type": "scale",
                "name": "severity",
                "instructions": "How severe?",
                "levels": [{"label": "low"}, {"label": "high"}],
            },
        ],
    }
)


def _valid_answers() -> dict[str, DecisionAnswer]:
    return {
        "urgent": PredicateAnswer(probability=0.9),
        "department": ChoiceAnswer(
            choice="billing", confidence=0.8, probabilities={"billing": 0.8, "technical": 0.2}
        ),
        "severity": ScaleAnswer(expected_level=0.7, confidence=0.6, probabilities={0: 0.3, 1: 0.7}),
    }


class TestDescribeHttpFailure:
    @pytest.mark.parametrize(
        "status,hint",
        [
            pytest.param(400, "Check the state and question configuration.", id="400"),
            pytest.param(
                401, "Check the API key and whether it has access to the model.", id="401"
            ),
            pytest.param(
                403, "Check the API key and whether it has access to the model.", id="403"
            ),
            pytest.param(404, "Check the base URL and the model name.", id="404"),
            pytest.param(422, "Check the state and question configuration.", id="422"),
            pytest.param(429, "The provider rate-limited the request. Wait and retry.", id="429"),
            pytest.param(500, "The provider is unavailable. Retry later.", id="500"),
            pytest.param(503, "The provider is unavailable. Retry later.", id="503"),
            pytest.param(
                307,
                "The endpoint redirected; use the final URL as the base URL.",
                id="redirect",
            ),
            pytest.param(
                418,
                "Check the API key, model access, endpoint, and question configuration.",
                id="fallback",
            ),
        ],
    )
    def test_hint_fits_the_status(self, status: int, hint: str) -> None:
        assert describe_http_failure("TypeSafe", status) == (
            f"TypeSafe decision request failed (HTTP {status}). {hint}"
        )


class TestValidateAnswers:
    def test_accepts_one_valid_answer_per_question(self) -> None:
        validate_answers(REQUEST, _valid_answers())

    def test_a_refusal_answers_any_question(self) -> None:
        answers = {**_valid_answers(), "department": RefusalAnswer()}
        validate_answers(REQUEST, answers)

    @pytest.mark.parametrize(
        "mutate",
        [
            pytest.param(lambda answers: answers.pop("urgent"), id="missing"),
            pytest.param(
                lambda answers: answers.update(extra=PredicateAnswer(probability=0.5)), id="extra"
            ),
            pytest.param(
                lambda answers: answers.update(wrong=answers.pop("urgent")), id="wrong-name"
            ),
        ],
    )
    def test_requires_one_answer_per_question(self, mutate: Any) -> None:
        answers = _valid_answers()
        mutate(answers)
        with pytest.raises(ValueError, match="did not return one answer per question"):
            validate_answers(REQUEST, answers)

    @pytest.mark.parametrize(
        "name,answer,message",
        [
            pytest.param(
                "urgent",
                ScaleAnswer(expected_level=0.5, confidence=0.9, probabilities={}),
                "Answer type does not match question",
                id="type-mismatch",
            ),
            pytest.param(
                "urgent",
                PredicateAnswer(probability=1.5),
                "Invalid probability",
                id="predicate-probability",
            ),
            pytest.param(
                "department",
                ChoiceAnswer(
                    choice="billing",
                    confidence=0.9,
                    probabilities={"billing": 1.5, "technical": 0.2},
                ),
                "Invalid probability",
                id="choice-probability",
            ),
            pytest.param(
                "department",
                ChoiceAnswer(
                    choice="billing",
                    confidence=1.5,
                    probabilities={"billing": 0.8, "technical": 0.2},
                ),
                "Invalid confidence",
                id="confidence-above-one",
            ),
            pytest.param(
                "department",
                ChoiceAnswer(
                    choice="billing",
                    confidence=-0.1,
                    probabilities={"billing": 0.8, "technical": 0.2},
                ),
                "Invalid confidence",
                id="confidence-below-zero",
            ),
            pytest.param(
                "department",
                ChoiceAnswer(
                    choice="unknown",
                    confidence=0.9,
                    probabilities={"billing": 0.5, "technical": 0.5},
                ),
                "Unknown choice",
                id="unknown-choice",
            ),
            pytest.param(
                "department",
                ChoiceAnswer(choice="billing", confidence=0.9, probabilities={"billing": 1.0}),
                "Unknown choice",
                id="missing-choice-probability",
            ),
            pytest.param(
                "severity",
                ScaleAnswer(expected_level=7.0, confidence=0.9, probabilities={0: 0.5, 1: 0.5}),
                "Unknown scale level",
                id="expected-level-out-of-range",
            ),
            pytest.param(
                "severity",
                ScaleAnswer(expected_level=0.5, confidence=0.9, probabilities={7: 1.0}),
                "Unknown scale level",
                id="unknown-level-probability",
            ),
        ],
    )
    def test_rejects_an_answer_that_does_not_fit_its_question(
        self, name: str, answer: DecisionAnswer, message: str
    ) -> None:
        answers = {**_valid_answers(), name: answer}
        with pytest.raises(ValueError, match=message):
            validate_answers(REQUEST, answers)


class TestValidatedBaseUrl:
    @pytest.mark.parametrize(
        "base_url", ["https://api.example.com", "http://localhost:11434/v1", "https://host/v1/"]
    )
    def test_accepts_plain_http_urls(self, base_url: str) -> None:
        assert _validated_base_url(base_url) == base_url

    @pytest.mark.parametrize(
        "base_url", ["http://[::1", "https://host:badport"], ids=["bad-ipv6", "bad-port"]
    )
    def test_rejects_a_malformed_url(self, base_url: str) -> None:
        with pytest.raises(BadRequest, match="Base URL must be a valid HTTP"):
            _validated_base_url(base_url)

    @pytest.mark.parametrize(
        "base_url",
        [
            pytest.param("ftp://host/v1", id="scheme"),
            pytest.param("file:///etc/passwd", id="file-scheme"),
            pytest.param("https:///v1", id="empty-host"),
            pytest.param("https://user:secret@host/v1", id="userinfo"),
            pytest.param("https://user@host/v1", id="username-only"),
            pytest.param("https://host?x=1", id="query"),
            pytest.param("https://host#fragment", id="fragment"),
        ],
    )
    def test_rejects_a_url_that_is_not_plain_http(self, base_url: str) -> None:
        with pytest.raises(
            BadRequest, match="without embedded credentials, a query, or a fragment"
        ):
            _validated_base_url(base_url)


class TestOllamaBaseUrl:
    @pytest.mark.parametrize(
        "configured,expected",
        [
            pytest.param("http://localhost:11434/v1", "http://localhost:11434", id="chat-style"),
            pytest.param(
                "http://localhost:11434/v1/", "http://localhost:11434", id="trailing-slash"
            ),
            pytest.param("http://localhost:11434/", "http://localhost:11434", id="server-root"),
            pytest.param("http://localhost:11434", "http://localhost:11434", id="bare"),
        ],
    )
    def test_environment_value_is_reduced_to_the_server_root(
        self, monkeypatch: pytest.MonkeyPatch, configured: str, expected: str
    ) -> None:
        monkeypatch.setenv("OLLAMA_BASE_URL", configured)
        assert OllamaDecisionClient.resolve_base_url(None) == expected

    def test_the_run_overrides_the_environment(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("OLLAMA_BASE_URL", "http://env-box:11434/v1")
        assert (
            OllamaDecisionClient.resolve_base_url("http://gpu-box:11434/v1")
            == "http://gpu-box:11434"
        )

    def test_there_is_no_default(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.delenv("OLLAMA_BASE_URL", raising=False)
        assert OllamaDecisionClient.resolve_base_url(None) is None

    async def test_a_missing_base_url_names_the_variable(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.delenv("OLLAMA_BASE_URL", raising=False)
        with pytest.raises(BadRequest, match="Set OLLAMA_BASE_URL"):
            await get_decision_client(
                provider=GenerativeProviderKey.OLLAMA,
                model_name="nimble",
                base_url=None,
                credentials=None,
                session=cast(Any, None),
                decrypt=lambda value: value,
            )


@pytest.mark.parametrize(
    "client_class,base_url",
    [
        pytest.param(OpenAIDecisionClient, "https://decisions.example/v1", id="openai"),
        pytest.param(TypeSafeDecisionClient, "https://decisions.example", id="typesafe"),
    ],
)
@pytest.mark.parametrize(
    "error,message",
    [
        pytest.param(
            httpx2.ReadTimeout("slow"),
            "Decision request timed out. Retry or reduce the input.",
            id="timeout",
        ),
        pytest.param(
            httpx2.ConnectError("refused"), "Could not connect to {provider}.", id="connection"
        ),
    ],
)
async def test_timeouts_and_connection_failures_are_transient(
    monkeypatch: pytest.MonkeyPatch,
    client_class: type[OpenAIDecisionClient] | type[TypeSafeDecisionClient],
    base_url: str,
    error: Exception,
    message: str,
) -> None:
    async def fail(transport: httpx2.AsyncHTTPTransport, request: httpx2.Request) -> Any:
        raise error

    monkeypatch.setattr(httpx2.AsyncHTTPTransport, "handle_async_request", fail)
    client = client_class(
        model_name="model",
        connection=DecisionConnection(api_key="key", base_url=base_url, sdk_retries=False),
    )
    with pytest.raises(DecisionTransientError) as raised:
        await client.create(
            request=DecisionRequest.model_validate(
                {
                    "state": "hello",
                    "questions": [{"type": "predicate", "name": "q", "instructions": "?"}],
                }
            ),
            tracer=Tracer(span_cost_calculator=cast(Any, MagicMock())),
        )
    assert str(raised.value) == message.format(provider=client_class.provider_key.value)
    assert client.is_transient_error(raised.value)

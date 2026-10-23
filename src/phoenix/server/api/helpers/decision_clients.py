"""Decision invocation, request validation, and OpenInference tracing.

Decision models are a second model type alongside chat (LLM) models. A provider may
offer either or both: OpenAI serves ``gpt-6-luna`` through both its chat and its
Decisions APIs, while TypeSafe serves decision models only. ``DECISION_CLIENTS`` is the
single source of truth for which providers and models support decision execution, and
each client class declares how it reaches its provider: the OpenInference ``system`` and
``provider`` values, the SDK, the default base URL and its environment override,
and the credential it authenticates with. Nothing outside this module should special-case
a provider.
"""

from __future__ import annotations

import asyncio
import importlib.util
import json
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import (
    TYPE_CHECKING,
    Annotated,
    Any,
    Callable,
    ClassVar,
    Hashable,
    Literal,
    Mapping,
    Optional,
    Sequence,
    TypedDict,
)

import httpx
from openinference.semconv.trace import (
    OpenInferenceDecisionProviderValues,
    OpenInferenceDecisionSystemValues,
    OpenInferenceSpanKindValues,
    SpanAttributes,
)
from opentelemetry.context import Context as OtelContext
from opentelemetry.trace import Span as OtelSpan
from opentelemetry.trace import Status, StatusCode, Tracer
from pydantic import BaseModel, ConfigDict, Field, ValidationError
from sqlalchemy.ext.asyncio import AsyncSession

from phoenix.config import getenv
from phoenix.db import models
from phoenix.db.types.decisions import (
    ChoiceQuestion,
    DecisionQuestion,
    PredicateQuestion,
    ScaleQuestion,
)
from phoenix.db.types.model_provider import (
    OPENAI_DEFAULT_BASE_URL,
    TYPESAFE_DEFAULT_BASE_URL,
    GenerativeModelCustomerProviderConfig,
    ModelProvider,
    OpenAICustomProviderConfig,
    TypeSafeCustomProviderConfig,
    sdk_offers_decisions,
)
from phoenix.server.api.exceptions import BadRequest, NotFound
from phoenix.server.api.helpers.playground_clients import resolve_provider_api_key
from phoenix.server.api.helpers.playground_registry import (
    filter_allowed_providers,
)
from phoenix.server.api.input_types.GenerativeCredentialInput import GenerativeCredentialInput
from phoenix.server.api.types.GenerativeProvider import GenerativeProvider, GenerativeProviderKey
from phoenix.utilities.env_vars import without_env_vars

if TYPE_CHECKING:
    from openai.types.decision import Answer as OpenAIAnswer
    from openai.types.decision_create_params import DecisionCreateParams
    from openai.types.decision_create_params import Question as OpenAIQuestion
    from typesafe_sdk import Answer as TypeSafeAnswer
    from typesafe_sdk import Content, NoulCriteria, NoulModel
    from typesafe_sdk import QuestionModel as TypeSafeQuestion

    class SystemOneRequest(TypedDict):
        """The arguments ``system_one`` is called with."""

        model: str
        state: Content
        questions: dict[str, TypeSafeQuestion]


JSONValue = str | dict[str, Any] | list[Any]
"""Text, a JSON object, or an array. Used only where structure is the point."""


@dataclass(frozen=True)
class DecisionRequest:
    """One run: the state, and the questions in their stored form and order."""

    state: JSONValue
    questions: Sequence[DecisionQuestion]

    def questions_by_name(self) -> dict[str, DecisionQuestion]:
        return {question.name: question for question in self.questions}


class _Answer(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)


class PredicateAnswer(_Answer):
    type: Literal["predicate"] = "predicate"
    probability: float
    """The probability that the statement is true."""


class ChoiceAnswer(_Answer):
    type: Literal["choice"] = "choice"
    choice: str
    confidence: float
    """The model's certainty in ``choice``, from 0 to 1; not a probability."""
    probabilities: dict[str, float]
    """Probability per choice value."""


class ScaleAnswer(_Answer):
    type: Literal["scale"] = "scale"
    expected_level: float
    """The probability-weighted average of the levels; it can fall between levels."""
    confidence: float
    """The model's certainty in ``expected_level``, from 0 to 1; not a probability."""
    probabilities: dict[int, float]
    """Probability per level index."""


class RefusalAnswer(_Answer):
    type: Literal["refusal"] = "refusal"


DecisionAnswer = Annotated[
    PredicateAnswer | ChoiceAnswer | ScaleAnswer | RefusalAnswer, Field(discriminator="type")
]


@dataclass(frozen=True)
class DecisionResponse:
    """Normalized answers and accounting; the provider's own response goes on the span."""

    model: str
    answers: dict[str, DecisionAnswer]
    input_tokens: int | None
    output_tokens: int | None


def validate_answers(request: DecisionRequest, answers: dict[str, DecisionAnswer]) -> None:
    """Check normalized answers against the questions they answer.

    Raises:
        ValueError: An answer is missing, extra, of the wrong type, or out of range.
    """
    questions = request.questions_by_name()
    if set(answers) != set(questions):
        raise ValueError("Provider did not return one answer per question")
    for name, answer in answers.items():
        if isinstance(answer, RefusalAnswer):
            continue
        question = questions[name]
        if answer.type != question.type:
            raise ValueError("Answer type does not match question")
        if isinstance(answer, PredicateAnswer):
            probabilities = [answer.probability]
        else:
            if not 0 <= answer.confidence <= 1:
                raise ValueError("Invalid confidence")
            probabilities = list(answer.probabilities.values())
        if not all(0 <= probability <= 1 for probability in probabilities):
            raise ValueError("Invalid probability")
        if isinstance(answer, ChoiceAnswer) and isinstance(question, ChoiceQuestion):
            values = {option.value for option in question.choices}
            if answer.choice not in values or set(answer.probabilities) != values:
                raise ValueError("Unknown choice")
        elif isinstance(answer, ScaleAnswer) and isinstance(question, ScaleQuestion):
            top = len(question.levels) - 1
            if not 0 <= answer.expected_level <= top or set(answer.probabilities) != set(
                range(top + 1)
            ):
                raise ValueError("Unknown scale level")


def _token_count(count: Any) -> int | None:
    """A provider token count, or None when it is missing or not a non-negative integer."""
    if isinstance(count, int) and not isinstance(count, bool) and count >= 0:
        return count
    return None


def _record_input(span: OtelSpan, parameters: Mapping[str, Any]) -> None:
    span.set_attribute(SpanAttributes.INPUT_VALUE, json.dumps(parameters, ensure_ascii=False))


def _record_output(span: OtelSpan, body: Any) -> None:
    span.set_attribute(SpanAttributes.OUTPUT_MIME_TYPE, "application/json")
    span.set_attribute(SpanAttributes.OUTPUT_VALUE, json.dumps(body, ensure_ascii=False))


def _as_text(value: JSONValue) -> str:
    return value if isinstance(value, str) else json.dumps(value, ensure_ascii=False)


def describe_http_failure(provider_name: str, status_code: int) -> str:
    """A user-facing message for a failed provider call, with a hint that fits the status.

    The upstream body is never included: it may echo the request or carry provider
    internals.
    """
    if status_code in (401, 403):
        hint = "Check the API key and whether it has access to the model."
    elif status_code == 404:
        hint = "Check the base URL and the model name."
    elif status_code == 429:
        hint = "The provider rate-limited the request. Wait and retry."
    elif status_code in (400, 422):
        hint = "Check the state and question configuration."
    elif 300 <= status_code < 400:
        hint = "The endpoint redirected; use the final URL as the base URL."
    elif status_code >= 500:
        hint = "The provider is unavailable. Retry later."
    else:
        hint = "Check the API key, model access, endpoint, and question configuration."
    return f"{provider_name} decision request failed (HTTP {status_code}). {hint}"


class UnreadableCustomProviderError(BadRequest):
    """A custom provider's stored configuration can't be decrypted or parsed, so the run
    fails before any request is sent. Like a provider failure, it is recorded as a span."""

    def __init__(self, message: str, *, provider_name: str) -> None:
        super().__init__(message)
        self.provider_name = provider_name


class DecisionRateLimitError(BadRequest):
    """The provider rate-limited the request (HTTP 429). Worth retrying after a wait."""


class DecisionTransientError(BadRequest):
    """A timeout, a connection failure, or a provider error (HTTP 5xx). Worth retrying."""


def _status_error_class(status_code: int) -> type[BadRequest]:
    if status_code == 429:
        return DecisionRateLimitError
    if status_code >= 500:
        return DecisionTransientError
    return BadRequest


def _fail(span: OtelSpan, message: str, error_class: type[BadRequest] = BadRequest) -> BadRequest:
    """Record ``message`` as the span's error status and return the error to raise.

    ``error_class`` says what kind of failure it is, so a caller that retries (the
    experiment runner) can tell a rate limit or a transient failure from a request the
    provider will always reject. Every kind is a ``BadRequest`` with the same message.
    """
    span.set_status(Status(StatusCode.ERROR, message))
    return error_class(message)


@dataclass(frozen=True)
class DecisionConnection:
    """How a decision client reaches its endpoint, resolved before it is built."""

    api_key: str
    base_url: str
    headers: Optional[Mapping[str, str]] = None
    organization: Optional[str] = None
    """OpenAI only."""
    project: Optional[str] = None
    """OpenAI only."""
    provider_name: Optional[str] = None
    """The span's ``decision.provider``; the client's own provider when unset. A custom
    provider names who hosts it."""
    ignore_environment: bool = False
    """Keep the SDK from reading the server's environment (organization, project), so
    a custom provider sends only what it configures."""


class DecisionClient(ABC):
    """Execute a non-streaming decision request without chat/tool emulation.

    Subclasses declare how to reach their provider through class attributes, so the
    resolver in :func:`get_decision_client` never needs to know which provider it is
    building for. ``api_key_env_var`` defaults to the provider's first required
    credential from :class:`GenerativeProvider`'s credential requirements, which keeps
    one source of truth for credential names across chat and decision execution.
    """

    provider_key: ClassVar[GenerativeProviderKey]
    system: ClassVar[OpenInferenceDecisionSystemValues]
    provider: ClassVar[str]
    """The span's ``decision.provider``: who hosts the model, which may differ from the
    API family in ``system``."""
    model_names: ClassVar[tuple[str, ...]]
    """The decision models offered in the catalog, in order."""
    sdk_import_name: ClassVar[str]
    default_base_url: ClassVar[Optional[str]]
    """None when there is no sensible default, so a base URL must be configured."""
    base_url_env_var: ClassVar[str]
    api_key_env_var: ClassVar[Optional[str]] = None
    requires_api_key: ClassVar[bool] = True
    """False for servers that ignore the key; a placeholder is sent, since the SDK
    requires one."""

    def __init__(self, *, model_name: str, connection: DecisionConnection) -> None:
        self.model_name = model_name
        self._connection = connection
        self._api_key = connection.api_key
        self._base_url = connection.base_url.rstrip("/")

    @classmethod
    def credential_env_var(cls) -> str:
        """The environment variable (and secret name) holding this client's API key."""
        if cls.api_key_env_var:
            return cls.api_key_env_var
        requirements = GenerativeProvider.model_provider_to_credential_requirements_map.get(
            cls.provider_key, []
        )
        for requirement in requirements:
            if requirement.is_required:
                return requirement.env_var_name
        raise RuntimeError(
            f"{cls.__name__} declares no api_key_env_var and {cls.provider_key.value} "
            "has no required credential."
        )

    @classmethod
    def resolve_base_url(cls, override: Optional[str]) -> Optional[str]:
        return override or getenv(cls.base_url_env_var) or cls.default_base_url

    def get_rate_limit_key(self) -> Hashable:
        """Requests with the same key share rate-limit capacity: same API, endpoint, key."""
        return ("decision", self.system.value, hash(self._base_url), hash(self._api_key))

    def is_rate_limit_error(self, error: Exception) -> bool:
        return isinstance(error, DecisionRateLimitError)

    def is_transient_error(self, error: Exception) -> bool:
        return isinstance(error, DecisionTransientError)

    @classmethod
    def dependencies_are_installed(cls) -> bool:
        """Whether the optional provider SDK is available."""
        try:
            return importlib.util.find_spec(cls.sdk_import_name) is not None
        except (ImportError, ValueError):
            return False

    @abstractmethod
    async def invoke(self, request: DecisionRequest, span: OtelSpan) -> DecisionResponse:
        """Translate the request, call the provider SDK, and normalize its answers.

        Implementations record on ``span`` the provider request before calling, so a
        failed call still shows what was sent, and the provider's raw response after.
        Checking the answers against the questions is left to :meth:`create`.

        Raises:
            BadRequest: The request uses something this provider can't express, or the
                provider call failed.
        """
        ...

    async def create(
        self,
        *,
        request: DecisionRequest,
        tracer: Tracer,
        otel_context: Optional[OtelContext] = None,
    ) -> DecisionResponse:
        """Run the request and trace the provider's request, response, model, and usage.

        Args:
            request: Validated state and named questions.
            tracer: Trace collector owned by this execution.
            otel_context: Explicit span parent; None inherits the active context.

        Returns:
            Validated answers keyed by question name, with the resolved model and usage.

        Raises:
            BadRequest: Provider rejected the input or returned an invalid response.
        """
        with tracer.start_as_current_span(
            "Decision",
            context=otel_context,
            attributes={
                SpanAttributes.OPENINFERENCE_SPAN_KIND: OpenInferenceSpanKindValues.DECISION.value,
                SpanAttributes.DECISION_SYSTEM: self.system.value,
                SpanAttributes.DECISION_PROVIDER: (self._connection.provider_name or self.provider),
                SpanAttributes.DECISION_MODEL_NAME: self.model_name,
                SpanAttributes.DECISION_REQUEST_MODEL_NAME: self.model_name,
                SpanAttributes.INPUT_MIME_TYPE: "application/json",
            },
            # Without this, the SDK replaces the status ``_fail`` sets with
            # ``BadRequest: ...`` as the exception leaves the block.
            set_status_on_exception=False,
        ) as span:
            try:
                response = await self.invoke(request, span)
                validate_answers(request, response.answers)
                resolved_model = response.model.strip() or self.model_name
                span.set_attribute(SpanAttributes.DECISION_RESPONSE_MODEL_NAME, resolved_model)
                span.set_attribute(SpanAttributes.DECISION_MODEL_NAME, resolved_model)
                input_tokens = _token_count(response.input_tokens)
                output_tokens = _token_count(response.output_tokens)
                for count, attribute in (
                    (input_tokens, SpanAttributes.DECISION_TOKEN_COUNT_INPUT),
                    (output_tokens, SpanAttributes.DECISION_TOKEN_COUNT_OUTPUT),
                ):
                    if count is not None:
                        span.set_attribute(attribute, count)
                span.set_status(Status(StatusCode.OK))
                return DecisionResponse(
                    model=resolved_model,
                    answers=response.answers,
                    input_tokens=input_tokens,
                    output_tokens=output_tokens,
                )
            except asyncio.CancelledError:
                span.set_status(Status(StatusCode.ERROR, "Decision execution cancelled"))
                raise
            except BadRequest as error:
                raise _fail(span, str(error), type(error)) from error
            except (ValueError, KeyError, TypeError, AttributeError) as error:
                raise _fail(
                    span, f"{self.provider_key.value} returned an invalid decision response."
                ) from error


TYPESAFE_DECISION_MODELS: tuple[str, ...] = (
    "jev-latest",
    "jev-1.14.0",
    "jev-1.13.0",
    "jev-preview",
)


class TypeSafeDecisionClient(DecisionClient):
    """TypeSafe System One. Any System One-compatible host (OpenRouter, a LiteLLM
    proxy, self-hosted vLLM Decision models) works through ``TYPESAFE_BASE_URL``."""

    provider_key = GenerativeProviderKey.TYPESAFE
    system = OpenInferenceDecisionSystemValues.TYPESAFE
    provider = OpenInferenceDecisionProviderValues.TYPESAFE.value
    model_names = TYPESAFE_DECISION_MODELS
    sdk_import_name = "typesafe_sdk"
    default_base_url: ClassVar[Optional[str]] = TYPESAFE_DEFAULT_BASE_URL
    base_url_env_var = "TYPESAFE_BASE_URL"

    def _build_request(self, request: DecisionRequest) -> SystemOneRequest:
        """Translate Phoenix questions into System One's: a predicate is a ``noul``, a
        scale is a ``score`` whose criteria are the level descriptions."""
        questions: dict[str, TypeSafeQuestion] = {}
        for question in request.questions:
            name = question.name
            if isinstance(question, PredicateQuestion):
                noul: NoulModel = {"type": "noul", "instructions": question.instructions}
                if question.criteria is not None:
                    criteria: NoulCriteria = {}
                    if question.criteria.true is not None:
                        criteria["true"] = question.criteria.true
                    if question.criteria.false is not None:
                        criteria["false"] = question.criteria.false
                    if criteria:
                        noul["criteria"] = criteria
                questions[name] = noul
            elif isinstance(question, ChoiceQuestion):
                questions[name] = {
                    "type": "choice",
                    "instructions": question.instructions,
                    "criteria": {option.value: option.description for option in question.choices},
                }
            else:
                questions[name] = {
                    "type": "score",
                    "instructions": question.instructions,
                    "criteria": [
                        level.label if level.description is None else level.description
                        for level in question.levels
                    ],
                }
        return {"model": self.model_name, "state": request.state, "questions": questions}

    async def invoke(self, request: DecisionRequest, span: OtelSpan) -> DecisionResponse:
        from typesafe_sdk import (
            AsyncTypeSafeClient,
            RetryPolicy,
            TypeSafeAPIConnectionError,
            TypeSafeAPIError,
            TypeSafeAPIResponseValidationError,
            TypeSafeAPITimeoutError,
            TypeSafeError,
        )

        parameters = self._build_request(request)
        _record_input(span, parameters)
        try:
            async with AsyncTypeSafeClient(
                api_key=self._api_key,
                base_url=self._base_url,
                headers=self._connection.headers,
                retry=RetryPolicy(max_retries=0),
                timeout=60,
            ) as client:
                response = await client.system_one(**parameters)
            _record_output(span, response.raw_http_response.json())
        except TypeSafeAPIResponseValidationError as error:
            _record_output(span, error.body)
            raise ValueError("Invalid TypeSafe response") from error
        except TypeSafeAPITimeoutError as error:
            raise _fail(
                span,
                "Decision request timed out. Retry or reduce the input.",
                DecisionTransientError,
            ) from error
        except TypeSafeAPIConnectionError as error:
            raise _fail(
                span, f"Could not connect to {self.provider_key.value}.", DecisionTransientError
            ) from error
        except TypeSafeAPIError as error:
            raise _fail(
                span,
                describe_http_failure(self.provider_key.value, error.status),
                _status_error_class(error.status),
            ) from error
        except TypeSafeError as error:
            raise _fail(span, "Invalid TypeSafe client configuration.") from error
        return DecisionResponse(
            model=response.model,
            answers={name: self._normalize(answer) for name, answer in response.answers.items()},
            input_tokens=response.usage.input_tokens,
            output_tokens=response.usage.output_tokens,
        )

    @staticmethod
    def _normalize(answer: TypeSafeAnswer) -> DecisionAnswer:
        if answer.type == "noul":
            return PredicateAnswer(probability=answer.noul)
        if answer.type == "choice":
            return ChoiceAnswer(
                choice=answer.choice,
                confidence=answer.confidence,
                probabilities=dict(answer.probabilities),
            )
        if answer.type == "score":
            return ScaleAnswer(
                expected_level=answer.score,
                confidence=answer.confidence,
                probabilities=dict(answer.probabilities),
            )
        raise ValueError(f"Unsupported TypeSafe answer type {answer.type!r}")


OPENAI_DECISION_MODELS: tuple[str, ...] = ("gpt-6-luna",)


class OpenAIDecisionClient(DecisionClient):
    """OpenAI Decisions API. Shares OpenAI's credential and base URL with chat."""

    provider_key = GenerativeProviderKey.OPENAI
    system = OpenInferenceDecisionSystemValues.OPENAI
    provider = OpenInferenceDecisionProviderValues.OPENAI.value
    model_names = OPENAI_DECISION_MODELS
    sdk_import_name = "openai"
    default_base_url: ClassVar[Optional[str]] = OPENAI_DEFAULT_BASE_URL
    base_url_env_var = "OPENAI_BASE_URL"

    def _build_request(self, request: DecisionRequest) -> DecisionCreateParams:
        """Translate Phoenix questions into the SDK's discriminated request types.

        OpenAI's ``input`` is text, so a structured state is sent as JSON, and a
        predicate's criteria are folded into its instructions since OpenAI has no field
        for them.
        """
        questions: list[OpenAIQuestion] = []
        for question in request.questions:
            name = question.name
            instructions = question.instructions
            if isinstance(question, ChoiceQuestion):
                questions.append(
                    {
                        "name": name,
                        "type": "choice",
                        "instructions": instructions,
                        "choices": [
                            {"value": option.value}
                            if option.description is None
                            else {
                                "value": option.value,
                                "description": option.description,
                            }
                            for option in question.choices
                        ],
                    }
                )
            elif isinstance(question, ScaleQuestion):
                questions.append(
                    {
                        "name": name,
                        "type": "score",
                        "instructions": instructions,
                        "levels": [
                            {"label": level.label}
                            if level.description is None
                            else {"label": level.label, "description": level.description}
                            for level in question.levels
                        ],
                    }
                )
            else:
                if question.criteria is not None:
                    for outcome, description in (
                        ("True", question.criteria.true),
                        ("False", question.criteria.false),
                    ):
                        if description is not None:
                            instructions += f"\n{outcome} if: {description}"
                questions.append({"name": name, "type": "predicate", "instructions": instructions})
        return {"model": self.model_name, "input": _as_text(request.state), "questions": questions}

    async def invoke(self, request: DecisionRequest, span: OtelSpan) -> DecisionResponse:
        import httpx2
        from openai import (
            APIConnectionError,
            APIStatusError,
            APITimeoutError,
            AsyncOpenAI,
        )
        from openai.types import Decision

        parameters = self._build_request(request)
        _record_input(span, parameters)
        connection = self._connection
        try:
            ignored = ("OPENAI_*",) if connection.ignore_environment else ()
            with without_env_vars(*ignored):
                openai_client = AsyncOpenAI(
                    api_key=self._api_key,
                    base_url=self._base_url,
                    organization=connection.organization,
                    project=connection.project,
                    default_headers=connection.headers,
                    timeout=60,
                    max_retries=0,
                    http_client=httpx2.AsyncClient(follow_redirects=False),
                )
            async with openai_client as client:
                response = await client.decisions.with_raw_response.create(**parameters)
                raw = response.http_response.json()
                _record_output(span, raw)
                decision = Decision.model_validate(raw)
        except APITimeoutError as error:
            raise _fail(
                span,
                "Decision request timed out. Retry or reduce the input.",
                DecisionTransientError,
            ) from error
        except APIConnectionError as error:
            raise _fail(
                span, f"Could not connect to {self.provider_key.value}.", DecisionTransientError
            ) from error
        except APIStatusError as error:
            raise _fail(
                span,
                describe_http_failure(self.provider_key.value, error.status_code),
                _status_error_class(error.status_code),
            ) from error
        answers: dict[str, DecisionAnswer] = {}
        for answer in decision.answers:
            if answer.name is None or answer.name in answers:
                raise ValueError("Missing or duplicate answer name")
            answers[answer.name] = self._normalize(answer)
        return DecisionResponse(
            model=decision.model,
            answers=answers,
            input_tokens=decision.usage.input_tokens,
            output_tokens=decision.usage.output_tokens,
        )

    @staticmethod
    def _normalize(answer: OpenAIAnswer) -> DecisionAnswer:
        if answer.type == "refusal":
            return RefusalAnswer()
        if answer.type == "predicate":
            return PredicateAnswer(probability=answer.probability)
        if answer.type == "choice":
            probabilities = {item.value: item.probability for item in answer.probabilities}
            if len(probabilities) != len(answer.probabilities):
                raise ValueError("Duplicate choice probability")
            return ChoiceAnswer.model_validate(
                {
                    "choice": answer.choice,
                    "confidence": answer.confidence,
                    "probabilities": probabilities,
                },
                strict=True,
            )
        levels = {item.value: item.probability for item in answer.probabilities}
        if len(levels) != len(answer.probabilities):
            raise ValueError("Duplicate level probability")
        return ScaleAnswer(
            expected_level=answer.score, confidence=answer.confidence, probabilities=levels
        )


OLLAMA_DECISION_MODELS: tuple[str, ...] = (
    "tev1",
    "nimble",
    "clef-flash",
    "nimble-v3",
    "laya",
    "kev",
    "pplx-decider",
    "strands-decider",
)
"""Ollama's local decision models. ``clef`` is left out: it runs on Ollama's cloud."""


class OllamaDecisionClient(TypeSafeDecisionClient):
    """Ollama's decision models, which it serves through System One at ``/v1/systemone``.

    Configured the way Ollama chat is: no credentials, and a base URL from the run or
    ``OLLAMA_BASE_URL`` with no default. That variable names the OpenAI-compatible root
    (``http://localhost:11434/v1``) for chat, while System One's path starts at the
    server root, so a trailing ``/v1`` is dropped and one variable serves both.
    """

    provider_key = GenerativeProviderKey.OLLAMA
    system = OpenInferenceDecisionSystemValues.TYPESAFE
    provider = "ollama"  # OpenInference has no Ollama decision provider value yet.
    model_names = OLLAMA_DECISION_MODELS
    default_base_url = None
    base_url_env_var = "OLLAMA_BASE_URL"
    requires_api_key = False

    @classmethod
    def resolve_base_url(cls, override: Optional[str]) -> Optional[str]:
        base_url = super().resolve_base_url(override)
        if base_url is None:
            return None
        return base_url.rstrip("/").removesuffix("/v1")


DECISION_CLIENTS: Mapping[GenerativeProviderKey, type[DecisionClient]] = {
    client.provider_key: client
    for client in (TypeSafeDecisionClient, OpenAIDecisionClient, OllamaDecisionClient)
}
"""The client for each provider that offers decision models. A provider here and not in
the playground registry is decision-only, which is what the chat-path guards in
prompts, agents, and the playground check for."""


def allowed_decision_providers(
    allowed_provider_names: Optional[frozenset[str]],
) -> list[GenerativeProviderKey]:
    """The decision providers this deployment permits (see ``PHOENIX_ALLOWED_PROVIDERS``)."""
    return filter_allowed_providers(list(DECISION_CLIENTS), allowed_provider_names)


_PLACEHOLDER_API_KEY = "ollama"
"""Sent to servers that ignore the key, as Ollama chat does."""


def _require_model_name(model_name: str) -> None:
    if not model_name.strip():
        raise BadRequest("A decision model name is required.")


def _require_dependencies(client_class: type[DecisionClient]) -> None:
    if not client_class.dependencies_are_installed():
        raise BadRequest(
            f"Install {client_class.sdk_import_name.replace('_', '-')} to run decision models."
        )


def _validated_base_url(base_url: str) -> str:
    """``base_url`` if it is a plain HTTP(S) URL.

    Raises:
        BadRequest: The URL is malformed, not HTTP(S), or carries credentials, a
            query, or a fragment.
    """
    try:
        url = httpx.URL(base_url)
    except httpx.InvalidURL as error:
        raise BadRequest("Base URL must be a valid HTTP(S) URL.") from error
    if (
        url.scheme not in ("http", "https")
        or not url.host
        or url.userinfo
        or url.query
        or url.fragment
    ):
        raise BadRequest(
            "Base URL must be an HTTP(S) URL without embedded credentials, a query, or a fragment."
        )
    return base_url


async def get_decision_client(
    *,
    provider: GenerativeProviderKey,
    model_name: str,
    base_url: str | None,
    credentials: Sequence[GenerativeCredentialInput] | None,
    session: AsyncSession,
    decrypt: Callable[[bytes], bytes],
    allowed_provider_names: Optional[frozenset[str]] = None,
) -> DecisionClient:
    """Resolve the client for a built-in ``provider`` and its credentials.

    The credential name, default endpoint, and endpoint override all come from the
    client class, so adding a provider is one subclass in :data:`DECISION_CLIENTS`. The
    server-key endpoint guard in ``resolve_provider_api_key`` still applies: a
    server-configured key is never sent to a caller-supplied base URL.
    """
    if allowed_provider_names is not None and provider.name not in allowed_provider_names:
        raise BadRequest("This decision provider is not permitted by the server configuration.")
    client_class = DECISION_CLIENTS.get(provider)
    if client_class is None:
        raise BadRequest(f"{provider.value} does not offer decision models.")
    _require_model_name(model_name)
    _require_dependencies(client_class)
    configured_base_url = client_class.resolve_base_url(base_url)
    if configured_base_url is None:
        raise BadRequest(
            f"A base URL is required for {provider.value} decision models. "
            f"Set {client_class.base_url_env_var} or pass a base URL."
        )
    resolved_base_url = _validated_base_url(configured_base_url)
    if not client_class.requires_api_key:
        return client_class(
            model_name=model_name,
            connection=DecisionConnection(api_key=_PLACEHOLDER_API_KEY, base_url=resolved_base_url),
        )
    env_var_name = client_class.credential_env_var()
    api_key = await resolve_provider_api_key(
        credentials=credentials,
        session=session,
        decrypt=decrypt,
        env_var_name=env_var_name,
        client_base_url=base_url,
        provider_label=provider.value,
    )
    if not api_key:
        raise BadRequest(
            f"An API key is required. Configure {env_var_name} to run decision models."
        )
    return client_class(
        model_name=model_name,
        connection=DecisionConnection(api_key=api_key, base_url=resolved_base_url),
    )


async def get_custom_provider_decision_client(
    *,
    custom_provider_id: int,
    model_name: str,
    session: AsyncSession,
    decrypt: Callable[[bytes], bytes],
) -> DecisionClient:
    """Resolve the client for a custom provider from its stored configuration.

    The provider brings its own key, endpoint, and headers; neither the server's
    environment nor its stored secrets are consulted. An ``openai`` provider runs
    OpenAI's Decisions API and a ``typesafe`` provider runs System One.

    Raises:
        NotFound: No custom provider has this ID.
        BadRequest: The provider serves no decision models or its endpoint is not a
            plain HTTP(S) URL.
        UnreadableCustomProviderError: Its stored configuration can't be read.
    """
    record = await session.get(models.GenerativeModelCustomProvider, custom_provider_id)
    if record is None:
        raise NotFound("Custom provider not found.")
    if not sdk_offers_decisions(record.sdk):
        raise BadRequest(f"Custom provider '{record.name}' does not serve decision models.")
    _require_model_name(model_name)
    # The reasons name what failed, never the configuration's values.
    try:
        decrypted = decrypt(record.config)
    except Exception as error:
        raise UnreadableCustomProviderError(
            f"Could not read custom provider '{record.name}': its stored configuration "
            "can't be decrypted, which happens when PHOENIX_SECRET changed after it was "
            "saved. Re-enter its settings under Settings > AI Providers.",
            provider_name=record.name,
        ) from error
    try:
        config = GenerativeModelCustomerProviderConfig.model_validate_json(decrypted).root
    except ValidationError as error:
        fields = sorted(
            {".".join(str(part) for part in detail["loc"]) or "(root)" for detail in error.errors()}
        )
        raise UnreadableCustomProviderError(
            f"Could not read custom provider '{record.name}': its stored configuration is "
            f"invalid ({', '.join(fields)}). Edit it under Settings > AI Providers.",
            provider_name=record.name,
        ) from error
    client_class: type[DecisionClient]
    if isinstance(config, OpenAICustomProviderConfig):
        client_class = OpenAIDecisionClient
        openai_kwargs = config.openai_client_kwargs
        connection = DecisionConnection(
            api_key=config.openai_authentication_method.api_key,
            base_url=_validated_base_url(
                (openai_kwargs.base_url if openai_kwargs else None) or OPENAI_DEFAULT_BASE_URL
            ),
            headers=openai_kwargs.default_headers if openai_kwargs else None,
            organization=openai_kwargs.organization if openai_kwargs else None,
            project=openai_kwargs.project if openai_kwargs else None,
            provider_name=record.provider,
            ignore_environment=True,
        )
    elif isinstance(config, TypeSafeCustomProviderConfig):
        client_class = TypeSafeDecisionClient
        typesafe_kwargs = config.typesafe_client_kwargs
        connection = DecisionConnection(
            api_key=config.typesafe_authentication_method.api_key,
            base_url=_validated_base_url(
                (typesafe_kwargs.base_url if typesafe_kwargs else None) or TYPESAFE_DEFAULT_BASE_URL
            ),
            headers=typesafe_kwargs.default_headers if typesafe_kwargs else None,
            provider_name=record.provider,
            ignore_environment=True,
        )
    else:
        raise BadRequest(f"Custom provider '{record.name}' does not serve decision models.")
    _require_dependencies(client_class)
    return client_class(model_name=model_name, connection=connection)


async def resolve_decision_client(
    *,
    model_provider: ModelProvider,
    model_name: str,
    custom_provider_id: Optional[int] = None,
    base_url: Optional[str] = None,
    credentials: Optional[Sequence[GenerativeCredentialInput]] = None,
    session: AsyncSession,
    decrypt: Callable[[bytes], bytes],
) -> DecisionClient:
    """Resolve either a custom-provider or built-in DecisionClient."""
    if custom_provider_id is not None:
        return await get_custom_provider_decision_client(
            custom_provider_id=custom_provider_id,
            model_name=model_name,
            session=session,
            decrypt=decrypt,
        )
    return await get_decision_client(
        provider=GenerativeProviderKey.from_model_provider(model_provider),
        model_name=model_name,
        base_url=base_url,
        credentials=credentials,
        session=session,
        decrypt=decrypt,
    )

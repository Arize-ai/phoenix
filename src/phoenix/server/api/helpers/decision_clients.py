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
from opentelemetry.trace import Status, StatusCode
from pydantic import BaseModel, ConfigDict, Field, model_validator
from sqlalchemy.ext.asyncio import AsyncSession

from phoenix.config import getenv
from phoenix.db.types.decisions import (
    ChoiceQuestion,
    DecisionQuestion,
    PredicateQuestion,
    ScaleQuestion,
)
from phoenix.server.api.exceptions import BadRequest
from phoenix.server.api.helpers.decision_versions import validate_questions
from phoenix.server.api.helpers.playground_clients import resolve_provider_api_key
from phoenix.server.api.helpers.playground_registry import (
    filter_allowed_providers,
)
from phoenix.server.api.input_types.GenerativeCredentialInput import GenerativeCredentialInput
from phoenix.server.api.types.GenerativeProvider import GenerativeProvider, GenerativeProviderKey
from phoenix.tracers import Tracer

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


class DecisionRequest(BaseModel):
    """One run: the state, and the questions in their stored form and order.

    Each adapter translates it to its provider's request. Write-time rules for the
    questions run here too (see :func:`validate_questions`), because running accepts
    questions just as saving does.
    """

    model_config = ConfigDict(extra="forbid")
    state: JSONValue
    questions: list[DecisionQuestion]

    @model_validator(mode="after")
    def validate_state_and_questions(self) -> "DecisionRequest":
        if isinstance(self.state, str) and not self.state.strip():
            raise ValueError("State cannot be empty")
        validate_questions(self.questions)
        return self

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


def _fail(span: OtelSpan, message: str) -> BadRequest:
    """Record ``message`` as the span's error status and return the error to raise."""
    span.set_status(Status(StatusCode.ERROR, message))
    return BadRequest(message)


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
    provider: ClassVar[OpenInferenceDecisionProviderValues]
    model_names: ClassVar[tuple[str, ...]]
    """The decision models offered in the catalog, in order."""
    sdk_import_name: ClassVar[str]
    default_base_url: ClassVar[str]
    base_url_env_var: ClassVar[str]
    api_key_env_var: ClassVar[Optional[str]] = None

    def __init__(self, *, model_name: str, api_key: str, base_url: str) -> None:
        self.model_name = model_name
        self._api_key = api_key
        self._base_url = base_url.rstrip("/")

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
    def resolve_base_url(cls, override: Optional[str]) -> str:
        return override or getenv(cls.base_url_env_var) or cls.default_base_url

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

    async def create(self, *, request: DecisionRequest, tracer: Tracer) -> DecisionResponse:
        """Run the request and trace the provider's request, response, model, and usage.

        Args:
            request: Validated state and named questions.
            tracer: Trace collector owned by this execution.

        Returns:
            Validated answers keyed by question name, with the resolved model and usage.

        Raises:
            BadRequest: Provider rejected the input or returned an invalid response.
        """
        with tracer.start_as_current_span(
            "Decision",
            context=OtelContext(),
            attributes={
                SpanAttributes.OPENINFERENCE_SPAN_KIND: OpenInferenceSpanKindValues.DECISION.value,
                SpanAttributes.DECISION_SYSTEM: self.system.value,
                SpanAttributes.DECISION_PROVIDER: self.provider.value,
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
                raise _fail(span, str(error)) from error
            except (ValueError, KeyError, TypeError, AttributeError) as error:
                raise _fail(
                    span, f"{self.provider_key.value} returned an invalid decision response."
                ) from error


TYPESAFE_DECISION_MODELS = (
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
    provider = OpenInferenceDecisionProviderValues.TYPESAFE
    model_names = TYPESAFE_DECISION_MODELS
    sdk_import_name = "typesafe_sdk"
    default_base_url = "https://api.typesafe.ai"
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
                api_key=self._api_key, base_url=self._base_url, timeout=60
            ) as client:
                response = await client.system_one(**parameters)
            _record_output(span, response.raw_http_response.json())
        except TypeSafeAPIResponseValidationError as error:
            _record_output(span, error.body)
            raise ValueError("Invalid TypeSafe response") from error
        except TypeSafeAPITimeoutError as error:
            raise _fail(span, "Decision request timed out. Retry or reduce the input.") from error
        except TypeSafeAPIConnectionError as error:
            raise _fail(span, f"Could not connect to {self.provider_key.value}.") from error
        except TypeSafeAPIError as error:
            raise _fail(
                span, describe_http_failure(self.provider_key.value, error.status)
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


OPENAI_DECISION_MODELS = ("gpt-6-luna",)


class OpenAIDecisionClient(DecisionClient):
    """OpenAI Decisions API. Shares OpenAI's credential and base URL with chat."""

    provider_key = GenerativeProviderKey.OPENAI
    system = OpenInferenceDecisionSystemValues.OPENAI
    provider = OpenInferenceDecisionProviderValues.OPENAI
    model_names = OPENAI_DECISION_MODELS
    sdk_import_name = "openai"
    default_base_url = "https://api.openai.com/v1"
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
        from openai import APIConnectionError, APIStatusError, APITimeoutError, AsyncOpenAI
        from openai.types import Decision

        parameters = self._build_request(request)
        _record_input(span, parameters)
        try:
            async with AsyncOpenAI(
                api_key=self._api_key,
                base_url=self._base_url,
                timeout=60,
                http_client=httpx2.AsyncClient(follow_redirects=False),
            ) as client:
                response = await client.decisions.with_raw_response.create(**parameters)
                raw = response.http_response.json()
                _record_output(span, raw)
                decision = Decision.model_validate(raw)
        except APITimeoutError as error:
            raise _fail(span, "Decision request timed out. Retry or reduce the input.") from error
        except APIConnectionError as error:
            raise _fail(span, f"Could not connect to {self.provider_key.value}.") from error
        except APIStatusError as error:
            raise _fail(
                span, describe_http_failure(self.provider_key.value, error.status_code)
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


DECISION_CLIENTS: Mapping[GenerativeProviderKey, type[DecisionClient]] = {
    client.provider_key: client for client in (TypeSafeDecisionClient, OpenAIDecisionClient)
}
"""The client for each provider that offers decision models. A provider here and not in
the playground registry is decision-only, which is what the chat-path guards in
prompts, agents, and the playground check for."""


def allowed_decision_providers(
    allowed_provider_names: Optional[frozenset[str]],
) -> list[GenerativeProviderKey]:
    """The decision providers this deployment permits (see ``PHOENIX_ALLOWED_PROVIDERS``)."""
    return filter_allowed_providers(list(DECISION_CLIENTS), allowed_provider_names)


async def get_decision_client(
    *,
    provider: GenerativeProviderKey,
    model_name: str,
    base_url: str | None,
    credentials: Sequence[GenerativeCredentialInput] | None,
    session: AsyncSession,
    decrypt: Callable[[bytes], bytes],
) -> DecisionClient:
    """Resolve the registered client for ``provider`` and its credentials.

    The credential name, default endpoint, and endpoint override all come from the
    client class, so adding a provider is one registered subclass. The server-key
    endpoint guard in ``resolve_provider_api_key`` still applies: a server-configured
    key is never sent to a caller-supplied base URL.
    """
    client_class = DECISION_CLIENTS.get(provider)
    if client_class is None:
        raise BadRequest(f"{provider.value} does not offer decision models.")
    if not model_name.strip():
        raise BadRequest("A decision model name is required.")
    if not client_class.dependencies_are_installed():
        raise BadRequest(
            f"Install {client_class.sdk_import_name.replace('_', '-')} to run decision models."
        )
    resolved_base_url = client_class.resolve_base_url(base_url)
    try:
        url = httpx.URL(resolved_base_url)
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
        api_key=api_key,
        base_url=resolved_base_url,
    )

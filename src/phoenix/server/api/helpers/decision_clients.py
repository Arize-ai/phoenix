"""Decision model clients, answer validation, and OpenInference tracing."""

from __future__ import annotations

import asyncio
import json
from abc import abstractmethod
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

from phoenix.db import models
from phoenix.db.types.decisions import (
    ChoiceQuestion,
    DecisionQuestion,
    PredicateQuestion,
    ScaleQuestion,
)
from phoenix.db.types.model_provider import (
    ClientFactory,
    GenerativeModelCustomerProviderConfig,
    GenerativeModelCustomerProviderConfigType,
    ModelProvider,
    OpenAICustomProviderConfig,
    TypeSafeCustomProviderConfig,
)
from phoenix.server.api.exceptions import BadRequest, NotFound
from phoenix.server.api.helpers.builtin_providers import (
    BuiltInEndpoint,
    check_provider_base_urls,
    credential_env_vars,
    resolve_builtin_config,
)
from phoenix.server.api.helpers.chat_clients import CHAT_ENDPOINTS
from phoenix.server.api.helpers.client_registry import (
    CLIENT_REGISTRY,
    PROVIDER_DEFAULT,
    register_client,
)
from phoenix.server.api.helpers.model_clients import Dependency, ModelClient
from phoenix.server.api.input_types.GenerativeCredentialInput import GenerativeCredentialInput
from phoenix.server.api.types.GenerativeProvider import GenerativeProviderKey
from phoenix.server.decisions.validation import custom_provider_without_decisions_error

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


class DecisionClient(ModelClient[Any]):
    """A model client whose call is a decision: a non-streaming request answered
    without chat/tool emulation."""

    provider_key: ClassVar[GenerativeProviderKey]
    system: ClassVar[OpenInferenceDecisionSystemValues]
    built_in_endpoint: ClassVar[BuiltInEndpoint]

    def get_rate_limit_key(self) -> Hashable:
        return ("decision", self.system.value, self._client_factory.rate_limit_key)

    def is_rate_limit_error(self, e: Exception) -> bool:
        return isinstance(e, DecisionRateLimitError)

    def is_transient_error(self, e: Exception) -> bool:
        return isinstance(e, DecisionTransientError)

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
                SpanAttributes.DECISION_PROVIDER: self.provider,
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


@register_client(
    GenerativeProviderKey.TYPESAFE,
    (PROVIDER_DEFAULT, *TYPESAFE_DECISION_MODELS),
    model_type="decision",
)
class TypeSafeDecisionClient(DecisionClient):
    """TypeSafe System One. Any System One-compatible host (OpenRouter, a LiteLLM
    proxy, self-hosted vLLM Decision models) works through ``TYPESAFE_BASE_URL``."""

    provider_key = GenerativeProviderKey.TYPESAFE
    system = OpenInferenceDecisionSystemValues.TYPESAFE
    provider = OpenInferenceDecisionProviderValues.TYPESAFE.value
    built_in_endpoint = BuiltInEndpoint(
        label=GenerativeProviderKey.TYPESAFE.value,
        sdk="typesafe",
        api_key_env_vars=credential_env_vars(GenerativeProviderKey.TYPESAFE),
        base_url_env_var="TYPESAFE_BASE_URL",
    )

    @classmethod
    def dependencies(cls) -> list[Dependency]:
        return [Dependency(name="typesafe-sdk", module_name="typesafe_sdk")]

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
            TypeSafeAPIConnectionError,
            TypeSafeAPIError,
            TypeSafeAPIResponseValidationError,
            TypeSafeAPITimeoutError,
            TypeSafeError,
        )

        parameters = self._build_request(request)
        _record_input(span, parameters)
        try:
            async with self._client_factory() as client:
                response = await client.system_one(**parameters, timeout=60)
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


@register_client(
    GenerativeProviderKey.OPENAI,
    (PROVIDER_DEFAULT, *OPENAI_DECISION_MODELS),
    model_type="decision",
)
class OpenAIDecisionClient(DecisionClient):
    """OpenAI Decisions API client."""

    provider_key = GenerativeProviderKey.OPENAI
    system = OpenInferenceDecisionSystemValues.OPENAI
    provider = OpenInferenceDecisionProviderValues.OPENAI.value
    built_in_endpoint = CHAT_ENDPOINTS[GenerativeProviderKey.OPENAI]

    @classmethod
    def dependencies(cls) -> list[Dependency]:
        return [Dependency(name="openai")]

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
        from openai import (
            APIConnectionError,
            APIStatusError,
            APITimeoutError,
        )
        from openai.types import Decision

        parameters = self._build_request(request)
        _record_input(span, parameters)
        try:
            async with self._client_factory() as client:
                response = await client.decisions.with_raw_response.create(**parameters, timeout=60)
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


FIREWORKS_DECISION_MODELS: tuple[str, ...] = ("accounts/fireworks/models/rune",)


@register_client(
    GenerativeProviderKey.FIREWORKS,
    (PROVIDER_DEFAULT, *FIREWORKS_DECISION_MODELS),
    model_type="decision",
)
class FireworksDecisionClient(TypeSafeDecisionClient):
    """Fireworks System One decision client (``/inference/v1/systemone``)."""

    provider_key = GenerativeProviderKey.FIREWORKS
    system = OpenInferenceDecisionSystemValues.TYPESAFE
    provider = "fireworks"  # OpenInference has no Fireworks decision provider value yet.
    built_in_endpoint = BuiltInEndpoint(
        label=GenerativeProviderKey.FIREWORKS.value,
        sdk="typesafe",
        api_key_env_vars=credential_env_vars(GenerativeProviderKey.FIREWORKS),
        base_url_env_var="FIREWORKS_BASE_URL",
        default_base_url="https://api.fireworks.ai/inference",
        base_url_drops_v1=True,
    )


OLLAMA_DECISION_MODELS: tuple[str, ...] = (
    "nimble",
    "tev1",
    "clef",
    "clef-flash",
    "d3",
    "d1",
    "d1-omni",
    "nimble-v3",
    "pplx-decider",
    "kev",
    "laya",
    "strands-decider",
)
"""Ollama's decision models: first the four its decision guide names
(docs.ollama.com/capabilities/decision), then the rest of its library's decision
category (ollama.com/search?c=decision). ``clef`` runs locally or, as ``clef:cloud``,
on Ollama's cloud."""


@register_client(
    GenerativeProviderKey.OLLAMA,
    (PROVIDER_DEFAULT, *OLLAMA_DECISION_MODELS),
    model_type="decision",
)
class OllamaDecisionClient(TypeSafeDecisionClient):
    """Ollama System One decision client (``/v1/systemone``)."""

    provider_key = GenerativeProviderKey.OLLAMA
    system = OpenInferenceDecisionSystemValues.TYPESAFE
    provider = "ollama"  # OpenInference has no Ollama decision provider value yet.
    built_in_endpoint = BuiltInEndpoint(
        label=GenerativeProviderKey.OLLAMA.value,
        sdk="typesafe",
        api_key_env_vars=(),
        base_url_env_var="OLLAMA_BASE_URL",
        base_url_required=True,
        base_url_example="http://localhost:11434/v1",
        base_url_drops_v1=True,
    )


def decision_client_class(provider_key: GenerativeProviderKey) -> Optional[type[DecisionClient]]:
    client_class = CLIENT_REGISTRY.get_client(provider_key, model_type="decision")
    assert client_class is None or issubclass(client_class, DecisionClient)
    return client_class


def _require_model_name(model_name: str) -> None:
    if not model_name.strip():
        raise BadRequest("A decision model name is required.")


def _require_dependencies(client_class: type[DecisionClient]) -> None:
    if not client_class.dependencies_are_installed():
        names = ", ".join(dependency.name for dependency in client_class.dependencies())
        raise BadRequest(f"Install {names} to run decision models.")


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
    """Resolve the decision client for a built-in ``provider``."""
    if allowed_provider_names is not None and provider.name not in allowed_provider_names:
        raise BadRequest("This decision provider is not permitted by the server configuration.")
    client_class = decision_client_class(provider)
    if client_class is None:
        raise BadRequest(f"{provider.value} does not offer decision models.")
    _require_model_name(model_name)
    _require_dependencies(client_class)
    config = await resolve_builtin_config(
        client_class.built_in_endpoint,
        base_url=base_url,
        credentials=credentials,
        session=session,
        decrypt=decrypt,
        models_label="decision models",
    )
    return client_class(client_factory=config.get_client_factory(), model_name=model_name)


def custom_provider_decision_client_class(
    config: GenerativeModelCustomerProviderConfigType, *, provider_name: str
) -> type[DecisionClient]:
    if isinstance(config, OpenAICustomProviderConfig):
        return OpenAIDecisionClient
    if isinstance(config, TypeSafeCustomProviderConfig):
        return TypeSafeDecisionClient
    raise custom_provider_without_decisions_error(provider_name)


def custom_provider_decision_client_factory(
    config: OpenAICustomProviderConfig | TypeSafeCustomProviderConfig,
) -> ClientFactory[Any]:
    check_provider_base_urls(config)
    return config.get_client_factory()


async def get_custom_provider_decision_client(
    *,
    custom_provider_id: int,
    model_name: str,
    session: AsyncSession,
    decrypt: Callable[[bytes], bytes],
) -> DecisionClient:
    """Resolve the decision client for a custom provider.

    Raises:
        NotFound: No custom provider has this ID.
        BadRequest: The provider does not serve decision models or has an invalid base URL.
        UnreadableCustomProviderError: Stored configuration cannot be decrypted or parsed.
    """
    record = await session.get(models.GenerativeModelCustomProvider, custom_provider_id)
    if record is None:
        raise NotFound("Custom provider not found.")
    if record.models.decision is None:
        raise custom_provider_without_decisions_error(record.name)
    _require_model_name(model_name)
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
        # Include only field paths, never secret values.
        fields = sorted(
            {".".join(str(part) for part in detail["loc"]) or "(root)" for detail in error.errors()}
        )
        raise UnreadableCustomProviderError(
            f"Could not read custom provider '{record.name}': its stored configuration is "
            f"invalid ({', '.join(fields)}). Edit it under Settings > AI Providers.",
            provider_name=record.name,
        ) from error
    client_class = custom_provider_decision_client_class(config, provider_name=record.name)
    _require_dependencies(client_class)
    assert isinstance(config, (OpenAICustomProviderConfig, TypeSafeCustomProviderConfig))
    return client_class(
        model_name=model_name,
        client_factory=custom_provider_decision_client_factory(config),
        provider=record.provider,
    )


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

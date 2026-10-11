"""Decision invocation, request validation, and OpenInference tracing.

Decision models are a second model type alongside chat (LLM) models. A provider may
offer either or both: OpenAI serves ``gpt-6-luna`` through both its chat and its
Decisions APIs, while TypeSafe serves decision models only. The registry below is the
single source of truth for which providers and models support decision execution, and
each client class declares how it reaches its provider: the API shape (``system`` and
``wire_format``), the endpoint path, the default base URL and its environment override,
and the credential it authenticates with. Nothing outside this module should
special-case a provider.
"""

import asyncio
import json
from abc import ABC, abstractmethod
from typing import Annotated, Any, Callable, ClassVar, Literal, Optional, Sequence

import httpx
from openinference.semconv.trace import SpanAttributes
from opentelemetry.context import Context as OtelContext
from opentelemetry.trace import Status, StatusCode
from pydantic import BaseModel, ConfigDict, Field, model_validator
from sqlalchemy.ext.asyncio import AsyncSession

from phoenix.config import getenv
from phoenix.server.api.exceptions import BadRequest
from phoenix.server.api.helpers.playground_clients import resolve_provider_api_key
from phoenix.server.api.helpers.playground_registry import (
    SingletonMeta,
    filter_allowed_providers,
)
from phoenix.server.api.input_types.GenerativeCredentialInput import GenerativeCredentialInput
from phoenix.server.api.types.DecisionWireFormat import DecisionWireFormat
from phoenix.server.api.types.GenerativeProvider import GenerativeProvider, GenerativeProviderKey
from phoenix.trace.decision import DecisionAttributes
from phoenix.tracers import Tracer

Description = str | dict[str, Any] | list[Any]


class Question(BaseModel):
    model_config = ConfigDict(extra="forbid")
    instructions: Description


class NoulQuestion(Question):
    type: Literal["noul"]
    criteria: dict[Literal["true", "false"], Description] | None = None


class ChoiceQuestion(Question):
    type: Literal["choice"]
    criteria: dict[str, Description | None] = Field(min_length=2, max_length=255)


class ScoreQuestion(Question):
    type: Literal["score"]
    criteria: list[Description] = Field(min_length=2, max_length=10)


class DecisionRequest(BaseModel):
    """Provider-independent System One-shaped decision input."""

    model_config = ConfigDict(extra="forbid")
    state: Description
    questions: dict[
        str,
        Annotated[NoulQuestion | ChoiceQuestion | ScoreQuestion, Field(discriminator="type")],
    ] = Field(min_length=1, max_length=255)

    @model_validator(mode="after")
    def validate_names_and_content(self) -> "DecisionRequest":
        if isinstance(self.state, str) and not self.state.strip():
            raise ValueError("State cannot be empty")
        for name, question in self.questions.items():
            if not name.strip():
                raise ValueError("Question names cannot be empty")
            if isinstance(question.instructions, str) and not question.instructions.strip():
                raise ValueError(f"Instructions for {name} cannot be empty")
            if isinstance(question, ChoiceQuestion) and any(
                not option.strip() for option in question.criteria
            ):
                raise ValueError(f"Choice options for {name} cannot be empty")
        return self


def _as_text(value: Description) -> str:
    return value if isinstance(value, str) else json.dumps(value, ensure_ascii=False)


class DecisionClient(ABC):
    """Execute a non-streaming decision request without chat/tool emulation.

    Subclasses declare how to reach their provider through class attributes, so the
    resolver in :func:`get_decision_client` never needs to know which provider it is
    building for. ``api_key_env_var`` defaults to the provider's first required
    credential from :class:`GenerativeProvider`'s credential requirements, which keeps
    one source of truth for credential names across chat and decision execution.
    """

    provider_key: ClassVar[GenerativeProviderKey]
    system: ClassVar[str]
    wire_format: ClassVar[DecisionWireFormat]
    path: ClassVar[str]
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
        """Decision clients speak plain HTTP; they need no optional SDK."""
        return True

    @abstractmethod
    def build_request(self, request: DecisionRequest) -> dict[str, Any]: ...

    @abstractmethod
    def get_answers(self, response: dict[str, Any]) -> dict[str, Any]: ...

    async def create(self, *, request: DecisionRequest, tracer: Tracer) -> dict[str, Any]:
        """Invoke the provider and trace raw input, output, model, and token usage.

        Args:
            request: Validated state and named questions.
            tracer: Trace collector owned by this execution.

        Returns:
            Provider response, with answers keyed by question name.

        Raises:
            BadRequest: Provider rejected the input or returned an invalid response.
        """
        body = self.build_request(request)
        with tracer.start_as_current_span(
            "Decision",
            context=OtelContext(),
            attributes={
                SpanAttributes.OPENINFERENCE_SPAN_KIND: "DECISION",
                DecisionAttributes.SYSTEM: self.system,
                DecisionAttributes.PROVIDER: self.system,
                DecisionAttributes.MODEL_NAME: self.model_name,
                DecisionAttributes.REQUEST_MODEL_NAME: self.model_name,
                SpanAttributes.INPUT_MIME_TYPE: "application/json",
                SpanAttributes.INPUT_VALUE: json.dumps(body, ensure_ascii=False),
            },
        ) as span:
            try:
                async with httpx.AsyncClient(timeout=60, follow_redirects=False) as client:
                    response = await client.post(
                        f"{self._base_url}/{self.path}",
                        headers={"Authorization": f"Bearer {self._api_key}"},
                        json=body,
                    )
                if response.is_error or response.is_redirect:
                    raise BadRequest(
                        f"{self.system} decision request failed (HTTP {response.status_code}). "
                        "Check the API key, model access, endpoint, and question configuration."
                    )
                result = response.json()
                if not isinstance(result, dict):
                    raise ValueError("Expected an object response")
                answers = self.get_answers(result)
                if set(answers) != set(request.questions):
                    raise ValueError("Provider did not return one answer per question")
                span.set_attribute(SpanAttributes.OUTPUT_MIME_TYPE, "application/json")
                span.set_attribute(
                    SpanAttributes.OUTPUT_VALUE, json.dumps(result, ensure_ascii=False)
                )
                # Providers resolve aliases such as ``jev-latest`` to a versioned model.
                # Per the decision span convention, ``decision.model_name`` is the model
                # that answered when the provider reports it, else the requested one.
                response_model = result.get("model")
                resolved_model = (
                    response_model
                    if isinstance(response_model, str) and response_model.strip()
                    else self.model_name
                )
                span.set_attribute(DecisionAttributes.RESPONSE_MODEL_NAME, resolved_model)
                span.set_attribute(DecisionAttributes.MODEL_NAME, resolved_model)
                # Usage is optional, and a provider may send it as null.
                usage = result.get("usage")
                if isinstance(usage, dict):
                    for key, attribute in (
                        ("input_tokens", DecisionAttributes.TOKEN_COUNT_INPUT),
                        ("output_tokens", DecisionAttributes.TOKEN_COUNT_OUTPUT),
                    ):
                        count = usage.get(key)
                        if isinstance(count, int) and count >= 0:
                            span.set_attribute(attribute, count)
                span.set_status(Status(StatusCode.OK))
                return {**result, "answers": answers}
            except asyncio.CancelledError:
                span.set_status(Status(StatusCode.ERROR, "Decision execution cancelled"))
                raise
            except httpx.TimeoutException as error:
                raise BadRequest(
                    "Decision request timed out. Retry or reduce the input."
                ) from error
            except httpx.RequestError as error:
                raise BadRequest("Could not connect to the decision provider.") from error
            except (ValueError, KeyError, TypeError, AttributeError) as error:
                raise BadRequest("Decision provider returned an invalid response.") from error


class DecisionClientRegistry(metaclass=SingletonMeta):
    """Which providers offer decision models, and through which client.

    Mirrors ``PlaygroundClientRegistry`` for chat models. A provider registered here
    and not in the playground registry is decision-only, which is what the chat-path
    guards in prompts, agents, and the playground check for.
    """

    def __init__(self) -> None:
        self._clients: dict[GenerativeProviderKey, type[DecisionClient]] = {}
        self._models: dict[GenerativeProviderKey, list[str]] = {}

    def register(
        self,
        client_class: type[DecisionClient],
        model_names: Sequence[str],
    ) -> None:
        """Bind ``client_class`` to the provider it declares and add its models."""
        provider_key = client_class.provider_key
        self._clients[provider_key] = client_class
        models = self._models.setdefault(provider_key, [])
        for model_name in model_names:
            if model_name not in models:
                models.append(model_name)

    def get_client_class(
        self, provider_key: GenerativeProviderKey
    ) -> Optional[type[DecisionClient]]:
        return self._clients.get(provider_key)

    def supports_decisions(self, provider_key: GenerativeProviderKey) -> bool:
        return provider_key in self._clients

    def list_all_providers(self) -> list[GenerativeProviderKey]:
        return list(self._clients)

    def list_allowed_providers(
        self, allowed_provider_names: Optional[frozenset[str]]
    ) -> list[GenerativeProviderKey]:
        """The registered decision providers this deployment permits (see
        ``PHOENIX_ALLOWED_PROVIDERS``)."""
        return filter_allowed_providers(self.list_all_providers(), allowed_provider_names)

    def list_models(self, provider_key: GenerativeProviderKey) -> list[str]:
        return list(self._models.get(provider_key, []))

    def list_all_models(self) -> list[tuple[GenerativeProviderKey, str]]:
        return [
            (provider_key, model_name)
            for provider_key, model_names in self._models.items()
            for model_name in model_names
        ]


DECISION_CLIENT_REGISTRY: DecisionClientRegistry = DecisionClientRegistry()


def register_decision_client(
    model_names: Sequence[str],
) -> Callable[[type[DecisionClient]], type[DecisionClient]]:
    """Add a client's decision models to the catalog under the provider it declares."""

    def decorator(cls: type[DecisionClient]) -> type[DecisionClient]:
        DECISION_CLIENT_REGISTRY.register(cls, model_names)
        return cls

    return decorator


@register_decision_client(model_names=["jev-latest", "jev-1.13.0", "jev-preview"])
class TypeSafeDecisionClient(DecisionClient):
    """TypeSafe System One. Any System One-compatible host (OpenRouter, a LiteLLM
    proxy, self-hosted vLLM Decision models) works through ``TYPESAFE_BASE_URL``."""

    provider_key = GenerativeProviderKey.TYPESAFE
    system = "typesafe"
    wire_format = DecisionWireFormat.SYSTEM_ONE
    path = "systemone"
    default_base_url = "https://api.typesafe.ai/v1"
    base_url_env_var = "TYPESAFE_BASE_URL"

    def build_request(self, request: DecisionRequest) -> dict[str, Any]:
        return {"model": self.model_name, **request.model_dump(exclude_none=True)}

    def get_answers(self, response: dict[str, Any]) -> dict[str, Any]:
        answers = response["answers"]
        if not isinstance(answers, dict) or not all(
            isinstance(answer, dict) for answer in answers.values()
        ):
            raise ValueError("Expected named answers")
        return answers


@register_decision_client(model_names=["gpt-6-luna"])
class OpenAIDecisionClient(DecisionClient):
    """OpenAI Decisions API. Shares OpenAI's credential and base URL with chat."""

    provider_key = GenerativeProviderKey.OPENAI
    system = "openai"
    wire_format = DecisionWireFormat.OPENAI_DECISIONS
    path = "decisions"
    default_base_url = "https://api.openai.com/v1"
    base_url_env_var = "OPENAI_BASE_URL"

    def build_request(self, request: DecisionRequest) -> dict[str, Any]:
        questions: list[dict[str, Any]] = []
        for name, question in request.questions.items():
            output: dict[str, Any] = {
                "name": name,
                "instructions": _as_text(question.instructions),
                "type": "predicate" if question.type == "noul" else question.type,
            }
            if isinstance(question, ChoiceQuestion):
                output["choices"] = [
                    {
                        "value": option,
                        **(
                            {"description": _as_text(description)}
                            if description is not None
                            else {}
                        ),
                    }
                    for option, description in question.criteria.items()
                ]
            elif isinstance(question, ScoreQuestion):
                output["levels"] = [
                    {"label": str(index), "description": _as_text(description)}
                    for index, description in enumerate(question.criteria)
                ]
            elif question.criteria:
                output["instructions"] += "\nCriteria: " + json.dumps(question.criteria)
            questions.append(output)
        return {"model": self.model_name, "input": _as_text(request.state), "questions": questions}

    def get_answers(self, response: dict[str, Any]) -> dict[str, Any]:
        answers = response["answers"]
        if not isinstance(answers, list):
            raise ValueError("Expected an answer array")
        named = {answer["name"]: answer for answer in answers}
        if len(named) != len(answers):
            raise ValueError("Duplicate answer names")
        return named


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
    client_class = DECISION_CLIENT_REGISTRY.get_client_class(provider)
    if client_class is None:
        raise BadRequest(f"{provider.value} does not offer decision models.")
    if not model_name.strip():
        raise BadRequest("A decision model name is required.")
    if base_url:
        url = httpx.URL(base_url)
        if url.scheme not in ("http", "https") or not url.host or url.userinfo:
            raise BadRequest("Base URL must be an HTTP(S) URL without embedded credentials.")
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
        base_url=client_class.resolve_base_url(base_url),
    )

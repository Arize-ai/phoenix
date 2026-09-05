import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass
from enum import Enum
from typing import (
    Any,
    Awaitable,
    Callable,
    Dict,
    List,
    Literal,
    Optional,
    Tuple,
    Type,
    TypeVar,
    cast,
)

import jsonschema

from .prompts import PromptLike

__all__ = [
    "ObjectGenerationMethod",
    "BaseLLMAdapter",
    "AdapterRegistration",
    "ProviderRegistration",
    "LLMOutputError",
    "MalformedOutputError",
    "SchemaViolationError",
    "RefusalError",
    "TruncatedResponseError",
    "capability_mismatch_only",
]

logger = logging.getLogger(__name__)

T = TypeVar("T")


class LLMOutputError(ValueError):
    """Base class for errors raised after a successful API call, when the
    response content itself could not be turned into valid, schema-conforming
    structured output.

    These are never capability-mismatch signals: a malformed, refused, or
    truncated result from one generation method says nothing about whether
    the *other* method would work, so adapters must let these propagate
    directly rather than routing them through ``_try_with_fallback``.
    """


class MalformedOutputError(LLMOutputError):
    """The model's raw output could not be parsed as JSON."""


class SchemaViolationError(LLMOutputError):
    """The model's output was valid JSON but did not conform to the requested schema."""


class RefusalError(LLMOutputError):
    """The model declined to produce the requested output (e.g. a safety refusal)."""


class TruncatedResponseError(LLMOutputError):
    """The response was cut off (e.g. hit the token limit) before completion."""


def capability_mismatch_only(
    *exception_types: Type[BaseException],
) -> Callable[[BaseException], bool]:
    """Build an ``is_capability_mismatch`` predicate for
    :meth:`BaseLLMAdapter._try_with_fallback` that matches only the given
    exception types (e.g. a provider's ``BadRequestError``).

    Errors that aren't genuine capability-mismatch signals -- authentication,
    rate-limit, quota, timeout, and any :class:`LLMOutputError` (refusal,
    truncation, malformed output, schema violation) -- must return directly
    instead of triggering a second request against the fallback method.
    """

    def predicate(error: BaseException) -> bool:
        return isinstance(error, exception_types)

    return predicate


class ObjectGenerationMethod(str, Enum):
    AUTO = "auto"
    TOOL_CALLING = "tool_calling"
    STRUCTURED_OUTPUT = "structured_output"


class BaseLLMAdapter(ABC):
    """
    Abstract base class that all SDK adapters must implement.

    Adapters only need to implement 4 core methods:
    - generate_text (sync text generation)
    - async_generate_text (async text generation)
    - generate_object (sync structured output)
    - async_generate_object (async structured output)

    The adapter is responsible for handling all implementation details including
    tool calling, structured output, and fallback mechanisms internally.
    """

    def __init__(self, client: Any, model: str) -> None:
        """Initialize the adapter with a client."""
        self.client = client
        self.model = model  # store the model name since the client might not store it

    @classmethod
    @abstractmethod
    def client_name(cls) -> str:
        """Return the name of the client."""
        pass

    @abstractmethod
    def generate_text(self, prompt: PromptLike, **kwargs: Any) -> str:
        """Generate text response from the model.

        Args:
            prompt: Either a string or a list of message dicts with 'role' and 'content' fields.
        """
        pass

    @abstractmethod
    async def async_generate_text(self, prompt: PromptLike, **kwargs: Any) -> str:
        """Async version of generate_text.

        Args:
            prompt: Either a string or a list of message dicts with 'role' and 'content' fields.
        """
        pass

    @abstractmethod
    def generate_object(
        self,
        prompt: PromptLike,
        schema: Dict[str, Any],
        method: ObjectGenerationMethod = ObjectGenerationMethod.AUTO,
        **kwargs: Any,
    ) -> Dict[str, Any]:
        """
        Generate structured output conforming to the provided schema.

        The adapter handles all implementation details internally (native structured output,
        tool calling, text parsing, etc.).

        Args:
            prompt: Either a string or a list of message dicts with 'role' and 'content' fields.
            schema: JSON schema for the structured output.
            method: Method to use for generation (auto, tool_calling, structured_output).

        Returns:
            A dictionary containing the structured data that conforms to the provided schema.
        """
        pass

    @abstractmethod
    async def async_generate_object(
        self,
        prompt: PromptLike,
        schema: Dict[str, Any],
        method: ObjectGenerationMethod = ObjectGenerationMethod.AUTO,
        **kwargs: Any,
    ) -> Dict[str, Any]:
        """
        Async version of generate_object.

        Args:
            prompt: Either a string or a list of message dicts with 'role' and 'content' fields.
            schema: JSON schema for the structured output.
            method: Method to use for generation (auto, tool_calling, structured_output).

        Returns:
            A dictionary containing the structured data that conforms to the provided schema.
        """
        pass

    @property
    def model_name(self) -> str:
        """Return the name/identifier of the underlying model."""
        return f"{type(self).__name__}-{type(self.client).__name__}"

    def _try_with_fallback(
        self,
        *,
        primary: Callable[[], T],
        fallback: Callable[[], T],
        primary_name: str,
        fallback_name: str,
        is_capability_mismatch: Callable[[BaseException], bool],
    ) -> Tuple[T, Literal["primary", "fallback"]]:
        """Try ``primary``, falling back to ``fallback`` on a capability-mismatch error.

        ``is_capability_mismatch`` decides whether an error is eligible to
        trigger the fallback at all -- typically built with
        :func:`capability_mismatch_only` around a provider's
        ``BadRequestError``. Everything else (authentication, rate-limit,
        quota, timeout errors, and any :class:`LLMOutputError` -- refusal,
        truncation, malformed output, schema violation) propagates
        immediately, uncaught: those errors say nothing about whether the
        other method would succeed, so retrying against it would just waste
        a request, and for rate limits it would also rob the outer
        ``RateLimiter`` of the chance to retry.

        Returns the result together with which path produced it, so the caller
        can update its own ``_preferred_method`` cache.
        """
        try:
            return primary(), "primary"
        except Exception as primary_error:
            if not is_capability_mismatch(primary_error):
                raise
            logger.debug(
                f"{primary_name} rejected by {self.model_name}, falling back "
                f"to {fallback_name}: {primary_error}"
            )
            try:
                return fallback(), "fallback"
            except Exception as fallback_error:
                if not is_capability_mismatch(fallback_error):
                    raise
                raise ValueError(
                    f"{self.model_name} failed with both {primary_name} and "
                    f"{fallback_name}. {primary_name} error: {primary_error}. "
                    f"{fallback_name} error: {fallback_error}"
                ) from fallback_error

    async def _try_with_fallback_async(
        self,
        *,
        primary: Callable[[], Awaitable[T]],
        fallback: Callable[[], Awaitable[T]],
        primary_name: str,
        fallback_name: str,
        is_capability_mismatch: Callable[[BaseException], bool],
    ) -> Tuple[T, Literal["primary", "fallback"]]:
        """Async counterpart of :meth:`_try_with_fallback`."""
        try:
            return await primary(), "primary"
        except Exception as primary_error:
            if not is_capability_mismatch(primary_error):
                raise
            logger.debug(
                f"{primary_name} rejected by {self.model_name}, falling back "
                f"to {fallback_name}: {primary_error}"
            )
            try:
                return await fallback(), "fallback"
            except Exception as fallback_error:
                if not is_capability_mismatch(fallback_error):
                    raise
                raise ValueError(
                    f"{self.model_name} failed with both {primary_name} and "
                    f"{fallback_name}. {primary_name} error: {primary_error}. "
                    f"{fallback_name} error: {fallback_error}"
                ) from fallback_error

    def _validate_against_schema(self, data: Any, schema: Dict[str, Any]) -> Dict[str, Any]:
        """Validate that ``data`` conforms to ``schema``, raising
        :class:`SchemaViolationError` (never a capability-mismatch signal) if not.
        """
        try:
            jsonschema.validate(instance=data, schema=schema)
        except jsonschema.ValidationError as e:
            raise SchemaViolationError(
                f"{self.model_name} output does not conform to the requested schema "
                f"at {'.'.join(str(p) for p in e.absolute_path) or '<root>'}: {e.message}"
            ) from e
        return cast(Dict[str, Any], data)


@dataclass
class AdapterRegistration:
    adapter_class: Type["BaseLLMAdapter"]
    identifier: Callable[[Any], bool]
    name: str


@dataclass
class ProviderRegistration:
    provider: str
    adapter_class: Type["BaseLLMAdapter"]
    client_name: str
    client_factory: Callable[..., Any]
    get_rate_limit_errors: Optional[Callable[..., List[Type[Exception]]]]
    dependencies: List[str]

"""Structured model backend contracts for offline datagen."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Literal, Mapping, Protocol, cast

ModelPurpose = Literal["generation", "user_simulator", "judge"]


class ModelBackendError(RuntimeError):
    """Raised when a backend cannot return a valid structured result."""


@dataclass(frozen=True)
class BackendCapabilities:
    batch: bool = False
    resumable_session: bool = False
    priced_tokens: bool = False


@dataclass(frozen=True)
class ProviderUsage:
    input_tokens: int
    cached_input_tokens: int
    output_tokens: int
    reasoning_output_tokens: int = 0

    def __post_init__(self) -> None:
        if min(
            self.input_tokens,
            self.cached_input_tokens,
            self.output_tokens,
            self.reasoning_output_tokens,
        ) < 0:
            raise ModelBackendError("provider usage cannot be negative")
        if self.cached_input_tokens > self.input_tokens:
            raise ModelBackendError("cached input tokens cannot exceed input tokens")

    def to_dict(self) -> dict[str, int]:
        return {
            "input_tokens": self.input_tokens,
            "cached_input_tokens": self.cached_input_tokens,
            "output_tokens": self.output_tokens,
            "reasoning_output_tokens": self.reasoning_output_tokens,
        }


@dataclass(frozen=True)
class ModelRequest:
    request_id: str
    purpose: ModelPurpose
    model: str
    prompt: str
    output_schema: Mapping[str, Any]
    max_output_tokens: int

    def __post_init__(self) -> None:
        if not self.request_id or not self.model or not self.prompt:
            raise ModelBackendError("request_id, model, and prompt must be non-empty")
        if self.max_output_tokens < 1:
            raise ModelBackendError("max_output_tokens must be positive")


@dataclass(frozen=True)
class ModelResult:
    provider: str
    model: str
    output: Mapping[str, Any]
    usage: ProviderUsage | None
    provider_run_id: str | None = None
    metadata: Mapping[str, Any] = field(default_factory=dict)


class ModelBackend(Protocol):
    provider: str
    capabilities: BackendCapabilities

    def generate(self, request: ModelRequest) -> ModelResult: ...


def provider_usage(value: Mapping[str, Any]) -> ProviderUsage:
    input_tokens = value.get("input_tokens", value.get("prompt_tokens"))
    output_tokens = value.get("output_tokens", value.get("completion_tokens"))
    input_details = value.get("input_tokens_details", value.get("prompt_tokens_details", {}))
    output_details = value.get("output_tokens_details", value.get("completion_tokens_details", {}))
    cached = input_details.get("cached_tokens", 0) if isinstance(input_details, Mapping) else 0
    reasoning = output_details.get("reasoning_tokens", 0) if isinstance(output_details, Mapping) else 0
    if any(type(item) is not int for item in (input_tokens, cached, output_tokens, reasoning)):
        raise ModelBackendError("provider usage must contain integer token counts")
    return ProviderUsage(
        cast(int, input_tokens),
        cast(int, cached),
        cast(int, output_tokens),
        cast(int, reasoning),
    )


class OpenAIResponsesBackend:
    provider = "openai_api"
    capabilities = BackendCapabilities(priced_tokens=True)

    def __init__(self, create_response: Any) -> None:
        self._create_response = create_response

    def generate(self, request: ModelRequest) -> ModelResult:
        response = self._create_response(
            model=request.model,
            input=request.prompt,
            text={
                "format": {
                    "type": "json_schema",
                    "name": "datagen_result",
                    "strict": True,
                    "schema": dict(request.output_schema),
                }
            },
            max_output_tokens=request.max_output_tokens,
        )
        value = response.model_dump(mode="json") if hasattr(response, "model_dump") else response
        if not isinstance(value, Mapping):
            raise ModelBackendError("OpenAI backend returned an unsupported response")
        raw_output = value.get("output_text")
        if not isinstance(raw_output, str):
            raise ModelBackendError("OpenAI backend response has no output_text")
        import json

        try:
            output = json.loads(raw_output)
        except json.JSONDecodeError as error:
            raise ModelBackendError("OpenAI backend returned invalid JSON") from error
        if not isinstance(output, Mapping):
            raise ModelBackendError("OpenAI backend output must be a JSON object")
        raw_usage = value.get("usage")
        usage = provider_usage(raw_usage) if isinstance(raw_usage, Mapping) else None
        identifier = value.get("id")
        return ModelResult(
            provider=self.provider,
            model=request.model,
            output=output,
            usage=usage,
            provider_run_id=identifier if isinstance(identifier, str) else None,
            metadata={"request_id": request.request_id},
        )

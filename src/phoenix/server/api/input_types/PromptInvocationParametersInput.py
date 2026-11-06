from enum import Enum
from typing import Any, Literal, Optional

import strawberry
from strawberry import UNSET
from strawberry.scalars import JSON
from typing_extensions import assert_never

import phoenix.db.types.prompts as orm
from phoenix.db.types.db_helper_types import UNDEFINED
from phoenix.server.api.exceptions import BadRequest

# --- OpenAI family ---


class OpenAIReasoningEffort(str, Enum):
    NONE = "none"
    MINIMAL = "minimal"
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    XHIGH = "xhigh"


@strawberry.input
class PromptOpenAIInvocationParametersInput:
    temperature: Optional[float] = None
    max_tokens: Optional[int] = None
    max_completion_tokens: Optional[int] = None
    frequency_penalty: Optional[float] = None
    presence_penalty: Optional[float] = None
    top_p: Optional[float] = None
    seed: Optional[int] = None
    stop: Optional[list[str]] = None
    reasoning_effort: Optional[OpenAIReasoningEffort] = None
    extra_body: Optional[JSON] = None

    def to_orm(self) -> orm.PromptOpenAIInvocationParameters:
        reasoning_effort: Literal["none", "minimal", "low", "medium", "high", "xhigh"] = UNDEFINED
        if self.reasoning_effort:
            if self.reasoning_effort is OpenAIReasoningEffort.NONE:
                reasoning_effort = "none"
            elif self.reasoning_effort is OpenAIReasoningEffort.MINIMAL:
                reasoning_effort = "minimal"
            elif self.reasoning_effort is OpenAIReasoningEffort.LOW:
                reasoning_effort = "low"
            elif self.reasoning_effort is OpenAIReasoningEffort.MEDIUM:
                reasoning_effort = "medium"
            elif self.reasoning_effort is OpenAIReasoningEffort.HIGH:
                reasoning_effort = "high"
            elif self.reasoning_effort is OpenAIReasoningEffort.XHIGH:
                reasoning_effort = "xhigh"
            else:
                assert_never(self.reasoning_effort)
        extra_body: dict[str, Any] = UNDEFINED
        if isinstance(self.extra_body, dict):
            extra_body = self.extra_body
        elif self.extra_body is not None:
            raise BadRequest("extra_body must be a JSON object")
        return orm.PromptOpenAIInvocationParameters(
            type="openai",
            openai=orm.PromptOpenAIInvocationParametersContent(
                temperature=self.temperature if self.temperature is not None else UNDEFINED,
                max_tokens=self.max_tokens if self.max_tokens is not None else UNDEFINED,
                max_completion_tokens=self.max_completion_tokens
                if self.max_completion_tokens is not None
                else UNDEFINED,
                frequency_penalty=self.frequency_penalty
                if self.frequency_penalty is not None
                else UNDEFINED,
                presence_penalty=self.presence_penalty
                if self.presence_penalty is not None
                else UNDEFINED,
                top_p=self.top_p if self.top_p is not None else UNDEFINED,
                seed=self.seed if self.seed is not None else UNDEFINED,
                stop=self.stop if self.stop else UNDEFINED,
                reasoning_effort=reasoning_effort,
                extra_body=extra_body,
            ),
        )


# --- Anthropic ---


class AnthropicThinkingDisplay(str, Enum):
    SUMMARIZED = "summarized"
    OMITTED = "omitted"


@strawberry.input
class AnthropicThinkingDisabledMarkerInput:
    """Set this branch (empty object) for disabled extended thinking."""

    disabled: bool = True


@strawberry.input
class AnthropicThinkingEnabledInput:
    budget_tokens: int
    display: Optional[AnthropicThinkingDisplay] = None

    def to_orm(self) -> orm.PromptAnthropicThinkingConfigEnabled:
        display: Literal["summarized", "omitted"] = UNDEFINED
        if self.display is AnthropicThinkingDisplay.SUMMARIZED:
            display = "summarized"
        elif self.display is AnthropicThinkingDisplay.OMITTED:
            display = "omitted"
        elif self.display is not None:
            assert_never(self.display)
        return orm.PromptAnthropicThinkingConfigEnabled(
            type="enabled",
            budget_tokens=self.budget_tokens,
            display=display,
        )


@strawberry.input
class AnthropicThinkingAdaptiveInput:
    display: Optional[AnthropicThinkingDisplay] = None

    def to_orm(self) -> orm.PromptAnthropicThinkingConfigAdaptive:
        display: Literal["summarized", "omitted"] = UNDEFINED
        if self.display is AnthropicThinkingDisplay.SUMMARIZED:
            display = "summarized"
        elif self.display is AnthropicThinkingDisplay.OMITTED:
            display = "omitted"
        elif self.display is not None:
            assert_never(self.display)
        return orm.PromptAnthropicThinkingConfigAdaptive(
            type="adaptive",
            display=display,
        )


@strawberry.input(one_of=True)
class PromptAnthropicThinkingConfigInput:
    disabled: Optional[AnthropicThinkingDisabledMarkerInput] = UNSET
    enabled: Optional[AnthropicThinkingEnabledInput] = UNSET
    adaptive: Optional[AnthropicThinkingAdaptiveInput] = UNSET

    def to_orm(
        self,
    ) -> (
        orm.PromptAnthropicThinkingConfigDisabled
        | orm.PromptAnthropicThinkingConfigEnabled
        | orm.PromptAnthropicThinkingConfigAdaptive
    ):
        if self.disabled:
            return orm.PromptAnthropicThinkingConfigDisabled(type="disabled")
        if self.enabled:
            return self.enabled.to_orm()
        if self.adaptive:
            return self.adaptive.to_orm()
        raise BadRequest("No thinking config branch is set")


class AnthropicOutputConfigEffort(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    XHIGH = "xhigh"
    MAX = "max"


@strawberry.input
class PromptAnthropicOutputConfigInput:
    effort: Optional[AnthropicOutputConfigEffort] = None

    def to_orm(self) -> orm.PromptAnthropicOutputConfig:
        effort: Literal["low", "medium", "high", "xhigh", "max"] = UNDEFINED
        if self.effort is AnthropicOutputConfigEffort.LOW:
            effort = "low"
        elif self.effort is AnthropicOutputConfigEffort.MEDIUM:
            effort = "medium"
        elif self.effort is AnthropicOutputConfigEffort.HIGH:
            effort = "high"
        elif self.effort is AnthropicOutputConfigEffort.XHIGH:
            effort = "xhigh"
        elif self.effort is AnthropicOutputConfigEffort.MAX:
            effort = "max"
        elif self.effort is not None:
            assert_never(self.effort)
        return orm.PromptAnthropicOutputConfig(effort=effort)


@strawberry.input
class PromptAnthropicInvocationParametersInput:
    max_tokens: int
    temperature: Optional[float] = None
    top_p: Optional[float] = None
    stop_sequences: Optional[list[str]] = None
    output_config: Optional[PromptAnthropicOutputConfigInput] = None
    thinking: Optional[PromptAnthropicThinkingConfigInput] = None
    extra_body: Optional[JSON] = None

    def to_orm(self) -> orm.PromptAnthropicInvocationParameters:
        extra_body: dict[str, Any] = UNDEFINED
        if isinstance(self.extra_body, dict):
            extra_body = self.extra_body
        elif self.extra_body is not None:
            raise BadRequest("extra_body must be a JSON object")
        return orm.PromptAnthropicInvocationParameters(
            type="anthropic",
            anthropic=orm.PromptAnthropicInvocationParametersContent(
                max_tokens=self.max_tokens,
                temperature=self.temperature if self.temperature is not None else UNDEFINED,
                top_p=self.top_p if self.top_p is not None else UNDEFINED,
                stop_sequences=self.stop_sequences if self.stop_sequences else UNDEFINED,
                output_config=self.output_config.to_orm() if self.output_config else UNDEFINED,
                thinking=self.thinking.to_orm() if self.thinking else UNDEFINED,
                extra_body=extra_body,
            ),
        )


# --- Google ---


class GoogleThinkingLevel(str, Enum):
    MINIMAL = "minimal"
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


@strawberry.input
class PromptGoogleThinkingConfigInput:
    thinking_budget: Optional[int] = None
    thinking_level: Optional[GoogleThinkingLevel] = None
    include_thoughts: Optional[bool] = None

    def to_orm(self) -> orm.PromptGoogleThinkingConfig:
        thinking_level: Literal["minimal", "low", "medium", "high"] = UNDEFINED
        if self.thinking_level is GoogleThinkingLevel.MINIMAL:
            thinking_level = "minimal"
        elif self.thinking_level is GoogleThinkingLevel.LOW:
            thinking_level = "low"
        elif self.thinking_level is GoogleThinkingLevel.MEDIUM:
            thinking_level = "medium"
        elif self.thinking_level is GoogleThinkingLevel.HIGH:
            thinking_level = "high"
        elif self.thinking_level is not None:
            assert_never(self.thinking_level)
        return orm.PromptGoogleThinkingConfig(
            thinking_budget=self.thinking_budget if self.thinking_budget is not None else UNDEFINED,
            thinking_level=thinking_level,
            include_thoughts=self.include_thoughts
            if self.include_thoughts is not None
            else UNDEFINED,
        )


@strawberry.input
class PromptGoogleInvocationParametersInput:
    temperature: Optional[float] = None
    max_output_tokens: Optional[int] = None
    stop_sequences: Optional[list[str]] = None
    presence_penalty: Optional[float] = None
    frequency_penalty: Optional[float] = None
    top_p: Optional[float] = None
    top_k: Optional[int] = None
    thinking_config: Optional[PromptGoogleThinkingConfigInput] = None

    def to_orm(self) -> orm.PromptGoogleInvocationParameters:
        return orm.PromptGoogleInvocationParameters(
            type="google",
            google=orm.PromptGoogleInvocationParametersContent(
                temperature=self.temperature if self.temperature is not None else UNDEFINED,
                max_output_tokens=self.max_output_tokens
                if self.max_output_tokens is not None
                else UNDEFINED,
                stop_sequences=self.stop_sequences if self.stop_sequences else UNDEFINED,
                presence_penalty=self.presence_penalty
                if self.presence_penalty is not None
                else UNDEFINED,
                frequency_penalty=self.frequency_penalty
                if self.frequency_penalty is not None
                else UNDEFINED,
                top_p=self.top_p if self.top_p is not None else UNDEFINED,
                top_k=self.top_k if self.top_k is not None else UNDEFINED,
                thinking_config=self.thinking_config.to_orm()
                if self.thinking_config
                else UNDEFINED,
            ),
        )


# --- AWS ---


@strawberry.input
class PromptAwsInvocationParametersInput:
    max_tokens: Optional[int] = None
    temperature: Optional[float] = None
    top_p: Optional[float] = None
    stop_sequences: Optional[list[str]] = None

    def to_orm(self) -> orm.PromptAwsInvocationParameters:
        return orm.PromptAwsInvocationParameters(
            type="aws",
            aws=orm.PromptAwsInvocationParametersContent(
                max_tokens=self.max_tokens if self.max_tokens is not None else UNDEFINED,
                temperature=self.temperature if self.temperature is not None else UNDEFINED,
                top_p=self.top_p if self.top_p is not None else UNDEFINED,
                stop_sequences=self.stop_sequences if self.stop_sequences else UNDEFINED,
            ),
        )


# --- Root one_of ---


@strawberry.input(one_of=True)
class PromptInvocationParametersInput:
    openai: Optional[PromptOpenAIInvocationParametersInput] = UNSET
    anthropic: Optional[PromptAnthropicInvocationParametersInput] = UNSET
    google: Optional[PromptGoogleInvocationParametersInput] = UNSET
    aws: Optional[PromptAwsInvocationParametersInput] = UNSET

    def to_orm(
        self,
    ) -> (
        orm.PromptOpenAIInvocationParameters
        | orm.PromptAnthropicInvocationParameters
        | orm.PromptGoogleInvocationParameters
        | orm.PromptAwsInvocationParameters
    ):
        if self.openai:
            return self.openai.to_orm()
        if self.anthropic:
            return self.anthropic.to_orm()
        if self.google:
            return self.google.to_orm()
        if self.aws:
            return self.aws.to_orm()
        raise BadRequest("No invocation parameters variant is set")

from __future__ import annotations

import os
from dataclasses import dataclass, replace
from typing import Any

from pydantic_ai.capabilities import AbstractCapability
from pydantic_ai.messages import ModelMessage, ModelRequest, ToolReturnPart
from pydantic_ai.models import Model, ModelRequestContext
from pydantic_ai.models.anthropic import AnthropicModelSettings
from pydantic_ai.tools import AgentDepsT, RunContext

ENV_CONTEXT_POLICY = "PHOENIX_AGENTS_ASSISTANT_CONTEXT_POLICY"
DEFAULT_CLEAR_KEEP_RECENT = 5
DEFAULT_CLEAR_THRESHOLD_TOKENS = 30_000
TOOL_RESULT_CLEARED_TEMPLATE = (
    "[Tool result cleared to save context. Tool: {tool_name}. "
    "Original size: {n_chars} characters. Re-run the tool if this result is needed.]"
)


@dataclass(frozen=True)
class ContextPolicyConfig:
    name: str
    keep_recent_tool_returns: int = DEFAULT_CLEAR_KEEP_RECENT
    threshold_tokens: int = DEFAULT_CLEAR_THRESHOLD_TOKENS


def _parse_policy_params(raw_params: str) -> dict[str, str]:
    params: dict[str, str] = {}
    for item in raw_params.split(","):
        if not item:
            continue
        key, separator, value = item.partition("=")
        if not separator or not key or not value:
            raise ValueError(f"invalid context policy parameter {item!r}")
        params[key.strip()] = value.strip()
    return params


def parse_context_policy(value: str | None) -> ContextPolicyConfig | None:
    if value is None or not value.strip() or value.strip().lower() in {"full", "none", "p0"}:
        return None
    name, separator, raw_params = value.strip().partition(":")
    normalized_name = name.lower()
    params = _parse_policy_params(raw_params) if separator else {}
    keep_recent = int(params.get("k", DEFAULT_CLEAR_KEEP_RECENT))
    threshold = int(params.get("threshold", DEFAULT_CLEAR_THRESHOLD_TOKENS))
    if keep_recent < 0:
        raise ValueError("context policy k must be >= 0")
    if threshold < 0:
        raise ValueError("context policy threshold must be >= 0")
    if normalized_name in {"clear_tool_uses", "p1"}:
        return ContextPolicyConfig(
            name="clear_tool_uses",
            keep_recent_tool_returns=keep_recent,
            threshold_tokens=threshold,
        )
    if normalized_name in {"clear_tool_uses_continuous", "p1c"}:
        return ContextPolicyConfig(
            name="clear_tool_uses_continuous",
            keep_recent_tool_returns=keep_recent,
            threshold_tokens=0,
        )
    if normalized_name in {"anthropic_context_editing", "p6"}:
        return ContextPolicyConfig(name="anthropic_context_editing")
    raise ValueError(f"unknown context policy {name!r}")


def get_context_policy_from_env() -> ContextPolicyConfig | None:
    return parse_context_policy(os.getenv(ENV_CONTEXT_POLICY))


def _estimate_message_tokens(messages: list[ModelMessage]) -> int:
    total_chars = 0
    for message in messages:
        for part in getattr(message, "parts", ()):
            content = getattr(part, "content", None)
            if isinstance(content, str):
                total_chars += len(content)
            elif content is not None:
                total_chars += len(str(content))
            args = getattr(part, "args", None)
            if args is not None:
                total_chars += len(str(args))
    return max(1, total_chars // 4) if total_chars else 0


def _tool_return_positions(messages: list[ModelMessage]) -> list[tuple[int, int, ToolReturnPart]]:
    positions: list[tuple[int, int, ToolReturnPart]] = []
    for message_index, message in enumerate(messages):
        if not isinstance(message, ModelRequest):
            continue
        for part_index, part in enumerate(message.parts):
            if isinstance(part, ToolReturnPart):
                positions.append((message_index, part_index, part))
    return positions


def apply_context_policy(
    messages: list[ModelMessage],
    config: ContextPolicyConfig,
) -> list[ModelMessage]:
    if config.name not in {"clear_tool_uses", "clear_tool_uses_continuous"}:
        return messages
    if (
        config.name == "clear_tool_uses"
        and _estimate_message_tokens(messages) <= config.threshold_tokens
    ):
        return messages
    tool_returns = _tool_return_positions(messages)
    if len(tool_returns) <= config.keep_recent_tool_returns:
        return messages

    clear_until = len(tool_returns) - config.keep_recent_tool_returns
    replacements: dict[tuple[int, int], ToolReturnPart] = {}
    for message_index, part_index, part in tool_returns[:clear_until]:
        content = part.content if isinstance(part.content, str) else str(part.content)
        replacements[(message_index, part_index)] = replace(
            part,
            content=TOOL_RESULT_CLEARED_TEMPLATE.format(
                tool_name=part.tool_name,
                n_chars=len(content),
            ),
        )

    transformed: list[ModelMessage] = []
    for message_index, message in enumerate(messages):
        if not isinstance(message, ModelRequest):
            transformed.append(message)
            continue
        parts: list[Any] = []
        changed = False
        for part_index, part in enumerate(message.parts):
            replacement = replacements.get((message_index, part_index))
            if replacement is None:
                parts.append(part)
            else:
                parts.append(replacement)
                changed = True
        transformed.append(replace(message, parts=parts) if changed else message)
    return transformed


@dataclass
class ContextPolicyCapability(AbstractCapability[AgentDepsT]):
    config: ContextPolicyConfig

    def get_model_settings(self) -> AnthropicModelSettings | None:
        if self.config.name != "anthropic_context_editing":
            return None
        return AnthropicModelSettings(
            anthropic_context_management={"edits": [{"type": "clear_tool_uses_20250919"}]},
            anthropic_betas=["context-management-2025-06-27"],
        )

    async def before_model_request(
        self,
        ctx: RunContext[AgentDepsT],
        request_context: ModelRequestContext,
    ) -> ModelRequestContext:
        request_context.messages = apply_context_policy(request_context.messages, self.config)
        return request_context


def build_context_policy_capability(
    model: Model,
    config: ContextPolicyConfig | None = None,
) -> ContextPolicyCapability[object] | None:
    resolved_config = config or get_context_policy_from_env()
    if resolved_config is None:
        return None
    if resolved_config.name == "anthropic_context_editing" and model.system != "anthropic":
        return None
    return ContextPolicyCapability[object](config=resolved_config)

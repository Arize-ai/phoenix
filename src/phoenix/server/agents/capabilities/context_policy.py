from __future__ import annotations

import os
from dataclasses import dataclass, replace
from typing import Any

from pydantic_ai.capabilities import AbstractCapability
from pydantic_ai.messages import ModelMessage, ModelRequest, ToolReturnPart, UserPromptPart
from pydantic_ai.models import Model, ModelRequestContext
from pydantic_ai.models.anthropic import AnthropicModelSettings
from pydantic_ai.tools import AgentDepsT, RunContext

ENV_CONTEXT_POLICY = "PHOENIX_AGENTS_ASSISTANT_CONTEXT_POLICY"
DEFAULT_CLEAR_KEEP_RECENT = 5
DEFAULT_CLEAR_THRESHOLD_TOKENS = 30_000
DEFAULT_SUMMARY_THRESHOLD_TOKENS = 40_000
DEFAULT_TRAILING_TOKENS = 8_000
DEFAULT_MAX_SUMMARY_TOKENS = 2_000
TOOL_RESULT_CLEARED_TEMPLATE = (
    "[Tool result cleared to save context. Tool: {tool_name}. "
    "Original size: {n_chars} characters. Re-run the tool if this result is needed.]"
)


@dataclass(frozen=True)
class ContextPolicyConfig:
    name: str
    keep_recent_tool_returns: int = DEFAULT_CLEAR_KEEP_RECENT
    threshold_tokens: int = DEFAULT_CLEAR_THRESHOLD_TOKENS
    trailing_tokens: int = DEFAULT_TRAILING_TOKENS
    max_summary_tokens: int = DEFAULT_MAX_SUMMARY_TOKENS
    oracle_terms: tuple[str, ...] = ()


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
    trailing_tokens = int(params.get("trailing_tokens", DEFAULT_TRAILING_TOKENS))
    max_summary_tokens = int(params.get("max_summary_tokens", DEFAULT_MAX_SUMMARY_TOKENS))
    oracle_terms = tuple(
        term.strip() for term in params.get("terms", "").split("|") if term.strip()
    )
    if keep_recent < 0:
        raise ValueError("context policy k must be >= 0")
    if threshold < 0:
        raise ValueError("context policy threshold must be >= 0")
    if trailing_tokens < 0:
        raise ValueError("context policy trailing_tokens must be >= 0")
    if max_summary_tokens < 0:
        raise ValueError("context policy max_summary_tokens must be >= 0")
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
    if normalized_name in {"threshold_summary", "p2"}:
        return ContextPolicyConfig(
            name="threshold_summary",
            threshold_tokens=int(params.get("threshold", DEFAULT_SUMMARY_THRESHOLD_TOKENS)),
            trailing_tokens=trailing_tokens,
            max_summary_tokens=max_summary_tokens,
        )
    if normalized_name in {"noop_summary", "p3"}:
        return ContextPolicyConfig(
            name="noop_summary",
            threshold_tokens=int(params.get("threshold", DEFAULT_SUMMARY_THRESHOLD_TOKENS)),
            trailing_tokens=trailing_tokens,
        )
    if normalized_name in {"naive_truncation", "p4"}:
        return ContextPolicyConfig(
            name="naive_truncation",
            threshold_tokens=int(params.get("threshold", DEFAULT_SUMMARY_THRESHOLD_TOKENS)),
            trailing_tokens=trailing_tokens,
        )
    if normalized_name in {"oracle_focused", "p5"}:
        return ContextPolicyConfig(
            name="oracle_focused",
            trailing_tokens=trailing_tokens,
            oracle_terms=oracle_terms,
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


def _message_text(message: ModelMessage) -> str:
    chunks: list[str] = []
    for part in getattr(message, "parts", ()):
        content = getattr(part, "content", None)
        if isinstance(content, str):
            chunks.append(content)
        elif content is not None:
            chunks.append(str(content))
        args = getattr(part, "args", None)
        if args is not None:
            chunks.append(str(args))
    return "\n".join(chunks)


def _message_token_estimate(message: ModelMessage) -> int:
    text = _message_text(message)
    return max(1, len(text) // 4) if text else 0


def _tool_return_positions(messages: list[ModelMessage]) -> list[tuple[int, int, ToolReturnPart]]:
    positions: list[tuple[int, int, ToolReturnPart]] = []
    for message_index, message in enumerate(messages):
        if not isinstance(message, ModelRequest):
            continue
        for part_index, part in enumerate(message.parts):
            if isinstance(part, ToolReturnPart):
                positions.append((message_index, part_index, part))
    return positions


def _first_user_index(messages: list[ModelMessage]) -> int | None:
    for message_index, message in enumerate(messages):
        if not isinstance(message, ModelRequest):
            continue
        if any(isinstance(part, UserPromptPart) for part in message.parts):
            return message_index
    return None


def _trailing_start_index(messages: list[ModelMessage], trailing_tokens: int) -> int:
    if trailing_tokens <= 0:
        return len(messages)
    tokens = 0
    for index in range(len(messages) - 1, -1, -1):
        tokens += _message_token_estimate(messages[index])
        if tokens >= trailing_tokens:
            return index
    return 0


def _summary_message(content: str) -> ModelRequest:
    return ModelRequest(parts=[UserPromptPart(content=content)])


def _safe_compaction_trailing_messages(messages: list[ModelMessage]) -> list[ModelMessage]:
    safe_messages: list[ModelMessage] = []
    for message in messages:
        if not isinstance(message, ModelRequest):
            continue
        if all(isinstance(part, UserPromptPart) for part in message.parts):
            safe_messages.append(message)
    return safe_messages


def _extractive_summary(messages: list[ModelMessage], max_summary_tokens: int) -> str:
    max_chars = max_summary_tokens * 4
    if max_chars <= 0:
        return ""
    summary = "\n\n".join(_message_text(message) for message in messages if _message_text(message))
    if len(summary) <= max_chars:
        return summary
    return summary[:max_chars].rstrip() + "\n[summary truncated]"


def _apply_compaction_policy(
    messages: list[ModelMessage],
    config: ContextPolicyConfig,
) -> list[ModelMessage]:
    if _estimate_message_tokens(messages) <= config.threshold_tokens:
        return messages
    first_user_index = _first_user_index(messages)
    trailing_start_index = _trailing_start_index(messages, config.trailing_tokens)

    kept_prefix = (
        [messages[first_user_index]]
        if first_user_index is not None and first_user_index < trailing_start_index
        else []
    )
    trailing = _safe_compaction_trailing_messages(messages[trailing_start_index:])
    middle_start = (first_user_index + 1) if first_user_index is not None else 0
    middle = messages[middle_start:trailing_start_index]

    if config.name == "naive_truncation":
        return [*kept_prefix, *trailing]
    if config.name == "noop_summary":
        summary_text = "[Earlier conversation history was removed to save context.]"
    else:
        summary = _extractive_summary(middle, config.max_summary_tokens)
        summary_text = (
            "The earlier conversation history was compacted to save context. "
            f"<conversation_summary>{summary}</conversation_summary>"
        )
    return [*kept_prefix, _summary_message(summary_text), *trailing]


def _apply_oracle_policy(
    messages: list[ModelMessage],
    config: ContextPolicyConfig,
) -> list[ModelMessage]:
    first_user_index = _first_user_index(messages)
    trailing_start_index = _trailing_start_index(messages, config.trailing_tokens)
    keep_indices: set[int] = set(range(trailing_start_index, len(messages)))
    if first_user_index is not None:
        keep_indices.add(first_user_index)
    for index, message in enumerate(messages):
        text = _message_text(message)
        if config.oracle_terms and any(term in text for term in config.oracle_terms):
            keep_indices.add(index)
    return [message for index, message in enumerate(messages) if index in keep_indices]


def apply_context_policy(
    messages: list[ModelMessage],
    config: ContextPolicyConfig,
) -> list[ModelMessage]:
    if config.name in {"threshold_summary", "noop_summary", "naive_truncation"}:
        return _apply_compaction_policy(messages, config)
    if config.name == "oracle_focused":
        return _apply_oracle_policy(messages, config)
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
        for part_index, message_part in enumerate(message.parts):
            replacement = replacements.get((message_index, part_index))
            if replacement is None:
                parts.append(message_part)
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

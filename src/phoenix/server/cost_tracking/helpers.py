import logging
from typing import Any, Mapping

from openinference.semconv.trace import SpanAttributes
from typing_extensions import TypeAlias

from phoenix.trace.attributes import get_attribute_value

logger = logging.getLogger(__name__)

_PromptTokens: TypeAlias = int
_CompletionTokens: TypeAlias = int
_TotalTokens: TypeAlias = int


def get_aggregated_tokens(
    attributes: Mapping[str, Any],
) -> tuple[_PromptTokens, _CompletionTokens, _TotalTokens]:
    """Return the total, prompt, and completion token counts from the span attributes."""
    try:
        prompt_tokens_value = get_attribute_value(
            attributes,
            SpanAttributes.LLM_TOKEN_COUNT_PROMPT,
        )
        prompt_tokens: int = (
            0
            if not isinstance(prompt_tokens_value, (int, float))
            else max(0, int(prompt_tokens_value))
        )

        completion_tokens_value = get_attribute_value(
            attributes,
            SpanAttributes.LLM_TOKEN_COUNT_COMPLETION,
        )
        completion_tokens: int = (
            0
            if not isinstance(completion_tokens_value, (int, float))
            else max(0, int(completion_tokens_value))
        )

        total_tokens_value = get_attribute_value(
            attributes,
            SpanAttributes.LLM_TOKEN_COUNT_TOTAL,
        )
        total_tokens: int = (
            0
            if not isinstance(total_tokens_value, (int, float))
            else max(0, int(total_tokens_value))
        )

        assert prompt_tokens >= 0
        assert completion_tokens >= 0
        assert total_tokens >= 0

        calculated_total = prompt_tokens + completion_tokens

        if total_tokens > calculated_total:
            if not prompt_tokens:
                prompt_tokens = total_tokens - completion_tokens
            else:
                completion_tokens = total_tokens - prompt_tokens
        else:
            total_tokens = calculated_total

        return prompt_tokens, completion_tokens, total_tokens
    except Exception as e:
        logger.error(f"Error getting aggregated tokens: {e}")
        return 0, 0, 0

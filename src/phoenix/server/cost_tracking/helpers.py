import logging
import math
from typing import Any, Literal, Mapping, Optional, Union

from openinference.semconv.trace import OpenInferenceSpanKindValues, SpanAttributes
from typing_extensions import TypeAlias, TypeGuard

from phoenix.trace.attributes import get_attribute_value

logger = logging.getLogger(__name__)

_PromptTokens: TypeAlias = int
_CompletionTokens: TypeAlias = int
_TotalTokens: TypeAlias = int

PricedModelType: TypeAlias = Literal["LLM", "DECISION"]
"""The `GenerativeModel.type` values that span costs are calculated for."""


def get_priced_model_type(attributes: Optional[Mapping[str, Any]]) -> PricedModelType:
    """
    Return the type of `GenerativeModel` a span is priced against.

    The span kind picks the type: DECISION spans price against DECISION models, and every other
    span prices against LLM models (`should_calculate_span_cost` only lets LLM and DECISION
    spans through).
    """
    span_kind = get_attribute_value(attributes, SpanAttributes.OPENINFERENCE_SPAN_KIND)
    if span_kind == OpenInferenceSpanKindValues.DECISION.value:
        return "DECISION"
    return "LLM"


def _get_str(attributes: Optional[Mapping[str, Any]], *keys: str) -> str:
    """Return the first non-blank value among `keys` as a stripped string, or ""."""
    for key in keys:
        if value := str(get_attribute_value(attributes, key) or "").strip():
            return value
    return ""


def _get_name(attributes: Optional[Mapping[str, Any]], *keys: str) -> str:
    """Return the first non-blank string among `keys`, stripped, or "". Non-strings are skipped."""
    for key in keys:
        value = get_attribute_value(attributes, key)
        if isinstance(value, str) and (value := value.strip()):
            return value
    return ""


_DECISION_MODEL_NAME_KEYS = (
    SpanAttributes.DECISION_RESPONSE_MODEL_NAME,
    SpanAttributes.DECISION_MODEL_NAME,
    SpanAttributes.DECISION_REQUEST_MODEL_NAME,
)
_LLM_MODEL_NAME_KEYS = (
    SpanAttributes.LLM_RESPONSE_MODEL_NAME,
    SpanAttributes.LLM_MODEL_NAME,
    SpanAttributes.LLM_REQUEST_MODEL_NAME,
)


def get_model_name(attributes: Optional[Mapping[str, Any]]) -> str:
    """
    Return the model name used for cost lookup, or "" if the span has none. Only string values
    count. `should_calculate_span_cost` uses this too, so the gate and the lookup agree on the name.

    Within each attribute family, the provider-reported `*.response.model_name` wins over
    `*.model_name`, which wins over `*.request.model_name`. DECISION spans read `decision.*`,
    falling back to `llm.*` for TypeSafe instrumentor releases from before the `decision.*`
    attributes existed (OpenInference `spec/decision_spans.md`, "Transition Note"). Other spans
    read `llm.*`.
    """
    if get_priced_model_type(attributes) == "DECISION":
        return _get_name(attributes, *_DECISION_MODEL_NAME_KEYS, *_LLM_MODEL_NAME_KEYS)
    return _get_name(attributes, *_LLM_MODEL_NAME_KEYS)


def get_provider(attributes: Optional[Mapping[str, Any]]) -> str:
    """
    Return the provider used to break ties in cost lookup, or "" if the span has none.

    DECISION spans read `decision.provider`, then `decision.system` (the spec sets the provider
    only when it differs from the system, and their well-known values are the same strings),
    then the legacy `llm.provider`. Other spans read `llm.provider`.
    """
    if get_priced_model_type(attributes) == "DECISION":
        return _get_str(
            attributes,
            SpanAttributes.DECISION_PROVIDER,
            SpanAttributes.DECISION_SYSTEM,
            SpanAttributes.LLM_PROVIDER,
        )
    return _get_str(attributes, SpanAttributes.LLM_PROVIDER)


def is_finite_number(value: Any) -> TypeGuard[Union[int, float]]:
    """Whether `value` is a finite `int` or `float` (excluding `bool`)."""
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


def parse_token_count(value: Any) -> Optional[int]:
    """Parse a span attribute value as a non-negative integer token count, or None if invalid."""
    if not is_finite_number(value):
        return None
    return max(0, int(value))


def uses_decision_token_counts(attributes: Optional[Mapping[str, Any]]) -> bool:
    """
    Whether the span's token counts come from `decision.token_count.*`.

    True for a DECISION span that sets a finite numeric `decision.token_count.input` or `.output`.
    A DECISION span that sets neither falls back to the legacy `llm.token_count.*` attributes.
    The two families are never mixed (the spec keeps decision usage in its own namespace): a
    span with `decision.token_count.input` and only `llm.token_count.completion` has 0 output
    tokens.
    `decision.token_count.*` has no detail (cache, audio, ...) keys, so when this is True the
    `llm.token_count.*_details` attributes are ignored too: they would describe a different set
    of counts.
    """
    if get_priced_model_type(attributes) != "DECISION":
        return False
    return any(
        parse_token_count(get_attribute_value(attributes, key)) is not None
        for key in (
            SpanAttributes.DECISION_TOKEN_COUNT_INPUT,
            SpanAttributes.DECISION_TOKEN_COUNT_OUTPUT,
        )
    )


def _get_token_count(attributes: Mapping[str, Any], key: str) -> int:
    return parse_token_count(get_attribute_value(attributes, key)) or 0


def get_aggregated_tokens(
    attributes: Mapping[str, Any],
) -> tuple[_PromptTokens, _CompletionTokens, _TotalTokens]:
    """
    Return the prompt (input), completion (output), and total token counts from the span
    attributes.

    DECISION spans that report `decision.token_count.input` / `.output` use those (there is no
    decision total, so the total is their sum). Everything else uses `llm.token_count.*`.
    """
    try:
        if uses_decision_token_counts(attributes):
            prompt_tokens = _get_token_count(attributes, SpanAttributes.DECISION_TOKEN_COUNT_INPUT)
            completion_tokens = _get_token_count(
                attributes, SpanAttributes.DECISION_TOKEN_COUNT_OUTPUT
            )
            return prompt_tokens, completion_tokens, prompt_tokens + completion_tokens

        prompt_tokens = _get_token_count(attributes, SpanAttributes.LLM_TOKEN_COUNT_PROMPT)
        completion_tokens = _get_token_count(attributes, SpanAttributes.LLM_TOKEN_COUNT_COMPLETION)
        total_tokens = _get_token_count(attributes, SpanAttributes.LLM_TOKEN_COUNT_TOTAL)

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

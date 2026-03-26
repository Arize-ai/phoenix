"""
Output coercion for code evaluator results.

_coerce_output maps a raw Python/TypeScript return value from sandbox
execution to a (label, score) pair suitable for EvaluationResult.

Three modes:
1. No output_configs — bare value passthrough (score if numeric, label if str).
2. CategoricalOutputConfig — label validation + score lookup from values list.
3. ContinuousOutputConfig — numeric extraction + bounds validation.

Bool exclusion: bool is NOT treated as numeric in any mode.
"""

from __future__ import annotations

from typing import Any, Optional

from phoenix.db.types.annotation_configs import (
    CategoricalOutputConfig,
    ContinuousOutputConfig,
    OutputConfigType,
)


def _coerce_output(
    value: Any,
    output_config: Optional[OutputConfigType],
) -> tuple[Optional[str], Optional[float]]:
    """
    Coerce a raw sandbox return value to (label, score).

    Args:
        value: Raw return value from sandbox execution.
        output_config: Output config to validate/coerce against, or None for
            bare passthrough.

    Returns:
        (label, score) tuple. Either or both may be None.

    Raises:
        ValueError: If the value is incompatible with the output_config
            (e.g. label not in categorical values, numeric out of bounds).
    """
    if output_config is None:
        return _coerce_bare(value)

    if isinstance(output_config, CategoricalOutputConfig):
        return _coerce_categorical(value, output_config)

    if isinstance(output_config, ContinuousOutputConfig):
        return _coerce_continuous(value, output_config)

    # Should never reach here with a well-typed OutputConfigType
    return _coerce_bare(value)


def _coerce_bare(value: Any) -> tuple[Optional[str], Optional[float]]:
    """No output_config: passthrough — numeric → score, str → label."""
    if isinstance(value, bool):
        # Bool exclusion (D6): bool is not treated as numeric.
        return (str(value), None)
    if isinstance(value, (int, float)):
        return (None, float(value))
    if isinstance(value, str):
        return (value, None)
    if value is None:
        return (None, None)
    # Complex types: stringify as label
    return (str(value), None)


def _coerce_categorical(
    value: Any,
    config: CategoricalOutputConfig,
) -> tuple[Optional[str], Optional[float]]:
    """Validate label against config.values; look up associated score."""
    if isinstance(value, bool):
        # Bool exclusion: stringify, then validate as label
        label = str(value)
    elif isinstance(value, str):
        label = value
    else:
        raise ValueError(
            f"Expected a string label for categorical output, got {type(value).__name__!r}: "
            f"{value!r}"
        )

    label_to_score: dict[str, Optional[float]] = {v.label: v.score for v in config.values}
    if label not in label_to_score:
        valid = ", ".join(repr(v.label) for v in config.values)
        raise ValueError(f"Label {label!r} not in categorical output config values [{valid}]")
    return (label, label_to_score[label])


def _coerce_continuous(
    value: Any,
    config: ContinuousOutputConfig,
) -> tuple[Optional[str], Optional[float]]:
    """Extract numeric value; validate against optional bounds."""
    if isinstance(value, bool):
        # Bool exclusion (D6): bool is not numeric.
        raise ValueError(f"Expected a numeric value for continuous output, got bool: {value!r}")
    if not isinstance(value, (int, float)):
        raise ValueError(
            f"Expected a numeric value for continuous output, got "
            f"{type(value).__name__!r}: {value!r}"
        )
    score = float(value)
    if config.lower_bound is not None and score < config.lower_bound:
        raise ValueError(f"Score {score} is below lower_bound {config.lower_bound}")
    if config.upper_bound is not None and score > config.upper_bound:
        raise ValueError(f"Score {score} is above upper_bound {config.upper_bound}")
    return (None, score)

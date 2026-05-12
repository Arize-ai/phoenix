"""
Output coercion for code evaluator results.

_coerce_output maps a raw Python/TypeScript return value from sandbox
execution to a (label, score, explanation) triple suitable for EvaluationResult.

User-facing spec: docs/phoenix/evaluation/how-to-evals/code-evaluator-output-shapes.mdx

Triple-collapse model (two-stage):
  Stage 1 — _extract_triple: parse any accepted raw_value shape into a Triple.
    Accepted shapes:
      - Bare scalar (str, int, float, bool, None) → bare triple
      - Dict with any subset of {label, score, explanation} keys → triple by key
    Not accepted:
      - Tuples (deferred per D5)
      - Multi-output routing dicts (handled by the runner, not this function)

  Stage 2 — per-config validators: check the triple against config requirements.
    - CategoricalOutputConfig: label required, must be in config.values, score
      looked up from config (user-supplied score must match lookup or is rejected).
    - ContinuousOutputConfig: score required, must be finite numeric (not bool),
      must be within optional bounds; free-form label accepted.
    - No config: bare passthrough; lists/nested objects rejected.

Bool exclusion: bool is NOT treated as numeric in any mode.
NaN/Infinity: rejected as continuous score.

The 'language' keyword in _coerce_output is forwarded only to error-message
rendering via shape_examples; it has no effect on accepted shapes.
"""

from __future__ import annotations

import math
from typing import Any, NamedTuple, Optional

from phoenix.db.types.annotation_configs import (
    CategoricalOutputConfig,
    ContinuousOutputConfig,
    OutputConfigType,
)

_DICT_KEYS = frozenset({"label", "score", "explanation"})


class Triple(NamedTuple):
    label: Optional[str]
    score: Optional[float]
    explanation: Optional[str]


def _extract_triple(value: Any) -> Triple:
    """Stage 1: parse any accepted raw_value shape into a Triple.

    Only bare scalars and recognized dict-by-key shapes are handled here.
    Multi-output routing dicts (keyed by config.name) are handled by the runner.
    """
    if isinstance(value, dict):
        unknown = set(value.keys()) - _DICT_KEYS
        if unknown:
            raise ValueError(
                f"Unrecognized keys in output dict: {sorted(unknown)!r}. "
                f"Accepted dict keys are: {sorted(_DICT_KEYS)!r}"
            )
        raw_label = value.get("label")
        raw_score = value.get("score")
        raw_explanation = value.get("explanation")
        return Triple(
            label=raw_label,
            score=raw_score,
            explanation=raw_explanation,
        )

    # Bare scalar dispatch
    if isinstance(value, bool):
        return Triple(label=str(value), score=None, explanation=None)
    if isinstance(value, (int, float)):
        return Triple(label=None, score=float(value), explanation=None)
    if isinstance(value, str):
        return Triple(label=value, score=None, explanation=None)
    if value is None:
        return Triple(label=None, score=None, explanation=None)

    # Lists and complex objects: rejected here; _validate_triple_bare gives the error.
    return Triple(label=None, score=None, explanation=None)


def _validate_field_types(triple: Triple) -> None:
    """Validate that label, explanation are str|None.

    Score type-checking is deferred to the per-config Stage 2 validators because
    the bare passthrough path allows score to come from bare int/float without a
    config, and continuous config does its own numeric validation.
    """
    if triple.label is not None and not isinstance(triple.label, str):
        raise ValueError(
            f"'label' must be a string or None, got {type(triple.label).__name__!r}: "
            f"{triple.label!r}"
        )
    if triple.explanation is not None and not isinstance(triple.explanation, str):
        raise ValueError(
            f"'explanation' must be a string or None, got "
            f"{type(triple.explanation).__name__!r}: {triple.explanation!r}"
        )


def _validate_triple_bare(value: Any, triple: Triple) -> Triple:
    """No config: passthrough for bare scalars and recognized dicts.

    Lists and nested objects are rejected with a clear error pointing at the
    shape catalog.
    """
    if isinstance(value, (list, tuple)) or (
        isinstance(value, dict) and set(value.keys()) - _DICT_KEYS
    ):
        raise ValueError(
            f"Unsupported output type {type(value).__name__!r}: {value!r}. "
            f"Without an output config, accepted shapes are: bare scalar "
            f"(str, int, float, bool, None) or a dict with keys from "
            f"{sorted(_DICT_KEYS)!r}."
        )
    # Recognized dict-by-key or bare scalar: passthrough
    return triple


def _validate_triple_categorical(
    triple: Triple,
    config: CategoricalOutputConfig,
    language: str = "PYTHON",
) -> Triple:
    """Stage 2: validate triple against categorical config.

    - label is required
    - label must be in config.values
    - if score is present, it must match the config lookup
    - explanation passes through verbatim
    """
    shapes = "\n".join(f"  {s}" for s in config.shape_examples(language=language, mode="full"))

    label = triple.label
    if label is None:
        raise ValueError(
            f"Categorical output requires a label. Got label=None. "
            f"Return a string from {[v.label for v in config.values]!r} "
            f"or a dict with a 'label' key.\nValid shapes:\n{shapes}"
        )
    if not isinstance(label, str):
        raise ValueError(
            f"Expected a string label for categorical output, got "
            f"{type(label).__name__!r}: {label!r}\nValid shapes:\n{shapes}"
        )

    label_to_score: dict[str, Optional[float]] = {v.label: v.score for v in config.values}
    if label not in label_to_score:
        valid = ", ".join(repr(v.label) for v in config.values)
        raise ValueError(
            f"Label {label!r} not in categorical output config values [{valid}].\n"
            f"Valid shapes:\n{shapes}"
        )

    looked_up_score = label_to_score[label]

    # If the user explicitly supplied a score, it must match the canonical lookup.
    if triple.score is not None:
        if isinstance(triple.score, bool):
            raise ValueError(
                f"'score' must not be bool; got {triple.score!r}. "
                f"Categorical score is determined by the config lookup for label {label!r}."
            )
        user_score = float(triple.score)
        if looked_up_score is not None and user_score != looked_up_score:
            raise ValueError(
                f"Score {user_score!r} does not match the configured score "
                f"{looked_up_score!r} for label {label!r}. "
                f"Remove the 'score' key or use the canonical value {looked_up_score!r}."
            )

    score = looked_up_score if looked_up_score is not None else triple.score
    return Triple(label=label, score=score, explanation=triple.explanation)


def _validate_triple_continuous(
    triple: Triple,
    config: ContinuousOutputConfig,
    language: str = "PYTHON",
) -> Triple:
    """Stage 2: validate triple against continuous config.

    - score is required
    - score must be a finite numeric value (not bool, not NaN, not Infinity)
    - score must be within optional bounds
    - free-form label is accepted as-is
    """
    shapes = "\n".join(f"  {s}" for s in config.shape_examples(language=language, mode="full"))

    score = triple.score
    if score is None:
        raise ValueError(
            f"Continuous output requires a numeric score. Got score=None. "
            f"Return a number or a dict with a 'score' key.\nValid shapes:\n{shapes}"
        )
    if isinstance(score, bool):
        raise ValueError(f"Expected a numeric value for continuous output, got bool: {score!r}")
    if not isinstance(score, (int, float)):
        raise ValueError(
            f"Expected a numeric value for continuous output, got "
            f"{type(score).__name__!r}: {score!r}\nValid shapes:\n{shapes}"
        )
    score_f = float(score)
    if math.isnan(score_f) or math.isinf(score_f):
        raise ValueError(f"Score must be a finite number; got {score!r}")
    if config.lower_bound is not None and score_f < config.lower_bound:
        raise ValueError(f"Score {score_f} is below lower_bound {config.lower_bound}")
    if config.upper_bound is not None and score_f > config.upper_bound:
        raise ValueError(f"Score {score_f} is above upper_bound {config.upper_bound}")
    # Free-form label accepted verbatim
    return Triple(label=triple.label, score=score_f, explanation=triple.explanation)


def _coerce_output(
    value: Any,
    output_config: Optional[OutputConfigType],
    *,
    language: str = "PYTHON",
) -> tuple[Optional[str], Optional[float], Optional[str]]:
    """
    Coerce a raw sandbox return value to (label, score, explanation).

    Args:
        value: Raw return value from sandbox execution. Multi-output routing
            (a dict keyed by config.name) must be resolved by the caller before
            passing here; this function handles single-config coercion only.
        output_config: Output config to validate/coerce against, or None for
            bare passthrough.
        language: Evaluator language ("PYTHON" or "TYPESCRIPT"). Used only for
            rendering language-appropriate code examples in ValueError messages;
            has no effect on accepted shapes.

    Returns:
        (label, score, explanation) triple. Any element may be None.

    Raises:
        ValueError: If the value is incompatible with the output_config
            (e.g. label not in categorical values, numeric out of bounds).
    """
    # Stage 1: extract triple from value shape
    if isinstance(value, (list, tuple)) and output_config is None:
        # Early path for lists/tuples under no-config (gives better error message)
        raise ValueError(
            f"Unsupported output type {type(value).__name__!r}: {value!r}. "
            f"Without an output config, accepted shapes are: bare scalar "
            f"(str, int, float, bool, None) or a dict with keys from "
            f"{sorted(_DICT_KEYS)!r}."
        )

    # Bool under continuous config must be caught before _extract_triple converts
    # bool to label="True", which would then incorrectly raise "requires a numeric
    # score" instead of the expected "got bool" message.
    if isinstance(output_config, ContinuousOutputConfig) and isinstance(value, bool):
        raise ValueError(f"Expected a numeric value for continuous output, got bool: {value!r}")

    triple = _extract_triple(value)
    _validate_field_types(triple)

    # Stage 2: per-config validation
    if output_config is None:
        validated = _validate_triple_bare(value, triple)
    elif isinstance(output_config, CategoricalOutputConfig):
        validated = _validate_triple_categorical(triple, output_config, language)
    elif isinstance(output_config, ContinuousOutputConfig):
        validated = _validate_triple_continuous(triple, output_config, language)
    else:
        validated = _validate_triple_bare(value, triple)

    return (validated.label, validated.score, validated.explanation)

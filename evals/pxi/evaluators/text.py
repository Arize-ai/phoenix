from __future__ import annotations

from typing import Any

from phoenix.evals import create_evaluator


def _as_dict(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _assistant_text(output: Any) -> str | None:
    text = _as_dict(output).get("assistant_text")
    return text if isinstance(text, str) and text.strip() else None


def _failure(explanation: str, *, metadata: dict[str, Any] | None = None) -> dict[str, Any]:
    result: dict[str, Any] = {
        "score": 0.0,
        "label": "fail",
        "explanation": explanation,
    }
    if metadata:
        result["metadata"] = dict(metadata)
    return result


def _success() -> dict[str, Any]:
    return {"score": 1.0, "label": "pass"}


def _text_expectations(expected: Any) -> list[dict[str, Any]] | None:
    """Return the list of acceptable assistant-text variants, or ``None`` on schema errors.

    ``expected.assistant_text`` accepts either a single object or a non-empty
    list of objects; an absent section yields an empty list (vacuous pass).
    """
    raw = _as_dict(expected).get("assistant_text")
    if raw is None:
        return []
    if isinstance(raw, dict):
        return [raw]
    if isinstance(raw, list) and raw and all(isinstance(item, dict) for item in raw):
        return raw
    return None


def _normalized_contains_all(value: Any) -> list[str | list[str]] | None:
    """Validate and lowercase a ``contains_all`` list.

    Each entry is either a string (must appear) or a non-empty list of strings
    (an any-of group: at least one alternative must appear).
    """
    if value is None:
        return []
    if not isinstance(value, list):
        return None
    normalized: list[str | list[str]] = []
    for entry in value:
        if isinstance(entry, str):
            normalized.append(entry.casefold())
        elif (
            isinstance(entry, list)
            and entry
            and all(isinstance(alternative, str) for alternative in entry)
        ):
            normalized.append([alternative.casefold() for alternative in entry])
        else:
            return None
    return normalized


def _normalized_string_list(value: Any) -> list[str] | None:
    if value is None:
        return []
    if isinstance(value, list) and all(isinstance(item, str) for item in value):
        return [item.casefold() for item in value]
    return None


_VARIANT_KEYS: frozenset[str] = frozenset({"contains_all", "contains_any", "not_contains"})


def _normalize_variant(variant: dict[str, Any]) -> dict[str, Any] | None:
    """Validate one expectation variant; return normalized fields or ``None``."""
    if not variant or any(key not in _VARIANT_KEYS for key in variant):
        return None
    contains_all = _normalized_contains_all(variant.get("contains_all"))
    contains_any = _normalized_string_list(variant.get("contains_any"))
    not_contains = _normalized_string_list(variant.get("not_contains"))
    if contains_all is None or contains_any is None or not_contains is None:
        return None
    if not contains_all and not contains_any and not not_contains:
        return None
    return {
        "contains_all": contains_all,
        "contains_any": contains_any,
        "not_contains": not_contains,
    }


def _contains_entry_matches(text: str, entry: str | list[str]) -> bool:
    """One ``contains_all`` entry passes if the string (or any alternative) appears."""
    if isinstance(entry, str):
        return entry in text
    return any(alternative in text for alternative in entry)


def _variant_failures(text: str, variant: dict[str, Any]) -> dict[str, Any]:
    """Return the per-variant mismatch details; empty dict means the variant passed."""
    missing: list[str | list[str]] = [
        entry for entry in variant["contains_all"] if not _contains_entry_matches(text, entry)
    ]
    failures: dict[str, Any] = {}
    if missing:
        failures["missing_required"] = missing
    if variant["contains_any"] and not any(needle in text for needle in variant["contains_any"]):
        failures["missing_any_of"] = variant["contains_any"]
    matched_forbidden = [needle for needle in variant["not_contains"] if needle in text]
    if matched_forbidden:
        failures["matched_forbidden"] = matched_forbidden
    return failures


def evaluate_assistant_text_substrings(output: Any, expected: Any) -> dict[str, Any]:
    """Match the assistant's final text by required and forbidden substrings.

    Reads ``expected.assistant_text`` as either a single object or a list of
    acceptable variants; the run passes if the assistant text satisfies ANY
    variant. Each variant supports:

    - ``contains_all``: every entry must appear. An entry is a string, or a
      list of alternative strings of which at least one must appear (an
      any-of group for synonym tolerance, e.g. ``["pricing", "model prices"]``).
    - ``contains_any``: at least one entry must appear.
    - ``not_contains``: no entry may appear.

    All matching is case-insensitive substring containment. This is
    intentionally coarser than exact text matching: knowledge answers vary
    freely in phrasing, so expectations should pin the facts that must (or
    must not) surface, not the wording around them. Passes vacuously when
    ``expected.assistant_text`` is absent so the evaluator can be enabled
    dataset-wide.
    """
    variants = _text_expectations(expected)
    if variants is None:
        return _failure("Expected assistant_text must be an object or non-empty list of objects")
    if not variants:
        return _success()

    normalized_variants: list[dict[str, Any]] = []
    malformed: list[dict[str, Any]] = []
    for index, variant in enumerate(variants):
        normalized = _normalize_variant(variant)
        if normalized is None:
            malformed.append({"index": index, "variant": variant})
        else:
            normalized_variants.append(normalized)
    if malformed:
        return _failure(
            "Expected assistant_text variants must be non-empty objects with "
            "contains_all (strings or non-empty lists of strings), contains_any, "
            "and/or not_contains (lists of strings)",
            metadata={"malformed": malformed},
        )

    text = _assistant_text(output)
    if text is None:
        return _failure("Assistant output did not include text.")
    normalized_text = text.casefold()

    variant_failures: list[dict[str, Any]] = []
    for index, variant in enumerate(normalized_variants):
        failures = _variant_failures(normalized_text, variant)
        if not failures:
            return _success()
        variant_failures.append({"variant_index": index, **failures})

    return _failure(
        "Assistant text did not satisfy any expected substring variant",
        metadata={"variant_failures": variant_failures},
    )


@create_evaluator(name="assistant_text_substrings_match", kind="code")
def assistant_text_substrings_match(output: Any, expected: Any) -> dict[str, Any]:
    """Phoenix evaluator entrypoint for assistant-text substring matching.

    See :func:`evaluate_assistant_text_substrings` for the expected-block
    schema and matching semantics.
    """
    return evaluate_assistant_text_substrings(output, expected)

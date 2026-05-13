from __future__ import annotations

import json
from typing import Any

from phoenix.evals import create_evaluator


def _as_dict(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def tool_calls_from_output(output: Any) -> list[dict[str, Any]]:
    messages = _as_dict(output).get("messages", [])
    if not isinstance(messages, list):
        return []
    calls: list[dict[str, Any]] = []
    for message in messages:
        if not isinstance(message, dict):
            continue
        parts = message.get("parts", [])
        if not isinstance(parts, list):
            continue
        calls.extend(
            part
            for part in parts
            if isinstance(part, dict) and part.get("part_kind") == "tool-call"
        )
    return calls


def _tool_name(call: dict[str, Any]) -> str | None:
    name = call.get("tool_name")
    return name if isinstance(name, str) else None


def _tool_args(call: dict[str, Any]) -> dict[str, Any]:
    args = call.get("args", {})
    if isinstance(args, dict):
        return args
    if isinstance(args, str):
        # Pydantic AI serializes tool-call args as a JSON string in some
        # transports. Decode so subset/any-of matching can see the keys.
        try:
            decoded = json.loads(args)
        except (json.JSONDecodeError, ValueError):
            return {}
        return decoded if isinstance(decoded, dict) else {}
    return {}


def _expected_tools(expected: Any) -> dict[str, Any]:
    return _as_dict(_as_dict(expected).get("tools", {}))


def _expected_tool_call_args(expected: Any) -> dict[str, Any]:
    return _as_dict(_as_dict(expected).get("tool_call_args", {}))


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


def evaluate_tools_called(output: Any, expected: Any) -> dict[str, Any]:
    """Evaluate observed tool calls against required/forbidden/exact_match expectations.

    Reads strictness from ``expected.tools.exact_match`` (defaulting to False).
    Returns a dict with one of the labels:

    - ``correct``: all required tools were called, no forbidden tools, and (when
      ``exact_match`` is true) the observed sequence equals the required sequence.
    - ``called_forbidden``: at least one forbidden tool was called.
    - ``missing_required``: at least one required tool was not called.
    - ``not_exact_match``: ``exact_match`` is true, all required tools were
      called, and the observed sequence does not equal the required sequence
      (extra calls, duplicates, or different ordering).

    Precedence (most specific first): ``called_forbidden`` >
    ``missing_required`` > ``not_exact_match`` > ``correct``.
    """
    tool_expectation = _expected_tools(expected)
    required = list(tool_expectation.get("required") or [])
    forbidden = list(tool_expectation.get("forbidden") or [])
    exact_match = bool(tool_expectation.get("exact_match", False))

    observed = [
        name for call in tool_calls_from_output(output) if (name := _tool_name(call)) is not None
    ]

    forbidden_observed = [name for name in forbidden if name in observed]
    if forbidden_observed:
        return {
            "score": 0.0,
            "label": "called_forbidden",
            "explanation": f"Forbidden tools were called: {forbidden_observed}",
            "metadata": {"observed_tools": observed},
        }

    missing = [name for name in required if name not in observed]
    if missing:
        return {
            "score": 0.0,
            "label": "missing_required",
            "explanation": f"Required tools were not called: {missing}",
            "metadata": {"observed_tools": observed},
        }

    if exact_match and observed != required:
        return {
            "score": 0.0,
            "label": "not_exact_match",
            "explanation": f"Expected exact tool sequence {required}, observed {observed}",
            "metadata": {"observed_tools": observed},
        }

    return {"score": 1.0, "label": "correct"}


@create_evaluator(name="correct_tools_called", kind="code")
def correct_tools_called(output: Any, expected: Any) -> dict[str, Any]:
    """Phoenix evaluator entrypoint for tool-selection correctness.

    Delegates to :func:`evaluate_tools_called`; see that function for label
    semantics and precedence. Strictness is read from
    ``expected.tools.exact_match`` so it can be controlled per-example via
    the dataset YAML.
    """
    return evaluate_tools_called(output, expected)


def _normalize_arg_value(value: Any) -> Any:
    """Make string values that look like SQL boolean conjunctions or
    disjunctions invariant to clause ordering.

    Phoenix tool arg values like ``"span_kind == 'LLM' and latency_ms >= 5000"``
    are semantically equivalent regardless of clause order; the same holds for
    ``"span_kind == 'TOOL' or span_kind == 'CHAIN'"``. The evaluator compares
    strings exactly otherwise, so without normalization a model that emits
    clauses in a different order from the dataset (or, in OR's case, picks an
    equivalent membership rewrite) would silently fail.

    Normalization rules:

    - Pure ``and``-joined: split on `` and ``, return ``("AND", frozenset(...))``.
    - Pure ``or``-joined: split on `` or ``, return ``("OR", frozenset(...))``.
    - Mixed (both ``and`` and ``or`` appear): return the raw string. Splitting
      naively would lose precedence; dataset authors who care about a specific
      mixed-operator form should pin it exactly.
    - Everything else: return the value unchanged.

    The tagged tuples guarantee an AND-set never compares equal to an OR-set
    over the same clauses — those expressions are not semantically equivalent.
    """
    if not isinstance(value, str):
        return value
    has_and = " and " in value
    has_or = " or " in value
    if has_and and has_or:
        return value
    if has_and:
        clauses = frozenset(clause.strip() for clause in value.split(" and ") if clause.strip())
        return ("AND", clauses)
    if has_or:
        clauses = frozenset(clause.strip() for clause in value.split(" or ") if clause.strip())
        return ("OR", clauses)
    return value


# Tools that have their own specialized arg-match evaluator with
# tool-specific value semantics. The generic ``tool_call_args_match``
# evaluator skips these so we don't double-score (and so a tool whose
# args have semantic equivalences -- like the Phoenix span-filter DSL
# -- isn't held to a stricter exact-string standard by the generic eval).
_TOOLS_WITH_SPECIALIZED_ARG_EVALUATORS: frozenset[str] = frozenset({"set_spans_filter"})


def _values_match_exact(observed: Any, expected_value: Any) -> bool:
    return bool(observed == expected_value)


def _values_match_with_dsl_normalization(observed: Any, expected_value: Any) -> bool:
    return bool(_normalize_arg_value(observed) == _normalize_arg_value(expected_value))


def _expected_arg_variants(expected_for_tool: Any) -> list[dict[str, Any]]:
    """Return the list of acceptable arg dicts for one tool.

    The dataset schema for ``expected.tool_call_args[<tool>]`` accepts either:

    - a single dict ``{key: value, ...}`` (the default form), OR
    - a list of dicts -- each entry is an independently-acceptable
      arg shape; the observed call passes if it satisfies ANY variant.

    Variants exist for genuinely-ambiguous queries where more than one
    set of arguments is a reasonable agent choice (e.g. "show me recent
    traces" could resolve to ``1h``, ``1d``, ``7d``, etc.). Invalid
    entries (non-dict members of a list) are silently dropped.
    """
    if isinstance(expected_for_tool, dict):
        return [expected_for_tool]
    if isinstance(expected_for_tool, list):
        return [item for item in expected_for_tool if isinstance(item, dict)]
    return []


def _evaluate_args_for_tools(
    output: Any,
    expected: Any,
    *,
    tool_predicate: Any,
    value_comparator: Any,
) -> dict[str, Any]:
    """Shared subset/any-of arg matcher used by both arg evaluators.

    ``tool_predicate`` filters which tool names from ``expected.tool_call_args``
    this evaluator is responsible for. ``value_comparator`` decides whether
    an observed value matches an expected value for a single ``(key, value)``
    pair -- exact equality for the generic evaluator, DSL-normalized
    equality for the ``set_spans_filter``-specific evaluator.

    Matching is permissive in three ways:

    1. **Subset match per call.** Extra observed arg keys are ignored.
    2. **Any-of match across multiple calls.** If a tool fires multiple
       times in one turn, ANY call may satisfy the expectation.
    3. **Variant match across expected shapes.** If the dataset declares a
       list of acceptable arg dicts for a tool, ANY variant passing is
       enough. See :func:`_expected_arg_variants`.
    """
    expected_args_by_tool = _expected_tool_call_args(expected)
    observed_calls = tool_calls_from_output(output)
    failures: dict[str, Any] = {}

    for tool_name, expected_for_tool in expected_args_by_tool.items():
        if not isinstance(tool_name, str):
            continue
        if not tool_predicate(tool_name):
            continue
        variants = _expected_arg_variants(expected_for_tool)
        if not variants:
            continue
        matching_calls = [call for call in observed_calls if _tool_name(call) == tool_name]
        if not matching_calls:
            failures[tool_name] = {"reason": "tool was not called"}
            continue
        # Pass if ANY (variant, call) pair satisfies the subset check.
        if any(
            all(
                value_comparator(_tool_args(call).get(key), value) for key, value in variant.items()
            )
            for variant in variants
            for call in matching_calls
        ):
            continue
        failures[tool_name] = {
            "expected": ([dict(v) for v in variants] if len(variants) > 1 else dict(variants[0])),
            "observed": [dict(_tool_args(call)) for call in matching_calls],
        }

    if failures:
        return _failure("Tool call arguments did not match expected values", metadata=failures)
    return _success()


def evaluate_tool_call_args(output: Any, expected: Any) -> dict[str, Any]:
    """Pure-Python implementation of :func:`tool_call_args_match`.

    Scoped to tools that do NOT have a specialized arg-match evaluator
    (see ``_TOOLS_WITH_SPECIALIZED_ARG_EVALUATORS``). Uses exact value
    comparison.
    """
    return _evaluate_args_for_tools(
        output,
        expected,
        tool_predicate=lambda name: name not in _TOOLS_WITH_SPECIALIZED_ARG_EVALUATORS,
        value_comparator=_values_match_exact,
    )


def evaluate_set_spans_filter_args(output: Any, expected: Any) -> dict[str, Any]:
    """Pure-Python implementation of :func:`set_spans_filter_args_match`.

    Scoped to the ``set_spans_filter`` tool only. Applies Phoenix span-filter
    DSL normalization to string values so semantically-equivalent
    ``condition`` rewrites (clause reordering under ``and`` or ``or``) match.
    """
    return _evaluate_args_for_tools(
        output,
        expected,
        tool_predicate=lambda name: name == "set_spans_filter",
        value_comparator=_values_match_with_dsl_normalization,
    )


@create_evaluator(name="tool_call_args_match", kind="code")
def tool_call_args_match(output: Any, expected: Any) -> dict[str, Any]:
    """Generic tool-call arg matcher with exact value comparison.

    The expected shape is
    ``expected.tool_call_args[tool_name] -> {key: value}`` (a single
    acceptable arg dict) OR ``... -> [{key: value}, ...]`` (a list of
    independently-acceptable variants). Three intentional permissive
    properties:

    - **Subset match.** A call passes the per-tool check when *all* expected
      ``(key, value)`` pairs are present; the observed call may carry extra
      arg keys that the dataset doesn't mention.
    - **Any-of match across multiple calls.** When a tool is called more
      than once in a single turn, the check passes if *any* of those calls
      satisfies the expected arg pairs.
    - **Variant match across expected shapes.** When the dataset declares a
      list of variants, ANY variant matching ANY observed call passes.

    Values are compared with ``==``. This evaluator skips tools that have
    their own specialized arg-match evaluator (e.g. ``set_spans_filter``)
    so that tool-specific semantic equivalence isn't undercut by a stricter
    exact-string check.
    """
    return evaluate_tool_call_args(output, expected)


@create_evaluator(name="set_spans_filter_args_match", kind="code")
def set_spans_filter_args_match(output: Any, expected: Any) -> dict[str, Any]:
    """Arg matcher specialized for the ``set_spans_filter`` tool.

    The Phoenix span-filter DSL has commutative boolean operators: clauses
    joined by ``and`` (or ``or``) are semantically equivalent regardless of
    order, and a model run can plausibly emit either order. This evaluator
    applies :func:`_normalize_arg_value` to both expected and observed
    values so clause reordering under a pure-``and`` or pure-``or``
    expression does not produce a spurious failure. Mixed ``and``/``or``
    expressions fall back to exact-string comparison because precedence
    matters and we don't parse the DSL here.

    Subset / any-of / variant semantics are identical to
    ``tool_call_args_match`` -- see that docstring for details. Scoped to
    the ``set_spans_filter`` tool only.
    """
    return evaluate_set_spans_filter_args(output, expected)

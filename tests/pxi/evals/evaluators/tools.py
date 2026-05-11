from __future__ import annotations

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
    return args if isinstance(args, dict) else {}


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
    """Make string values that look like ``and``-joined SQL conjunctions
    invariant to clause ordering.

    Phoenix tool arg values like ``"span_kind == 'LLM' and latency_ms >= 5000"``
    are semantically equivalent regardless of clause order. The evaluator
    compares strings exactly otherwise, so without normalization a model that
    emits the clauses in the opposite order from the dataset would silently
    fail. The normalization is intentionally narrow: only string values that
    contain `` and `` are split, trimmed, and returned as a frozenset.
    """
    if not isinstance(value, str) or " and " not in value:
        return value
    return frozenset(clause.strip() for clause in value.split(" and ") if clause.strip())


def evaluate_tool_call_args(output: Any, expected: Any) -> dict[str, Any]:
    """Pure-Python implementation of :func:`tool_call_args_match`.

    Exists separately so unit tests can call it without going through the
    :class:`phoenix.evals.Evaluator` wrapper produced by
    ``@create_evaluator``.
    """
    expected_args_by_tool = _expected_tool_call_args(expected)
    observed_calls = tool_calls_from_output(output)
    failures: dict[str, Any] = {}

    for tool_name, expected_args in expected_args_by_tool.items():
        if not isinstance(tool_name, str) or not isinstance(expected_args, dict):
            continue
        matching_calls = [call for call in observed_calls if _tool_name(call) == tool_name]
        if not matching_calls:
            failures[tool_name] = {"reason": "tool was not called"}
            continue
        if any(
            all(
                _normalize_arg_value(_tool_args(call).get(key)) == _normalize_arg_value(value)
                for key, value in expected_args.items()
            )
            for call in matching_calls
        ):
            continue
        failures[tool_name] = {
            "expected": dict(expected_args),
            "observed": [dict(_tool_args(call)) for call in matching_calls],
        }

    if failures:
        return _failure("Tool call arguments did not match expected values", metadata=failures)
    return _success()


@create_evaluator(name="tool_call_args_match", kind="code")
def tool_call_args_match(output: Any, expected: Any) -> dict[str, Any]:
    """Check that observed tool-call arguments match the dataset's expectations.

    The expected shape is ``expected.tool_call_args[tool_name] -> {key: value}``
    — at most one expected arg map per tool name. The match has two
    intentional permissive properties documented here so future readers and
    dataset authors aren't surprised:

    - **Subset match.** A call passes the per-tool check when *all* expected
      ``(key, value)`` pairs are present; the observed call may carry extra
      arg keys that the dataset doesn't mention.
    - **Any-of match across multiple calls.** When a tool is called more
      than once in a single turn, the check passes if *any* of those calls
      satisfies the expected arg pairs. The schema cannot express
      "expectation N for the Nth call to this tool"; if you need that,
      widen the schema before relying on multi-call ordering.

    String values are compared with :func:`_normalize_arg_value`, which
    treats `` and ``-joined conjunctions as order-independent. Other types
    are compared with ``==``.
    """
    return evaluate_tool_call_args(output, expected)

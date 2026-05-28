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


def _expected_documentation_tools(expected: Any) -> list[str]:
    configured = _expected_tools(expected).get(
        "documentation_any",
        ["search_phoenix", "query_docs_filesystem_phoenix"],
    )
    if not isinstance(configured, list):
        return []
    return [name for name in configured if isinstance(name, str) and name]


def _expected_tool_call_args(expected: Any) -> dict[str, Any]:
    return _as_dict(_as_dict(expected).get("tool_call_args", {}))


def _expected_budgets(expected: Any) -> dict[str, Any]:
    return _as_dict(_as_dict(expected).get("budgets", {}))


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


def evaluate_tool_call_count(output: Any, expected: Any) -> dict[str, Any]:
    """Evaluate the number of tool calls against ``expected.budgets.max_tool_calls``.

    Missing budget expectations pass so the evaluator can be enabled for a
    whole dataset while only scoring examples that opt into a budget.
    """
    max_tool_calls = _expected_budgets(expected).get("max_tool_calls")
    if max_tool_calls is None:
        return _success()
    if not isinstance(max_tool_calls, int) or max_tool_calls < 0:
        return _failure(
            "Expected budgets.max_tool_calls must be a non-negative integer",
            metadata={"max_tool_calls": max_tool_calls},
        )

    observed_names = [
        name for call in tool_calls_from_output(output) if (name := _tool_name(call)) is not None
    ]
    if len(observed_names) <= max_tool_calls:
        return _success()
    return _failure(
        f"Expected at most {max_tool_calls} tool calls, observed {len(observed_names)}",
        metadata={"observed_tools": observed_names, "max_tool_calls": max_tool_calls},
    )


@create_evaluator(name="correct_tools_called", kind="code")
def correct_tools_called(output: Any, expected: Any) -> dict[str, Any]:
    """Phoenix evaluator entrypoint for tool-selection correctness.

    Delegates to :func:`evaluate_tools_called`; see that function for label
    semantics and precedence. Strictness is read from
    ``expected.tools.exact_match`` so it can be controlled per-example via
    the dataset YAML.
    """
    return evaluate_tools_called(output, expected)


def evaluate_documentation_tools_used(output: Any, expected: Any) -> dict[str, Any]:
    """Evaluate whether the PXI agent used at least one documentation tool."""
    expected_tools = _expected_documentation_tools(expected)
    observed = [
        name for call in tool_calls_from_output(output) if (name := _tool_name(call)) is not None
    ]
    observed_documentation = [name for name in observed if name in expected_tools]
    metadata = {
        "expected_any_documentation_tool": expected_tools,
        "observed_tools": observed,
        "observed_documentation_tools": observed_documentation,
    }
    if observed_documentation:
        return {
            "score": 1.0,
            "label": "pass",
            "metadata": metadata,
        }
    return {
        "score": 0.0,
        "label": "fail",
        "explanation": "No documentation tool was called.",
        "metadata": metadata,
    }


@create_evaluator(name="documentation_tools_used", kind="code")
def documentation_tools_used(output: Any, expected: Any) -> dict[str, Any]:
    return evaluate_documentation_tools_used(output, expected)


@create_evaluator(name="tool_call_count_within_limit", kind="code")
def tool_call_count_within_limit(output: Any, expected: Any) -> dict[str, Any]:
    """Phoenix evaluator entrypoint for per-example tool-call budgets."""
    return evaluate_tool_call_count(output, expected)


def _string_list(value: Any) -> list[str] | None:
    if value is None:
        return []
    if isinstance(value, list) and all(isinstance(item, str) for item in value):
        return value
    return None


def _bash_commands(output: Any) -> list[str]:
    commands: list[str] = []
    for call in tool_calls_from_output(output):
        if _tool_name(call) != "bash":
            continue
        command = _tool_args(call).get("command")
        if isinstance(command, str):
            commands.append(command)
    return commands


def _bash_command_expectations(expected: Any) -> list[dict[str, Any]] | None:
    raw = _as_dict(expected).get("bash_command")
    if raw is None:
        return []
    if isinstance(raw, dict):
        return [raw]
    if isinstance(raw, list) and all(isinstance(item, dict) for item in raw):
        return raw
    return None


def evaluate_bash_command_substrings(output: Any, expected: Any) -> dict[str, Any]:
    """Match bash commands by required and forbidden substrings.

    The expectation can be either a single object or a list of acceptable
    variants:

    ``expected.bash_command: {contains: [...], not_contains: [...]}``

    A run passes if any observed bash command satisfies any variant. This is
    intentionally coarser than exact command matching because command flags,
    quoting, and JSON tooling are legitimate implementation details.
    """
    variants = _bash_command_expectations(expected)
    if variants is None:
        return _failure("Expected bash_command must be an object or list of objects")
    if not variants:
        return _success()

    malformed: list[dict[str, Any]] = []
    normalized_variants: list[dict[str, list[str]]] = []
    for index, variant in enumerate(variants):
        contains = _string_list(variant.get("contains"))
        not_contains = _string_list(variant.get("not_contains"))
        if contains is None or not_contains is None:
            malformed.append({"index": index, "variant": variant})
            continue
        normalized_variants.append({"contains": contains, "not_contains": not_contains})
    if malformed:
        return _failure(
            "Expected bash_command contains/not_contains must be lists of strings",
            metadata={"malformed": malformed},
        )

    commands = _bash_commands(output)
    if not commands:
        return _failure("Expected a bash tool call, observed none")

    for command in commands:
        for variant in normalized_variants:
            if all(text in command for text in variant["contains"]) and not any(
                text in command for text in variant["not_contains"]
            ):
                return _success()
    return _failure(
        "No bash command matched expected substrings",
        metadata={"observed_commands": commands, "expected_variants": normalized_variants},
    )


@create_evaluator(name="bash_command_substrings_match", kind="code")
def bash_command_substrings_match(output: Any, expected: Any) -> dict[str, Any]:
    """Phoenix evaluator entrypoint for coarse bash command-shape matching."""
    return evaluate_bash_command_substrings(output, expected)


# Matcher vocabulary recognized inside ``expected.tool_call_args[tool][key]``.
# When the expected value is a dict whose top-level keys are ALL in this set,
# it's treated as a matcher object instead of a literal; otherwise the dict is
# compared by equality (so a tool that legitimately takes a dict-shaped arg
# whose keys overlap a matcher name still works, as long as some non-matcher
# key is present).
#
# Matchers (any may combine in one matcher dict; all must pass):
# - ``equals: <value>`` -- explicit equality, same as a bare literal.
# - ``contains_all: [<substr>, ...]`` -- observed must be a string containing
#   every substring. The primary tool for asserting clause membership in
#   commutative DSL expressions ("filter mentions ``start_time`` AND
#   ``2026-04-03``") without pinning clause order.
# - ``contains_any: [<substr>, ...]`` -- observed must be a string containing
#   at least one substring. Useful when several phrasings are acceptable.
# - ``not_contains: [<substr>, ...]`` -- observed must be a string containing
#   none of the substrings.
# - ``any: true`` -- the key must be present in observed args; value is free.
# - ``non_empty: true`` -- the key must be present and contain non-whitespace text.
# - ``absent: true`` -- the key must not be present in observed args.
# - ``empty_or_absent: true`` -- the key is omitted OR present as an empty
#   collection (``[]``, ``""``, ``{}``). Use for args where omitting and
#   passing an empty value are semantically equivalent, e.g. ``tags`` (the save
#   tool treats an omitted ``tags`` and ``tags: []`` identically), so the agent
#   may legitimately produce either form.
# - ``has_keys: [<key>, ...]`` -- observed must be a dict containing every
#   listed key (presence only -- values are not checked, and nesting below the
#   top level is not inspected). For object-valued args where the agent fills
#   in free-form values but the set of keys is the contract, e.g. an experiment
#   ``metadata`` object that must carry ``observations`` while preserving the
#   scaffold keys an earlier write left behind.
_MATCHER_KEYS: frozenset[str] = frozenset(
    {
        "equals",
        "contains_all",
        "contains_any",
        "not_contains",
        "any",
        "non_empty",
        "absent",
        "empty_or_absent",
        "has_keys",
    }
)
# Sentinel meaning "the key was not present at all in the observed call args."
# Distinct from a literal ``None`` value so the ``any`` matcher (presence-only
# check) can tell absence from a key whose value happens to be ``None``.
_MISSING: Any = object()


def _is_matcher_dict(value: Any) -> bool:
    return (
        isinstance(value, dict)
        and bool(value)
        and all(isinstance(k, str) and k in _MATCHER_KEYS for k in value)
    )


def _string_list_or_none(value: Any) -> list[str] | None:
    """Return ``value`` if it's a list of strings, else ``None`` for schema errors."""
    if isinstance(value, list) and all(isinstance(item, str) for item in value):
        return value
    return None


def _matcher_value_error(matcher: dict[str, Any]) -> str | None:
    """Validate a matcher dict; return an error string if malformed."""
    if "any" in matcher and matcher["any"] is not True:
        return "matcher 'any' must be true"
    if "non_empty" in matcher and matcher["non_empty"] is not True:
        return "matcher 'non_empty' must be true"
    if "absent" in matcher:
        if matcher["absent"] is not True:
            return "matcher 'absent' must be true"
        if len(matcher) > 1:
            return "matcher 'absent' cannot be combined with other matchers"
    if "empty_or_absent" in matcher:
        if matcher["empty_or_absent"] is not True:
            return "matcher 'empty_or_absent' must be true"
        if len(matcher) > 1:
            return "matcher 'empty_or_absent' cannot be combined with other matchers"
    for key in ("contains_all", "contains_any", "not_contains", "has_keys"):
        if key in matcher and _string_list_or_none(matcher[key]) is None:
            return f"matcher {key!r} must be a list of strings"
    return None


def _matcher_passes(observed: Any, matcher: dict[str, Any]) -> bool:
    """Apply a matcher dict to one observed value. Caller has already
    validated the matcher with :func:`_matcher_value_error`.

    ``observed`` is the literal value pulled from the call's args, or the
    ``_MISSING`` sentinel if the key wasn't present at all.
    """
    if "any" in matcher:
        if observed is _MISSING:
            return False
        # All other matcher keys still apply if combined with ``any``.
    if "absent" in matcher:
        return observed is _MISSING
    if "empty_or_absent" in matcher:
        return observed is _MISSING or (
            isinstance(observed, (list, str, dict)) and len(observed) == 0
        )
    if "non_empty" in matcher:
        if not isinstance(observed, str) or not observed.strip():
            return False
    if "equals" in matcher and observed != matcher["equals"]:
        return False
    if "has_keys" in matcher:
        if not isinstance(observed, dict):
            return False
        if not all(wanted in observed for wanted in matcher["has_keys"]):
            return False
    if "contains_all" in matcher:
        if not isinstance(observed, str):
            return False
        if not all(needle in observed for needle in matcher["contains_all"]):
            return False
    if "contains_any" in matcher:
        if not isinstance(observed, str):
            return False
        if not any(needle in observed for needle in matcher["contains_any"]):
            return False
    if "not_contains" in matcher:
        if not isinstance(observed, str):
            return False
        if any(needle in observed for needle in matcher["not_contains"]):
            return False
    return True


def _pair_passes(observed_args: dict[str, Any], key: str, expected_value: Any) -> bool:
    """Check one ``(key, expected_value)`` pair against a call's observed args.

    Literal values (strings, numbers, lists, non-matcher dicts) use equality;
    matcher dicts use :func:`_matcher_passes` and can express
    presence-only / substring / negation semantics on string args.
    """
    if _is_matcher_dict(expected_value):
        observed = observed_args[key] if key in observed_args else _MISSING
        return _matcher_passes(observed, expected_value)
    return bool(observed_args.get(key) == expected_value)


def _matcher_validation_failures(variants: list[dict[str, Any]]) -> dict[str, str]:
    """Return ``{key: error_message}`` for any malformed matcher in ``variants``.

    Empty dict means all matcher dicts in the expected variants are well-formed.
    """
    failures: dict[str, str] = {}
    for variant in variants:
        for key, expected_value in variant.items():
            if _is_matcher_dict(expected_value):
                reason = _matcher_value_error(expected_value)
                if reason:
                    failures[key] = reason
    return failures


def _expected_arg_variants(expected_for_tool: Any) -> list[dict[str, Any]]:
    """Return the list of acceptable arg dicts for one tool.

    The dataset schema for ``expected.tool_call_args[<tool>]`` accepts either:

    - a single dict ``{key: value, ...}`` (the default form), OR
    - a list of dicts -- each entry is an independently-acceptable
      arg shape; the observed call passes if it satisfies ANY variant.

    Variants exist for genuinely-ambiguous queries where more than one
    set of arguments is a reasonable agent choice (e.g. "show me recent
    traces" could resolve to ``1h``, ``1d``, ``7d``, etc.).
    """
    if isinstance(expected_for_tool, dict):
        return [expected_for_tool]
    if isinstance(expected_for_tool, list):
        return expected_for_tool
    return []


def _invalid_arg_expectation_reason(expected_for_tool: Any) -> str | None:
    """Return a schema error for malformed per-tool arg expectations."""
    if isinstance(expected_for_tool, dict):
        return None
    if isinstance(expected_for_tool, list):
        if not expected_for_tool:
            return "expected arg variants must be a non-empty list of objects"
        invalid_indices = [
            str(index) for index, item in enumerate(expected_for_tool) if not isinstance(item, dict)
        ]
        if invalid_indices:
            return f"expected arg variants must all be objects; invalid indices: {', '.join(invalid_indices)}"
        return None
    return "expected tool arguments must be an object or a non-empty list of objects"


def evaluate_tool_call_args(output: Any, expected: Any) -> dict[str, Any]:
    """Pure-Python implementation of :func:`tool_call_args_match`.

    Iterates each ``(tool_name, expected_args)`` pair in
    ``expected.tool_call_args`` and checks at least one observed call to that
    tool satisfies one of the acceptable arg variants. Per-pair semantics are
    delegated to :func:`_pair_passes` so literal values use equality and
    matcher dicts (``contains_all``, ``any``, etc.) use matcher semantics.

    Matching is permissive in three ways:

    1. **Subset match per call.** Extra observed arg keys are ignored.
    2. **Any-of match across multiple calls.** If a tool fires multiple times
       in one turn, ANY call may satisfy the expectation.
    3. **Variant match across expected shapes.** If the dataset declares a
       list of acceptable arg dicts for a tool, ANY variant passing is enough.
    """
    expected_args_by_tool = _expected_tool_call_args(expected)
    observed_calls = tool_calls_from_output(output)
    failures: dict[str, Any] = {}

    for tool_name, expected_for_tool in expected_args_by_tool.items():
        if not isinstance(tool_name, str):
            continue
        invalid_reason = _invalid_arg_expectation_reason(expected_for_tool)
        if invalid_reason:
            failures[tool_name] = {
                "reason": invalid_reason,
                "expected": expected_for_tool,
            }
            continue
        variants = _expected_arg_variants(expected_for_tool)
        matcher_errors = _matcher_validation_failures(variants)
        if matcher_errors:
            failures[tool_name] = {
                "reason": "expected arg matcher is malformed",
                "matcher_errors": matcher_errors,
            }
            continue
        matching_calls = [call for call in observed_calls if _tool_name(call) == tool_name]
        if not matching_calls:
            failures[tool_name] = {"reason": "tool was not called"}
            continue
        # Pass if ANY (variant, call) pair satisfies the subset check.
        if any(
            all(_pair_passes(_tool_args(call), key, value) for key, value in variant.items())
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


def evaluate_forbidden_tool_call_args(output: Any, expected: Any) -> dict[str, Any]:
    """Fail if any observed tool call matches a forbidden tool+args combination.

    Reads ``expected.forbidden_tool_call_args[tool_name] -> {key: value}``.
    For each listed tool, fails if ANY observed call to that tool has ALL the
    specified key-value pairs in its args (subset match, same as
    :func:`evaluate_tool_call_args`). Passes vacuously when the section is
    absent or empty.

    This is the inverse of :func:`evaluate_tool_call_args`: instead of
    asserting a call DID happen with certain args, it asserts a call did NOT.
    The primary use case is checking that a specific skill was not triggered --
    e.g. ``forbidden_tool_call_args: {load_skill: {skill_name: debug-trace}}``
    -- without forbidding *all* ``load_skill`` calls (the agent may legitimately
    load a different skill in the same turn).
    """
    forbidden_args_by_tool = _as_dict(_as_dict(expected).get("forbidden_tool_call_args", {}))
    if not forbidden_args_by_tool:
        return _success()

    observed_calls = tool_calls_from_output(output)
    violations: dict[str, Any] = {}

    for tool_name, forbidden_for_tool in forbidden_args_by_tool.items():
        if not isinstance(tool_name, str):
            continue
        if not isinstance(forbidden_for_tool, dict):
            violations[tool_name] = {
                "reason": "forbidden_tool_call_args entry must be an object",
                "value": forbidden_for_tool,
            }
            continue
        matching_calls = [call for call in observed_calls if _tool_name(call) == tool_name]
        for call in matching_calls:
            call_args = _tool_args(call)
            if all(
                _pair_passes(call_args, key, value) for key, value in forbidden_for_tool.items()
            ):
                violations[tool_name] = {
                    "forbidden_args": dict(forbidden_for_tool),
                    "observed_args": dict(call_args),
                }
                break

    if violations:
        return _failure(
            "Forbidden tool+args combination was called",
            metadata={"violations": violations},
        )
    return _success()


@create_evaluator(name="forbidden_tool_call_args_match", kind="code")
def forbidden_tool_call_args_match(output: Any, expected: Any) -> dict[str, Any]:
    """Evaluator entrypoint: assert a specific tool+args combination was NOT called.

    Reads ``expected.forbidden_tool_call_args[tool_name] -> {key: value}``.
    Fails if any observed call to the named tool matches ALL specified arg
    pairs. Passes vacuously when the section is absent.

    Use this instead of (or alongside) ``expected.tools.forbidden`` when the
    tool may legitimately be called with *different* args in the same turn --
    the canonical case being ``load_skill``, which can be called for multiple
    skills and where only one specific ``skill_name`` value should be
    forbidden.

    See :func:`evaluate_forbidden_tool_call_args` for full semantics.
    """
    return evaluate_forbidden_tool_call_args(output, expected)


@create_evaluator(name="tool_call_args_match", kind="code")
def tool_call_args_match(output: Any, expected: Any) -> dict[str, Any]:
    """Generic tool-call arg matcher used by every PXI dataset.

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

    Per-value semantics:

    - Literal values compare with ``==``.
    - A dict whose top-level keys are all in the matcher vocabulary
      (``equals``, ``contains_all``, ``contains_any``, ``not_contains``,
      ``any``, ``non_empty``, ``absent``, ``empty_or_absent``, ``has_keys``) is
      treated as a matcher object. Matchers cover the cases where exact equality
      is too strict -- commutative DSL clauses ("filter must mention both
      ``start_time`` and ``2026-04-03`` in any order"), free-form values
      (``{any: true}`` asserts presence only), required string content
      (``{non_empty: true}`` rejects blank text), absent values
      (``{absent: true}`` asserts the key was omitted), omitted-or-empty values
      (``{empty_or_absent: true}`` accepts a missing key or an empty
      collection), negative constraints (``not_contains``), and required keys on
      an object-valued arg (``{has_keys: [...]}`` asserts a dict carries every
      listed key without pinning its values).
    """
    return evaluate_tool_call_args(output, expected)

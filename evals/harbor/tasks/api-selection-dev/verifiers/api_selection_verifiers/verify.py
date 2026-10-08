"""Grade an api-selection task reply and score which Phoenix surface the agent used.

Usage inside a task verifier::

    python -m api_selection_verifiers.verify --expected /tests/expected.json

``expected.json`` holds the ``exact`` or ``reference`` key that
:mod:`harbor_verifiers.verify` grades, plus ``expected_api``: ``"sql"`` for a question
written to be answered through the ``executeSql`` tool and ``"http"`` for one written for
the REST or GraphQL APIs. The surfaces the agent reached (see
:mod:`harbor_verifiers.tool_usage`) and ``api_selection_correct`` ride along in
``reward.json`` beside ``reward`` without changing the pass or fail verdict.
"""

from __future__ import annotations

import json

from harbor_verifiers import tool_usage, verify

EXPECTED_APIS = frozenset({"sql", "http"})


def api_selection_correct(expected_api: str, usage: dict[str, float]) -> float:
    """1.0 when the agent used SQL exactly if the task expected SQL.

    A SQL task is answered correctly through SQL alone; touching SQL on an HTTP task
    counts as the wrong choice even if the answer came from REST in the end.
    """
    if expected_api not in EXPECTED_APIS:
        raise ValueError(
            f"expected_api must be one of {sorted(EXPECTED_APIS)}, not {expected_api!r}"
        )
    return 1.0 if bool(usage.get("used_sql")) == (expected_api == "sql") else 0.0


def main(argv: list[str] | None = None) -> None:
    args = verify.parse_args(argv)
    expected = json.loads(args.expected.read_text())
    usage = tool_usage.surface_usage(verify.read_trajectory(args.trajectory))
    usage["api_selection_correct"] = api_selection_correct(expected.get("expected_api"), usage)
    verify.grade(args, expected, **usage)


if __name__ == "__main__":
    main()

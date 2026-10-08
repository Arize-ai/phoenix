"""Grade an api-selection task reply and score which Phoenix surface the agent used.

Usage inside a task verifier::

    python -m api_selection_verifiers.verify --expected /tests/expected.json

``expected.json`` holds the ``reference`` answer and ``notes`` for the LLM judge, plus
``expected_api``: ``"sql"`` for a question written to be answered through the
``executeSql`` tool and ``"http"`` for one written for the REST or GraphQL APIs. The
surfaces the agent reached and ``api_selection_correct`` ride along in ``reward.json``
beside ``reward`` without changing the pass or fail verdict.
"""

from __future__ import annotations

import json
from typing import Any

from api_selection_verifiers import tool_usage
from harbor_verifiers import verify

EXPECTED_APIS = frozenset({"sql", "http"})


def api_selection_correct(expected_api: str, usage: dict[str, float]) -> float:
    """Touching SQL on an HTTP task is the wrong choice even if REST gave the answer."""
    if expected_api not in EXPECTED_APIS:
        raise ValueError(
            f"expected_api must be one of {sorted(EXPECTED_APIS)}, not {expected_api!r}"
        )
    return 1.0 if bool(usage.get("used_sql")) == (expected_api == "sql") else 0.0


def main(argv: list[str] | None = None) -> None:
    args = verify.parse_args(argv)
    expected = json.loads(args.expected.read_text())
    trajectory = verify.load_trajectory(args.trajectory)
    # An oracle run has no trajectory: its solution script wrote the answer file and
    # queried through HTTP, so it counts as the HTTP choice.
    reply = (
        verify.get_final_reply(trajectory) if trajectory is not None else args.answer.read_text()
    )
    reward, reason = verify.check_reference(
        reply, str(expected["reference"]), notes=str(expected.get("notes", ""))
    )
    usage: dict[str, Any] = tool_usage.surface_usage(trajectory)
    usage["api_selection_correct"] = api_selection_correct(expected["expected_api"], usage)
    scores = verify.write_reward(
        reward, trajectory_path=args.trajectory, reward_path=args.reward_file, **usage
    )
    print(
        json.dumps({"reply": reply[:500], "expected": expected, "reason": reason, "scores": scores})
    )


if __name__ == "__main__":
    main()

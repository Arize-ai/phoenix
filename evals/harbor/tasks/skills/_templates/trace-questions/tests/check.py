"""Grade `/app/answer.json` against the errored traces in the `support-bot` project.

The verifier computes the answer from Phoenix instead of storing it, so the task keeps
working when the fixture changes.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from harbor_verifiers import phoenix_api, skills
from harbor_verifiers.verify import read_trajectory, write_reward

ANSWER = Path("/app/answer.json")
EXPECTED = json.loads(Path("/tests/expected.json").read_text())
PROJECT = "support-bot"


def truth() -> dict[str, Any]:
    """Returns the errored trace count and the exception types on the errored roots."""
    roots = [s for s in phoenix_api.project_spans(PROJECT) if not s.get("parent_id")]
    errored = [s for s in roots if s["status_code"] == "ERROR"]
    types = {
        str(event["attributes"]["exception.type"]).rsplit(".", 1)[-1]
        for span in errored
        for event in span.get("events") or []
        if "exception.type" in (event.get("attributes") or {})
    }
    return {"error_trace_count": len(errored), "error_types": sorted(types)}


def grade(answer: dict[str, Any], expected: dict[str, Any]) -> dict[str, bool]:
    error_type = str(answer.get("error_type", "")).lower()
    return {
        "count_matches": answer.get("error_trace_count") == expected["error_trace_count"],
        "type_matches": any(t.lower() in error_type for t in expected["error_types"]),
    }


def main() -> None:
    expected = truth()
    try:
        answer = json.loads(ANSWER.read_text())
    except (OSError, json.JSONDecodeError) as error:
        answer, checks = {"error": str(error)}, {"answer_readable": False}
    else:
        checks = grade(answer, expected)
    loaded = skills.loaded_skills(read_trajectory(Path("/logs/agent/trajectory.json")))
    details = {"answer": answer, "expected": expected, "checks": checks}
    scores = write_reward(
        float(all(checks.values())),
        details,
        loaded_skills=loaded,
        **skills.skill_scores(loaded, EXPECTED),
    )
    print(json.dumps({**details, "scores": scores}))


if __name__ == "__main__":
    main()

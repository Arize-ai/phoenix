"""Grade an answer file and write Harbor's ``reward.json``.

Usage inside a task verifier::

    PYTHONPATH=/opt/verifier /opt/verifier/bin/python -m evals.harbor.lib.grade \
        --expected /tests/expected.json

Expected specs support ``integer``, ``number``, ``name``, normalized ``exact``,
and recursive ``all`` checks. A value list accepts any entry unless
``require_all`` is set. State verifiers can call :func:`write_reward` directly.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

from evals.harbor.lib import answers, atif

ANSWER_PATH = Path("/workspace/answer.txt")
TRAJECTORY_PATH = Path("/logs/agent/trajectory.json")
REWARD_PATH = Path("/logs/verifier/reward.json")


def grade_answer(text: str, expected: dict[str, Any]) -> bool:
    kind = expected.get("kind")
    raw = expected.get("value")
    values = [value for value in (raw if isinstance(raw, list) else [raw]) if value is not None]
    combine = all if expected.get("require_all") else any
    if kind == "all":
        return bool(expected["checks"]) and all(
            grade_answer(text, check) for check in expected["checks"]
        )
    if kind == "integer":
        return bool(values) and combine(answers.match_integer(text, int(value)) for value in values)
    if kind == "number":
        places = int(expected.get("places", 2))
        return bool(values) and combine(
            answers.match_number(text, value, places) for value in values
        )
    if kind == "name":
        return answers.match_name(
            text,
            expected["aliases"],
            require_all=bool(expected.get("require_all", False)),
            allow_hedging=bool(expected.get("allow_hedging", False)),
        )
    if kind == "exact":
        return bool(values) and any(answers.match_exact(text, str(value)) for value in values)
    raise ValueError(f"Unknown expected kind: {kind!r}")


def write_reward(
    reward: float,
    *,
    trajectory_path: Path = TRAJECTORY_PATH,
    reward_path: Path = REWARD_PATH,
    **extra: float,
) -> dict[str, float]:
    """Write the reward, ATIF measurements, and extra scores."""
    scores: dict[str, float] = {"reward": float(reward)}
    scores.update(atif.measurements(atif.read_trajectory(trajectory_path)))
    scores.update({key: float(value) for key, value in extra.items()})
    reward_path.parent.mkdir(parents=True, exist_ok=True)
    reward_path.write_text(json.dumps(scores))
    return scores


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument("--expected", type=Path, required=True)
    parser.add_argument("--answer", type=Path, default=ANSWER_PATH)
    parser.add_argument("--trajectory", type=Path, default=TRAJECTORY_PATH)
    parser.add_argument("--reward-file", type=Path, default=REWARD_PATH)
    args = parser.parse_args(argv)
    expected = json.loads(args.expected.read_text())
    try:
        text = args.answer.read_text()
    except OSError:
        text = ""
    passed = grade_answer(text, expected)
    scores = write_reward(
        float(passed), trajectory_path=args.trajectory, reward_path=args.reward_file
    )
    print(json.dumps({"answer": answers.plain(text)[:500], "expected": expected, "scores": scores}))


if __name__ == "__main__":
    main()

"""Grade a task reply and write Harbor's ``reward.json`` file.

Usage inside a task verifier::

    PYTHONPATH=/opt/verifier python -m evals.harbor.verifiers.verify --expected /tests/expected.json

The verifier grades the last agent message in the ATIF trajectory at
``/logs/agent/trajectory.json``. An oracle run has no trajectory because it runs a
solution script instead of an agent. In that case, the verifier reads the answer from
``/app/answer.txt``.

Use ``{"exact": "ok"}`` in ``expected.json`` to compare normalized strings. The
normalization removes emphasis, extra whitespace, and final punctuation and ignores
letter case. Use ``{"reference": "117 traces", "notes": "..."}`` to ask the LLM judge
in :mod:`evals.harbor.verifiers.llm_judge` whether the reply gives the reference answer.
State verifiers can call :func:`write_reward` to record their own reward and include the
trajectory measurements.
"""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from typing import Any, Literal

from phoenix.evals.metrics import exact_match

ANSWER_PATH = Path("/app/answer.txt")
TRAJECTORY_PATH = Path("/logs/agent/trajectory.json")
REWARD_PATH = Path("/logs/verifier/reward.json")

_MARKUP = re.compile(r"[*`_]")

ReplySource = Literal["trajectory", "answer_file"]


def read_trajectory(path: Path) -> dict[str, Any] | None:
    try:
        value = json.loads(path.read_text())
    except (OSError, ValueError):
        return None
    return value if isinstance(value, dict) else None


def agent_steps(trajectory: dict[str, Any] | None) -> list[dict[str, Any]]:
    if not isinstance(trajectory, dict) or not isinstance(trajectory.get("steps"), list):
        return []
    return [
        step
        for step in trajectory["steps"]
        if isinstance(step, dict)
        and step.get("source") == "agent"
        and not step.get("is_copied_context")
    ]


def final_reply(trajectory: dict[str, Any] | None) -> str:
    for step in reversed(agent_steps(trajectory)):
        message = step.get("message")
        if isinstance(message, str) and message.strip():
            return message
        if isinstance(message, list):
            text = "\n".join(
                str(part.get("text", ""))
                for part in message
                if isinstance(part, dict) and part.get("type") == "text"
            )
            if text.strip():
                return text
    return ""


def measurements(trajectory: dict[str, Any] | None) -> dict[str, float]:
    """Count tool calls and agent turns, excluding copied context."""
    steps = agent_steps(trajectory)
    if not steps:
        return {}
    tool_calls = sum(len(step.get("tool_calls") or []) for step in steps)
    return {"tool_call_count": float(tool_calls), "agent_turn_count": float(len(steps))}


def read_reply(trajectory_path: Path, answer_path: Path) -> tuple[str, ReplySource]:
    trajectory = read_trajectory(trajectory_path)
    if trajectory is not None:
        return final_reply(trajectory), "trajectory"
    try:
        return answer_path.read_text(), "answer_file"
    except OSError:
        return "", "answer_file"


def normalize(text: str) -> str:
    return " ".join(_MARKUP.sub("", text).split()).rstrip(".!").casefold()


def check(reply: str, expected: dict[str, Any]) -> tuple[float, str]:
    """Return the reward and explanation for a reply."""
    if "exact" in expected:
        scores = exact_match.evaluate(
            {"output": normalize(reply), "expected": normalize(str(expected["exact"]))}
        )
        return float(scores[0].score or 0.0), f"exact match against {expected['exact']!r}"
    if "reference" in expected:
        from evals.harbor.verifiers import llm_judge

        verdict = llm_judge.matches_reference(
            reply, str(expected["reference"]), notes=str(expected.get("notes", ""))
        )
        return float(verdict.score or 0.0), str(verdict.explanation or verdict.label)
    raise ValueError("expected.json needs an 'exact' or a 'reference' key")


def write_reward(
    reward: float,
    *,
    trajectory_path: Path = TRAJECTORY_PATH,
    reward_path: Path = REWARD_PATH,
    **extra: float,
) -> dict[str, float]:
    """Write the reward with trajectory measurements and extra scores."""
    scores: dict[str, float] = {"reward": float(reward)}
    scores.update(measurements(read_trajectory(trajectory_path)))
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
    reply, source = read_reply(args.trajectory, args.answer)
    reward, reason = check(reply, expected)
    scores = write_reward(reward, trajectory_path=args.trajectory, reward_path=args.reward_file)
    print(
        json.dumps(
            {
                "reply": reply[:500],
                "reply_source": source,
                "expected": expected,
                "reason": reason,
                "scores": scores,
            }
        )
    )


if __name__ == "__main__":
    main()

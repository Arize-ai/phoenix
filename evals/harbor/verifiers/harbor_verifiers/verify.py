"""Grade a task reply and write Harbor's ``reward.json`` file.

Usage inside a task verifier::

    python -m harbor_verifiers.verify --expected /tests/expected.json

The verifier grades the last agent message in the ATIF trajectory at
``/logs/agent/trajectory.json``. An oracle run has no trajectory because it runs a
solution script instead of an agent. In that case, the verifier reads the answer from
``/app/answer.txt``.

Use ``{"exact": "ok"}`` in ``expected.json`` to compare normalized strings. The
normalization removes emphasis, extra whitespace, and final punctuation and ignores
letter case. Use ``{"reference": "117 traces", "notes": "..."}`` to ask the LLM judge
in :mod:`harbor_verifiers.llm_judge` whether the reply gives the reference answer.
State verifiers can call :func:`write_reward` to record their own reward and include the
trajectory measurements. A dataset with its own grading composes the same helpers in its
own ``main``: :func:`load_trajectory`, :func:`get_final_reply`, :func:`check_exact` or
:func:`check_reference`, and :func:`write_reward`.
"""

from __future__ import annotations

import argparse
import json
import os
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable

from phoenix.evals.metrics import exact_match

ANSWER_PATH = Path("/app/answer.txt")
TRAJECTORY_PATH = Path(
    os.environ.get("PHOENIX_EVAL_TRAJECTORY_PATH", "/logs/agent/trajectory.json")
)
REWARD_PATH = Path(os.environ.get("PHOENIX_EVAL_REWARD_PATH", "/logs/verifier/reward.json"))

_MARKUP = re.compile(r"[*`_]")


def load_trajectory(path: Path) -> dict[str, Any] | None:
    """None when there is no trajectory, as in an oracle run; a file that is not an
    ATIF object is an error rather than a missing trajectory."""
    if not path.exists():
        return None
    value = json.loads(path.read_text())
    if not isinstance(value, dict):
        raise ValueError(f"{path} does not hold an ATIF trajectory object")
    return value


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


def tool_calls(trajectory: dict[str, Any] | None) -> Iterable[dict[str, Any]]:
    for step in agent_steps(trajectory):
        for call in step.get("tool_calls") or []:
            if isinstance(call, dict):
                yield call


def parse_timestamp(text: str) -> datetime:
    """An ISO 8601 instant as an aware UTC datetime; naive input is taken as UTC."""
    parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def started_at(trajectory: dict[str, Any] | None) -> datetime | None:
    """When this step's agent run began: the earliest step timestamp that is not copied
    context carried over from an earlier step."""
    if not isinstance(trajectory, dict) or not isinstance(trajectory.get("steps"), list):
        return None
    timestamps = [
        parse_timestamp(str(step["timestamp"]))
        for step in trajectory["steps"]
        if isinstance(step, dict) and step.get("timestamp") and not step.get("is_copied_context")
    ]
    return min(timestamps) if timestamps else None


def get_final_reply(trajectory: dict[str, Any] | None) -> str:
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
    return {"tool_count": float(len(list(tool_calls(trajectory)))), "turn_count": float(len(steps))}


def normalize(text: str) -> str:
    return " ".join(_MARKUP.sub("", text).split()).rstrip(".!").casefold()


def check_exact(reply: str, expected_answer: str) -> float:
    scores = exact_match.evaluate(
        {"output": normalize(reply), "expected": normalize(expected_answer)}
    )
    return float(scores[0].score or 0.0)


def check_reference(reply: str, reference: str, notes: str = "") -> tuple[float, str]:
    """Ask the LLM judge whether the reply gives the reference answer; returns the score
    and the judge's explanation."""
    from harbor_verifiers import llm_judge

    verdict = llm_judge.matches_reference(reply, reference, notes=notes)
    return float(verdict.score or 0.0), str(verdict.explanation or verdict.label)


def write_reward(
    reward: float,
    details: dict[str, Any] | None = None,
    *,
    trajectory_path: Path = TRAJECTORY_PATH,
    reward_path: Path = REWARD_PATH,
    **components: Any,
) -> dict[str, float]:
    """Harbor's reward file accepts numbers only. Harbor reports ``reward`` as the
    trial's score and tallies every other key on its own, and the Phoenix plugin
    records each key as a separate evaluation, so the trajectory measurements and
    any numeric diagnostics go there without affecting pass or fail. Other
    components join ``details`` in ``details.json`` beside it."""
    scores: dict[str, float] = {"reward": float(reward)}
    scores.update(measurements(load_trajectory(trajectory_path)))
    details = dict(details or {})
    for key, value in components.items():
        if isinstance(value, (bool, int, float)):
            scores[key] = float(value)
        else:
            details[key] = value
    reward_path.parent.mkdir(parents=True, exist_ok=True)
    reward_path.write_text(json.dumps(scores))
    if details:
        reward_path.with_name("details.json").write_text(json.dumps(details, indent=2, default=str))
    return scores


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument("--expected", type=Path, required=True)
    parser.add_argument("--answer", type=Path, default=ANSWER_PATH)
    parser.add_argument("--trajectory", type=Path, default=TRAJECTORY_PATH)
    parser.add_argument("--reward-file", type=Path, default=REWARD_PATH)
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> None:
    args = parse_args(argv)
    expected = json.loads(args.expected.read_text())
    trajectory = load_trajectory(args.trajectory)
    reply = get_final_reply(trajectory) if trajectory is not None else args.answer.read_text()
    if "exact" in expected:
        reward = check_exact(reply, str(expected["exact"]))
        reason = f"exact match against {expected['exact']!r}"
    elif "reference" in expected:
        reward, reason = check_reference(
            reply, str(expected["reference"]), notes=str(expected.get("notes", ""))
        )
    else:
        raise SystemExit("expected.json needs an 'exact' or a 'reference' key")
    scores = write_reward(reward, trajectory_path=args.trajectory, reward_path=args.reward_file)
    print(
        json.dumps({"reply": reply[:500], "expected": expected, "reason": reason, "scores": scores})
    )


if __name__ == "__main__":
    main()

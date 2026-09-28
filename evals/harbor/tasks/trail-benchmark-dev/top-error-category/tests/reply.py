"""Write the reply that the criteria in this directory grade to /logs/verifier/reply.txt.

An agent's reply is the last agent message in the ATIF trajectory at
/logs/agent/trajectory.json. An oracle run has no trajectory because it runs the
reference solution instead of an agent, and the solution writes /app/answer.txt.
test.sh runs this script before Reward Kit; Reward Kit also imports it while discovering
criteria, which registers nothing.
"""

import json
from pathlib import Path
from typing import Any

TRAJECTORY_PATH = Path("/logs/agent/trajectory.json")
ANSWER_PATH = Path("/app/answer.txt")
REPLY_PATH = Path("/logs/verifier/reply.txt")


def read_trajectory(path: Path) -> dict[str, Any] | None:
    try:
        value = json.loads(path.read_text())
    except (OSError, ValueError):
        return None
    return value if isinstance(value, dict) else None


def agent_steps(trajectory: dict[str, Any]) -> list[dict[str, Any]]:
    steps = trajectory.get("steps")
    if not isinstance(steps, list):
        return []
    return [
        step
        for step in steps
        if isinstance(step, dict)
        and step.get("source") == "agent"
        and not step.get("is_copied_context")
    ]


def message_text(message: Any) -> str:
    if isinstance(message, str):
        return message
    if isinstance(message, list):
        return "\n".join(
            str(part.get("text", ""))
            for part in message
            if isinstance(part, dict) and part.get("type") == "text"
        )
    return ""


def final_reply(trajectory: dict[str, Any]) -> str:
    for step in reversed(agent_steps(trajectory)):
        text = message_text(step.get("message"))
        if text.strip():
            return text
    return ""


def read_reply(
    trajectory_path: Path = TRAJECTORY_PATH, answer_path: Path = ANSWER_PATH
) -> tuple[str, Path | None]:
    """Return the reply and the file it came from."""
    trajectory = read_trajectory(trajectory_path)
    if trajectory is not None:
        return final_reply(trajectory), trajectory_path
    try:
        return answer_path.read_text(), answer_path
    except OSError:
        return "", None


def main() -> None:
    reply, source = read_reply()
    REPLY_PATH.parent.mkdir(parents=True, exist_ok=True)
    REPLY_PATH.write_text(reply)
    print(f"reply from {source or 'no trajectory or answer file'}: {reply[:500]!r}")


if __name__ == "__main__":
    main()

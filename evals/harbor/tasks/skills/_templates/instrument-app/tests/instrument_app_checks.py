"""Run the agent's instrumented bot and check the spans it sends to `support-bot-dev`.

The verifier starts the fake gateway, runs `python support_bot.py` in `/app`, and waits
for the spans. The reward is 1 only when every check passes:

- An LLM span records `llm.model_name`.
- A TOOL span records `tool.name`.
- Every root span has a `session.id`, and at least one session holds two traces.
- The bot still prints its answers.
"""

from __future__ import annotations

import json
import subprocess
import sys
import time
import urllib.request
from collections import Counter
from pathlib import Path
from typing import Any

from harbor_verifiers import phoenix_api, skills
from harbor_verifiers.verify import read_trajectory, write_reward

APP = Path("/app")
EXPECTED = json.loads(Path("/tests/expected.json").read_text())
PROJECT = "support-bot-dev"
GATEWAY = "http://127.0.0.1:8100"


def attribute(span: Any, key: str) -> Any:
    """Returns a span attribute whether the API sends it flat or nested."""
    attributes = span.get("attributes") or {}
    if key in attributes:
        return attributes[key]
    value: Any = attributes
    for part in key.split("."):
        if not isinstance(value, dict) or part not in value:
            return None
        value = value[part]
    return value


def start_gateway() -> subprocess.Popen[bytes]:
    gateway = subprocess.Popen([sys.executable, str(APP / "dev" / "fake_gateway.py")])
    for _ in range(30):
        try:
            urllib.request.urlopen(f"{GATEWAY}/healthz", timeout=2)
            return gateway
        except OSError:
            time.sleep(1)
    raise RuntimeError("The fake gateway did not start")


def project_spans() -> list[Any]:
    try:
        return list(phoenix_api.project_spans(PROJECT))
    except Exception:  # The project doesn't exist until the first span arrives.
        return []


def wait_for_spans() -> list[Any]:
    """Returns the project's spans once their count stops growing."""
    spans: list[Any] = []
    for _ in range(20):
        time.sleep(3)
        latest = project_spans()
        if latest and len(latest) == len(spans):
            return latest
        spans = latest
    return spans


def grade(spans: list[Any], stdout: str) -> dict[str, bool]:
    roots = [s for s in spans if not s.get("parent_id")]
    sessions = Counter(attribute(s, "session.id") for s in roots)
    return {
        "bot_answered": "A: " in stdout,
        "llm_span_has_model": any(
            s["span_kind"] == "LLM" and attribute(s, "llm.model_name") for s in spans
        ),
        "tool_span_has_name": any(
            s["span_kind"] == "TOOL" and attribute(s, "tool.name") for s in spans
        ),
        "every_trace_has_session": bool(roots) and None not in sessions,
        "session_spans_turns": any(n >= 2 for n in sessions.values()),
    }


def main() -> None:
    gateway = start_gateway()
    try:
        run = subprocess.run(
            [sys.executable, "support_bot.py"],
            cwd=APP,
            capture_output=True,
            text=True,
            timeout=180,
        )
    finally:
        gateway.terminate()
    spans = wait_for_spans()
    checks = grade(spans, run.stdout)
    loaded = skills.loaded_skills(read_trajectory(Path("/logs/agent/trajectory.json")))
    details = {
        "checks": checks,
        "span_count": len(spans),
        "exit_code": run.returncode,
        "stderr": run.stderr[-2000:],
    }
    components: dict[str, Any] = {"loaded_skills": loaded}
    components.update(skills.skill_scores(loaded, EXPECTED))
    scores = write_reward(
        float(all(checks.values())),
        details,
        **components,
    )
    print(json.dumps({**details, "scores": scores}))


if __name__ == "__main__":
    main()

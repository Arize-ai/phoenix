"""Run the agent's fixed `/app/error_traces.py` and compare its output with Phoenix.

The reward is 1 when the script exits with status 0 and its last line of output is JSON
whose `error_traces` equals the number of errored root spans in `support-bot`.
"""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path
from typing import Any

from harbor_verifiers import phoenix_api, skills
from harbor_verifiers.verify import read_trajectory, write_reward

SCRIPT = Path("/app/error_traces.py")
EXPECTED = json.loads(Path("/tests/expected.json").read_text())
PROJECT = "support-bot"


def error_traces() -> int:
    spans = phoenix_api.project_spans(PROJECT)
    return sum(1 for s in spans if not s.get("parent_id") and s["status_code"] == "ERROR")


def main() -> None:
    want = error_traces()
    details: dict[str, object] = {"expected_error_traces": want}
    reward = 0.0
    if SCRIPT.exists():
        run = subprocess.run(
            [sys.executable, str(SCRIPT)], cwd="/app", capture_output=True, text=True, timeout=120
        )
        details.update(
            exit_code=run.returncode, stdout=run.stdout[-1000:], stderr=run.stderr[-2000:]
        )
        lines = run.stdout.strip().splitlines()
        try:
            got = json.loads(lines[-1])["error_traces"] if lines else None
        except (json.JSONDecodeError, KeyError, TypeError):
            got = None
        details["error_traces"] = got
        reward = float(run.returncode == 0 and got == want)
    else:
        details["error"] = f"{SCRIPT} doesn't exist"
    loaded = skills.loaded_skills(read_trajectory(Path("/logs/agent/trajectory.json")))
    components: dict[str, Any] = {"loaded_skills": loaded}
    components.update(skills.skill_scores(loaded, EXPECTED))
    scores = write_reward(reward, details, **components)
    print(json.dumps({**details, "scores": scores}))


if __name__ == "__main__":
    main()

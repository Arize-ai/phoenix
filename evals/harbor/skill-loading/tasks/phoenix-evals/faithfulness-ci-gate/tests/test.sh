#!/bin/sh
# Scores which skills the agent loaded. Identical in every skill-loading task.
set -eu
exec python - <<'PY'
import json
from pathlib import Path

from harbor_verifiers import skills, verify

expected = json.loads(Path("/tests/expected.json").read_text())
loaded = skills.loaded_skills(verify.read_trajectory(verify.TRAJECTORY_PATH))
scores = skills.skill_scores(loaded, expected)
verify.write_reward(
    min(scores.values(), default=1.0),
    skill_loaded=float(expected["skill"] in loaded),
    loaded_skills=loaded,
    **scores,
)
print(json.dumps({"loaded_skills": loaded, "scores": scores}))
PY

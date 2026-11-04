#!/bin/sh
# Records every skill the agent loaded. Identical in every skill-loading task.
# reward is 1 when the agent loaded exactly the skills in skills_expected.
set -eu
exec python - <<'PY'
import json
from pathlib import Path

from harbor_verifiers import skills, verify

expected = json.loads(Path("/tests/expected.json").read_text())
loaded = skills.loaded_skills(verify.read_trajectory(verify.TRAJECTORY_PATH))
wanted = set(expected["skills_expected"])
extra = sorted(set(loaded) - wanted)
scores = verify.write_reward(
    float(wanted <= set(loaded) and not extra),
    expected_skills_loaded=float(wanted <= set(loaded)),
    no_unexpected_skills=float(not extra),
    skill_loaded=float(expected["skill"] in loaded),
    loaded_skills=loaded,
    unexpected_skills=extra,
)
print(json.dumps({"loaded_skills": loaded, "scores": scores}))
PY

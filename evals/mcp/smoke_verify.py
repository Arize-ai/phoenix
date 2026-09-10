"""Separate verifier entrypoint; only the trusted runner supplies judge output."""

import json
from pathlib import Path

from isolation import read_regular
from smoke_tasks import grade_review
from verify import grade_count

trusted = Path("/trusted")
# Harbor restores explicit artifacts to their original source paths in the
# separate verifier, not to the host-side destination directory.
answer = json.loads(read_regular(Path("/workspace"), "answer.json"))
reference_path = trusted / "reference.json"
grade = grade_review if reference_path.exists() else grade_count
scores = grade(
    answer,
    json.loads((reference_path if reference_path.exists() else trusted / "truth.json").read_text()),
    json.loads((trusted / "evidence.json").read_text()),
)
judge = json.loads((trusted / "judge.json").read_text())
if judge["available"]:
    scores["task_completeness"] = judge["numeric_rewards"]["task_completeness"]
Path("/logs/verifier/reward.json").write_text(json.dumps(scores))

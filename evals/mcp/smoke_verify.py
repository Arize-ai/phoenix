"""Separate verifier entrypoint; only the trusted runner supplies judge output."""

import json
from pathlib import Path

from smoke_tasks import grade_review
from verify import grade_count, read_answer


def verify(trusted: Path, workspace: Path) -> dict[str, float]:
    answer, _ = read_answer(workspace)
    reference_path = trusted / "reference.json"
    grade = grade_review if reference_path.exists() else grade_count
    scores = grade(
        answer,
        json.loads(
            (reference_path if reference_path.exists() else trusted / "truth.json").read_text()
        ),
        json.loads((trusted / "evidence.json").read_text()),
    )
    judge = json.loads((trusted / "judge.json").read_text())
    if judge["available"]:
        scores["task_completeness"] = judge["numeric_rewards"]["task_completeness"]
    measurements = trusted / "measurements.json"
    if measurements.exists():
        scores |= {
            key: float(value)
            for key, value in json.loads(measurements.read_text()).items()
            if value is not None
        }
    return scores


if __name__ == "__main__":
    scores = verify(Path("/trusted"), Path("/workspace"))
    Path("/logs/verifier/reward.json").write_text(json.dumps(scores))

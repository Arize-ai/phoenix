import json
from pathlib import Path

step_logs = Path("/logs/agent/steps/2")
answer_path = step_logs / "answer.json"
answer = json.loads(answer_path.read_text()) if answer_path.exists() else {}
truth = json.loads(Path("/data/ground_truth.json").read_text())["step2"]
# The answer's `pattern` sentence is deliberately unscored: keyword matching is
# too brittle to gate on, and it's a better fit for a follow-up LLM judge.
passed = set(answer.get("regressed_example_keys", [])) == set(truth["regressed_example_keys"])
metrics_path = step_logs / "metrics.json"
metrics = json.loads(metrics_path.read_text()) if metrics_path.exists() else {}
Path("/logs/verifier/reward.json").write_text(
    json.dumps({"reward": float(passed), "tool_calls": metrics.get("tool_calls", 0)})
)

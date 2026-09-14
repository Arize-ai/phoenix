import json
from pathlib import Path

step_logs = Path("/logs/agent/steps/3")
answer_path = step_logs / "answer.json"
answer = json.loads(answer_path.read_text()) if answer_path.exists() else {}
truth = json.loads(Path("/data/ground_truth.json").read_text())["step3"]
passed = answer.get("span_name") == truth["span_name"] and truth["exception_substring"] in str(
    answer.get("exception_message", "")
)
metrics_path = step_logs / "metrics.json"
metrics = json.loads(metrics_path.read_text()) if metrics_path.exists() else {}
Path("/logs/verifier/reward.json").write_text(
    json.dumps({"reward": float(passed), "tool_calls": metrics.get("tool_calls", 0)})
)

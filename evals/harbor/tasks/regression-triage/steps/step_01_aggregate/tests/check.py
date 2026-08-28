import json
from pathlib import Path

step_logs = Path("/logs/agent/steps/1")
answer_path = step_logs / "answer.json"
answer = json.loads(answer_path.read_text()) if answer_path.exists() else {}
truth = json.loads(Path("/data/ground_truth.json").read_text())["step1"]
means = answer.get("means", {})
passed = answer.get("lower_experiment") == truth["lower_experiment"] and all(
    abs(float(means.get(name, -1)) - value) <= 0.001 for name, value in truth["means"].items()
)
messages_path = step_logs / "new_messages.json"
messages = messages_path.read_text() if messages_path.exists() else ""
Path("/logs/verifier/reward.json").write_text(
    json.dumps({"reward": float(passed), "tool_calls": messages.count('"tool-call"')})
)

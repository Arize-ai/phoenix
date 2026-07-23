import json
from pathlib import Path

answer = json.loads(Path("/logs/agent/latest/answer.json").read_text())
truth = json.loads(Path("/data/ground_truth.json").read_text())["step1"]
means = answer.get("means", {})
passed = answer.get("lower_experiment") == truth["lower_experiment"] and all(
    abs(float(means.get(name, -1)) - value) <= 0.001 for name, value in truth["means"].items()
)
messages = Path("/logs/agent/latest/new_messages.json").read_text()
Path("/logs/verifier/reward.json").write_text(
    json.dumps({"reward": float(passed), "tool_calls": messages.count('"tool-call"')})
)

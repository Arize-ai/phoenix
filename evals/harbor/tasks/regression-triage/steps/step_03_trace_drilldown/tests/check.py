import json
from pathlib import Path

answer = json.loads(Path("/logs/agent/latest/answer.json").read_text())
truth = json.loads(Path("/data/ground_truth.json").read_text())["step3"]
passed = answer.get("span_name") == truth["span_name"] and truth["exception_substring"] in str(
    answer.get("exception_message", "")
)
messages = Path("/logs/agent/latest/new_messages.json").read_text()
Path("/logs/verifier/reward.json").write_text(
    json.dumps({"reward": float(passed), "tool_calls": messages.count('"tool-call"')})
)

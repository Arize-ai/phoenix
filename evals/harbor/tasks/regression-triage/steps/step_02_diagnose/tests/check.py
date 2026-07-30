import json
from pathlib import Path

answer = json.loads(Path("/logs/agent/latest/answer.json").read_text())
truth = json.loads(Path("/data/ground_truth.json").read_text())["step2"]
# The answer's `pattern` sentence is deliberately unscored: keyword matching is
# too brittle to gate on, and it's a better fit for a follow-up LLM judge.
passed = set(answer.get("regressed_example_keys", [])) == set(truth["regressed_example_keys"])
messages = Path("/logs/agent/latest/new_messages.json").read_text()
Path("/logs/verifier/reward.json").write_text(
    json.dumps({"reward": float(passed), "tool_calls": messages.count('"tool-call"')})
)

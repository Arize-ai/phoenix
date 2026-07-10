import json
from pathlib import Path

answer = json.loads(Path("/logs/agent/latest/answer.json").read_text())
truth = json.loads(Path("/data/ground_truth.json").read_text())["step2"]
ids = float(set(answer.get("regressed_example_keys", [])) == set(truth["regressed_example_keys"]))
pattern_text = str(answer.get("pattern", "")).casefold()
pattern = float(any(word.casefold() in pattern_text for word in truth["pattern_keywords"]))
messages = Path("/logs/agent/latest/messages.json").read_text()
Path("/logs/verifier/reward.json").write_text(
    json.dumps(
        {
            "reward": (ids + pattern) / 2,
            "ids": ids,
            "pattern": pattern,
            "tool_calls": messages.count('"tool-call"'),
        }
    )
)

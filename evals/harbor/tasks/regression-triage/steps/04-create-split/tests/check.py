import json
import sqlite3
from pathlib import Path

truth = json.loads(Path("/data/ground_truth.json").read_text())["step4"]
connection = sqlite3.connect("/data/phoenix.db")
rows = connection.execute(
    """SELECT ds.name, json_extract(der.metadata, '$.example_key') FROM dataset_splits ds JOIN dataset_splits_dataset_examples link ON link.dataset_split_id = ds.id JOIN dataset_examples de ON de.id = link.dataset_example_id JOIN dataset_example_revisions der ON der.dataset_example_id = de.id JOIN datasets d ON d.id = de.dataset_id WHERE d.name = 'qa-bot-golden'"""
).fetchall()
split_count = connection.execute("SELECT COUNT(*) FROM dataset_splits").fetchone()[0]
actual = {key for name, key in rows if name == truth["split_name"]}
passed = split_count == 1 and actual == set(truth["expected_example_keys"])
messages = Path("/logs/agent/latest/new_messages.json").read_text()
Path("/logs/verifier/reward.json").write_text(
    json.dumps({"reward": float(passed), "tool_calls": messages.count('"tool-call"')})
)

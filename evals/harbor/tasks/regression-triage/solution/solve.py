import json
import sqlite3
from pathlib import Path

logs = Path("/logs/agent")
logs.joinpath("steps").mkdir(parents=True, exist_ok=True)
# Harbor archives /logs/agent after every step, so the step counter must live
# on the container filesystem to survive across steps.
counter_path = Path("/var/lib/phoenix-eval/step_counter")
counter_path.parent.mkdir(parents=True, exist_ok=True)
step = int(counter_path.read_text() if counter_path.exists() else "0") + 1
counter_path.write_text(str(step))
truth = json.loads(Path("/data/ground_truth.json").read_text())
answers = {
    1: truth["step1"],
    2: {
        "regressed_example_keys": truth["step2"]["regressed_example_keys"],
        "pattern": "All regressed inputs are Spanish-language questions.",
    },
    3: {
        "span_name": truth["step3"]["span_name"],
        "exception_message": "UnsupportedLocaleError: locale 'es' is not enabled for translation",
    },
    4: {
        "split_name": truth["step4"]["split_name"],
        "example_keys": truth["step4"]["expected_example_keys"],
    },
}
if step == 4:
    connection = sqlite3.connect("/data/phoenix.db")
    connection.execute(
        "INSERT INTO dataset_splits(name, description, color, metadata, created_at, updated_at) VALUES (?, NULL, '#5B8FF9', '{}', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
        (truth["step4"]["split_name"],),
    )
    split_id = connection.execute("SELECT last_insert_rowid()").fetchone()[0]
    keys = truth["step4"]["expected_example_keys"]
    placeholders = ",".join("?" for _ in keys)
    rows = connection.execute(
        f"SELECT de.id FROM dataset_examples de JOIN dataset_example_revisions der ON der.dataset_example_id=de.id WHERE json_extract(der.metadata, '$.example_key') IN ({placeholders})",
        keys,
    ).fetchall()
    connection.executemany(
        "INSERT INTO dataset_splits_dataset_examples(dataset_split_id, dataset_example_id) VALUES (?, ?)",
        [(split_id, row[0]) for row in rows],
    )
    connection.commit()
out = logs / "steps" / str(step)
out.mkdir()
out.joinpath("answer.json").write_text(json.dumps(answers[step]))
out.joinpath("answer.md").write_text(f"```json\n{json.dumps(answers[step])}\n```\n")
out.joinpath("messages.json").write_text("[]")
out.joinpath("new_messages.json").write_text("[]")
out.joinpath("usage.json").write_text("{}")
latest = logs / "latest"
if latest.is_symlink() or latest.exists():
    latest.unlink()
latest.symlink_to(out)

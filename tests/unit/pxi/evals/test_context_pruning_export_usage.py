from __future__ import annotations

import json
import sqlite3
from pathlib import Path

from evals.pxi.experiments.context_pruning.export_usage import export_usage


def _create_db(path: Path) -> None:
    conn = sqlite3.connect(path)
    try:
        conn.executescript(
            """
            CREATE TABLE datasets (id INTEGER PRIMARY KEY, name VARCHAR NOT NULL);
            CREATE TABLE experiments (
                id INTEGER PRIMARY KEY,
                dataset_id INTEGER NOT NULL,
                name VARCHAR NOT NULL
            );
            CREATE TABLE experiment_runs (
                id INTEGER PRIMARY KEY,
                experiment_id INTEGER NOT NULL,
                output TEXT,
                error VARCHAR
            );
            """
        )
        conn.execute("INSERT INTO datasets (id, name) VALUES (1, 'context_pruning_type_a_50k')")
        conn.execute(
            """
            INSERT INTO experiments (id, dataset_id, name)
            VALUES (1, 1, 'context-pruning-main-context_pruning_type_a_50k-p5')
            """
        )
        conn.execute(
            """
            INSERT INTO experiments (id, dataset_id, name)
            VALUES (2, 1, 'context-pruning-main-context_pruning_type_a_50k-p5-fixed')
            """
        )
        conn.execute(
            """
            INSERT INTO experiments (id, dataset_id, name)
            VALUES (3, 1, 'context-pruning-main-context_pruning_type_a_50k-p2')
            """
        )
        failed_output = {
            "task_output": {
                "usage": {
                    "input_tokens": 0,
                    "output_tokens": 0,
                    "cache_read_tokens": 0,
                    "cache_write_tokens": 0,
                },
                "latency_ms": 0,
            }
        }
        fixed_output = {
            "task_output": {
                "usage": {
                    "input_tokens": 100,
                    "output_tokens": 10,
                    "cache_read_tokens": 80,
                    "cache_write_tokens": 5,
                },
                "policy_usage": {
                    "input_tokens": 20,
                    "output_tokens": 2,
                    "cache_read_tokens": 0,
                    "cache_write_tokens": 0,
                },
                "latency_ms": 123,
            }
        }
        conn.execute(
            "INSERT INTO experiment_runs (experiment_id, output, error) VALUES (1, ?, NULL)",
            (json.dumps(failed_output),),
        )
        conn.execute(
            "INSERT INTO experiment_runs (experiment_id, output, error) VALUES (2, ?, NULL)",
            (json.dumps(fixed_output),),
        )
        conn.commit()
    finally:
        conn.close()


def test_export_usage_prefers_fixed_rerun_and_aggregates_policy_usage(tmp_path: Path) -> None:
    db_path = tmp_path / "phoenix.db"
    _create_db(db_path)

    summary = export_usage(db_path, experiment_prefix="context-pruning-main")

    assert summary["cell_count"] == 1
    cell = summary["cells"][0]
    assert cell["policy"] == "p5"
    assert cell["experiment_id"] == 2
    assert cell["usage"] == {
        "input_tokens": 120,
        "output_tokens": 12,
        "cache_read_tokens": 80,
        "cache_write_tokens": 5,
    }
    assert cell["cache_read_ratio"] == 80 / 120
    assert cell["median_latency_ms"] == 123

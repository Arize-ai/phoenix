from __future__ import annotations

from pathlib import Path

import pytest
import yaml

from evals.harbor.pxi.compile_tasks import select_examples
from evals.harbor.pxi.examples import parse_instruction
from evals.harbor.pxi.exec_config import (
    JOB_PATH,
    TASK_TEMPLATE_DIR,
    TASKS_DIR,
    TESTS_DIR,
    exec_config,
    load_job,
    main,
)


def test_exec_config_compiles_one_instruction_per_example(tmp_path: Path) -> None:
    examples = [example for example, _ in select_examples(["set_time_range"], None, 3)]
    config = exec_config(examples, environment_dir=tmp_path, job=load_job(JOB_PATH))
    compile = config["map"]["compile"]
    assert [parse_instruction(i["text"])["id"] for i in compile["instructions"]] == [
        e["id"] for e in examples
    ]
    assert compile["environments"] == [{"path": str(tmp_path.resolve())}]
    assert compile["verifiers"] == [{"path": str(TESTS_DIR)}]
    assert compile["task_template"] == str(TASK_TEMPLATE_DIR)
    assert compile["output_dir"] == str(TASKS_DIR)
    assert (TASK_TEMPLATE_DIR / "task.toml").exists()
    job = config["map"]["job"]
    assert "datasets" not in job
    assert job["agents"][0]["name"] == "pxi-eval-agent"


def test_exec_config_needs_examples(tmp_path: Path) -> None:
    with pytest.raises(ValueError, match="no examples"):
        exec_config([], environment_dir=tmp_path, job={})


def test_main_writes_yaml(tmp_path: Path) -> None:
    out = tmp_path / "exec.yaml"
    main(
        [
            "--out",
            str(out),
            "--environment-dir",
            str(tmp_path),
            "--datasets",
            "set_time_range",
            "--limit",
            "1",
            "--tasks-dir",
            str(tmp_path / "tasks"),
            "--job-name",
            "smoke",
        ]
    )
    config = yaml.safe_load(out.read_text())
    assert config["schema_version"] == "1.0"
    assert len(config["map"]["compile"]["instructions"]) == 1
    assert config["map"]["compile"]["output_dir"] == str((tmp_path / "tasks").resolve())
    assert config["map"]["job"]["job_name"] == "smoke"


def test_harbor_accepts_the_config(tmp_path: Path) -> None:
    models = pytest.importorskip("harbor.models.exec")
    examples = [example for example, _ in select_examples(["set_time_range"], None, 2)]
    config = exec_config(examples, environment_dir=tmp_path, job=load_job(JOB_PATH))
    assert models.ExecConfig.model_validate(config).map.compile.instructions

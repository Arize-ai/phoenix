# /// script
# requires-python = ">=3.10"
# dependencies = ["pyyaml", "pydantic"]
# ///
"""Generate one Harbor task per PXI eval example.

Each task's ``instruction.md`` holds the user's request followed by the example as JSON,
which is how the example reaches the agent at run time. Every task shares the same build
context so Harbor builds one image. ``harbor-prepare`` runs this before staging; the
generated tasks are not committed because the YAML datasets are the source of truth.

    uv run python -m evals.harbor.pxi.compile_tasks --out evals/harbor/tasks/pxi
    uv run python -m evals.harbor.pxi.compile_tasks --datasets set_spans_filter --splits regression
"""

from __future__ import annotations

import argparse
import json
import shutil
import stat
from pathlib import Path
from typing import Any

import yaml
from pydantic import BaseModel, ConfigDict, field_validator, model_validator

from evals.harbor.pxi.examples import render_instruction, step_name

DATASETS_DIR = Path(__file__).resolve().parent / "datasets"
ALLOWED_SPLITS: frozenset[str] = frozenset({"dev", "holdout", "regression", "val"})


class EvalDataset(BaseModel):
    model_config = ConfigDict(extra="forbid")

    dataset_name: str
    description: str | None = None
    evaluators: list[str]
    examples: list[dict[str, Any]]

    @field_validator("dataset_name")
    @classmethod
    def _dataset_name_not_empty(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("dataset_name cannot be empty")
        return value

    @field_validator("evaluators")
    @classmethod
    def _evaluators_non_empty(cls, value: list[str]) -> list[str]:
        if not value:
            raise ValueError(
                "evaluators must be a non-empty list of evaluator names "
                "(see evals/harbor/pxi/evaluators/__init__.py for valid names)"
            )
        for name in value:
            if not isinstance(name, str) or not name.strip():
                raise ValueError("evaluators entries must be non-empty strings")
        duplicates = sorted({n for n in value if value.count(n) > 1})
        if duplicates:
            raise ValueError(f"duplicate evaluator names: {', '.join(duplicates)}")
        return value

    @model_validator(mode="after")
    def _validate_examples(self) -> "EvalDataset":
        if not self.examples:
            raise ValueError("dataset must contain at least one example")
        ids: list[str] = []
        for index, example in enumerate(self.examples):
            if not isinstance(example, dict):
                raise ValueError(f"example {index} must be an object")
            example_id = example.get("id")
            if not isinstance(example_id, str) or not example_id.strip():
                raise ValueError(f"example {index} id cannot be empty")
            ids.append(example_id)
            input_value = example.get("input")
            if not isinstance(input_value, dict):
                raise ValueError(f"example {example_id} input must be an object")
            if "split" in example:
                raise ValueError(f"example {example_id} must use splits, not split")
            example["splits"] = _validate_splits(example_id, example.get("splits"))
            expected = example.get("expected")
            if not isinstance(expected, dict):
                raise ValueError(f"example {example_id} expected must be an object")
            metadata = example.setdefault("metadata", {})
            if not isinstance(metadata, dict):
                raise ValueError(f"example {example_id} metadata must be an object")
        duplicates = sorted({example_id for example_id in ids if ids.count(example_id) > 1})
        if duplicates:
            raise ValueError(f"duplicate example ids: {', '.join(duplicates)}")
        return self


def _validate_splits(example_id: str, value: Any) -> list[str]:
    if not isinstance(value, list) or not value:
        raise ValueError(f"example {example_id} must define non-empty splits")
    if not all(isinstance(split, str) and split.strip() for split in value):
        raise ValueError(f"example {example_id} splits entries must be non-empty strings")
    splits = [split.strip() for split in value]
    if len(splits) != 1:
        raise ValueError(f"example {example_id} must belong to exactly one split")
    unknown = sorted(set(splits) - ALLOWED_SPLITS)
    if unknown:
        raise ValueError(
            f"example {example_id} has unknown split name(s): {', '.join(unknown)}. "
            f"Allowed: {', '.join(sorted(ALLOWED_SPLITS))}"
        )
    return splits


class DatasetValidationError(ValueError):
    """Raised when a PXI eval dataset is present but malformed (bad YAML or
    schema). Use :class:`FileNotFoundError` for missing dataset files.
    """


def _available_dataset_stems() -> list[str]:
    return sorted(p.stem for p in DATASETS_DIR.glob("*.yaml"))


def dataset_path(dataset: str) -> Path:
    """Resolve a dataset stem (e.g. ``set_spans_filter``) to its YAML file path.

    Raises :class:`FileNotFoundError` if no matching file exists, including
    the list of available stems in the error message.
    """
    path = DATASETS_DIR / f"{dataset}.yaml"
    if not path.exists():
        available = _available_dataset_stems()
        raise FileNotFoundError(f"Dataset not found: {path}. Available: {available}")
    return path


def load_dataset(dataset: str | Path) -> EvalDataset:
    """Load and validate a YAML dataset by file stem or absolute path.

    Raises :class:`FileNotFoundError` for missing files and
    :class:`DatasetValidationError` for malformed YAML or schema violations.
    """
    path = dataset_path(dataset) if isinstance(dataset, str) else dataset
    try:
        raw: Any = yaml.safe_load(path.read_text())
    except yaml.YAMLError as exc:
        raise DatasetValidationError(f"Invalid YAML in {path}: {exc}") from exc
    if raw is None:
        raise DatasetValidationError(f"Dataset is empty: {path}")
    try:
        return EvalDataset.model_validate(raw)
    except ValueError as exc:
        raise DatasetValidationError(f"Invalid dataset {path}: {exc}") from exc


def example_records(dataset: EvalDataset) -> list[dict[str, Any]]:
    return [
        {
            "dataset": dataset.dataset_name,
            "id": example["id"],
            "splits": example["splits"],
            "evaluators": list(dataset.evaluators),
            "input": example["input"],
            "expected": example["expected"],
            "metadata": example.get("metadata", {}),
        }
        for example in dataset.examples
    ]


def load_example_records(dataset: str | Path) -> list[dict[str, Any]]:
    return example_records(load_dataset(dataset))


TASK_TOML = """\
schema_version = "1.3"
artifacts = ["/var/lib/phoenix-eval/server.log"]

[task]
name = "arize/pxi-{dataset}-{example}"
description = {description}
keywords = ["pxi", "agent_session_chat", "{dataset}"]

[metadata]
fixture = "pxi"
pxi_dataset = "{dataset}"
pxi_example = {example_id}
pxi_splits = {splits}

[environment]
os = "linux"
cpus = 2
memory_mb = 4096
# Add hosts in the job or agent configuration to keep this task's dataset version stable
# across providers and operators.
network_mode = "allowlist"
build_timeout_sec = 1200.0

[environment.env]
ANTHROPIC_API_KEY = "${{ANTHROPIC_API_KEY:-}}"
OPENAI_API_KEY = "${{OPENAI_API_KEY:-}}"

# Start Phoenix as root so it owns the database before the unprivileged agent runs.
[environment.healthcheck]
command = "sh /opt/phoenix-eval/start_phoenix_server.sh"
timeout_sec = 180.0
retries = 2

# The chat client only talks to Phoenix over HTTP; the agent class seeds the session as root.
[agent]
user = "agent"
timeout_sec = {agent_timeout}

[verifier]
timeout_sec = 120.0
"""

TEST_SH = """\
#!/bin/sh
set -eu
PYTHONPATH=/opt/verifier exec python -m evals.harbor.pxi.verify \\
  --example /app/example.json --seed /app/seed.json
"""

GITIGNORE = """\
# Staging writes the image, wheel, and fixture to environment/. Ignore these generated
# files so they do not change the task digest that versions the Phoenix dataset.
environment/
"""


def _toml_string(value: str) -> str:
    return json.dumps(" ".join(value.split()))


def task_dir_name(example: dict[str, Any]) -> str:
    return f"{example['dataset']}__{step_name(example['id'])}"


def write_task(
    example: dict[str, Any],
    *,
    out_dir: Path,
    description: str,
    agent_timeout_sec: float,
) -> Path:
    task_dir = out_dir / task_dir_name(example)
    if task_dir.exists():
        environment = task_dir / "environment"
        for child in task_dir.iterdir():
            if child != environment:
                shutil.rmtree(child) if child.is_dir() else child.unlink()
    (task_dir / "tests").mkdir(parents=True, exist_ok=True)
    (task_dir / ".gitignore").write_text(GITIGNORE)
    test_sh = task_dir / "tests" / "test.sh"
    test_sh.write_text(TEST_SH)
    test_sh.chmod(test_sh.stat().st_mode | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH)
    (task_dir / "instruction.md").write_text(render_instruction(example))
    (task_dir / "task.toml").write_text(
        TASK_TOML.format(
            dataset=example["dataset"],
            example=step_name(example["id"]),
            example_id=json.dumps(example["id"]),
            splits=json.dumps(example["splits"]),
            description=_toml_string(description),
            agent_timeout=agent_timeout_sec,
        )
    )
    return task_dir


def generate(
    *,
    out_dir: Path,
    datasets: list[str] | None,
    splits: list[str] | None,
    limit: int | None,
    agent_timeout_sec: float,
) -> list[Path]:
    """Write one task per selected example and remove task directories for any others."""
    names = datasets or sorted(path.stem for path in DATASETS_DIR.glob("*.yaml"))
    written: list[Path] = []
    for name in names:
        dataset = load_dataset(name)
        examples = example_records(dataset)
        if splits:
            examples = [e for e in examples if any(s in splits for s in e["splits"])]
        if limit is not None:
            examples = examples[:limit]
        description = dataset.description or f"PXI eval dataset {name}"
        for example in examples:
            written.append(
                write_task(
                    example,
                    out_dir=out_dir,
                    description=f"{example['id']}: {description}",
                    agent_timeout_sec=agent_timeout_sec,
                )
            )
    if out_dir.exists():
        for child in out_dir.iterdir():
            if child.is_dir() and child not in written:
                shutil.rmtree(child)
    return written


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", type=Path, default=Path("evals/harbor/tasks/pxi"))
    parser.add_argument("--datasets", nargs="*", default=None, help="dataset stems; default all")
    parser.add_argument("--splits", nargs="*", default=None, help="keep only these splits")
    parser.add_argument("--limit", type=int, default=None, help="keep the first N examples")
    parser.add_argument("--agent-timeout-sec", type=float, default=600.0)
    args = parser.parse_args(argv)
    written = generate(
        out_dir=args.out,
        datasets=args.datasets,
        splits=args.splits,
        limit=args.limit,
        agent_timeout_sec=args.agent_timeout_sec,
    )
    print(f"Generated {len(written)} task(s) under {args.out}")


if __name__ == "__main__":
    main()

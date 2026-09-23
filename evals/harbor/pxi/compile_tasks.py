"""Generate one Harbor task per PXI eval example with Harbor's compiler.

Each example becomes an instruction; the compiler cross-products the instructions with
the task template and the shared Reward Kit ``tests/`` directory, and this module then
names each task after its example. The instruction holds the user's request followed by
the example as JSON, which is how the example reaches the agent at run time. Staging
fills each task's ``environment/`` afterwards so Harbor builds one image, and ``harbor
run -p`` records the job in Phoenix. ``harbor-prepare`` runs this through
``prepare_tasks.sh``; the generated tasks are not committed because the YAML datasets
are the source of truth.

    uvx --python 3.13 --from harbor==0.21.0 --with pyyaml \
        python -m evals.harbor.pxi.compile_tasks --out evals/harbor/tasks/pxi
"""

from __future__ import annotations

import argparse
import shutil
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


HERE = Path(__file__).resolve().parent
TASK_TEMPLATE_DIR = HERE / "task_template"
# Every task shares the Reward Kit verifier; see evals/harbor/pxi/criteria.py.
TESTS_DIR = HERE / "tests"
ARTIFACTS = ["/var/lib/phoenix-eval/server.log"]


def task_dir_name(example: dict[str, Any]) -> str:
    return f"{example['dataset']}__{step_name(example['id'])}"


def select_examples(
    datasets: list[str] | None, splits: list[str] | None, limit: int | None
) -> list[tuple[dict[str, Any], str]]:
    """The selected example records, each with its dataset's description."""
    names = datasets or sorted(path.stem for path in DATASETS_DIR.glob("*.yaml"))
    selected: list[tuple[dict[str, Any], str]] = []
    for name in names:
        dataset = load_dataset(name)
        examples = example_records(dataset)
        if splits:
            examples = [e for e in examples if any(s in splits for s in e["splits"])]
        if limit is not None:
            examples = examples[:limit]
        description = dataset.description or f"PXI eval dataset {name}"
        selected.extend((example, description) for example in examples)
    return selected


def generate(
    *,
    out_dir: Path,
    datasets: list[str] | None,
    splits: list[str] | None,
    limit: int | None,
    agent_timeout_sec: float,
) -> list[Path]:
    """Compile one task per selected example with Harbor's compiler, replacing ``out_dir``.

    Harbor requires Python 3.12, so the import stays inside the function and the dataset
    loaders above remain usable from the Phoenix development environment.
    """
    from harbor.compile import Compiler
    from harbor.models.compile import CompileConfig, CompileVerifier

    selected = select_examples(datasets, splits, limit)
    if not selected:
        raise ValueError("no examples selected")
    if out_dir.exists():
        shutil.rmtree(out_dir)
    compiled = Compiler(
        CompileConfig(
            task_name_prefix="pxi",
            output_dir=out_dir,
            task_template=TASK_TEMPLATE_DIR,
            artifacts=list(ARTIFACTS),
            instructions=[render_instruction(example) for example, _ in selected],
            verifiers=[CompileVerifier(path=TESTS_DIR)],
        )
    ).compile()
    written: list[Path] = []
    for task_dir, (example, description) in zip(compiled, selected, strict=True):
        target = task_dir.rename(out_dir / task_dir_name(example))
        _name_task(target, example, description, agent_timeout_sec)
        written.append(target)
    return written


def _name_task(
    task_dir: Path, example: dict[str, Any], description: str, agent_timeout_sec: float
) -> None:
    """Give the compiled task the example's name and metadata for the Phoenix plugin."""
    from harbor.models.task.config import PackageInfo, TaskConfig

    config_path = task_dir / "task.toml"
    config = TaskConfig.model_validate_toml(config_path.read_text())
    dataset, example_id = example["dataset"], example["id"]
    config.task = PackageInfo(
        name=f"arize/pxi-{dataset}-{step_name(example_id)}",
        description=" ".join(f"{example_id}: {description}".split()),
        keywords=["pxi", "agent_session_chat", dataset],
    )
    config.metadata.update(
        pxi_dataset=dataset, pxi_example=example_id, pxi_splits=list(example["splits"])
    )
    config.agent.timeout_sec = agent_timeout_sec
    config_path.write_text(config.model_dump_toml())


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

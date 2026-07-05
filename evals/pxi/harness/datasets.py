from __future__ import annotations

from pathlib import Path
from typing import Any

import yaml
from pydantic import BaseModel, ConfigDict, field_validator, model_validator

DATASETS_DIR = Path(__file__).resolve().parents[1] / "datasets"
EXPERIMENT_DATASETS_DIRS: tuple[Path, ...] = (
    Path(__file__).resolve().parents[1] / "experiments" / "context-pruning" / "datasets",
)
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
                "(see evals/pxi/evaluators/__init__.py for valid names)"
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
    stems = {p.stem for p in DATASETS_DIR.glob("*.yaml")}
    for directory in EXPERIMENT_DATASETS_DIRS:
        stems.update(p.stem for p in directory.glob("*.yaml"))
    return sorted(stems)


def dataset_path(dataset: str) -> Path:
    """Resolve a dataset stem (e.g. ``set_spans_filter``) to its YAML file path.

    Raises :class:`FileNotFoundError` if no matching file exists, including
    the list of available stems in the error message.
    """
    candidates = [DATASETS_DIR / f"{dataset}.yaml"]
    candidates.extend(directory / f"{dataset}.yaml" for directory in EXPERIMENT_DATASETS_DIRS)
    for path in candidates:
        if path.exists():
            return path
    else:
        available = _available_dataset_stems()
        raise FileNotFoundError(f"Dataset not found: {candidates[0]}. Available: {available}")


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

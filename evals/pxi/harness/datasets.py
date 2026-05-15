from __future__ import annotations

from pathlib import Path
from typing import Any

import yaml
from pydantic import BaseModel, ConfigDict, field_validator, model_validator

DATASETS_DIR = Path(__file__).resolve().parents[1] / "datasets"
ALLOWED_SPLITS: frozenset[str] = frozenset({"dev", "val", "regression"})


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
            if not isinstance(input_value, dict) or not isinstance(input_value.get("query"), str):
                raise ValueError(f"example {example_id} must define input.query")
            split = example.get("split")
            if not isinstance(split, str) or not split.strip():
                raise ValueError(f"example {example_id} must define split")
            if split not in ALLOWED_SPLITS:
                raise ValueError(
                    f"example {example_id} has unknown split name: {split}. "
                    f"Allowed: {', '.join(sorted(ALLOWED_SPLITS))}"
                )
            if "splits" in example:
                raise ValueError(f"example {example_id} must use split, not splits")
            expected = example.get("expected")
            if not isinstance(expected, dict):
                raise ValueError(f"example {example_id} must define expected")
            tools = expected.get("tools")
            if not isinstance(tools, dict):
                raise ValueError(f"example {example_id} must define expected.tools")
            metadata = example.setdefault("metadata", {})
            if not isinstance(metadata, dict):
                raise ValueError(f"example {example_id} metadata must be an object")
        duplicates = sorted({example_id for example_id in ids if ids.count(example_id) > 1})
        if duplicates:
            raise ValueError(f"duplicate example ids: {', '.join(duplicates)}")
        return self


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

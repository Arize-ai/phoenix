from __future__ import annotations

from pathlib import Path
from typing import Any, cast

import yaml

from tests.pxi.evals.types import EvalDataset, JsonObject, PhoenixExample

DATASETS_DIR = Path(__file__).parent / "datasets"


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


def to_phoenix_examples(dataset: EvalDataset) -> list[PhoenixExample]:
    """Convert a validated dataset into the dict shape Phoenix client upserts."""
    return [
        {
            "id": example["id"],
            "input": example["input"],
            "output": example["expected"],
            "metadata": cast(JsonObject, example.get("metadata") or {}),
        }
        for example in dataset.examples
    ]

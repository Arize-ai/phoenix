from __future__ import annotations

from pathlib import Path
from typing import Any

import yaml

from tests.pxi.evals.types import EvalDataset

DATASETS_DIR = Path(__file__).parent / "datasets"


class DatasetValidationError(ValueError):
    """Raised when a PXI eval dataset is malformed."""


def dataset_path(dataset: str) -> Path:
    path = DATASETS_DIR / f"{dataset}.yaml"
    if not path.exists():
        raise DatasetValidationError(f"Dataset not found: {path}")
    return path


def load_dataset(dataset: str | Path) -> EvalDataset:
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


def to_phoenix_examples(dataset: EvalDataset) -> list[dict[str, Any]]:
    return [
        {
            "id": example.id,
            "input": example.input.model_dump(mode="json"),
            "output": example.expected.model_dump(mode="json", by_alias=True),
            "metadata": example.metadata,
        }
        for example in dataset.examples
    ]

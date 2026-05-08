"""Unit tests for PXI eval-harness dataset loading and validation.

Run directly:

    uv run pytest tests/pxi/evals/test_datasets.py
"""

from __future__ import annotations

from pathlib import Path

import pytest

from tests.pxi.evals.datasets import (
    DatasetValidationError,
    dataset_path,
    load_dataset,
    to_phoenix_examples,
)
from tests.pxi.evals.types import EvalDataset

_VALID_YAML = """\
dataset_name: example_suite
description: Tiny suite for tests
examples:
  - id: ex-1
    input:
      query: hello
    expected:
      tools:
        required: [foo]
      tool_call_args:
        foo:
          a: 1
    metadata:
      category: greeting
"""


def _write(path: Path, content: str) -> Path:
    path.write_text(content)
    return path


class TestDatasetPath:
    def test_missing_file_raises_file_not_found(self) -> None:
        with pytest.raises(FileNotFoundError) as exc_info:
            dataset_path("definitely_not_a_real_dataset_xyz")
        assert "definitely_not_a_real_dataset_xyz" in str(exc_info.value)
        # The error should hint at what is available so users can correct
        # typos without reading source.
        assert "Available:" in str(exc_info.value)


class TestLoadDataset:
    def test_loads_valid_yaml(self, tmp_path: Path) -> None:
        path = _write(tmp_path / "ds.yaml", _VALID_YAML)
        dataset = load_dataset(path)
        assert isinstance(dataset, EvalDataset)
        assert dataset.dataset_name == "example_suite"
        assert len(dataset.examples) == 1
        assert dataset.examples[0].id == "ex-1"

    def test_malformed_yaml_raises_validation_error(self, tmp_path: Path) -> None:
        path = _write(tmp_path / "bad.yaml", "dataset_name: [unterminated\n")
        with pytest.raises(DatasetValidationError) as exc_info:
            load_dataset(path)
        assert "Invalid YAML in" in str(exc_info.value)

    def test_empty_file_raises_validation_error(self, tmp_path: Path) -> None:
        path = _write(tmp_path / "empty.yaml", "")
        with pytest.raises(DatasetValidationError) as exc_info:
            load_dataset(path)
        assert "Dataset is empty" in str(exc_info.value)

    def test_duplicate_ids_raises_with_sorted_ids(self, tmp_path: Path) -> None:
        path = _write(
            tmp_path / "dupes.yaml",
            """\
dataset_name: dupes
examples:
  - id: b
    input: {query: x}
    expected: {tools: {required: []}}
  - id: a
    input: {query: x}
    expected: {tools: {required: []}}
  - id: a
    input: {query: x}
    expected: {tools: {required: []}}
  - id: b
    input: {query: x}
    expected: {tools: {required: []}}
""",
        )
        with pytest.raises(DatasetValidationError) as exc_info:
            load_dataset(path)
        # Duplicates appear sorted in the error message.
        assert "a, b" in str(exc_info.value)

    def test_empty_examples_raises_validation_error(self, tmp_path: Path) -> None:
        path = _write(
            tmp_path / "no_examples.yaml",
            "dataset_name: empty\nexamples: []\n",
        )
        with pytest.raises(DatasetValidationError) as exc_info:
            load_dataset(path)
        assert "at least one example" in str(exc_info.value)

    def test_load_by_stem_uses_repo_datasets_dir(self) -> None:
        # The shipped ``set_spans_filter`` dataset must round-trip cleanly so
        # changes to YAML schema or types break tests, not the runner.
        dataset = load_dataset("set_spans_filter")
        assert dataset.dataset_name == "set_spans_filter"
        assert len(dataset.examples) >= 1


class TestToPhoenixExamples:
    def test_round_trip_preserves_id_input_expected_metadata(self, tmp_path: Path) -> None:
        path = _write(tmp_path / "ds.yaml", _VALID_YAML)
        dataset = load_dataset(path)
        examples = to_phoenix_examples(dataset)
        assert len(examples) == 1
        ex = examples[0]
        assert ex["id"] == "ex-1"
        assert ex["input"] == {"query": "hello"}
        # ``output`` carries expected (which is the dataset's expected
        # behavior) so Phoenix can show it alongside actual outputs.
        assert ex["output"]["tools"]["required"] == ["foo"]
        assert ex["output"]["tool_call_args"] == {"foo": {"a": 1}}
        assert ex["metadata"] == {"category": "greeting"}

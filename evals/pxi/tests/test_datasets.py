"""Unit tests for PXI eval-harness dataset loading and validation.

Run directly:

    uv run pytest evals/pxi/harness/test_datasets.py
"""

from __future__ import annotations

from pathlib import Path

import pytest

from evals.pxi.harness.datasets import (
    DatasetValidationError,
    EvalDataset,
    dataset_path,
    load_dataset,
)

_VALID_YAML = """\
dataset_name: example_suite
description: Tiny suite for tests
evaluators:
  - correct_tools_called
  - tool_call_args_match
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
        assert dataset.examples[0]["id"] == "ex-1"

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
evaluators: [correct_tools_called]
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
            "dataset_name: empty\nevaluators: [correct_tools_called]\nexamples: []\n",
        )
        with pytest.raises(DatasetValidationError) as exc_info:
            load_dataset(path)
        assert "at least one example" in str(exc_info.value)

    def test_missing_evaluators_field_raises_validation_error(self, tmp_path: Path) -> None:
        # Datasets must declare which evaluators to run; there is no
        # implicit default.
        path = _write(
            tmp_path / "no_evaluators.yaml",
            """\
dataset_name: missing_evaluators
examples:
  - id: ex-1
    input: {query: x}
    expected: {tools: {required: []}}
""",
        )
        with pytest.raises(DatasetValidationError) as exc_info:
            load_dataset(path)
        assert "evaluators" in str(exc_info.value).lower()

    def test_empty_evaluators_field_raises_validation_error(self, tmp_path: Path) -> None:
        path = _write(
            tmp_path / "empty_evaluators.yaml",
            """\
dataset_name: empty_evaluators
evaluators: []
examples:
  - id: ex-1
    input: {query: x}
    expected: {tools: {required: []}}
""",
        )
        with pytest.raises(DatasetValidationError) as exc_info:
            load_dataset(path)
        assert "evaluators must be a non-empty list" in str(exc_info.value)

    def test_duplicate_evaluator_names_raises_validation_error(self, tmp_path: Path) -> None:
        path = _write(
            tmp_path / "dupe_evaluators.yaml",
            """\
dataset_name: dupe_evaluators
evaluators: [correct_tools_called, correct_tools_called]
examples:
  - id: ex-1
    input: {query: x}
    expected: {tools: {required: []}}
""",
        )
        with pytest.raises(DatasetValidationError) as exc_info:
            load_dataset(path)
        assert "duplicate evaluator names" in str(exc_info.value)

    def test_load_by_stem_uses_repo_datasets_dir(self) -> None:
        # The shipped ``set_spans_filter`` dataset must round-trip cleanly so
        # changes to YAML schema or types break tests, not the runner.
        dataset = load_dataset("set_spans_filter")
        assert dataset.dataset_name == "set_spans_filter"
        assert len(dataset.examples) >= 1
        assert "correct_tools_called" in dataset.evaluators

    def test_loads_in_app_links_dataset(self) -> None:
        dataset = load_dataset("in_app_links")
        assert dataset.dataset_name == "in_app_links"
        assert len(dataset.examples) == 4
        assert "in_app_links_valid" in dataset.evaluators
        assert any(example["id"] == "dataset-resource-link" for example in dataset.examples)

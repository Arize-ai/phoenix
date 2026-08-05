"""Unit tests for PXI eval-harness dataset loading and validation.

Run directly:

    uv run pytest tests/unit/pxi/evals/test_datasets.py
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
    splits: [regression]
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
    splits: [regression]
    input: {query: x}
    expected: {tools: {required: []}}
  - id: a
    splits: [regression]
    input: {query: x}
    expected: {tools: {required: []}}
  - id: a
    splits: [regression]
    input: {query: x}
    expected: {tools: {required: []}}
  - id: b
    splits: [regression]
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
    splits: [regression]
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
    splits: [regression]
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
    splits: [regression]
    input: {query: x}
    expected: {tools: {required: []}}
""",
        )
        with pytest.raises(DatasetValidationError) as exc_info:
            load_dataset(path)
        assert "duplicate evaluator names" in str(exc_info.value)

    def test_missing_splits_raises_validation_error(self, tmp_path: Path) -> None:
        path = _write(
            tmp_path / "missing_split.yaml",
            """\
dataset_name: missing_split
evaluators: [correct_tools_called]
examples:
  - id: ex-1
    input: {query: x}
    expected: {tools: {required: []}}
""",
        )
        with pytest.raises(DatasetValidationError) as exc_info:
            load_dataset(path)
        assert "must define non-empty splits" in str(exc_info.value)

    def test_empty_splits_raises_validation_error(self, tmp_path: Path) -> None:
        path = _write(
            tmp_path / "empty_splits.yaml",
            """\
dataset_name: empty_splits
evaluators: [correct_tools_called]
examples:
  - id: ex-1
    splits: []
    input: {query: x}
    expected: {tools: {required: []}}
""",
        )
        with pytest.raises(DatasetValidationError) as exc_info:
            load_dataset(path)
        assert "must define non-empty splits" in str(exc_info.value)

    def test_old_split_field_raises(self, tmp_path: Path) -> None:
        path = _write(
            tmp_path / "old_split.yaml",
            """\
dataset_name: old_split
evaluators: [correct_tools_called]
examples:
  - id: ex-1
    split: regression
    input: {query: x}
    expected: {tools: {required: []}}
""",
        )
        with pytest.raises(DatasetValidationError) as exc_info:
            load_dataset(path)
        assert "must use splits, not split" in str(exc_info.value)

    def test_unknown_split_names_raise(self, tmp_path: Path) -> None:
        path = _write(
            tmp_path / "unknown_splits.yaml",
            """\
dataset_name: unknown_splits
evaluators: [correct_tools_called]
examples:
  - id: ex-1
    splits: [unknown]
    input: {query: x}
    expected: {tools: {required: []}}
""",
        )
        with pytest.raises(DatasetValidationError) as exc_info:
            load_dataset(path)
        assert "unknown split name(s): unknown" in str(exc_info.value)

    @pytest.mark.parametrize("split", ("dev", "holdout", "regression", "val"))
    def test_single_allowed_split_parses(self, tmp_path: Path, split: str) -> None:
        path = _write(
            tmp_path / "single_split.yaml",
            f"""\
dataset_name: single_split
evaluators: [correct_tools_called]
examples:
  - id: ex-1
    splits: [{split}]
    input: {{query: x}}
    expected: {{tools: {{required: []}}}}
""",
        )
        dataset = load_dataset(path)
        assert dataset.examples[0]["splits"] == [split]

    @pytest.mark.parametrize(
        "splits", (["regression", "val"], ["dev", "val"], ["regression", "dev"])
    )
    def test_multiple_splits_raise(self, tmp_path: Path, splits: list[str]) -> None:
        path = _write(
            tmp_path / "multiple_splits.yaml",
            f"""\
dataset_name: multiple_splits
evaluators: [correct_tools_called]
examples:
  - id: ex-1
    splits: [{", ".join(splits)}]
    input: {{query: x}}
    expected: {{tools: {{required: []}}}}
""",
        )
        with pytest.raises(DatasetValidationError) as exc_info:
            load_dataset(path)
        assert "must belong to exactly one split" in str(exc_info.value)

    def test_load_by_stem_uses_repo_datasets_dir(self) -> None:
        # The shipped ``set_spans_filter`` dataset must round-trip cleanly so
        # changes to YAML schema or types break tests, not the runner.
        dataset = load_dataset("set_spans_filter")
        assert dataset.dataset_name == "set_spans_filter"
        assert len(dataset.examples) >= 1
        assert any(example["splits"] == ["regression"] for example in dataset.examples)
        assert "correct_tools_called" in dataset.evaluators

    def test_loads_in_app_links_dataset(self) -> None:
        dataset = load_dataset("in_app_links")
        assert dataset.dataset_name == "in_app_links"
        assert len(dataset.examples) == 8
        assert "in_app_links_valid" in dataset.evaluators
        assert any(
            example["id"] == "route-info-dataset-experiments-link" for example in dataset.examples
        )

    def test_loads_route_info_tool_selection_dataset(self) -> None:
        dataset = load_dataset("route_info_tool_selection")
        assert dataset.dataset_name == "route_info_tool_selection"
        assert len(dataset.examples) == 11
        assert "correct_tools_called" in dataset.evaluators
        assert "in_app_links_valid" in dataset.evaluators
        assert "tool_call_args_match" in dataset.evaluators

    def test_loads_playground_experiment_recording_dataset(self) -> None:
        dataset = load_dataset("playground_experiment_recording")
        assert dataset.dataset_name == "playground_experiment_recording"
        assert len(dataset.examples) == 6
        assert dataset.evaluators == [
            "correct_tools_called",
            "tool_call_args_match",
            "tool_call_count_within_limit",
        ]
        assert any(example["id"] == "record-next-run" for example in dataset.examples)
        assert any(example["id"] == "save-prompt-not-run" for example in dataset.examples)

    def test_loads_experiment_observations_dataset(self) -> None:
        dataset = load_dataset("experiment_observations")
        assert dataset.dataset_name == "experiment_observations"
        assert len(dataset.examples) == 6
        assert dataset.evaluators == [
            "correct_tools_called",
            "tool_call_args_match",
            "tool_call_count_within_limit",
        ]
        # The preservation case must assert the scaffold keys survive a
        # whole-metadata replace alongside the appended observations.
        preserve = next(
            e for e in dataset.examples if e["id"] == "preserve-scaffold-when-appending"
        )
        has_keys = preserve["expected"]["tool_call_args"]["patch_experiment"]["metadata"][
            "has_keys"
        ]
        assert set(has_keys) == {
            "observations",
            "hypothesis",
            "changed_variable",
            "baseline_experiment_id",
        }

    def test_save_prompt_dataset_requires_descriptions_for_save_calls(self) -> None:
        dataset = load_dataset("save_prompt")
        assert dataset.dataset_name == "save_prompt"
        assert "tool_call_args_match" in dataset.evaluators
        for example in dataset.examples:
            expected = example["expected"]
            save_prompt_args = expected.get("tool_call_args", {}).get("save_prompt")
            if save_prompt_args is None:
                continue
            # `save_prompt` may be a single arg-matcher dict or a list of
            # independently-acceptable variants; every variant must require a
            # non-empty description.
            variants = (
                save_prompt_args if isinstance(save_prompt_args, list) else [save_prompt_args]
            )
            for variant in variants:
                description = variant.get("description")
                assert description is not None, (
                    f"{example['id']} must assert save_prompt.description"
                )
                assert isinstance(description, dict)
                assert description.get("non_empty") is True, (
                    f"{example['id']} must reject empty save_prompt.description"
                )

    def test_loads_documentation_links_dataset(self) -> None:
        dataset = load_dataset("documentation_links")
        assert dataset.dataset_name == "documentation_links"
        assert len(dataset.examples) == 5
        assert dataset.evaluators == ["documentation_tools_used", "documentation_links_valid"]
        assert all(
            example["expected"]["links"]["canonical_docs_domain"]
            == "https://arize.com/docs/phoenix"
            for example in dataset.examples
        )

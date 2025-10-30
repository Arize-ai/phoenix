# type: ignore

import json

import pandas as pd
import pytest
from jsonpath_ng.exceptions import JsonPathParserError

from phoenix.evals.utils import (
    extract_with_jsonpath,
    remap_eval_input,
    to_annotation_dataframe,
)


class TestRemapEvalInput:
    """Test the remap_eval_input utility function."""

    @pytest.mark.parametrize(
        "eval_input,required_fields,input_mapping,expected_result",
        [
            pytest.param(
                {"input": "test", "output": "result"},
                {"input", "output"},
                None,
                {"input": "test", "output": "result"},
                id="Basic remapping without input_mapping",
            ),
            pytest.param(
                {"user_input": "test", "model_output": "result"},
                {"input", "output"},
                {"input": "user_input", "output": "model_output"},
                {"input": "test", "output": "result"},
                id="Remapping with input_mapping",
            ),
            pytest.param(
                {"input": "test", "output": "result"},
                ["input", "output"],
                None,
                {"input": "test", "output": "result"},
                id="Remapping with list required_fields",
            ),
        ],
    )
    def test_remap_eval_input_simple_cases(
        self, eval_input, required_fields, input_mapping, expected_result
    ):
        """Test successful remapping of eval_input."""
        result = remap_eval_input(
            eval_input=eval_input, required_fields=required_fields, input_mapping=input_mapping
        )
        assert result == expected_result

    @pytest.mark.parametrize(
        "eval_input,required_fields,input_mapping,expected",
        [
            pytest.param(
                {"output": {"response": " Yes "}, "expected": "yes"},
                {"output", "expected"},
                {
                    "output": lambda row: row["output"]["response"].strip().lower(),
                    "expected": "expected",
                },
                {"output": "yes", "expected": "yes"},
                id="nested_path_with_strip_lower",
            ),
            pytest.param(
                {"docs": [" A ", "B"]},
                {"first"},
                {"first": lambda row: row["docs"][0].strip()},
                {"first": "A"},
                id="first_transform_on_list_then_strip",
            ),
            pytest.param(
                {"x": 5},
                {"x_str"},
                {"x_str": lambda row: str(row["x"])},
                {"x_str": "5"},
                id="as_str_transform",
            ),
            pytest.param(
                {"x": "7", "y": "3.14", "z": "1"},
                {"xi", "yf", "zb"},
                {
                    "xi": lambda row: int(row["x"]),
                    "yf": lambda row: float(row["y"]),
                    "zb": lambda row: bool(row["z"]),
                },
                {"xi": 7, "yf": 3.14, "zb": True},
                id="coercion_transforms_int_float_bool",
            ),
            pytest.param(
                {"items": ["keep", "drop"]},
                {"v"},
                {"v": "items[0]"},
                {"v": "keep"},
                id="bracket_index_access",
            ),
            pytest.param(
                {"output": {"response": "Value"}},
                {"output"},
                {"output": ""},
                {"output": {"response": "Value"}},
                id="empty_mapping_string_falls_back_to_direct_key",
            ),
            pytest.param(
                {"a": 1},
                {"b"},
                {"b": (lambda row: row.get("a", None))},
                {"b": 1},
                id="callable_extractor",
            ),
            pytest.param(
                {
                    "attributes.input.value": "direct_value",
                    "attributes.output.value": "another_direct_value",
                },
                {"attributes.input.value", "attributes.output.value"},
                {},
                {
                    "attributes.input.value": "direct_value",
                    "attributes.output.value": "another_direct_value",
                },
                id="required fields with dot notation",
            ),
            pytest.param(
                {
                    "attributes.input.value": "direct_value",
                    "attributes.output.value": "another_direct_value",
                    "nested": {"input": "nested_value", "output": "nested_output"},
                },
                {"attributes.input.value", "attributes.output.value", "output"},
                {"output": "nested.output"},
                {
                    "attributes.input.value": "direct_value",
                    "attributes.output.value": "another_direct_value",
                    "output": "nested_output",
                },
                id="required fields with dot notation and input_mapping with dot notation",
            ),
            pytest.param(
                {
                    "attributes.input.value": "direct_value",
                    "attributes.output.value": "another_direct_value",
                },
                {"output"},
                {"output": "attributes.output.value"},
                {
                    "attributes.input.value": "direct_value",
                    "output": "another_direct_value",
                },
                id="dot notation accessed as top level key before jsonpath",
            ),
            pytest.param(
                {
                    "user_data": {"input": "mapped_input", "output": "mapped_output"},
                    "attributes.value": "direct_key_value",
                },
                {"input", "output", "attributes.input.value"},
                {
                    "input": "user_data.input",
                    "output": "user_data.output",
                    "attributes.input.value": "attributes.value",
                },
                {
                    "input": "mapped_input",
                    "output": "mapped_output",
                    "attributes.input.value": "direct_key_value",
                },
                id="dot notation in key and path",
            ),
        ],
    )
    def test_remap_success_cases(self, eval_input, required_fields, input_mapping, expected):
        result = remap_eval_input(
            eval_input=eval_input, required_fields=required_fields, input_mapping=input_mapping
        )
        # Expect at least the expected key/values; result may include pass-through optional fields
        for k, v in expected.items():
            assert result.get(k) == v

    @pytest.mark.parametrize(
        "eval_input,required_fields,input_mapping,expected_required,expected_optional",
        [
            pytest.param(
                {"a": "x", "b": "y", "extra": 1},
                {"a"},
                None,
                {"a": "x"},
                {"b": "y", "extra": 1},
                id="optional_fields_pass_through_when_present",
            ),
        ],
    )
    def test_optional_fields_pass_through_when_present(
        self, eval_input, required_fields, input_mapping, expected_required, expected_optional
    ):
        out = remap_eval_input(
            eval_input=eval_input, required_fields=required_fields, input_mapping=input_mapping
        )
        # Required present
        for k, v in expected_required.items():
            assert out[k] == v
        # Optional provided by caller should be preserved
        for k, v in expected_optional.items():
            assert out[k] == v

    @pytest.mark.parametrize(
        "eval_input,required_fields,input_mapping,expected",
        [
            pytest.param(
                {"a": "x", "source_b": "mapped"},
                {"a"},
                {"b": "source_b"},
                {"a": "x", "b": "mapped"},
                id="optional_fields_can_be_mapped",
            ),
        ],
    )
    def test_optional_fields_can_be_mapped(
        self, eval_input, required_fields, input_mapping, expected
    ):
        out = remap_eval_input(
            eval_input=eval_input, required_fields=required_fields, input_mapping=input_mapping
        )
        for k, v in expected.items():
            assert out[k] == v

    @pytest.mark.parametrize(
        "eval_input,required_fields,input_mapping,expected_present,expected_absent",
        [
            pytest.param(
                {"a": "x"},
                {"a"},
                {"b": "missing.path"},
                {"a": "x"},
                ["b"],
                id="optional_mapped_field_missing_is_ignored",
            ),
        ],
    )
    def test_optional_mapped_field_missing_is_ignored(
        self, eval_input, required_fields, input_mapping, expected_present, expected_absent
    ):
        out = remap_eval_input(
            eval_input=eval_input, required_fields=required_fields, input_mapping=input_mapping
        )
        for k, v in expected_present.items():
            assert out[k] == v
        for k in expected_absent:
            assert k not in out

    @pytest.mark.parametrize(
        "eval_input,required_fields,input_mapping,expected_error",
        [
            pytest.param(
                {"items": ["only-one"]},
                {"v"},
                {"v": "items[1]"},
                "not found",
                id="index_out_of_range",
            ),
            pytest.param(
                {"root": {}},
                {"v"},
                {"v": "root.missing"},
                "not found",
                id="missing_key",
            ),
        ],
    )
    def test_remap_error_cases(self, eval_input, required_fields, input_mapping, expected_error):
        with pytest.raises(ValueError, match=expected_error):
            remap_eval_input(
                eval_input=eval_input, required_fields=required_fields, input_mapping=input_mapping
            )

    @pytest.mark.parametrize(
        "eval_input,required_fields,input_mapping,expected_error_type",
        [
            pytest.param(
                {"x": "value"},
                {"y"},
                {"y": "x["},
                JsonPathParserError,
                id="malformed_syntax_raises_jsonpath_error",
            ),
            pytest.param(
                {"x": "value"},
                {"y"},
                {"y": "x[abc]"},
                ValueError,
                id="invalid_syntax_raises_value_error",
            ),
        ],
    )
    def test_invalid_path_patterns_raise_error(
        self, eval_input, required_fields, input_mapping, expected_error_type
    ):
        with pytest.raises(expected_error_type):
            remap_eval_input(
                eval_input=eval_input, required_fields=required_fields, input_mapping=input_mapping
            )

    @pytest.mark.parametrize(
        "eval_input,required_fields,input_mapping,expected_error_type,expected_error_match",
        [
            pytest.param(
                {"x": 1},
                {"y"},
                {"y": 123},
                TypeError,
                "Invalid mapping",
                id="invalid_mapping_type_raises_type_error",
            ),
        ],
    )
    def test_invalid_mapping_type_raises(
        self, eval_input, required_fields, input_mapping, expected_error_type, expected_error_match
    ):
        with pytest.raises(expected_error_type, match=expected_error_match):
            remap_eval_input(
                eval_input=eval_input, required_fields=required_fields, input_mapping=input_mapping
            )


class TestExtractWithJsonPath:
    """Test the extract_with_jsonpath utility function."""

    @pytest.mark.parametrize(
        "payload,path,match_all,expected_value",
        [
            pytest.param({"key": "value"}, "key", False, "value", id="Simple key"),
            pytest.param({"a": {"b": "c"}}, "a.b", False, "c", id="Nested key"),
            pytest.param({"a": {"b": {"c": "d"}}}, "a.b.c", False, "d", id="Deep nested key"),
            pytest.param({"items": ["a", "b", "c"]}, "items[0]", False, "a", id="List index"),
            pytest.param(
                {"items": ["a", "b", "c"]}, "items[1]", False, "b", id="List index with value"
            ),
            pytest.param(
                {"data": {"items": ["a", "b"]}},
                "data.items[0]",
                False,
                "a",
                id="Nested list index",
            ),
            pytest.param(
                {"items": [{"name": "item1"}, {"name": "item2"}]},
                "items[0].name",
                False,
                "item1",
                id="List of objects",
            ),
            pytest.param(
                {"items": [{"data": {"value": 42}}]},
                "items[0].data.value",
                False,
                42,
                id="Deep nested in list",
            ),
            pytest.param(
                {"items": [["a", "b"], ["c", "d"]]}, "items[0][1]", False, "b", id="Nested lists"
            ),
            # Test case for path pointing to None value
            pytest.param({"key": None}, "key", False, None, id="Path to None value"),
            # Test case for match_all=True with nested object matches
            pytest.param(
                {"store": {"books": [{"title": "Book A"}, {"title": "Book B"}]}},
                "store.books[*].title",
                True,
                ["Book A", "Book B"],
                id="Match all nested values",
            ),
            # Test case for match_all=False with nested object matches
            pytest.param(
                {"store": {"books": [{"title": "Book A"}, {"title": "Book B"}]}},
                "store.books[*].title",
                False,
                "Book A",
                id="Match first nested value",
            ),
            # Test case for array return without wildcards
            pytest.param(
                {"store": {"books": [{"title": "Book A"}, {"title": "Book B"}]}},
                "store.books",
                False,
                [{"title": "Book A"}, {"title": "Book B"}],
                id="Return full array without wildcards",
            ),
            # Test case where top match is a list
            pytest.param(
                {"items": [1, 2, 3]},
                "items",
                False,
                [1, 2, 3],
                id="Top match is list",
            ),
        ],
    )
    def test_extract_with_path_success(self, payload, path, match_all, expected_value):
        """Test successful value extraction from nested structure."""
        result = extract_with_jsonpath(payload, path, match_all)
        assert result == expected_value

    @pytest.mark.parametrize(
        "payload,path,error_type,error_match",
        [
            # Test case for unparseable path
            pytest.param(
                {"key": "value"},
                "[invalid",
                JsonPathParserError,
                "Parse error",
                id="Unparseable path",
            ),
            # Test case for path not found
            pytest.param(
                {"a": {}},
                "a.missing",
                ValueError,
                "Path not found",
                id="Missing path",
            ),
            # Test case for list index out of range
            pytest.param(
                {"items": ["a"]},
                "items[1]",
                ValueError,
                "Path not found",
                id="Index out of range",
            ),
        ],
    )
    def test_extract_with_path_errors(self, payload, path, error_type, error_match):
        """Test error handling for various error cases."""
        with pytest.raises(error_type, match=error_match):
            extract_with_jsonpath(payload, path)


class TestFormatAsAnnotationDataframe:
    """Test the to_annotation_dataframe utility function."""

    @pytest.mark.parametrize(
        "score_data,score_name,expected_columns",
        [
            pytest.param(
                {
                    "score": 0.85,
                    "label": "good",
                    "explanation": "The response is accurate and helpful",
                    "metadata": {"model": "gpt-4"},
                    "source": "llm",
                    "direction": "maximize",
                },
                "hallucination",
                [
                    "span_id",
                    "score",
                    "label",
                    "explanation",
                    "metadata",
                    "annotation_name",
                    "annotator_kind",
                ],
                id="complete_score_data",
            ),
        ],
    )
    def test_output_column_structure(self, score_data, score_name, expected_columns):
        """Test that output has correct column structure."""
        df = pd.DataFrame({"span_id": ["span_1"], f"{score_name}_score": [json.dumps(score_data)]})
        result = to_annotation_dataframe(dataframe=df, score_names=[score_name])
        assert list(result.columns) == expected_columns

    @pytest.mark.parametrize(
        "score_data,score_name,expected_score",
        [
            pytest.param(
                {"score": 0.85, "source": "llm"},
                "test",
                0.85,
                id="numeric_score",
            ),
            pytest.param(
                {"score": 1.0, "source": "llm"},
                "test",
                1.0,
                id="perfect_score",
            ),
            pytest.param(
                {"score": 0, "source": "llm"},
                "test",
                0,
                id="zero_score",
            ),
        ],
    )
    def test_score_extraction(self, score_data, score_name, expected_score):
        """Test that score values are extracted correctly."""
        df = pd.DataFrame({"span_id": ["span_1"], f"{score_name}_score": [json.dumps(score_data)]})
        result = to_annotation_dataframe(dataframe=df, score_names=[score_name])
        assert result["score"].iloc[0] == expected_score

    @pytest.mark.parametrize(
        "score_data,score_name,expected_label",
        [
            pytest.param(
                {"score": 0.85, "label": "good", "source": "llm"},
                "test",
                "good",
                id="string_label",
            ),
            pytest.param(
                {"score": 0.85, "label": "excellent", "source": "llm"},
                "test",
                "excellent",
                id="different_label",
            ),
        ],
    )
    def test_label_extraction(self, score_data, score_name, expected_label):
        """Test that label values are extracted correctly."""
        df = pd.DataFrame({"span_id": ["span_1"], f"{score_name}_score": [json.dumps(score_data)]})
        result = to_annotation_dataframe(dataframe=df, score_names=[score_name])
        assert result["label"].iloc[0] == expected_label

    @pytest.mark.parametrize(
        "score_data,score_name,expected_explanation",
        [
            pytest.param(
                {"score": 0.85, "explanation": "The response is accurate", "source": "llm"},
                "test",
                "The response is accurate",
                id="string_explanation",
            ),
            pytest.param(
                {
                    "score": 0.85,
                    "explanation": "Long detailed explanation with multiple words",
                    "source": "llm",
                },
                "test",
                "Long detailed explanation with multiple words",
                id="long_explanation",
            ),
        ],
    )
    def test_explanation_extraction(self, score_data, score_name, expected_explanation):
        """Test that explanation values are extracted correctly."""
        df = pd.DataFrame({"span_id": ["span_1"], f"{score_name}_score": [json.dumps(score_data)]})
        result = to_annotation_dataframe(dataframe=df, score_names=[score_name])
        assert result["explanation"].iloc[0] == expected_explanation

    @pytest.mark.parametrize(
        "score_data,score_name,expected_metadata",
        [
            pytest.param(
                {"score": 0.85, "metadata": {"model": "gpt-4"}, "source": "llm"},
                "test",
                {"model": "gpt-4"},
                id="simple_metadata",
            ),
            pytest.param(
                {
                    "score": 0.85,
                    "metadata": {
                        "model": "gpt-4",
                        "temperature": 0.7,
                        "tokens": {"input": 100, "output": 50},
                        "nested": {"key": "value"},
                    },
                    "source": "llm",
                },
                "test",
                {
                    "model": "gpt-4",
                    "temperature": 0.7,
                    "tokens": {"input": 100, "output": 50},
                    "nested": {"key": "value"},
                },
                id="complex_metadata",
            ),
            pytest.param(
                {
                    "score": 0.85,
                    "metadata": {"model": "gpt-4"},
                    "direction": "maximize",
                    "source": "llm",
                },
                "test",
                {"model": "gpt-4", "direction": "maximize"},
                id="metadata_with_direction",
            ),
            pytest.param(
                {
                    "score": 0.85,
                    "direction": "minimize",
                    "source": "llm",
                },
                "test",
                {"direction": "minimize"},
                id="direction_only_metadata",
            ),
            pytest.param(
                {
                    "score": 0.85,
                    "metadata": {},
                    "source": "llm",
                },
                "test",
                None,
                id="empty_metadata_no_direction",
            ),
            pytest.param(
                {
                    "score": 0.85,
                    "metadata": {},
                    "direction": "maximize",
                    "source": "llm",
                },
                "test",
                {"direction": "maximize"},
                id="empty_metadata_with_direction",
            ),
            pytest.param(
                {
                    "score": 0.85,
                    "metadata": None,
                    "source": "llm",
                },
                "test",
                None,
                id="null_metadata_no_direction",
            ),
            pytest.param(
                {
                    "score": 0.85,
                    "metadata": None,
                    "direction": "minimize",
                    "source": "llm",
                },
                "test",
                {"direction": "minimize"},
                id="null_metadata_with_direction",
            ),
        ],
    )
    def test_metadata_extraction(self, score_data, score_name, expected_metadata):
        """Test that metadata values are extracted correctly."""
        df = pd.DataFrame({"span_id": ["span_1"], f"{score_name}_score": [json.dumps(score_data)]})
        result = to_annotation_dataframe(dataframe=df, score_names=[score_name])
        assert result["metadata"].iloc[0] == expected_metadata

    @pytest.mark.parametrize(
        "score_data,score_name,expected_annotation_name",
        [
            pytest.param(
                {"score": 0.85, "source": "llm"},
                "precision",
                "precision",
                id="precision_score_name",
            ),
            pytest.param(
                {"score": 0.85, "source": "llm"},
                "hallucination",
                "hallucination",
                id="hallucination_score_name",
            ),
            pytest.param(
                {"score": 0.85, "source": "llm"},
                "relevance",
                "relevance",
                id="relevance_score_name",
            ),
        ],
    )
    def test_annotation_name_assignment(self, score_data, score_name, expected_annotation_name):
        """Test that annotation names use the score name by default."""
        df = pd.DataFrame({"span_id": ["span_1"], f"{score_name}_score": [json.dumps(score_data)]})
        result = to_annotation_dataframe(dataframe=df, score_names=[score_name])
        assert result["annotation_name"].iloc[0] == expected_annotation_name

    @pytest.mark.parametrize(
        "score_data,score_name,expected_annotator_kind",
        [
            pytest.param(
                {"score": 0.85, "source": "llm"},
                "test",
                "LLM",
                id="llm_source",
            ),
            pytest.param(
                {"score": 1.0, "source": "heuristic"},
                "test",
                "CODE",
                id="heuristic_source",
            ),
            pytest.param(
                {"score": 0.8, "source": "human"},
                "test",
                "HUMAN",
                id="human_source",
            ),
            pytest.param(
                {"score": 0.6, "source": "unknown_source"},
                "test",
                "LLM",
                id="unknown_source_defaults_to_llm",
            ),
        ],
    )
    def test_annotator_kind_inference(self, score_data, score_name, expected_annotator_kind):
        """Test that annotator kind is inferred correctly from source."""
        df = pd.DataFrame({"span_id": ["span_1"], f"{score_name}_score": [json.dumps(score_data)]})
        result = to_annotation_dataframe(dataframe=df, score_names=[score_name])
        assert result["annotator_kind"].iloc[0] == expected_annotator_kind

    @pytest.mark.parametrize(
        "score_data,score_name,expected_span_id",
        [
            pytest.param(
                {"score": 0.85, "source": "llm"},
                "test",
                "span_1",
                id="basic_span_id",
            ),
            pytest.param(
                {"score": 0.85, "source": "llm"},
                "test",
                "custom_span_123",
                id="custom_span_id",
            ),
        ],
    )
    def test_span_id_preservation(self, score_data, score_name, expected_span_id):
        """Test that span_id values are preserved correctly."""
        df = pd.DataFrame(
            {"span_id": [expected_span_id], f"{score_name}_score": [json.dumps(score_data)]}
        )
        result = to_annotation_dataframe(dataframe=df, score_names=[score_name])
        assert result["span_id"].iloc[0] == expected_span_id

    @pytest.mark.parametrize(
        "span_id_column,score_data,score_name",
        [
            pytest.param(
                "span_id",
                {"score": 0.9, "source": "llm"},
                "test",
                id="lowercase_span_id",
            ),
            pytest.param(
                "context.span_id",
                {"score": 0.9, "source": "llm"},
                "test",
                id="context.span_id",
            ),
            pytest.param(
                "Span_Id",
                {"score": 0.9, "source": "llm"},
                "test",
                id="mixed_case_span_id",
            ),
            pytest.param(
                "trace_span_id",
                {"score": 0.9, "source": "llm"},
                "test",
                id="prefixed_span_id",
            ),
            pytest.param(
                "my_span_id_column",
                {"score": 0.9, "source": "llm"},
                "test",
                id="long_span_id_name",
            ),
        ],
    )
    def test_span_id_column_detection(self, span_id_column, score_data, score_name):
        """Test that different span_id column names are detected correctly."""
        df = pd.DataFrame(
            {span_id_column: ["span_1"], f"{score_name}_score": [json.dumps(score_data)]}
        )
        result = to_annotation_dataframe(dataframe=df, score_names=[score_name])
        assert span_id_column in result.columns

    def test_multiple_span_id_columns_preserved(self):
        """Test that multiple span_id columns are preserved in the output."""
        score_data = {"score": 0.85, "source": "llm"}
        df = pd.DataFrame(
            {
                "span_id": ["span_1"],
                "parent_span_id": ["parent_1"],
                "child_span_id": ["child_1"],
                "context.span_id": ["context_span_1"],
                "test_score": [json.dumps(score_data)],
            }
        )
        result = to_annotation_dataframe(dataframe=df, score_names=["test"])

        # All span_id columns should be preserved
        expected_span_id_columns = ["span_id", "parent_span_id", "child_span_id", "context.span_id"]
        for col in expected_span_id_columns:
            assert col in result.columns, f"Expected column {col} not found in result"

        # Plus the annotation columns
        expected_annotation_columns = [
            "score",
            "label",
            "explanation",
            "metadata",
            "annotation_name",
            "annotator_kind",
        ]
        for col in expected_annotation_columns:
            assert col in result.columns, f"Expected column {col} not found in result"

        # Should have exactly the expected columns
        expected_total_columns = expected_span_id_columns + expected_annotation_columns
        assert set(result.columns) == set(expected_total_columns)

    @pytest.mark.parametrize(
        "score_data,score_name,expected_value",
        [
            pytest.param(
                {"score": 0.5, "source": "llm"},
                "test",
                None,
                id="missing_label",
            ),
            pytest.param(
                {"score": 0.5, "source": "llm"},
                "test",
                None,
                id="missing_explanation",
            ),
            pytest.param(
                {"score": 0.5, "source": "llm"},
                "test",
                None,
                id="missing_metadata",
            ),
        ],
    )
    def test_missing_optional_fields(self, score_data, score_name, expected_value):
        """Test handling of missing optional fields."""
        df = pd.DataFrame({"span_id": ["span_1"], f"{score_name}_score": [json.dumps(score_data)]})
        result = to_annotation_dataframe(dataframe=df, score_names=[score_name])
        # Test that missing fields are None
        assert pd.isna(result["label"].iloc[0]) or result["label"].iloc[0] is None
        assert pd.isna(result["explanation"].iloc[0]) or result["explanation"].iloc[0] is None
        assert pd.isna(result["metadata"].iloc[0]) or result["metadata"].iloc[0] is None

    @pytest.mark.parametrize(
        "score_column_value,score_name,expected_score",
        [
            pytest.param(
                None,
                "test",
                None,
                id="none_score_value",
            ),
            pytest.param(
                "",
                "test",
                None,
                id="empty_string_score",
            ),
            pytest.param(
                json.dumps({"score": None, "source": "llm"}),
                "test",
                None,
                id="none_score_in_json",
            ),
        ],
    )
    def test_none_and_empty_score_handling(self, score_column_value, score_name, expected_score):
        """Test handling of None and empty score values."""
        df = pd.DataFrame({"span_id": ["span_1"], f"{score_name}_score": [score_column_value]})
        result = to_annotation_dataframe(dataframe=df, score_names=[score_name])
        assert pd.isna(result["score"].iloc[0]) or result["score"].iloc[0] is None

    def test_multiple_scores_use_first_source_for_annotator_kind(self):
        """Test that annotator kind uses source from first non-null score."""
        df = pd.DataFrame(
            {
                "span_id": ["span_1", "span_2", "span_3"],
                "mixed_score": [
                    json.dumps({"score": 0.8, "source": "heuristic"}),  # First non-null
                    json.dumps({"score": 0.9, "source": "llm"}),
                    json.dumps({"score": 0.7, "source": "human"}),
                ],
            }
        )
        result = to_annotation_dataframe(dataframe=df, score_names=["mixed"])
        # Should use "heuristic" from first non-null score
        assert all(result["annotator_kind"] == "CODE")

    def test_all_none_scores_default_to_llm_annotator_kind(self):
        """Test that all None scores default to LLM annotator kind."""
        df = pd.DataFrame({"span_id": ["span_1", "span_2"], "none_score": [None, None]})
        result = to_annotation_dataframe(dataframe=df, score_names=["none"])
        # Should default to LLM when no source can be determined
        assert all(result["annotator_kind"] == "LLM")

    def test_original_dataframe_preservation(self):
        """Test that original dataframe is not modified."""
        original_score = json.dumps({"score": 0.8, "source": "llm"})
        df = pd.DataFrame({"span_id": ["span_1"], "preserve_score": [original_score]})
        original_df = df.copy()
        to_annotation_dataframe(dataframe=df, score_names=["preserve"])
        # Original dataframe should be unchanged
        pd.testing.assert_frame_equal(df, original_df)

    def test_large_dataframe_handling(self):
        """Test formatting with a larger dataframe."""
        n_rows = 1000
        score_data = {
            "score": 0.75,
            "label": "good",
            "explanation": "Standard response",
            "metadata": {"model": "gpt-3.5"},
            "source": "llm",
        }
        df = pd.DataFrame(
            {
                "span_id": [f"span_{i}" for i in range(n_rows)],
                "large_score": [json.dumps(score_data) for _ in range(n_rows)],
            }
        )
        result = to_annotation_dataframe(dataframe=df, score_names=["large"])
        assert len(result) == n_rows

    @pytest.mark.parametrize(
        "score_name,expected_score_column",
        [
            ("precision", "precision_score"),
            ("hallucination", "hallucination_score"),
            ("relevance", "relevance_score"),
            ("quality", "quality_score"),
        ],
    )
    def test_score_column_naming(self, score_name, expected_score_column):
        """Test that score column names are constructed correctly."""
        score_data = {"score": 0.8, "source": "llm"}
        df = pd.DataFrame({"span_id": ["span_1"], expected_score_column: [json.dumps(score_data)]})
        result = to_annotation_dataframe(dataframe=df, score_names=[score_name])
        # Should work without error
        assert len(result) == 1

    @pytest.mark.parametrize(
        "dataframe_columns,score_name,expected_error",
        [
            pytest.param(
                {"span_id": ["span_1"], "other_column": ["value"]},
                "missing",
                "Score column 'missing_score' not found in DataFrame",
                id="missing_score_column",
            ),
        ],
    )
    def test_missing_score_column_error(self, dataframe_columns, score_name, expected_error):
        """Test error when score column is missing."""
        df = pd.DataFrame(dataframe_columns)
        with pytest.raises(ValueError, match=expected_error):
            to_annotation_dataframe(dataframe=df, score_names=[score_name])

    @pytest.mark.parametrize(
        "dataframe_columns,score_name,expected_error",
        [
            pytest.param(
                {"other_column": ["value"], "test_score": [json.dumps({"score": 0.5})]},
                "test",
                "No column containing 'span_id' found in DataFrame",
                id="missing_span_id_column",
            ),
        ],
    )
    def test_missing_span_id_column_error(self, dataframe_columns, score_name, expected_error):
        """Test error when no span_id column is found."""
        df = pd.DataFrame(dataframe_columns)
        with pytest.raises(ValueError, match=expected_error):
            to_annotation_dataframe(dataframe=df, score_names=[score_name])

    def test_invalid_json_in_score_column_error(self):
        """Test error handling for invalid JSON in score column."""
        df = pd.DataFrame({"span_id": ["span_1"], "invalid_score": ["invalid json string"]})
        # Should handle JSON parsing errors gracefully
        with pytest.raises(json.JSONDecodeError):
            to_annotation_dataframe(dataframe=df, score_names=["invalid"])

    # New tests for multiple score names and enhanced functionality

    @pytest.mark.parametrize(
        "score_names,expected_rows,expected_annotation_names",
        [
            pytest.param(["precision"], 2, ["precision"], id="single_score"),
            pytest.param(
                ["precision", "hallucination"],
                4,
                ["precision", "hallucination"],
                id="multiple_scores",
            ),
            pytest.param(["precision", "precision"], 4, ["precision"], id="duplicate_scores"),
            pytest.param(
                [], 4, ["precision", "hallucination"], id="empty_scores_triggers_auto_detect"
            ),
        ],
    )
    def test_multiple_score_names(self, score_names, expected_rows, expected_annotation_names):
        """Test basic functionality with multiple score names."""
        score_data = {"score": 0.8, "source": "llm"}

        # Create DataFrame with all possible score columns
        df_data = {"span_id": ["span_1", "span_2"]}
        for score_name in ["precision", "hallucination"]:
            df_data[f"{score_name}_score"] = [json.dumps(score_data), json.dumps(score_data)]

        df = pd.DataFrame(df_data)
        result = to_annotation_dataframe(dataframe=df, score_names=score_names)

        assert len(result) == expected_rows
        if expected_annotation_names:
            assert set(result["annotation_name"].unique()) == set(expected_annotation_names)

    @pytest.mark.parametrize(
        "index_name,index_values,expected_span_id_cols,should_raise",
        [
            pytest.param(
                "span_id", ["span_123", "span_456"], ["span_id"], False, id="index_as_span_id"
            ),
            pytest.param(None, [0, 1], [], True, id="no_span_id_index"),
        ],
    )
    def test_index_span_id_handling(
        self, index_name, index_values, expected_span_id_cols, should_raise
    ):
        """Test handling of span_id in DataFrame index."""
        score_data = {"score": 0.8, "source": "llm"}

        df = pd.DataFrame(
            {"precision_score": [json.dumps(score_data), json.dumps(score_data)]},
            index=index_values,
        )
        if index_name:
            df.index.name = index_name

        if should_raise:
            with pytest.raises(ValueError, match="No column containing 'span_id' found"):
                to_annotation_dataframe(dataframe=df, score_names=["precision"])
        else:
            result = to_annotation_dataframe(dataframe=df, score_names=["precision"])
            for col in expected_span_id_cols:
                assert col in result.columns
            assert len(result) == 2

    def test_mixed_span_id_sources(self):
        """Test with multiple span_id columns and index."""
        score_data = {"score": 0.8, "source": "llm"}

        df = pd.DataFrame(
            {
                "span_id": ["col_1", "col_2"],
                "parent_span_id": ["parent_1", "parent_2"],
                "precision_score": [json.dumps(score_data), json.dumps(score_data)],
            },
            index=["idx_1", "idx_2"],
        )
        df.index.name = "span_id"

        result = to_annotation_dataframe(dataframe=df, score_names=["precision"])

        # Should have all span_id sources
        expected_cols = ["span_id", "parent_span_id", "span_id_from_index"]
        assert all(col in result.columns for col in expected_cols)

    @pytest.mark.parametrize(
        "score_columns,score_names,should_raise",
        [
            pytest.param(["precision_score"], ["precision"], False, id="valid_score"),
            pytest.param(
                ["precision_score"], ["precision", "hallucination"], True, id="missing_score"
            ),
        ],
    )
    def test_missing_score_columns(self, score_columns, score_names, should_raise):
        """Test error handling for missing score columns."""
        score_data = {"score": 0.8, "source": "llm"}

        df_data = {"span_id": ["span_1"]}
        for col in score_columns:
            df_data[col] = [json.dumps(score_data)]

        df = pd.DataFrame(df_data)

        if should_raise:
            with pytest.raises(ValueError, match="Score column .* not found"):
                to_annotation_dataframe(dataframe=df, score_names=score_names)
        else:
            result = to_annotation_dataframe(dataframe=df, score_names=score_names)
            assert len(result) == 1

    def test_none_scores_and_index_reset(self):
        """Test handling of None scores and index reset."""
        score_data = {"score": 0.8, "source": "llm"}

        df = pd.DataFrame(
            {
                "span_id": ["span_1", "span_2"],
                "precision_score": [json.dumps(score_data), None],
                "hallucination_score": [None, json.dumps(score_data)],
            },
            index=[10, 20],  # Non-sequential index
        )

        result = to_annotation_dataframe(dataframe=df, score_names=["precision", "hallucination"])

        # Should have sequential index and handle None scores
        assert list(result.index) == [0, 1, 2, 3]
        assert len(result) == 4
        assert result["score"].isna().any()  # Some scores should be None

    # Tests for auto-detection of score columns when score_names is None

    @pytest.mark.parametrize(
        "score_columns,expected_score_names,expected_rows",
        [
            pytest.param(
                ["precision_score", "hallucination_score"],
                ["precision", "hallucination"],
                4,  # 2 spans × 2 scores
                id="multiple_score_columns",
            ),
            pytest.param(
                ["precision_score"],
                ["precision"],
                2,  # 2 spans × 1 score
                id="single_score_column",
            ),
            pytest.param(
                ["precision_score", "hallucination_score", "relevance_score"],
                ["precision", "hallucination", "relevance"],
                6,  # 2 spans × 3 scores
                id="three_score_columns",
            ),
            pytest.param(
                [],
                [],
                0,
                id="no_score_columns",
            ),
        ],
    )
    def test_auto_detect_score_columns(self, score_columns, expected_score_names, expected_rows):
        """Test auto-detection of score columns when score_names is None."""
        score_data = {"score": 0.8, "source": "llm"}

        # Create DataFrame with specified score columns
        df_data = {"span_id": ["span_1", "span_2"]}
        for col in score_columns:
            df_data[col] = [json.dumps(score_data), json.dumps(score_data)]

        df = pd.DataFrame(df_data)
        result = to_annotation_dataframe(dataframe=df, score_names=None)

        assert len(result) == expected_rows
        if expected_score_names:
            assert set(result["annotation_name"].unique()) == set(expected_score_names)

    @pytest.mark.parametrize(
        "score_column_data,expected_behavior",
        [
            pytest.param(
                {"precision_score": [json.dumps({"score": 0.8, "source": "llm"})]},
                "success",
                id="valid_score_data",
            ),
            pytest.param(
                {"precision_score": [None]},
                "success",
                id="none_score_data",
            ),
            pytest.param(
                {"precision_score": [""]},
                "success",
                id="empty_string_score_data",
            ),
            pytest.param(
                {"precision_score": ["invalid json"]},
                "error",
                id="invalid_json_score_data",
            ),
            pytest.param(
                {"precision_score": ["not a score object"]},
                "error",
                id="non_score_string_data",
            ),
            pytest.param(
                {"precision_score": [123]},
                "success",
                id="non_score_numeric_data",
            ),
        ],
    )
    def test_auto_detect_handles_various_score_data_types(
        self, score_column_data, expected_behavior
    ):
        """Test that auto-detection handles various types of data in _score columns."""
        df_data = {"span_id": ["span_1"]}
        df_data.update(score_column_data)

        df = pd.DataFrame(df_data)

        if expected_behavior == "error":
            with pytest.raises(json.JSONDecodeError):
                to_annotation_dataframe(dataframe=df, score_names=None)
        else:
            result = to_annotation_dataframe(dataframe=df, score_names=None)
            assert len(result) == 1
            assert "precision" in result["annotation_name"].values

    def test_auto_detect_with_mixed_valid_invalid_scores(self):
        """Test auto-detection when some _score columns have valid data and others don't."""
        df = pd.DataFrame(
            {
                "span_id": ["span_1", "span_2"],
                "precision_score": [json.dumps({"score": 0.8, "source": "llm"}), None],
                "hallucination_score": [None, json.dumps({"score": 0.9, "source": "heuristic"})],
                "invalid_score": ["not json", "also not json"],
            }
        )

        # Should raise JSONDecodeError when encountering invalid JSON
        with pytest.raises(json.JSONDecodeError):
            to_annotation_dataframe(dataframe=df, score_names=None)

    def test_auto_detect_vs_explicit_score_names(self):
        """Test that auto-detection produces same results as explicit score names."""
        score_data = {"score": 0.8, "source": "llm"}

        df = pd.DataFrame(
            {
                "span_id": ["span_1", "span_2"],
                "precision_score": [json.dumps(score_data), json.dumps(score_data)],
                "hallucination_score": [json.dumps(score_data), json.dumps(score_data)],
                "relevance_score": [json.dumps(score_data), json.dumps(score_data)],
            }
        )

        # Test auto-detection
        result_auto = to_annotation_dataframe(dataframe=df, score_names=None)

        # Test explicit score names
        result_explicit = to_annotation_dataframe(
            dataframe=df, score_names=["precision", "hallucination", "relevance"]
        )

        # Results should be identical
        pd.testing.assert_frame_equal(result_auto, result_explicit)

    def test_auto_detect_with_partial_explicit_override(self):
        """Test that explicit score_names overrides auto-detection."""
        score_data = {"score": 0.8, "source": "llm"}

        df = pd.DataFrame(
            {
                "span_id": ["span_1", "span_2"],
                "precision_score": [json.dumps(score_data), json.dumps(score_data)],
                "hallucination_score": [json.dumps(score_data), json.dumps(score_data)],
                "relevance_score": [json.dumps(score_data), json.dumps(score_data)],
            }
        )

        # Auto-detection should find all 3 scores
        result_auto = to_annotation_dataframe(dataframe=df, score_names=None)
        assert len(result_auto) == 6  # 2 spans × 3 scores

        # Explicit should only process specified scores
        result_explicit = to_annotation_dataframe(dataframe=df, score_names=["precision"])
        assert len(result_explicit) == 2  # 2 spans × 1 score
        assert set(result_explicit["annotation_name"].unique()) == {"precision"}

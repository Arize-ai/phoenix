# type: ignore

import pytest
from jsonpath_ng.exceptions import JsonPathParserError

from phoenix.evals.utils import (
    extract_with_jsonpath,
    remap_eval_input,
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
    def test_remap_eval_input_success(
        self, eval_input, required_fields, input_mapping, expected_result
    ):
        """Test successful remapping of eval_input."""
        result = remap_eval_input(eval_input, required_fields, input_mapping)
        assert result == expected_result


class TestRemapEvalInputAdvanced:
    """Deep coverage of remapping paths, transforms, and errors."""

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
        ],
    )
    def test_remap_success_cases(self, eval_input, required_fields, input_mapping, expected):
        result = remap_eval_input(eval_input, required_fields, input_mapping)
        # Expect at least the expected key/values; result may include pass-through optional fields
        for k, v in expected.items():
            assert result.get(k) == v

    def test_optional_fields_pass_through_when_present(self):
        eval_input = {"a": "x", "b": "y", "extra": 1}
        required_fields = {"a"}
        out = remap_eval_input(eval_input, required_fields, None)
        # Required present
        assert out["a"] == "x"
        # Optional provided by caller should be preserved
        assert out["b"] == "y"
        # Unrelated keys are preserved for downstream validation
        assert out["extra"] == 1

    def test_optional_fields_can_be_mapped(self):
        eval_input = {"a": "x", "source_b": "mapped"}
        required_fields = {"a"}
        input_mapping = {"b": "source_b"}
        out = remap_eval_input(eval_input, required_fields, input_mapping)
        assert out["a"] == "x"
        assert out["b"] == "mapped"

    def test_optional_mapped_field_missing_is_ignored(self):
        eval_input = {"a": "x"}
        required_fields = {"a"}
        input_mapping = {"b": "missing.path"}
        out = remap_eval_input(eval_input, required_fields, input_mapping)
        assert out["a"] == "x"
        assert "b" not in out

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
            remap_eval_input(eval_input, required_fields, input_mapping)

    def test_invalid_path_patterns_raise_error(self):
        eval_input = {"x": "value"}
        required_fields = {"y"}

        # Test malformed syntax
        input_mapping = {"y": "x["}
        with pytest.raises(JsonPathParserError):
            remap_eval_input(eval_input, required_fields, input_mapping)

        # Test invalid syntax
        input_mapping = {"y": "x[abc]"}
        with pytest.raises(ValueError):
            remap_eval_input(eval_input, required_fields, input_mapping)

    def test_invalid_mapping_type_raises(self):
        eval_input = {"x": 1}
        required_fields = {"y"}
        with pytest.raises(TypeError, match="Invalid mapping"):
            remap_eval_input(eval_input, required_fields, {"y": 123})


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

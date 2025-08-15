# type: ignore
from contextlib import nullcontext as does_not_raise

import pytest

from phoenix.evals.preview.utils import (
    _extract_with_path,
    _tokenize_path,
    _validate_field_value,
    remap_eval_input,
)


class TestValidateFieldValue:
    """Test the _validate_field_value utility function."""

    @pytest.mark.parametrize(
        "value,field_name,key,expected_raises",
        [
            pytest.param(
                "valid string", "field_name", "key", does_not_raise(), id="Valid string value"
            ),
            pytest.param(123, "field_name", "key", does_not_raise(), id="Valid integer value"),
            pytest.param([1, 2, 3], "field_name", "key", does_not_raise(), id="Valid list value"),
            pytest.param(
                {"key": "value"}, "field_name", "key", does_not_raise(), id="Valid dict value"
            ),
            pytest.param(
                None, "field_name", "key", pytest.raises(ValueError), id="None value raises error"
            ),
            pytest.param(
                "", "field_name", "key", pytest.raises(ValueError), id="Empty string raises error"
            ),
            pytest.param(
                "   ",
                "field_name",
                "key",
                pytest.raises(ValueError),
                id="Whitespace-only string raises error",
            ),
            pytest.param(
                [], "field_name", "key", pytest.raises(ValueError), id="Empty list raises error"
            ),
            pytest.param(
                (), "field_name", "key", pytest.raises(ValueError), id="Empty tuple raises error"
            ),
            pytest.param(
                {}, "field_name", "key", pytest.raises(ValueError), id="Empty dict raises error"
            ),
        ],
    )
    def test_validate_field_value(self, value, field_name, key, expected_raises):
        """Test _validate_field_value with various inputs."""
        with expected_raises:
            _validate_field_value(value, field_name, key)

    @pytest.mark.parametrize(
        "value,expected_error_pattern",
        [
            pytest.param(None, "cannot be None", id="None value error message"),
            pytest.param("", "cannot be empty or whitespace-only", id="Empty string error message"),
            pytest.param(
                "   ", "cannot be empty or whitespace-only", id="Whitespace-only error message"
            ),
            pytest.param([], "cannot be empty", id="Empty list error message"),
            pytest.param((), "cannot be empty", id="Empty tuple error message"),
            pytest.param({}, "cannot be empty", id="Empty dict error message"),
        ],
    )
    def test_validate_field_value_error_messages(self, value, expected_error_pattern):
        """Test that _validate_field_value raises appropriate error messages."""
        with pytest.raises(ValueError, match=expected_error_pattern):
            _validate_field_value(value, "field_name", "key")


class TestTokenizePath:
    """Test the _tokenize_path utility function."""

    @pytest.mark.parametrize(
        "path,expected_tokens",
        [
            pytest.param("", [], id="Empty path"),
            pytest.param("simple", ["simple"], id="Simple key"),
            pytest.param("a.b", ["a", "b"], id="Dot-separated keys"),
            pytest.param("a.b.c", ["a", "b", "c"], id="Multiple dot-separated keys"),
            pytest.param("items[0]", ["items", 0], id="List index"),
            pytest.param("items[1]", ["items", 1], id="List index with value"),
            pytest.param("items[0].name", ["items", 0, "name"], id="List index then key"),
            pytest.param("data.items[0].name", ["data", "items", 0, "name"], id="Complex path"),
            pytest.param("items[0][1]", ["items", 0, 1], id="Multiple list indices"),
            pytest.param("items[0].name[1]", ["items", 0, "name", 1], id="Key then list index"),
        ],
    )
    def test_tokenize_path_success(self, path, expected_tokens):
        """Test successful path tokenization."""
        result = _tokenize_path(path)
        assert result == expected_tokens

    @pytest.mark.parametrize(
        "path,expected_error_pattern",
        [
            pytest.param("items[", "Malformed bracket syntax", id="Missing closing bracket"),
            pytest.param("items[abc]", "Invalid index", id="Non-integer index"),
            pytest.param(
                "items[1.5", "Malformed bracket syntax", id="Float index without closing bracket"
            ),
        ],
    )
    def test_tokenize_path_errors(self, path, expected_error_pattern):
        """Test path tokenization error handling."""
        with pytest.raises(ValueError, match=expected_error_pattern):
            _tokenize_path(path)


class TestExtractWithPath:
    """Test the _extract_with_path utility function."""

    @pytest.mark.parametrize(
        "payload,path,expected_value",
        [
            pytest.param({"key": "value"}, "key", "value", id="Simple key"),
            pytest.param({"a": {"b": "c"}}, "a.b", "c", id="Nested key"),
            pytest.param({"a": {"b": {"c": "d"}}}, "a.b.c", "d", id="Deep nested key"),
            pytest.param({"items": ["a", "b", "c"]}, "items[0]", "a", id="List index"),
            pytest.param({"items": ["a", "b", "c"]}, "items[1]", "b", id="List index with value"),
            pytest.param({"items": ["a", "b", "c"]}, "items[-1]", "c", id="Negative list index"),
            pytest.param(
                {"data": {"items": ["a", "b"]}}, "data.items[0]", "a", id="Nested list index"
            ),
            pytest.param(
                {"items": [{"name": "item1"}, {"name": "item2"}]},
                "items[0].name",
                "item1",
                id="List of objects",
            ),
            pytest.param(
                {"items": [{"data": {"value": 42}}]},
                "items[0].data.value",
                42,
                id="Deep nested in list",
            ),
            pytest.param(
                {"items": [["a", "b"], ["c", "d"]]}, "items[0][1]", "b", id="Nested lists"
            ),
        ],
    )
    def test_extract_with_path_success(self, payload, path, expected_value):
        """Test successful value extraction from nested structure."""
        result = _extract_with_path(payload, path)
        assert result == expected_value

    @pytest.mark.parametrize(
        "payload,path,expected_error_pattern",
        [
            pytest.param({}, "missing", "Missing key", id="Missing key"),
            pytest.param({"a": {}}, "a.missing", "Missing key", id="Missing nested key"),
            pytest.param({"items": []}, "items[0]", "Index out of range", id="Empty list index"),
            pytest.param(
                {"items": ["a"]}, "items[1]", "Index out of range", id="Index out of range"
            ),
            pytest.param({"a": "not_list"}, "a[0]", "Index out of range", id="Index on non-list"),
        ],
    )
    def test_extract_with_path_errors(self, payload, path, expected_error_pattern):
        """Test value extraction error handling."""
        with pytest.raises(ValueError, match=expected_error_pattern):
            _extract_with_path(payload, path)

    def test_extract_with_path_empty_path(self):
        """Test that empty path returns None."""
        payload = {"key": "value"}
        result = _extract_with_path(payload, "")
        assert result is None


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

    @pytest.mark.parametrize(
        "eval_input,required_fields,input_mapping,expected_error_pattern",
        [
            pytest.param(
                {"input": "test"},
                {"input", "output"},
                None,
                r"(Missing required field|Missing key)",
                id="Missing required field raises error",
            ),
            pytest.param(
                {"input": ""},
                {"input"},
                None,
                "cannot be empty",
                id="Empty field value raises error",
            ),
            pytest.param(
                {"input": None},
                {"input"},
                None,
                "cannot be None",
                id="None field value raises error",
            ),
        ],
    )
    def test_remap_eval_input_errors(
        self, eval_input, required_fields, input_mapping, expected_error_pattern
    ):
        """Test remap_eval_input error handling."""
        with pytest.raises(ValueError, match=expected_error_pattern):
            remap_eval_input(eval_input, required_fields, input_mapping)


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
                "Index out of range",
                id="index_out_of_range",
            ),
            pytest.param(
                {"root": {}},
                {"v"},
                {"v": "root.missing"},
                "Missing key",
                id="missing_key",
            ),
            pytest.param(
                {"a": None},
                {"a"},
                None,
                "cannot be None",
                id="required_field_resolves_to_none",
            ),
        ],
    )
    def test_remap_error_cases(self, eval_input, required_fields, input_mapping, expected_error):
        with pytest.raises(ValueError, match=expected_error):
            remap_eval_input(eval_input, required_fields, input_mapping)

    def test_unknown_transform_raises_error(self):
        eval_input = {"x": " A "}
        required_fields = {"y"}
        input_mapping = {"y": "x | unknown_transform | strip"}
        # Invalid path syntax should raise an error from _tokenize_path
        with pytest.raises(ValueError):
            remap_eval_input(eval_input, required_fields, input_mapping)

    def test_invalid_path_patterns_raise_error(self):
        eval_input = {"x": "value"}
        required_fields = {"y"}

        # Test malformed bracket syntax
        input_mapping = {"y": "x["}
        with pytest.raises(ValueError, match="Malformed bracket syntax"):
            remap_eval_input(eval_input, required_fields, input_mapping)

        # Test invalid index (non-integer)
        input_mapping = {"y": "x[abc]"}
        with pytest.raises(ValueError, match="Invalid index"):
            remap_eval_input(eval_input, required_fields, input_mapping)

    def test_invalid_mapping_type_raises(self):
        eval_input = {"x": 1}
        required_fields = {"y"}
        with pytest.raises(TypeError, match="Invalid mapping"):
            remap_eval_input(eval_input, required_fields, {"y": 123})

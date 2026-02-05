import pytest
from pydantic import ValidationError

from phoenix.db.types.evaluators import InputMapping


class TestJSONPathValidation:
    """Tests for path validation in InputMapping.

    Paths are restricted to a simple feature set via AST allowlist.
    Only Root, Child, Fields, Index, and Slice nodes are permitted.

    Supported features:
      - Root marker: $ (optional)
      - Dot notation: field.nested, field.123
      - Bracket notation: ['field'], ["field"], ['field-name']
      - Index access: field[0], field[-1]
      - Wildcard: field[*]
      - Slices: field[0:5], field[::2]

    NOT supported (rejected):
      - '..' recursive descent
      - Bare '@' (use ['@'] instead)
      - Union (|), Intersect (&), Where, WhereNot, This
    """

    # --- Valid expressions (should pass) ---

    @pytest.mark.parametrize(
        "expr",
        [
            # Dot notation
            "field",  # Simple field
            "field.nested",  # Nested fields
            "field.deeply.nested.path",  # Deep nesting
            "a.b.c.d.e",  # Long path
            "field.123",  # Numeric field name
            "items.0.bar",  # Numeric field in chain
            # Bracket notation for fields
            "['field']",  # Bracket with single quotes
            '["field"]',  # Bracket with double quotes
            "['field-name']",  # Special chars in field name
            "['@']",  # @ in bracket notation (allowed)
            '["@"]',  # @ with double quotes (allowed)
            "data['special-key'].value",  # Bracket in chain
            "['123']",  # Numeric string as field name
            # Index access
            "items[0]",  # Index access
            "items[-1]",  # Negative index
            "data[0][1][2]",  # Multiple indices
            # Wildcard
            "items[*]",  # Wildcard
            "items[*].name",  # Wildcard with field access
            # Slices
            "items[0:5]",  # Slice with end
            "items[:5]",  # Slice with end only
            "items[0:]",  # Slice with start only
            "items[::2]",  # Slice with step
            "items[0:10:2]",  # Full slice
            "items[1:3]",  # Slice in path
            # Combined
            "items[0].name",  # Dot and index
            "users[-1].email",  # Negative index in path
            "input.query",  # Typical path
            "output.messages[0].content",  # Complex path
            # With $ prefix
            "$",  # Root only
            "$.field",  # Dot notation with $
            "$.field.nested",  # Nested with $
            "$[0]",  # Index with $
            "$['field']",  # Bracket notation with $
            "$.items[*].name",  # Wildcard with $
            "$['@']",  # @ in bracket with root
        ],
    )
    def test_valid_expressions(self, expr: str) -> None:
        """Valid expressions should be accepted."""
        mapping = InputMapping(
            literal_mapping={},
            path_mapping={"result": expr},
        )
        assert mapping.path_mapping["result"] == expr

    def test_multiple_valid_paths(self) -> None:
        """Multiple valid paths in one mapping should work."""
        mapping = InputMapping(
            literal_mapping={"static": "value"},
            path_mapping={
                "input": "messages[0].content",
                "output": "response.text",
                "score": "metadata.score",
            },
        )
        assert len(mapping.path_mapping) == 3

    # --- Pre-check rejections ---

    def test_empty_string_rejected(self) -> None:
        """Empty string should be rejected."""
        with pytest.raises(ValidationError) as exc_info:
            InputMapping(literal_mapping={}, path_mapping={"x": ""})
        assert "cannot be empty" in str(exc_info.value)

    def test_excessive_length_rejected(self) -> None:
        """Expression exceeding max length should be rejected."""
        long_path = "field" + ".a" * 500  # > 1000 chars
        with pytest.raises(ValidationError) as exc_info:
            InputMapping(literal_mapping={}, path_mapping={"x": long_path})
        assert "maximum length" in str(exc_info.value)

    def test_exactly_max_length_accepted(self) -> None:
        """Expression at exactly max length (1000 chars) should be accepted."""
        # Build a path of exactly 1000 characters
        path = "a" * 1000
        assert len(path) == 1000
        mapping = InputMapping(literal_mapping={}, path_mapping={"x": path})
        assert len(mapping.path_mapping["x"]) == 1000

    # --- '..' rejection ---

    @pytest.mark.parametrize(
        "expr",
        [
            "items..name",  # Recursive descent
            "data..value",  # Another recursive descent
            "$..field",  # With root marker
        ],
    )
    def test_recursive_descent_rejected(self, expr: str) -> None:
        """'..' recursive descent should be rejected (Descendants node not in allowlist)."""
        with pytest.raises(ValidationError) as exc_info:
            InputMapping(literal_mapping={}, path_mapping={"x": expr})
        assert "Descendants" in str(exc_info.value)

    # --- Invalid syntax (parser rejects) ---

    @pytest.mark.parametrize(
        "expr,description",
        [
            ("field[", "unclosed bracket"),
            ("field['name", "unclosed quote"),
        ],
    )
    def test_invalid_syntax_rejected(self, expr: str, description: str) -> None:
        """Expressions with invalid syntax should be rejected."""
        with pytest.raises(ValidationError):
            InputMapping(literal_mapping={}, path_mapping={"x": expr})

    # --- Bare @ rejection ---

    @pytest.mark.parametrize(
        "expr",
        [
            "@",  # Standalone @
            "foo.@.bar",  # @ in middle of path
            "$.@",  # @ after root
            "@.field",  # @ at start with field
        ],
    )
    def test_bare_at_rejected(self, expr: str) -> None:
        """Bare @ should be rejected (use bracket notation ['@'] instead)."""
        with pytest.raises(ValidationError) as exc_info:
            InputMapping(literal_mapping={}, path_mapping={"x": expr})
        assert "Bare '@'" in str(exc_info.value)

    # --- jsonpath-ng extensions rejection ---

    @pytest.mark.parametrize(
        "expr,feature",
        [
            ("a | b", "Union"),  # Union operator
            ("a & b", "Intersect"),  # Intersect operator
            ("a where b", "Where"),  # Where clause
            ("a wherenot b", "WhereNot"),  # WhereNot clause
            ("`this`", "This"),  # This operator
        ],
    )
    def test_jsonpath_ng_extensions_rejected(self, expr: str, feature: str) -> None:
        """jsonpath-ng extensions should be rejected."""
        with pytest.raises(ValidationError) as exc_info:
            InputMapping(literal_mapping={}, path_mapping={"x": expr})
        assert feature in str(exc_info.value)

    # --- Edge cases ---

    def test_wildcard_and_slices_allowed(self) -> None:
        """Wildcard and slice expressions should be allowed."""
        mapping = InputMapping(
            literal_mapping={},
            path_mapping={
                "all": "items[*]",
                "nested": "items[*].name",
                "slice": "items[0:5]",
            },
        )
        assert mapping.path_mapping["all"] == "items[*]"
        assert mapping.path_mapping["slice"] == "items[0:5]"

    def test_literal_mapping_unaffected(self) -> None:
        """Literal mapping should not be validated as path."""
        mapping = InputMapping(
            literal_mapping={
                "not_a_path": "this is just a string",
                "invalid_syntax": "a | b",  # Would fail as path_mapping (Union)
            },
            path_mapping={"valid": "field.nested"},
        )
        assert mapping.literal_mapping["invalid_syntax"] == "a | b"

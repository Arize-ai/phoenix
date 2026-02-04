import pytest
from pydantic import ValidationError

from phoenix.db.types.evaluators import InputMapping


class TestJSONPathValidation:
    """Tests for JSONPath validation in InputMapping.

    We support the intersection of RFC 9535 and jsonpath-ng base parser:
    - Root ($), child (.name, ['name']), index ([n]), wildcard ([*])
    - Slice ([start:end:step]), descendants (..)
    - Multiple name selectors (['a', 'b'])

    RFC 9535 features NOT supported (jsonpath-ng can't parse):
    - Filter expressions: $[?@.price < 10]
    - Function extensions: length(), count(), match(), search(), value()
    - Multiple index/slice selectors: $[0, 3], $[0:2, 5]

    jsonpath-ng extensions NOT in RFC 9535 (rejected by validator):
    - Union (|), Intersect (&), Where, WhereNot, Parent
    """

    # --- Valid expressions (should pass) ---

    @pytest.mark.parametrize(
        "expr",
        [
            "$",  # Root only
            "$.field",  # Dot notation
            "$.field.nested",  # Nested dot notation
            "$.field.deeply.nested.path",  # Deep nesting
            "$['field']",  # Bracket notation single quotes
            '$["field"]',  # Bracket notation double quotes
            "$[0]",  # Positive index
            "$[-1]",  # Negative index
            "$[*]",  # Wildcard
            "$[0:5]",  # Slice with end
            "$[:5]",  # Slice with end only
            "$[0:]",  # Slice with start only
            "$[::2]",  # Slice with step
            "$[0:10:2]",  # Full slice
            "$..field",  # Recursive descent (RFC 9535)
            "$..['field']",  # Recursive descent bracket
            "$.items..name",  # Nested recursive descent
            "$.items[0]",  # Combined dot and index
            "$.items[*].name",  # Wildcard with field access
            "$.items[1:3]",  # Slice in path
            "$['field'][0].name",  # Mixed notation
            "$.users[-1].email",  # Negative index in path
            "$[0][1][2]",  # Multiple indices
            "$.a.b.c.d.e",  # Long path
            "$['a', 'b']",  # Multiple name selectors (RFC 9535)
            '$["foo", "bar"]',  # Multiple name selectors double quotes
        ],
    )
    def test_valid_jsonpath_expressions(self, expr: str) -> None:
        """Valid JSONPath expressions should be accepted."""
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
                "input": "$.messages[0].content",
                "output": "$.response.text",
                "score": "$.metadata.score",
            },
        )
        assert len(mapping.path_mapping) == 3

    # --- Pre-check rejections ---

    def test_empty_string_rejected(self) -> None:
        """Empty string should be rejected."""
        with pytest.raises(ValidationError) as exc_info:
            InputMapping(literal_mapping={}, path_mapping={"x": ""})
        assert "cannot be empty" in str(exc_info.value)

    def test_missing_root_rejected(self) -> None:
        """Expression not starting with $ should be rejected."""
        with pytest.raises(ValidationError) as exc_info:
            InputMapping(literal_mapping={}, path_mapping={"x": "foo.bar"})
        assert "must start with '$'" in str(exc_info.value)

    def test_excessive_length_rejected(self) -> None:
        """Expression exceeding max length should be rejected."""
        long_path = "$" + ".field" * 200  # > 1000 chars
        with pytest.raises(ValidationError) as exc_info:
            InputMapping(literal_mapping={}, path_mapping={"x": long_path})
        assert "maximum length" in str(exc_info.value)

    # --- Invalid syntax (parser rejects) ---

    @pytest.mark.parametrize(
        "expr,description",
        [
            ("$.foo[", "unclosed bracket"),
            ("$foo", "missing dot after root"),
            ("$['field", "unclosed quote"),
        ],
    )
    def test_invalid_syntax_rejected(self, expr: str, description: str) -> None:
        """Expressions with invalid syntax should be rejected."""
        with pytest.raises(ValidationError) as exc_info:
            InputMapping(literal_mapping={}, path_mapping={"x": expr})
        assert "Invalid JSONPath syntax" in str(exc_info.value)

    # --- Disallowed features (jsonpath-ng extensions not in RFC 9535) ---

    @pytest.mark.parametrize(
        "expr,feature",
        [
            ("$.a | $.b", "Union"),  # Union operator
            ("$.x & $.y", "Intersect"),  # Intersect operator
            ("$.a where $.b", "Where"),  # Where clause
            ("$.a wherenot $.b", "WhereNot"),  # WhereNot clause
            ("$.foo.`parent`", "Parent"),  # Parent operator
        ],
    )
    def test_nonrfc_extensions_rejected(self, expr: str, feature: str) -> None:
        """jsonpath-ng extensions not in RFC 9535 should be rejected."""
        with pytest.raises(ValidationError) as exc_info:
            InputMapping(literal_mapping={}, path_mapping={"x": expr})
        assert feature in str(exc_info.value)

    # --- Nested disallowed features (tests recursive walk) ---

    def test_nested_union_rejected(self) -> None:
        """Union nested in path should be rejected."""
        # $.a | $..b - Union at top level (Descendants is allowed, Union is not)
        with pytest.raises(ValidationError) as exc_info:
            InputMapping(literal_mapping={}, path_mapping={"x": "$.a | $..b"})
        assert "Union" in str(exc_info.value)

    # --- Edge cases ---

    def test_wildcard_and_slices_allowed(self) -> None:
        """Wildcard and slice expressions should be allowed."""
        mapping = InputMapping(
            literal_mapping={},
            path_mapping={
                "all": "$[*]",
                "nested": "$.items[*].name",
                "slice": "$.items[0:5]",
            },
        )
        assert mapping.path_mapping["all"] == "$[*]"
        assert mapping.path_mapping["slice"] == "$.items[0:5]"

    def test_special_characters_in_field_names(self) -> None:
        """Field names with special characters (via bracket notation) should work."""
        mapping = InputMapping(
            literal_mapping={},
            path_mapping={
                "hyphen": "$['field-name']",
                "space": "$['field name']",
                "dot": "$['field.name']",
            },
        )
        assert len(mapping.path_mapping) == 3

    def test_literal_mapping_unaffected(self) -> None:
        """Literal mapping should not be validated as JSONPath."""
        mapping = InputMapping(
            literal_mapping={
                "not_a_path": "this is just a string",
                "union_syntax": "$.a | $.b",  # Would fail as path_mapping (Union disallowed)
            },
            path_mapping={"valid": "$.field"},
        )
        assert mapping.literal_mapping["union_syntax"] == "$.a | $.b"

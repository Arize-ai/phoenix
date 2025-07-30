# type: ignore
from typing import Any, Dict, List, Union

import pytest

from phoenix.evals.llm.wrapper import generate_classification_schema


class TestGenerateClassificationSchema:
    """Test cases for the generate_classification_schema function."""

    @pytest.mark.parametrize(
        "labels,expected_enum",
        [
            (["yes", "no"], ["yes", "no"]),
            (["positive", "negative", "neutral"], ["positive", "negative", "neutral"]),
            (["A", "B", "C", "D"], ["A", "B", "C", "D"]),
            (["single"], ["single"]),
        ],
    )
    def test_string_labels_generate_enum_schema(self, labels: List[str], expected_enum: List[str]):
        """Test that string labels generate proper enum schema."""
        schema = generate_classification_schema(labels)

        assert schema["type"] == "object"
        assert "properties" in schema
        assert "required" in schema

        label_schema = schema["properties"]["label"]
        assert label_schema["type"] == "string"
        assert "enum" in label_schema
        assert label_schema["enum"] == expected_enum
        assert "oneOf" not in label_schema

    @pytest.mark.parametrize(
        "labels,expected_one_of",
        [
            (
                {"yes": "", "no": ""},
                [{"const": "yes"}, {"const": "no"}],
            ),
            (
                {
                    "positive": "Positive sentiment",
                    "negative": "Negative sentiment",
                    "neutral": "Neutral sentiment",
                },
                [
                    {"const": "positive", "description": "Positive sentiment"},
                    {"const": "negative", "description": "Negative sentiment"},
                    {"const": "neutral", "description": "Neutral sentiment"},
                ],
            ),
            (
                {"single": ""},
                [{"const": "single"}],
            ),
        ],
    )
    def test_dict_labels_generate_one_of_schema(
        self, labels: Dict[str, str], expected_one_of: List[Dict[str, str]]
    ):
        """Test that dict labels generate proper oneOf schema."""
        schema = generate_classification_schema(labels)

        assert schema["type"] == "object"
        assert "properties" in schema
        assert "required" in schema

        label_schema = schema["properties"]["label"]
        assert label_schema["type"] == "string"
        assert "oneOf" in label_schema
        assert label_schema["oneOf"] == expected_one_of
        assert "enum" not in label_schema

    @pytest.mark.parametrize(
        "description,expected_description",
        [
            ("Test description", "Test description"),
            ("", ""),
            (
                "A very long description with multiple words",
                "A very long description with multiple words",
            ),
        ],
    )
    def test_description_is_added_to_label_schema(
        self, description: str, expected_description: str
    ):
        """Test that description is properly added to the label schema."""
        labels = ["yes", "no"]
        schema = generate_classification_schema(labels, description=description)

        label_schema = schema["properties"]["label"]
        if description:
            assert "description" in label_schema
            assert label_schema["description"] == expected_description
        else:
            assert "description" not in label_schema

    @pytest.mark.parametrize(
        "include_explanation,expected_properties,expected_required",
        [
            (True, ["explanation", "label"], ["explanation", "label"]),
            (False, ["label"], ["label"]),
        ],
    )
    def test_explanation_field_handling(
        self,
        include_explanation: bool,
        expected_properties: List[str],
        expected_required: List[str],
    ):
        """
        Test that explanation field is properly handled based on include_explanation parameter.
        """
        labels = ["yes", "no"]
        schema = generate_classification_schema(labels, include_explanation=include_explanation)

        properties = schema["properties"]
        required = schema["required"]

        assert list(properties.keys()) == expected_properties
        assert required == expected_required

        if include_explanation:
            explanation_schema = properties["explanation"]
            assert explanation_schema["type"] == "string"
            assert explanation_schema["description"] == "A brief explanation of your reasoning."

    def test_explanation_field_order(self):
        """Test that explanation field appears before label field in properties."""
        labels = ["yes", "no"]
        schema = generate_classification_schema(labels, include_explanation=True)

        properties = list(schema["properties"].keys())
        assert properties == ["explanation", "label"]

    def test_required_fields_order(self):
        """Test that required fields are in the correct order."""
        labels = ["yes", "no"]
        schema = generate_classification_schema(labels, include_explanation=True)

        required = schema["required"]
        assert required == ["explanation", "label"]

    @pytest.mark.parametrize(
        "labels,description,include_explanation,expected_schema",
        [
            (
                ["yes", "no"],
                "Test description",
                True,
                {
                    "type": "object",
                    "properties": {
                        "explanation": {
                            "type": "string",
                            "description": "A brief explanation of your reasoning.",
                        },
                        "label": {
                            "type": "string",
                            "description": "Test description",
                            "enum": ["yes", "no"],
                        },
                    },
                    "required": ["explanation", "label"],
                },
            ),
            (
                {"yes": "Positive response", "no": "Negative response"},
                "Test description",
                False,
                {
                    "type": "object",
                    "properties": {
                        "label": {
                            "type": "string",
                            "description": "Test description",
                            "oneOf": [
                                {"const": "yes", "description": "Positive response"},
                                {"const": "no", "description": "Negative response"},
                            ],
                        },
                    },
                    "required": ["label"],
                },
            ),
        ],
    )
    def test_complete_schema_generation(
        self,
        labels: Union[List[str], Dict[str, str]],
        description: str,
        include_explanation: bool,
        expected_schema: Dict[str, Any],
    ):
        """Test complete schema generation with various combinations of parameters."""
        schema = generate_classification_schema(labels, include_explanation, description)
        assert schema == expected_schema

    @pytest.mark.parametrize(
        "invalid_labels,expected_error",
        [
            (None, "Labels must be a non-empty list or dictionary."),
            ("not a list", "Labels must be a list of strings or a dictionary."),
            ([], "Labels must be a non-empty list or dictionary."),
            ({}, "Labels must be a non-empty list or dictionary."),
            ([1, 2, 3], "Labels must be a list of strings or a dictionary."),
            (["yes", 123], "Labels must be a list of strings or a dictionary."),
            (
                {"yes": "Positive", 123: "Invalid"},
                "Labels must be a list of strings or a dictionary.",
            ),
        ],
    )
    def test_invalid_inputs_raise_errors(self, invalid_labels: Any, expected_error: str):
        """Test that invalid inputs raise appropriate ValueError exceptions."""
        with pytest.raises(ValueError, match=expected_error):
            generate_classification_schema(invalid_labels)

    def test_dict_labels_with_optional_description(self):
        """Test that dict labels with optional description field work correctly."""
        labels = {
            "yes": "Positive response",
            "no": "",  # Empty description
            "maybe": "Uncertain response",
        }

        schema = generate_classification_schema(labels)
        label_schema = schema["properties"]["label"]
        one_of = label_schema["oneOf"]

        assert len(one_of) == 3
        assert one_of[0] == {"const": "yes", "description": "Positive response"}
        assert one_of[1] == {"const": "no"}
        assert one_of[2] == {"const": "maybe", "description": "Uncertain response"}

    def test_default_parameters(self):
        """Test that default parameters work correctly."""
        labels = ["yes", "no"]
        schema = generate_classification_schema(labels)

        # Should include explanation by default
        assert "explanation" in schema["properties"]
        assert "explanation" in schema["required"]

        # Should not have description by default
        label_schema = schema["properties"]["label"]
        assert "description" not in label_schema

    def test_schema_structure_consistency(self):
        """Test that the generated schema has consistent structure."""
        labels = ["yes", "no"]
        schema = generate_classification_schema(labels)

        # Check top-level structure
        assert isinstance(schema, dict)
        assert schema["type"] == "object"
        assert "properties" in schema
        assert "required" in schema

        # Check properties structure
        properties = schema["properties"]
        assert isinstance(properties, dict)
        assert "label" in properties

        # Check label schema structure
        label_schema = properties["label"]
        assert isinstance(label_schema, dict)
        assert label_schema["type"] == "string"

        # Check required structure
        required = schema["required"]
        assert isinstance(required, list)
        assert "label" in required

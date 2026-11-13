# type: ignore
from typing import Any, Dict, List, Union
from unittest.mock import AsyncMock, MagicMock

import pytest

from phoenix.evals.llm.llm import (
    LLM,
    _parse_classifications,
    generate_classification_schema,
    generate_classifications_schema,
)


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


def test_client_specific_kwargs_override_shared_kwargs(openai_api_key: str) -> None:
    llm = LLM(
        provider="openai",
        model="gpt-4o",
        timeout=30.0,
        sync_client_kwargs={"timeout": 60.0},
        async_client_kwargs={"timeout": 120.0},
    )

    assert llm._sync_client.timeout == 60.0
    assert llm._async_client.timeout == 120.0


def test_wrapper_shim_backward_compatibility():
    """Verify that phoenix.evals.llm.wrapper continues to export all public symbols."""
    from phoenix.evals.llm.llm import (
        LLM,
        generate_classification_schema,
        show_provider_availability,
    )
    from phoenix.evals.llm.wrapper import (
        LLM as ShimLLM,
    )
    from phoenix.evals.llm.wrapper import (
        generate_classification_schema as shim_generate_schema,
    )
    from phoenix.evals.llm.wrapper import (
        show_provider_availability as shim_show_availability,
    )

    assert ShimLLM is LLM
    assert shim_generate_schema is generate_classification_schema
    assert shim_show_availability is show_provider_availability


class TestGenerateClassificationsSchema:
    """Test cases for the multi-criterion generate_classifications_schema function."""

    def test_one_property_per_criterion_keyed_by_name(self):
        criteria = [
            {"name": "helpfulness", "labels": ["poor", "good"], "instructions": "how helpful"},
            {"name": "accuracy", "labels": {"right": "ok", "wrong": "nope"}},
        ]
        schema = generate_classifications_schema(criteria, include_explanation=True)

        assert schema["type"] == "object"
        assert list(schema["properties"].keys()) == ["helpfulness", "accuracy"]
        assert schema["required"] == ["helpfulness", "accuracy"]

    def test_each_property_is_a_single_criterion_schema(self):
        criteria = [{"name": "accuracy", "labels": {"right": "ok", "wrong": "nope"}}]
        schema = generate_classifications_schema(criteria, include_explanation=True)

        inner = schema["properties"]["accuracy"]
        expected = generate_classification_schema(
            {"right": "ok", "wrong": "nope"}, include_explanation=True
        )
        # Same inner object (label oneOf/enum + explanation), nested under the criterion name.
        assert {k: inner[k] for k in expected} == expected

    def test_instructions_become_the_property_description(self):
        criteria = [
            {"name": "helpfulness", "labels": ["poor", "good"], "instructions": "how helpful"}
        ]
        schema = generate_classifications_schema(criteria, include_explanation=True)
        assert schema["properties"]["helpfulness"]["description"] == "how helpful"

    def test_missing_instructions_adds_no_description(self):
        criteria = [{"name": "helpfulness", "labels": ["poor", "good"]}]
        schema = generate_classifications_schema(criteria, include_explanation=True)
        assert "description" not in schema["properties"]["helpfulness"]

    def test_include_explanation_false_omits_explanation(self):
        criteria = [{"name": "a", "labels": ["x", "y"]}]
        schema = generate_classifications_schema(criteria, include_explanation=False)
        props = schema["properties"]["a"]["properties"]
        assert "explanation" not in props
        assert schema["properties"]["a"]["required"] == ["label"]


class TestParseClassifications:
    """Test cases for _parse_classifications."""

    def test_unwraps_each_criterion_in_order(self):
        criteria = [{"name": "a", "labels": ["x", "y"]}, {"name": "b", "labels": ["x", "y"]}]
        raw = {
            "b": {"label": "y", "explanation": "because b"},
            "a": {"label": "x", "explanation": "because a"},
        }
        results = _parse_classifications(raw, criteria)
        assert results == [
            {"name": "a", "label": "x", "explanation": "because a"},
            {"name": "b", "label": "y", "explanation": "because b"},
        ]

    def test_explanation_omitted_when_absent(self):
        criteria = [{"name": "a", "labels": ["x", "y"]}]
        results = _parse_classifications({"a": {"label": "x"}}, criteria)
        assert results == [{"name": "a", "label": "x"}]

    def test_missing_criterion_raises(self):
        criteria = [{"name": "a", "labels": ["x", "y"]}]
        with pytest.raises(ValueError, match="malformed or missing answer for criterion 'a'"):
            _parse_classifications({}, criteria)

    def test_non_dict_answer_raises(self):
        """A model returning a bare string for a criterion errors clearly, not an AttributeError."""
        criteria = [{"name": "a", "labels": ["x", "y"]}]
        with pytest.raises(ValueError, match="malformed or missing answer for criterion 'a'"):
            _parse_classifications({"a": "x"}, criteria)

    def test_dict_answer_without_label_raises(self):
        criteria = [{"name": "a", "labels": ["x", "y"]}]
        with pytest.raises(ValueError, match="malformed or missing answer for criterion 'a'"):
            _parse_classifications({"a": {"explanation": "no label here"}}, criteria)


class TestLLMGenerateClassifications:
    """LLM.generate_classifications issues one generate_object call and parses per criterion."""

    def test_one_generate_object_call_returns_one_result_per_criterion(self, openai_api_key):
        llm = LLM(provider="openai", model="gpt-4o", client="openai")
        llm._sync_adapter = MagicMock()
        llm._sync_adapter.generate_object.return_value = {
            "helpfulness": {"label": "good", "explanation": "clear"},
            "accuracy": {"label": "wrong", "explanation": "off"},
        }

        criteria = [
            {"name": "helpfulness", "labels": ["poor", "good"], "instructions": "how helpful"},
            {"name": "accuracy", "labels": {"right": "ok", "wrong": "nope"}},
        ]
        results = llm.generate_classifications("some text", criteria)

        assert results == [
            {"name": "helpfulness", "label": "good", "explanation": "clear"},
            {"name": "accuracy", "label": "wrong", "explanation": "off"},
        ]

        llm._sync_adapter.generate_object.assert_called_once()
        args, _ = llm._sync_adapter.generate_object.call_args
        _prompt, schema = args[0], args[1]
        assert list(schema["properties"].keys()) == ["helpfulness", "accuracy"]

    async def test_async_generate_classifications(self, openai_api_key):
        llm = LLM(provider="openai", model="gpt-4o", client="openai")
        llm._async_adapter = MagicMock()
        llm._async_adapter.async_generate_object = AsyncMock(
            return_value={"a": {"label": "x"}, "b": {"label": "y"}}
        )

        criteria = [{"name": "a", "labels": ["x", "y"]}, {"name": "b", "labels": ["x", "y"]}]
        results = await llm.async_generate_classifications("text", criteria)

        assert [r["name"] for r in results] == ["a", "b"]
        assert [r["label"] for r in results] == ["x", "y"]
        llm._async_adapter.async_generate_object.assert_awaited_once()

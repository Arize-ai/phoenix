import pytest

from phoenix.db import models
from phoenix.db.types.annotation_configs import (
    CategoricalAnnotationConfig,
    CategoricalAnnotationValue,
    OptimizationDirection,
)
from phoenix.db.types.db_helper_types import UNDEFINED
from phoenix.db.types.identifier import Identifier
from phoenix.db.types.model_provider import ModelProvider
from phoenix.server.api.evaluators import apply_input_mapping
from phoenix.server.api.helpers.evaluators import (
    _LLMEvaluatorPromptErrorMessage,
    validate_consistent_llm_evaluator_and_prompt_version,
)
from phoenix.server.api.helpers.prompts.models import (
    PromptChatTemplate,
    PromptMessage,
    PromptOpenAIInvocationParameters,
    PromptOpenAIInvocationParametersContent,
    PromptResponseFormatJSONSchema,
    PromptResponseFormatJSONSchemaDefinition,
    PromptTemplateFormat,
    PromptTemplateType,
    PromptToolChoiceNone,
    PromptToolChoiceOneOrMore,
    PromptToolChoiceSpecificFunctionTool,
    PromptToolChoiceZeroOrMore,
    PromptToolFunction,
    PromptToolFunctionDefinition,
    PromptTools,
    TextContentPart,
)
from phoenix.server.api.input_types.PlaygroundEvaluatorInput import EvaluatorInputMappingInput


class TestValidateConsistentLLMEvaluatorAndPromptVersion:
    def test_both_descriptions_null_does_not_raise(
        self,
        llm_evaluator: models.LLMEvaluator,  # has description = None
        prompt_version: models.PromptVersion,  # has tools.tools[0].function.description = UNDEFINED
    ) -> None:
        validate_consistent_llm_evaluator_and_prompt_version(prompt_version, llm_evaluator)

    def test_both_descriptions_strings_do_not_raise(
        self,
        llm_evaluator: models.LLMEvaluator,
        prompt_version: models.PromptVersion,
    ) -> None:
        description = "evaluates the correctness of the output"
        llm_evaluator.description = description
        assert prompt_version.tools is not None
        prompt_version.tools.tools[0].function.description = description
        validate_consistent_llm_evaluator_and_prompt_version(prompt_version, llm_evaluator)

    def test_string_evaluator_description_and_null_function_description_raises(
        self,
        llm_evaluator: models.LLMEvaluator,
        prompt_version: models.PromptVersion,
    ) -> None:
        llm_evaluator.description = "a string description"
        with pytest.raises(
            ValueError,
            match=_LLMEvaluatorPromptErrorMessage.EVALUATOR_DESCRIPTION_MUST_MATCH_FUNCTION_DESCRIPTION,
        ):
            validate_consistent_llm_evaluator_and_prompt_version(prompt_version, llm_evaluator)

    def test_null_evaluator_description_and_string_function_description_raises(
        self,
        llm_evaluator: models.LLMEvaluator,
        prompt_version: models.PromptVersion,
    ) -> None:
        assert prompt_version.tools is not None
        llm_evaluator.description = "my different description"
        prompt_version.tools.tools[0].function.description = "a string description"
        with pytest.raises(
            ValueError,
            match=_LLMEvaluatorPromptErrorMessage.EVALUATOR_DESCRIPTION_MUST_MATCH_FUNCTION_DESCRIPTION,
        ):
            validate_consistent_llm_evaluator_and_prompt_version(prompt_version, llm_evaluator)

    def test_non_null_response_format_raises(
        self,
        llm_evaluator: models.LLMEvaluator,
        prompt_version: models.PromptVersion,
    ) -> None:
        prompt_version.response_format = PromptResponseFormatJSONSchema(
            type="json_schema",
            json_schema=PromptResponseFormatJSONSchemaDefinition(
                name="test",
                schema={"type": "object"},
            ),
        )
        with pytest.raises(
            ValueError,
            match=_LLMEvaluatorPromptErrorMessage.RESPONSE_FORMAT_NOT_SUPPORTED,
        ):
            validate_consistent_llm_evaluator_and_prompt_version(prompt_version, llm_evaluator)

    def test_null_tools_raises(
        self,
        llm_evaluator: models.LLMEvaluator,
        prompt_version: models.PromptVersion,
    ) -> None:
        prompt_version.tools = None
        with pytest.raises(
            ValueError,
            match=_LLMEvaluatorPromptErrorMessage.TOOLS_REQUIRED,
        ):
            validate_consistent_llm_evaluator_and_prompt_version(prompt_version, llm_evaluator)

    def test_empty_tools_list_raises(
        self,
        llm_evaluator: models.LLMEvaluator,
        prompt_version: models.PromptVersion,
    ) -> None:
        assert prompt_version.tools is not None
        prompt_version.tools.__dict__[
            "tools"
        ] = []  # skips validation for empty tools list on PromptTools type
        with pytest.raises(
            ValueError,
            match=_LLMEvaluatorPromptErrorMessage.EXACTLY_ONE_TOOL_REQUIRED,
        ):
            validate_consistent_llm_evaluator_and_prompt_version(prompt_version, llm_evaluator)

    def test_multiple_tools_raises(
        self,
        llm_evaluator: models.LLMEvaluator,
        prompt_version: models.PromptVersion,
    ) -> None:
        assert prompt_version.tools is not None
        prompt_version.tools.tools.append(
            PromptToolFunction(
                type="function",
                function=PromptToolFunctionDefinition(
                    name="hallucination_evaluator",
                    description="evaluates hallucinations",
                    parameters={
                        "type": "object",
                        "properties": {
                            "label": {
                                "type": "string",
                                "enum": ["hallucinated", "not_hallucinated"],
                                "description": "hallucination",
                            }
                        },
                        "required": ["label"],
                    },
                ),
            )
        )
        with pytest.raises(
            ValueError,
            match=_LLMEvaluatorPromptErrorMessage.EXACTLY_ONE_TOOL_REQUIRED,
        ):
            validate_consistent_llm_evaluator_and_prompt_version(prompt_version, llm_evaluator)

    def test_null_tool_choice_raises(
        self,
        llm_evaluator: models.LLMEvaluator,
        prompt_version: models.PromptVersion,
    ) -> None:
        assert prompt_version.tools is not None
        prompt_version.tools.tool_choice = PromptToolChoiceNone(type="none")
        with pytest.raises(
            ValueError,
            match=_LLMEvaluatorPromptErrorMessage.TOOL_CHOICE_REQUIRED,
        ):
            validate_consistent_llm_evaluator_and_prompt_version(prompt_version, llm_evaluator)

    def test_zero_or_more_tool_choice_raises(
        self,
        llm_evaluator: models.LLMEvaluator,
        prompt_version: models.PromptVersion,
    ) -> None:
        assert prompt_version.tools is not None
        prompt_version.tools.tool_choice = PromptToolChoiceZeroOrMore(type="zero_or_more")
        with pytest.raises(
            ValueError,
            match=_LLMEvaluatorPromptErrorMessage.TOOL_CHOICE_REQUIRED,
        ):
            validate_consistent_llm_evaluator_and_prompt_version(prompt_version, llm_evaluator)

    def test_specific_function_tool_choice_with_matching_name_does_not_raise(
        self,
        llm_evaluator: models.LLMEvaluator,
        prompt_version: models.PromptVersion,
    ) -> None:
        assert prompt_version.tools is not None
        prompt_version.tools.tool_choice = PromptToolChoiceSpecificFunctionTool(
            type="specific_function", function_name="correctness_evaluator"
        )
        validate_consistent_llm_evaluator_and_prompt_version(prompt_version, llm_evaluator)

    def test_specific_function_tool_choice_with_mismatched_name_raises(
        self,
        llm_evaluator: models.LLMEvaluator,
        prompt_version: models.PromptVersion,
    ) -> None:
        assert prompt_version.tools is not None
        prompt_version.tools.tool_choice = PromptToolChoiceSpecificFunctionTool(
            type="specific_function", function_name="different_function_name"
        )
        with pytest.raises(
            ValueError,
            match=_LLMEvaluatorPromptErrorMessage.TOOL_CHOICE_SPECIFIC_FUNCTION_NAME_MUST_MATCH_DEFINED_FUNCTION_NAME,
        ):
            validate_consistent_llm_evaluator_and_prompt_version(prompt_version, llm_evaluator)

    def test_function_parameters_type_not_object_raises(
        self,
        llm_evaluator: models.LLMEvaluator,
        prompt_version: models.PromptVersion,
    ) -> None:
        assert prompt_version.tools is not None
        prompt_version.tools.tools[0].function.parameters["type"] = "array"
        with pytest.raises(
            ValueError,
            match="^'correctness_evaluator' function has errors. At 'type': Input should be 'object'.$",
        ):
            validate_consistent_llm_evaluator_and_prompt_version(prompt_version, llm_evaluator)

    def test_empty_function_parameters_properties_raises(
        self,
        llm_evaluator: models.LLMEvaluator,
        prompt_version: models.PromptVersion,
    ) -> None:
        assert prompt_version.tools is not None
        prompt_version.tools.tools[0].function.parameters["properties"] = {}
        with pytest.raises(
            ValueError,
            match="^'correctness_evaluator' function has errors. At 'properties.label': Field required.$",
        ):
            validate_consistent_llm_evaluator_and_prompt_version(prompt_version, llm_evaluator)

    def test_missing_label_property_raises(
        self,
        llm_evaluator: models.LLMEvaluator,
        prompt_version: models.PromptVersion,
    ) -> None:
        assert prompt_version.tools is not None
        prompt_version.tools.tools[0].function.parameters = {
            "type": "object",
            "properties": {
                "other_property": {
                    "type": "string",
                    "enum": ["a", "b"],
                    "description": "some description",
                }
            },
            "required": ["other_property"],
        }
        with pytest.raises(
            ValueError,
            match="^'correctness_evaluator' function has errors. At 'properties.label': Field required.$",
        ):
            validate_consistent_llm_evaluator_and_prompt_version(prompt_version, llm_evaluator)

    def test_label_property_type_not_string_raises(
        self,
        llm_evaluator: models.LLMEvaluator,
        prompt_version: models.PromptVersion,
    ) -> None:
        assert prompt_version.tools is not None
        prompt_version.tools.tools[0].function.parameters = {
            "type": "object",
            "properties": {
                "label": {
                    "type": "number",
                    "enum": ["0", "1"],
                    "description": "correctness",
                }
            },
            "required": ["label"],
        }
        with pytest.raises(
            ValueError,
            match="^'correctness_evaluator' function has errors. At 'properties.label.type': Input should be 'string'.$",
        ):
            validate_consistent_llm_evaluator_and_prompt_version(prompt_version, llm_evaluator)

    def test_label_enum_less_than_two_items_raises(
        self,
        llm_evaluator: models.LLMEvaluator,
        prompt_version: models.PromptVersion,
    ) -> None:
        assert prompt_version.tools is not None
        prompt_version.tools.tools[0].function.parameters = {
            "type": "object",
            "properties": {
                "label": {
                    "type": "string",
                    "enum": ["correct"],
                    "description": "correctness",
                }
            },
            "required": ["label"],
        }
        with pytest.raises(
            ValueError,
            match="^'correctness_evaluator' function has errors. At 'properties.label.enum': List should have at least 2 items after validation, not 1.$",
        ):
            validate_consistent_llm_evaluator_and_prompt_version(prompt_version, llm_evaluator)

    def test_label_missing_enum_field_raises(
        self,
        llm_evaluator: models.LLMEvaluator,
        prompt_version: models.PromptVersion,
    ) -> None:
        assert prompt_version.tools is not None
        prompt_version.tools.tools[0].function.parameters = {
            "type": "object",
            "properties": {
                "label": {
                    "type": "string",
                    "description": "correctness",
                }
            },
            "required": ["label"],
        }
        with pytest.raises(
            ValueError,
            match="^'correctness_evaluator' function has errors. At 'properties.label.enum': Field required.$",
        ):
            validate_consistent_llm_evaluator_and_prompt_version(prompt_version, llm_evaluator)

    def test_label_missing_description_field_raises(
        self,
        llm_evaluator: models.LLMEvaluator,
        prompt_version: models.PromptVersion,
    ) -> None:
        assert prompt_version.tools is not None
        prompt_version.tools.tools[0].function.parameters = {
            "type": "object",
            "properties": {
                "label": {
                    "type": "string",
                    "enum": ["correct", "incorrect"],
                }
            },
            "required": ["label"],
        }
        with pytest.raises(
            ValueError,
            match="^'correctness_evaluator' function has errors. At 'properties.label.description': Field required.$",
        ):
            validate_consistent_llm_evaluator_and_prompt_version(prompt_version, llm_evaluator)

    def test_duplicate_function_parameters_required_values_raises(
        self,
        llm_evaluator: models.LLMEvaluator,
        prompt_version: models.PromptVersion,
    ) -> None:
        assert prompt_version.tools is not None
        prompt_version.tools.tools[0].function.parameters["required"] = [
            "label",
            "label",
        ]
        with pytest.raises(
            ValueError,
            match=_LLMEvaluatorPromptErrorMessage.REQUIRED_VALUES_MUST_BE_UNIQUE,
        ):
            validate_consistent_llm_evaluator_and_prompt_version(prompt_version, llm_evaluator)

    def test_label_defined_but_not_required_raises(
        self,
        llm_evaluator: models.LLMEvaluator,
        prompt_version: models.PromptVersion,
    ) -> None:
        assert prompt_version.tools is not None
        prompt_version.tools.tools[0].function.parameters = {
            "type": "object",
            "properties": {
                "label": {
                    "type": "string",
                    "enum": ["correct", "incorrect"],
                    "description": "correctness",
                }
            },
            "required": [],
        }
        with pytest.raises(
            ValueError,
            match=_LLMEvaluatorPromptErrorMessage.MISSING_REQUIRED_PROPERTIES.format(
                properties="label",
            ),
        ):
            validate_consistent_llm_evaluator_and_prompt_version(prompt_version, llm_evaluator)

    def test_label_and_explanation_defined_but_only_label_required_raises(
        self,
        llm_evaluator: models.LLMEvaluator,
        prompt_version: models.PromptVersion,
    ) -> None:
        assert prompt_version.tools is not None
        prompt_version.tools.tools[0].function.parameters = {
            "type": "object",
            "properties": {
                "label": {
                    "type": "string",
                    "enum": ["correct", "incorrect"],
                    "description": "correctness",
                },
                "explanation": {
                    "type": "string",
                    "description": "explanation for the label",
                },
            },
            "required": ["label"],
        }
        with pytest.raises(
            ValueError,
            match=_LLMEvaluatorPromptErrorMessage.MISSING_REQUIRED_PROPERTIES.format(
                properties="explanation",
            ),
        ):
            validate_consistent_llm_evaluator_and_prompt_version(prompt_version, llm_evaluator)

    def test_unexpected_required_property_raises(
        self,
        llm_evaluator: models.LLMEvaluator,
        prompt_version: models.PromptVersion,
    ) -> None:
        assert prompt_version.tools is not None
        prompt_version.tools.tools[0].function.parameters = {
            "type": "object",
            "properties": {
                "label": {
                    "type": "string",
                    "enum": ["correct", "incorrect"],
                    "description": "correctness",
                }
            },
            "required": ["label", "confidence"],
        }
        with pytest.raises(
            ValueError,
            match="Found unexpected required properties: confidence",
        ):
            validate_consistent_llm_evaluator_and_prompt_version(prompt_version, llm_evaluator)

    def test_label_description_mismatch_raises(
        self,
        llm_evaluator: models.LLMEvaluator,
        prompt_version: models.PromptVersion,
    ) -> None:
        assert prompt_version.tools is not None
        prompt_version.tools.tools[0].function.parameters = {
            "type": "object",
            "properties": {
                "label": {
                    "type": "string",
                    "enum": ["correct", "incorrect"],
                    "description": "different_name",
                }
            },
            "required": ["label"],
        }
        with pytest.raises(
            ValueError,
            match=_LLMEvaluatorPromptErrorMessage.EVALUATOR_ANNOTATION_NAME_MUST_MATCH_FUNCTION_LABEL_PROPERTY_DESCRIPTION,
        ):
            validate_consistent_llm_evaluator_and_prompt_version(prompt_version, llm_evaluator)

    def test_choices_mismatch_raises(
        self,
        llm_evaluator: models.LLMEvaluator,
        prompt_version: models.PromptVersion,
    ) -> None:
        assert prompt_version.tools is not None
        prompt_version.tools.tools[0].function.parameters["properties"]["label"]["enum"].append(
            "neutral"
        )
        with pytest.raises(
            ValueError,
            match=_LLMEvaluatorPromptErrorMessage.EVALUATOR_CHOICES_MUST_MATCH_TOOL_FUNCTION_LABELS,
        ):
            validate_consistent_llm_evaluator_and_prompt_version(prompt_version, llm_evaluator)

    def test_with_explanation_property_does_not_raise(
        self,
        llm_evaluator: models.LLMEvaluator,
        prompt_version: models.PromptVersion,
    ) -> None:
        assert prompt_version.tools is not None
        prompt_version.tools.tools[0].function.parameters = {
            "type": "object",
            "properties": {
                "label": {
                    "type": "string",
                    "enum": ["correct", "incorrect"],
                    "description": "correctness",
                },
                "explanation": {
                    "type": "string",
                    "description": "explanation for the label",
                },
            },
            "required": ["label", "explanation"],
        }
        validate_consistent_llm_evaluator_and_prompt_version(prompt_version, llm_evaluator)

    def test_explanation_property_explicitly_set_to_none_raises(
        self,
        llm_evaluator: models.LLMEvaluator,
        prompt_version: models.PromptVersion,
    ) -> None:
        assert prompt_version.tools is not None
        prompt_version.tools.tools[0].function.parameters = {
            "type": "object",
            "properties": {
                "label": {
                    "type": "string",
                    "enum": ["correct", "incorrect"],
                    "description": "correctness",
                },
                "explanation": None,
            },
            "required": ["label"],
        }
        with pytest.raises(
            ValueError,
            match=_LLMEvaluatorPromptErrorMessage.EXPLANATION_PROPERTIES_MUST_BE_STRING_OR_OMITTED,
        ):
            validate_consistent_llm_evaluator_and_prompt_version(prompt_version, llm_evaluator)


class TestApplyInputMapping:
    def test_extracts_value_using_jsonpath_expression(self) -> None:
        input_schema = {
            "type": "object",
            "properties": {"output": {"type": "string"}},
            "required": ["output"],
        }
        input_mapping = EvaluatorInputMappingInput(
            path_mapping={"output": "$.response"},
            literal_mapping={},
        )
        context = {"response": "Hello, world!"}
        result = apply_input_mapping(input_schema, input_mapping, context)
        assert result == {"output": "Hello, world!"}

    def test_extracts_nested_value_using_jsonpath(self) -> None:
        input_schema = {
            "type": "object",
            "properties": {"text": {"type": "string"}},
            "required": ["text"],
        }
        input_mapping = EvaluatorInputMappingInput(
            path_mapping={"text": "$.data.nested.value"},
            literal_mapping={},
        )
        context = {"data": {"nested": {"value": "deep content"}}}
        result = apply_input_mapping(input_schema, input_mapping, context)
        assert result == {"text": "deep content"}

    def test_literal_mapping_overrides_path_mapping(self) -> None:
        input_schema = {
            "type": "object",
            "properties": {"key": {"type": "string"}},
            "required": ["key"],
        }
        input_mapping = EvaluatorInputMappingInput(
            path_mapping={"key": "$.from_path"},
            literal_mapping={"key": "literal_value"},
        )
        context = {"from_path": "path_value"}
        result = apply_input_mapping(input_schema, input_mapping, context)
        assert result == {"key": "literal_value"}

    def test_falls_back_to_context_for_unmapped_schema_keys(self) -> None:
        input_schema = {
            "type": "object",
            "properties": {
                "input": {"type": "string"},
                "output": {"type": "string"},
            },
            "required": ["input", "output"],
        }
        input_mapping = EvaluatorInputMappingInput(
            path_mapping={},
            literal_mapping={},
        )
        context = {"input": "user input", "output": "model output"}
        result = apply_input_mapping(input_schema, input_mapping, context)
        assert result == {"input": "user input", "output": "model output"}

    def test_raises_on_invalid_jsonpath_expression(self) -> None:
        input_schema = {
            "type": "object",
            "properties": {"key": {"type": "string"}},
            "required": ["key"],
        }
        input_mapping = EvaluatorInputMappingInput(
            path_mapping={"key": "[[[invalid jsonpath"},
            literal_mapping={},
        )
        context = {"key": "fallback"}
        with pytest.raises(ValueError, match=r"Invalid JSONPath expression.*for key 'key'"):
            apply_input_mapping(input_schema, input_mapping, context)

    def test_skips_key_when_jsonpath_has_no_matches(self) -> None:
        input_schema = {
            "type": "object",
            "properties": {"key": {"type": "string"}},
            "required": ["key"],
        }
        input_mapping = EvaluatorInputMappingInput(
            path_mapping={"key": "$.nonexistent.path"},
            literal_mapping={},
        )
        context = {"other": "value", "key": "fallback"}
        result = apply_input_mapping(input_schema, input_mapping, context)
        # Falls back to context since jsonpath has no matches
        assert result == {"key": "fallback"}

    def test_with_empty_mappings_uses_context_fallback(self) -> None:
        input_schema = {
            "type": "object",
            "properties": {"a": {"type": "string"}, "b": {"type": "string"}},
            "required": ["a", "b"],
        }
        input_mapping = EvaluatorInputMappingInput(
            path_mapping={},
            literal_mapping={},
        )
        context = {"a": "value_a", "b": "value_b", "c": "value_c"}
        result = apply_input_mapping(input_schema, input_mapping, context)
        # Only keys in schema are included
        assert result == {"a": "value_a", "b": "value_b"}

    def test_combines_path_literal_and_fallback_sources(self) -> None:
        input_schema = {
            "type": "object",
            "properties": {
                "from_path": {"type": "string"},
                "from_literal": {"type": "string"},
                "from_fallback": {"type": "string"},
            },
            "required": ["from_path", "from_literal", "from_fallback"],
        }
        input_mapping = EvaluatorInputMappingInput(
            path_mapping={"from_path": "$.extracted"},
            literal_mapping={"from_literal": "hardcoded"},
        )
        context = {"extracted": "path_result", "from_fallback": "context_value"}
        result = apply_input_mapping(input_schema, input_mapping, context)
        assert result == {
            "from_path": "path_result",
            "from_literal": "hardcoded",
            "from_fallback": "context_value",
        }

    def test_returns_list_for_multi_match_jsonpath(self) -> None:
        input_schema = {
            "type": "object",
            "properties": {"item": {"type": "array", "items": {"type": "string"}}},
            "required": ["item"],
        }
        input_mapping = EvaluatorInputMappingInput(
            path_mapping={"item": "$.items[*]"},
            literal_mapping={},
        )
        context = {"items": ["first", "second", "third"]}
        result = apply_input_mapping(input_schema, input_mapping, context)
        assert result == {"item": ["first", "second", "third"]}

    def test_path_mapping_extracts_array_value(self) -> None:
        input_schema = {
            "type": "object",
            "properties": {
                "list": {
                    "type": "array",
                    "items": {"type": "number"},
                }
            },
            "required": ["list"],
        }
        input_mapping = EvaluatorInputMappingInput(
            path_mapping={"list": "$.data"},
            literal_mapping={},
        )
        context = {"data": [1, 2, 3]}
        result = apply_input_mapping(input_schema, input_mapping, context)
        assert result == {"list": [1, 2, 3]}

    def test_path_mapping_extracts_object_value(self) -> None:
        input_schema = {
            "type": "object",
            "properties": {
                "obj": {
                    "type": "object",
                    "properties": {
                        "a": {"type": "number"},
                        "b": {"type": "number"},
                    },
                }
            },
            "required": ["obj"],
        }
        input_mapping = EvaluatorInputMappingInput(
            path_mapping={"obj": "$.nested"},
            literal_mapping={},
        )
        context = {"nested": {"a": 1, "b": 2}}
        result = apply_input_mapping(input_schema, input_mapping, context)
        assert result == {"obj": {"a": 1, "b": 2}}


@pytest.fixture
def llm_evaluator() -> models.LLMEvaluator:
    return models.LLMEvaluator(
        name=Identifier("correctness_evaluator"),
        description=None,
        kind="LLM",
        prompt_id=1,
        annotation_name="correctness",
        output_config=CategoricalAnnotationConfig(
            type="CATEGORICAL",
            optimization_direction=OptimizationDirection.MAXIMIZE,
            description="correctness evaluation",
            values=[
                CategoricalAnnotationValue(label="correct", score=1.0),
                CategoricalAnnotationValue(label="incorrect", score=0.0),
            ],
        ),
    )


@pytest.fixture
def prompt_version() -> models.PromptVersion:
    return models.PromptVersion(
        prompt_id=1,
        template_type=PromptTemplateType.CHAT,
        template_format=PromptTemplateFormat.MUSTACHE,
        template=PromptChatTemplate(
            type="chat",
            messages=[
                PromptMessage(
                    role="user",
                    content=[
                        TextContentPart(
                            type="text",
                            text="Evaluate the correctness: {{input}}",
                        )
                    ],
                )
            ],
        ),
        invocation_parameters=PromptOpenAIInvocationParameters(
            type="openai",
            openai=PromptOpenAIInvocationParametersContent(),
        ),
        tools=PromptTools(
            type="tools",
            tools=[
                PromptToolFunction(
                    type="function",
                    function=PromptToolFunctionDefinition(
                        name="correctness_evaluator",
                        description=UNDEFINED,
                        parameters={
                            "type": "object",
                            "properties": {
                                "label": {
                                    "type": "string",
                                    "enum": ["correct", "incorrect"],
                                    "description": "correctness",
                                }
                            },
                            "required": ["label"],
                        },
                    ),
                )
            ],
            tool_choice=PromptToolChoiceOneOrMore(
                type="one_or_more",
            ),
        ),
        response_format=None,
        model_provider=ModelProvider.OPENAI,
        model_name="gpt-4",
        metadata_={},
    )

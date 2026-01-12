from typing import Any

import pytest

from phoenix.db import models
from phoenix.db.types.annotation_configs import (
    CategoricalAnnotationConfig,
    CategoricalAnnotationValue,
    OptimizationDirection,
)
from phoenix.db.types.db_helper_types import UNDEFINED
from phoenix.db.types.model_provider import ModelProvider
from phoenix.server.api.evaluators import (
    apply_input_mapping,
    cast_template_variable_types,
    json_diff_count,
    levenshtein_distance,
    validate_template_variables,
)
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
        output_config: CategoricalAnnotationConfig,
        prompt_version: models.PromptVersion,
    ) -> None:
        validate_consistent_llm_evaluator_and_prompt_version(
            prompt_version, output_config, annotation_name="correctness", description=None
        )

    def test_both_descriptions_strings_do_not_raise(
        self,
        output_config: CategoricalAnnotationConfig,
        prompt_version: models.PromptVersion,
    ) -> None:
        description = "evaluates the correctness of the output"
        assert prompt_version.tools is not None
        prompt_version.tools.tools[0].function.description = description
        validate_consistent_llm_evaluator_and_prompt_version(
            prompt_version, output_config, annotation_name="correctness", description=description
        )

    def test_string_evaluator_description_and_null_function_description_raises(
        self,
        output_config: CategoricalAnnotationConfig,
        prompt_version: models.PromptVersion,
    ) -> None:
        with pytest.raises(
            ValueError,
            match=_LLMEvaluatorPromptErrorMessage.EVALUATOR_DESCRIPTION_MUST_MATCH_FUNCTION_DESCRIPTION,
        ):
            validate_consistent_llm_evaluator_and_prompt_version(
                prompt_version,
                output_config,
                annotation_name="correctness",
                description="a string description",
            )

    def test_null_evaluator_description_and_string_function_description_raises(
        self,
        output_config: CategoricalAnnotationConfig,
        prompt_version: models.PromptVersion,
    ) -> None:
        assert prompt_version.tools is not None
        prompt_version.tools.tools[0].function.description = "a string description"
        with pytest.raises(
            ValueError,
            match=_LLMEvaluatorPromptErrorMessage.EVALUATOR_DESCRIPTION_MUST_MATCH_FUNCTION_DESCRIPTION,
        ):
            validate_consistent_llm_evaluator_and_prompt_version(
                prompt_version,
                output_config,
                annotation_name="correctness",
                description="my different description",
            )

    def test_non_null_response_format_raises(
        self,
        output_config: CategoricalAnnotationConfig,
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
            validate_consistent_llm_evaluator_and_prompt_version(
                prompt_version, output_config, annotation_name="correctness"
            )

    def test_null_tools_raises(
        self,
        output_config: CategoricalAnnotationConfig,
        prompt_version: models.PromptVersion,
    ) -> None:
        prompt_version.tools = None
        with pytest.raises(
            ValueError,
            match=_LLMEvaluatorPromptErrorMessage.TOOLS_REQUIRED,
        ):
            validate_consistent_llm_evaluator_and_prompt_version(
                prompt_version, output_config, annotation_name="correctness"
            )

    def test_empty_tools_list_raises(
        self,
        output_config: CategoricalAnnotationConfig,
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
            validate_consistent_llm_evaluator_and_prompt_version(
                prompt_version, output_config, annotation_name="correctness"
            )

    def test_multiple_tools_raises(
        self,
        output_config: CategoricalAnnotationConfig,
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
            validate_consistent_llm_evaluator_and_prompt_version(
                prompt_version, output_config, annotation_name="correctness"
            )

    def test_null_tool_choice_raises(
        self,
        output_config: CategoricalAnnotationConfig,
        prompt_version: models.PromptVersion,
    ) -> None:
        assert prompt_version.tools is not None
        prompt_version.tools.tool_choice = PromptToolChoiceNone(type="none")
        with pytest.raises(
            ValueError,
            match=_LLMEvaluatorPromptErrorMessage.TOOL_CHOICE_REQUIRED,
        ):
            validate_consistent_llm_evaluator_and_prompt_version(
                prompt_version, output_config, annotation_name="correctness"
            )

    def test_zero_or_more_tool_choice_raises(
        self,
        output_config: CategoricalAnnotationConfig,
        prompt_version: models.PromptVersion,
    ) -> None:
        assert prompt_version.tools is not None
        prompt_version.tools.tool_choice = PromptToolChoiceZeroOrMore(type="zero_or_more")
        with pytest.raises(
            ValueError,
            match=_LLMEvaluatorPromptErrorMessage.TOOL_CHOICE_REQUIRED,
        ):
            validate_consistent_llm_evaluator_and_prompt_version(
                prompt_version, output_config, annotation_name="correctness"
            )

    def test_specific_function_tool_choice_with_matching_name_does_not_raise(
        self,
        output_config: CategoricalAnnotationConfig,
        prompt_version: models.PromptVersion,
    ) -> None:
        assert prompt_version.tools is not None
        prompt_version.tools.tool_choice = PromptToolChoiceSpecificFunctionTool(
            type="specific_function", function_name="correctness_evaluator"
        )
        validate_consistent_llm_evaluator_and_prompt_version(
            prompt_version, output_config, annotation_name="correctness"
        )

    def test_specific_function_tool_choice_with_mismatched_name_raises(
        self,
        output_config: CategoricalAnnotationConfig,
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
            validate_consistent_llm_evaluator_and_prompt_version(
                prompt_version, output_config, annotation_name="correctness"
            )

    def test_function_parameters_type_not_object_raises(
        self,
        output_config: CategoricalAnnotationConfig,
        prompt_version: models.PromptVersion,
    ) -> None:
        assert prompt_version.tools is not None
        prompt_version.tools.tools[0].function.parameters["type"] = "array"
        with pytest.raises(
            ValueError,
            match="^'correctness_evaluator' function has errors. At 'type': Input should be 'object'.$",
        ):
            validate_consistent_llm_evaluator_and_prompt_version(
                prompt_version, output_config, annotation_name="correctness"
            )

    def test_empty_function_parameters_properties_raises(
        self,
        output_config: CategoricalAnnotationConfig,
        prompt_version: models.PromptVersion,
    ) -> None:
        assert prompt_version.tools is not None
        prompt_version.tools.tools[0].function.parameters["properties"] = {}
        with pytest.raises(
            ValueError,
            match="^'correctness_evaluator' function has errors. At 'properties.label': Field required.$",
        ):
            validate_consistent_llm_evaluator_and_prompt_version(
                prompt_version, output_config, annotation_name="correctness"
            )

    def test_missing_label_property_raises(
        self,
        output_config: CategoricalAnnotationConfig,
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
            validate_consistent_llm_evaluator_and_prompt_version(
                prompt_version, output_config, annotation_name="correctness"
            )

    def test_label_property_type_not_string_raises(
        self,
        output_config: CategoricalAnnotationConfig,
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
            validate_consistent_llm_evaluator_and_prompt_version(
                prompt_version, output_config, annotation_name="correctness"
            )

    def test_label_enum_less_than_two_items_raises(
        self,
        output_config: CategoricalAnnotationConfig,
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
            validate_consistent_llm_evaluator_and_prompt_version(
                prompt_version, output_config, annotation_name="correctness"
            )

    def test_label_missing_enum_field_raises(
        self,
        output_config: CategoricalAnnotationConfig,
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
            validate_consistent_llm_evaluator_and_prompt_version(
                prompt_version, output_config, annotation_name="correctness"
            )

    def test_label_missing_description_field_raises(
        self,
        output_config: CategoricalAnnotationConfig,
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
            validate_consistent_llm_evaluator_and_prompt_version(
                prompt_version, output_config, annotation_name="correctness"
            )

    def test_duplicate_function_parameters_required_values_raises(
        self,
        output_config: CategoricalAnnotationConfig,
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
            validate_consistent_llm_evaluator_and_prompt_version(
                prompt_version, output_config, annotation_name="correctness"
            )

    def test_label_defined_but_not_required_raises(
        self,
        output_config: CategoricalAnnotationConfig,
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
            validate_consistent_llm_evaluator_and_prompt_version(
                prompt_version, output_config, annotation_name="correctness"
            )

    def test_label_and_explanation_defined_but_only_label_required_raises(
        self,
        output_config: CategoricalAnnotationConfig,
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
            validate_consistent_llm_evaluator_and_prompt_version(
                prompt_version, output_config, annotation_name="correctness"
            )

    def test_unexpected_required_property_raises(
        self,
        output_config: CategoricalAnnotationConfig,
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
            validate_consistent_llm_evaluator_and_prompt_version(
                prompt_version, output_config, annotation_name="correctness"
            )

    def test_label_description_mismatch_raises(
        self,
        output_config: CategoricalAnnotationConfig,
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
            validate_consistent_llm_evaluator_and_prompt_version(
                prompt_version, output_config, annotation_name="correctness"
            )

    def test_choices_mismatch_raises(
        self,
        output_config: CategoricalAnnotationConfig,
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
            validate_consistent_llm_evaluator_and_prompt_version(
                prompt_version, output_config, annotation_name="correctness"
            )

    def test_with_explanation_property_does_not_raise(
        self,
        output_config: CategoricalAnnotationConfig,
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
        validate_consistent_llm_evaluator_and_prompt_version(
            prompt_version, output_config, annotation_name="correctness"
        )

    def test_explanation_property_explicitly_set_to_none_raises(
        self,
        output_config: CategoricalAnnotationConfig,
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
            validate_consistent_llm_evaluator_and_prompt_version(
                prompt_version, output_config, annotation_name="correctness"
            )


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
        result = apply_input_mapping(
            input_schema=input_schema,
            input_mapping=input_mapping,
            context=context,
        )
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
        result = apply_input_mapping(
            input_schema=input_schema,
            input_mapping=input_mapping,
            context=context,
        )
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
        result = apply_input_mapping(
            input_schema=input_schema,
            input_mapping=input_mapping,
            context=context,
        )
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
        result = apply_input_mapping(
            input_schema=input_schema,
            input_mapping=input_mapping,
            context=context,
        )
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
            apply_input_mapping(
                input_schema=input_schema,
                input_mapping=input_mapping,
                context=context,
            )

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
        result = apply_input_mapping(
            input_schema=input_schema,
            input_mapping=input_mapping,
            context=context,
        )
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
        result = apply_input_mapping(
            input_schema=input_schema,
            input_mapping=input_mapping,
            context=context,
        )
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
        result = apply_input_mapping(
            input_schema=input_schema,
            input_mapping=input_mapping,
            context=context,
        )
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
        result = apply_input_mapping(
            input_schema=input_schema,
            input_mapping=input_mapping,
            context=context,
        )
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
        result = apply_input_mapping(
            input_schema=input_schema,
            input_mapping=input_mapping,
            context=context,
        )
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
        result = apply_input_mapping(
            input_schema=input_schema,
            input_mapping=input_mapping,
            context=context,
        )
        assert result == {"obj": {"a": 1, "b": 2}}

    def test_path_mapping_with_llm_messages_structure(self) -> None:
        """Test deep path access into LLM message structures like those from subscriptions.py.

        The context_dict in chat_completion subscriptions contains input/output keys
        with values that are message arrays. This test verifies JSONPath can traverse
        into these structures (important after removing json.dumps from context values).
        """
        input_schema = {
            "type": "object",
            "properties": {"content": {"type": "string"}},
            "required": ["content"],
        }
        # Simulates the structure of LLM_INPUT_MESSAGES attribute
        context = {
            "input": [
                {"message": {"role": "user", "content": "What is 2+2?"}},
            ],
            "output": [
                {"message": {"role": "assistant", "content": "4"}},
            ],
        }
        # Extract content from first output message
        input_mapping = EvaluatorInputMappingInput(
            path_mapping={"content": "$.output[0].message.content"},
            literal_mapping={},
        )
        result = apply_input_mapping(
            input_schema=input_schema,
            input_mapping=input_mapping,
            context=context,
        )
        assert result == {"content": "4"}

    def test_path_mapping_extracts_all_message_contents(self) -> None:
        """Test extracting all message contents from a multi-message conversation."""
        input_schema = {
            "type": "object",
            "properties": {"messages": {}},
            "required": ["messages"],
        }
        context = {
            "input": [
                {"message": {"role": "user", "content": "Hello"}},
                {"message": {"role": "assistant", "content": "Hi there!"}},
                {"message": {"role": "user", "content": "How are you?"}},
            ],
        }
        # Extract all message contents using wildcard
        input_mapping = EvaluatorInputMappingInput(
            path_mapping={"messages": "$.input[*].message.content"},
            literal_mapping={},
        )
        result = apply_input_mapping(
            input_schema=input_schema,
            input_mapping=input_mapping,
            context=context,
        )
        assert result == {"messages": ["Hello", "Hi there!", "How are you?"]}

    def test_path_mapping_with_dataset_revision_structure(self) -> None:
        """Test path access with dataset revision input/output structures.

        The context_dict in chat_completion_over_dataset uses revision.input,
        revision.output, and run.output which are typically dict objects.
        """
        input_schema = {
            "type": "object",
            "properties": {
                "question": {"type": "string"},
                "expected_answer": {"type": "string"},
                "actual_answer": {"type": "string"},
            },
            "required": ["question", "expected_answer", "actual_answer"],
        }
        # Simulates context from chat_completion_over_dataset
        context = {
            "input": {"question": "What is the capital of France?", "category": "geography"},
            "expected": {"answer": "Paris", "confidence": 0.99},
            "output": {"messages": [{"role": "assistant", "content": "Paris"}]},
        }
        input_mapping = EvaluatorInputMappingInput(
            path_mapping={
                "question": "$.input.question",
                "expected_answer": "$.expected.answer",
                "actual_answer": "$.output.messages[0].content",
            },
            literal_mapping={},
        )
        result = apply_input_mapping(
            input_schema=input_schema,
            input_mapping=input_mapping,
            context=context,
        )
        assert result == {
            "question": "What is the capital of France?",
            "expected_answer": "Paris",
            "actual_answer": "Paris",
        }

    def test_path_mapping_cannot_traverse_stringified_json(self) -> None:
        """Test that JSONPath cannot traverse into stringified JSON values.

        This validates the importance of NOT using json.dumps on context values -
        if values are strings, deep path expressions will not match.
        """
        import json

        input_schema = {
            "type": "object",
            "properties": {"content": {"type": "string"}},
            "required": ["content"],
        }
        # If context values were stringified, deep paths wouldn't work
        context = {
            "output": json.dumps([{"message": {"role": "assistant", "content": "4"}}]),
        }
        input_mapping = EvaluatorInputMappingInput(
            path_mapping={"content": "$.output[0].message.content"},
            literal_mapping={},
        )
        result = apply_input_mapping(
            input_schema=input_schema,
            input_mapping=input_mapping,
            context=context,
        )
        # Path doesn't match because output is a string, not an object
        # Falls back to context which also doesn't have "content" key
        assert "content" not in result

    def test_path_mapping_with_complex_nested_tool_calls(self) -> None:
        """Test path access into complex tool call structures."""
        input_schema = {
            "type": "object",
            "properties": {"function_name": {"type": "string"}},
            "required": ["function_name"],
        }
        context = {
            "output": [
                {
                    "message": {
                        "role": "assistant",
                        "tool_calls": [
                            {
                                "tool_call": {
                                    "id": "call_123",
                                    "function": {
                                        "name": "get_weather",
                                        "arguments": '{"city": "NYC"}',
                                    },
                                }
                            }
                        ],
                    }
                }
            ],
        }
        input_mapping = EvaluatorInputMappingInput(
            path_mapping={
                "function_name": "$.output[0].message.tool_calls[0].tool_call.function.name"
            },
            literal_mapping={},
        )
        result = apply_input_mapping(
            input_schema=input_schema,
            input_mapping=input_mapping,
            context=context,
        )
        assert result == {"function_name": "get_weather"}


class TestCastTemplateVariableTypes:
    def test_converts_int_to_string(self) -> None:
        template_variables = {"count": 42}
        input_schema = {
            "type": "object",
            "properties": {"count": {"type": "string"}},
        }
        result = cast_template_variable_types(
            template_variables=template_variables,
            input_schema=input_schema,
        )
        assert result == {"count": "42"}

    def test_converts_list_to_string(self) -> None:
        template_variables = {"items": [1, 2, 3]}
        input_schema = {
            "type": "object",
            "properties": {"items": {"type": "string"}},
        }
        result = cast_template_variable_types(
            template_variables=template_variables,
            input_schema=input_schema,
        )
        assert result == {"items": "[1, 2, 3]"}

    def test_converts_dict_to_string(self) -> None:
        template_variables = {"data": {"key": "value"}}
        input_schema = {
            "type": "object",
            "properties": {"data": {"type": "string"}},
        }
        result = cast_template_variable_types(
            template_variables=template_variables,
            input_schema=input_schema,
        )
        assert result == {"data": "{'key': 'value'}"}

    def test_converts_none_to_string(self) -> None:
        template_variables = {"value": None}
        input_schema = {
            "type": "object",
            "properties": {"value": {"type": "string"}},
        }
        result = cast_template_variable_types(
            template_variables=template_variables,
            input_schema=input_schema,
        )
        assert result == {"value": "None"}

    def test_leaves_existing_string_unchanged(self) -> None:
        template_variables = {"text": "hello world"}
        input_schema = {
            "type": "object",
            "properties": {"text": {"type": "string"}},
        }
        result = cast_template_variable_types(
            template_variables=template_variables,
            input_schema=input_schema,
        )
        assert result == {"text": "hello world"}

    def test_ignores_non_string_schema_types(self) -> None:
        template_variables = {"count": 42, "flag": True}
        input_schema = {
            "type": "object",
            "properties": {
                "count": {"type": "number"},
                "flag": {"type": "boolean"},
            },
        }
        result = cast_template_variable_types(
            template_variables=template_variables,
            input_schema=input_schema,
        )
        assert result == {"count": 42, "flag": True}

    def test_preserves_keys_not_in_schema(self) -> None:
        template_variables = {"in_schema": 123, "not_in_schema": 456}
        input_schema = {
            "type": "object",
            "properties": {"in_schema": {"type": "string"}},
        }
        result = cast_template_variable_types(
            template_variables=template_variables,
            input_schema=input_schema,
        )
        assert result == {"in_schema": "123", "not_in_schema": 456}

    def test_handles_empty_schema(self) -> None:
        template_variables = {"key": 42}
        input_schema: dict[str, Any] = {}
        result = cast_template_variable_types(
            template_variables=template_variables,
            input_schema=input_schema,
        )
        assert result == {"key": 42}


class TestValidateTemplateVariables:
    def test_passes_with_valid_input(self) -> None:
        template_variables = {"name": "Alice", "age": "30"}
        input_schema = {
            "type": "object",
            "properties": {
                "name": {"type": "string"},
                "age": {"type": "string"},
            },
            "required": ["name", "age"],
        }
        validate_template_variables(
            template_variables=template_variables,
            input_schema=input_schema,
        )

    def test_raises_on_missing_required_field(self) -> None:
        template_variables = {"name": "Alice"}
        input_schema = {
            "type": "object",
            "properties": {
                "name": {"type": "string"},
                "age": {"type": "string"},
            },
            "required": ["name", "age"],
        }
        with pytest.raises(
            ValueError, match="Input validation failed.*'age' is a required property"
        ):
            validate_template_variables(
                template_variables=template_variables,
                input_schema=input_schema,
            )

    def test_raises_on_wrong_type(self) -> None:
        template_variables = {"count": "not a number"}
        input_schema = {
            "type": "object",
            "properties": {
                "count": {"type": "number"},
            },
            "required": ["count"],
        }
        with pytest.raises(ValueError, match="Input validation failed.*is not of type 'number'"):
            validate_template_variables(
                template_variables=template_variables,
                input_schema=input_schema,
            )

    def test_passes_with_extra_fields(self) -> None:
        template_variables = {"name": "Alice", "extra": "ignored"}
        input_schema = {
            "type": "object",
            "properties": {
                "name": {"type": "string"},
            },
            "required": ["name"],
        }
        validate_template_variables(
            template_variables=template_variables,
            input_schema=input_schema,
        )

    def test_with_nested_object_schema(self) -> None:
        template_variables = {
            "user": {"name": "Alice", "email": "alice@example.com"},
        }
        input_schema = {
            "type": "object",
            "properties": {
                "user": {
                    "type": "object",
                    "properties": {
                        "name": {"type": "string"},
                        "email": {"type": "string"},
                    },
                    "required": ["name", "email"],
                },
            },
            "required": ["user"],
        }
        # Should not raise
        validate_template_variables(
            template_variables=template_variables,
            input_schema=input_schema,
        )


class TestLevenshteinDistance:
    def test_identical_strings_returns_zero(self) -> None:
        assert levenshtein_distance("hello", "hello") == 0

    def test_empty_strings_returns_zero(self) -> None:
        assert levenshtein_distance("", "") == 0

    def test_one_empty_string_returns_length_of_other(self) -> None:
        assert levenshtein_distance("hello", "") == 5
        assert levenshtein_distance("", "world") == 5

    def test_single_character_difference(self) -> None:
        assert levenshtein_distance("cat", "bat") == 1

    def test_insertion(self) -> None:
        assert levenshtein_distance("cat", "cats") == 1

    def test_deletion(self) -> None:
        assert levenshtein_distance("cats", "cat") == 1

    def test_multiple_operations(self) -> None:
        assert levenshtein_distance("kitten", "sitting") == 3

    def test_completely_different_strings(self) -> None:
        assert levenshtein_distance("abc", "xyz") == 3

    def test_case_sensitive(self) -> None:
        assert levenshtein_distance("Hello", "hello") == 1

    def test_unicode_characters(self) -> None:
        assert levenshtein_distance("café", "cafe") == 1


class TestJsonDiffCount:
    def test_identical_objects_returns_zero(self) -> None:
        obj = {"a": 1, "b": 2}
        assert json_diff_count(obj, obj.copy()) == 0

    def test_identical_arrays_returns_zero(self) -> None:
        arr = [1, 2, 3]
        assert json_diff_count(arr, arr.copy()) == 0

    def test_identical_primitives_returns_zero(self) -> None:
        assert json_diff_count(42, 42) == 0
        assert json_diff_count("hello", "hello") == 0
        assert json_diff_count(True, True) == 0
        assert json_diff_count(None, None) == 0

    def test_different_primitives_returns_one(self) -> None:
        assert json_diff_count(42, 43) == 1
        assert json_diff_count("hello", "world") == 1
        assert json_diff_count(True, False) == 1

    def test_different_types_returns_one(self) -> None:
        assert json_diff_count(42, "42") == 1
        assert json_diff_count([1, 2], {"a": 1}) == 1
        assert json_diff_count(None, 0) == 1

    def test_object_with_missing_key(self) -> None:
        assert json_diff_count({"a": 1}, {"a": 1, "b": 2}) == 1
        assert json_diff_count({"a": 1, "b": 2}, {"a": 1}) == 1

    def test_object_with_different_value(self) -> None:
        assert json_diff_count({"a": 1}, {"a": 2}) == 1

    def test_nested_objects(self) -> None:
        expected = {"a": {"b": 1}}
        actual = {"a": {"b": 2}}
        assert json_diff_count(expected, actual) == 1

    def test_deeply_nested_difference(self) -> None:
        expected = {"a": {"b": {"c": 1}}}
        actual = {"a": {"b": {"c": 2}}}
        assert json_diff_count(expected, actual) == 1

    def test_multiple_nested_differences(self) -> None:
        expected = {"a": 1, "b": {"c": 2, "d": 3}}
        actual = {"a": 2, "b": {"c": 2, "d": 4}}
        assert json_diff_count(expected, actual) == 2

    def test_array_with_different_length(self) -> None:
        assert json_diff_count([1, 2, 3], [1, 2]) == 1
        assert json_diff_count([1, 2], [1, 2, 3]) == 1

    def test_array_with_different_elements(self) -> None:
        assert json_diff_count([1, 2, 3], [1, 2, 4]) == 1

    def test_array_length_and_element_differences(self) -> None:
        assert json_diff_count([1, 2, 3], [1, 4]) == 2

    def test_complex_nested_structure(self) -> None:
        expected = {"users": [{"name": "Alice", "age": 30}, {"name": "Bob", "age": 25}]}
        actual = {"users": [{"name": "Alice", "age": 31}, {"name": "Charlie", "age": 25}]}
        assert json_diff_count(expected, actual) == 2

    def test_empty_objects_returns_zero(self) -> None:
        assert json_diff_count({}, {}) == 0

    def test_empty_arrays_returns_zero(self) -> None:
        assert json_diff_count([], []) == 0


class TestBuiltInEvaluatorsWithLLMContextStructures:
    """Tests for builtin evaluators using context structures similar to subscriptions.py.

    These tests verify that evaluators work correctly when context values are
    objects/dicts (not stringified JSON), allowing deep path access via JSONPath.
    """

    def test_contains_evaluator_with_deep_path_into_output_messages(self) -> None:
        """Test ContainsEvaluator with path mapping into nested message structures."""
        from phoenix.server.api.evaluators import ContainsEvaluator

        evaluator = ContainsEvaluator()
        # Context similar to subscriptions.py chat_completion context_dict
        context = {
            "input": [{"message": {"role": "user", "content": "Tell me about Paris"}}],
            "output": [
                {"message": {"role": "assistant", "content": "Paris is the capital of France."}}
            ],
        }
        input_mapping = EvaluatorInputMappingInput(
            path_mapping={"text": "$.output[0].message.content"},
            literal_mapping={"words": "France,capital"},
        )
        result = evaluator.evaluate(context=context, input_mapping=input_mapping)
        assert result["error"] is None
        assert result["score"] == 1.0
        assert result["explanation"] is not None
        assert "found" in result["explanation"]

    def test_contains_evaluator_with_dataset_context_structure(self) -> None:
        """Test ContainsEvaluator with dataset experiment context structure."""
        from phoenix.server.api.evaluators import ContainsEvaluator

        evaluator = ContainsEvaluator()
        # Context similar to subscriptions.py chat_completion_over_dataset context_dict
        context = {
            "input": {"question": "What is the capital of France?", "topic": "geography"},
            "expected": {"answer": "Paris", "country": "France"},
            "output": {
                "messages": [{"role": "assistant", "content": "The capital of France is Paris."}]
            },
        }
        input_mapping = EvaluatorInputMappingInput(
            path_mapping={"text": "$.output.messages[0].content"},
            literal_mapping={"words": "Paris"},
        )
        result = evaluator.evaluate(context=context, input_mapping=input_mapping)
        assert result["error"] is None
        assert result["score"] == 1.0

    def test_exact_match_evaluator_with_nested_paths(self) -> None:
        """Test ExactMatchEvaluator extracting values from nested structures."""
        from phoenix.server.api.evaluators import ExactMatchEvaluator

        evaluator = ExactMatchEvaluator()
        context = {
            "expected": {"answer": "Paris"},
            "output": {"response": {"text": "Paris"}},
        }
        input_mapping = EvaluatorInputMappingInput(
            path_mapping={
                "expected": "$.expected.answer",
                "actual": "$.output.response.text",
            },
            literal_mapping={},
        )
        result = evaluator.evaluate(context=context, input_mapping=input_mapping)
        assert result["error"] is None
        assert result["score"] == 1.0
        assert result["explanation"] is not None
        assert "matches" in result["explanation"]

    def test_exact_match_evaluator_mismatch_with_nested_paths(self) -> None:
        """Test ExactMatchEvaluator with mismatched values from nested paths."""
        from phoenix.server.api.evaluators import ExactMatchEvaluator

        evaluator = ExactMatchEvaluator()
        context = {
            "expected": {"answer": "Paris"},
            "output": {"response": {"text": "London"}},
        }
        input_mapping = EvaluatorInputMappingInput(
            path_mapping={
                "expected": "$.expected.answer",
                "actual": "$.output.response.text",
            },
            literal_mapping={},
        )
        result = evaluator.evaluate(context=context, input_mapping=input_mapping)
        assert result["error"] is None
        assert result["score"] == 0.0
        assert result["explanation"] is not None
        assert "does not match" in result["explanation"]

    def test_json_distance_evaluator_with_json_string_values(self) -> None:
        """Test JSONDistanceEvaluator with JSON string values in context.

        Note: JSONDistanceEvaluator expects valid JSON strings, not Python objects.
        When extracting objects via JSONPath and casting to string, they become
        Python repr strings (single quotes), not valid JSON. For this evaluator,
        context values should be pre-serialized JSON strings or provided via literals.
        """
        import json

        from phoenix.server.api.evaluators import JSONDistanceEvaluator

        evaluator = JSONDistanceEvaluator()
        # Provide JSON strings directly in context
        context = {
            "expected_json": json.dumps({"items": [1, 2, 3]}),
            "actual_json": json.dumps({"items": [1, 2, 4]}),
        }
        input_mapping = EvaluatorInputMappingInput(
            path_mapping={
                "expected": "$.expected_json",
                "actual": "$.actual_json",
            },
            literal_mapping={},
        )
        result = evaluator.evaluate(context=context, input_mapping=input_mapping)
        assert result["error"] is None
        # Distance is 1 because one element differs
        assert result["score"] == 1.0

    def test_contains_evaluator_with_context_fallback(self) -> None:
        """Test evaluator using context fallback when no path mapping provided."""
        from phoenix.server.api.evaluators import ContainsEvaluator

        evaluator = ContainsEvaluator()
        # Direct context values (fallback behavior)
        context = {
            "words": "hello,world",
            "text": "Hello, World! How are you?",
        }
        input_mapping = EvaluatorInputMappingInput(
            path_mapping={},
            literal_mapping={},
        )
        result = evaluator.evaluate(context=context, input_mapping=input_mapping)
        assert result["error"] is None
        assert result["score"] == 1.0

    def test_levenshtein_evaluator_with_message_content_paths(self) -> None:
        """Test LevenshteinDistanceEvaluator with LLM message structures."""
        from phoenix.server.api.evaluators import LevenshteinDistanceEvaluator

        evaluator = LevenshteinDistanceEvaluator()
        context = {
            "expected": [{"message": {"content": "Hello"}}],
            "output": [{"message": {"content": "Hallo"}}],
        }
        input_mapping = EvaluatorInputMappingInput(
            path_mapping={
                "expected": "$.expected[0].message.content",
                "actual": "$.output[0].message.content",
            },
            literal_mapping={},
        )
        result = evaluator.evaluate(context=context, input_mapping=input_mapping)
        assert result["error"] is None
        # Distance between "Hello" and "Hallo" is 1
        assert result["score"] == 1.0

    def test_regex_evaluator_with_deep_path_extraction(self) -> None:
        """Test RegexEvaluator extracting text from nested structures."""
        from phoenix.server.api.evaluators import RegexEvaluator

        evaluator = RegexEvaluator()
        context = {
            "output": {
                "response": {
                    "content": "The answer is 42.",
                }
            }
        }
        input_mapping = EvaluatorInputMappingInput(
            path_mapping={"text": "$.output.response.content"},
            literal_mapping={"pattern": r"\d+"},
        )
        result = evaluator.evaluate(context=context, input_mapping=input_mapping)
        assert result["error"] is None
        assert result["score"] == 1.0
        assert result["explanation"] is not None
        assert "matched" in result["explanation"]

    def test_evaluator_handles_list_values_from_context(self) -> None:
        """Test that evaluators can handle list values extracted from context."""
        from phoenix.server.api.evaluators import ContainsEvaluator

        evaluator = ContainsEvaluator()
        context = {
            "output": [
                {"message": {"content": "First response"}},
                {"message": {"content": "Second response with keyword"}},
            ],
        }
        # When extracting all message contents, the result is stringified by cast_template_variable_types
        input_mapping = EvaluatorInputMappingInput(
            path_mapping={"text": "$.output[*].message.content"},
            literal_mapping={"words": "keyword"},
        )
        result = evaluator.evaluate(context=context, input_mapping=input_mapping)
        assert result["error"] is None
        # The list gets stringified and searched
        assert result["score"] == 1.0

    def test_evaluator_handles_dict_values_cast_to_string(self) -> None:
        """Test that dict values are properly cast to strings for evaluators expecting string input."""
        from phoenix.server.api.evaluators import ContainsEvaluator

        evaluator = ContainsEvaluator()
        context = {
            "output": {"nested": {"value": "contains target word"}},
        }
        # Extracting the whole nested object, which will be stringified
        input_mapping = EvaluatorInputMappingInput(
            path_mapping={"text": "$.output.nested"},
            literal_mapping={"words": "target"},
        )
        result = evaluator.evaluate(context=context, input_mapping=input_mapping)
        assert result["error"] is None
        assert result["score"] == 1.0


@pytest.fixture
def output_config() -> CategoricalAnnotationConfig:
    return CategoricalAnnotationConfig(
        type="CATEGORICAL",
        name="correctness",
        optimization_direction=OptimizationDirection.MAXIMIZE,
        description="correctness evaluation",
        values=[
            CategoricalAnnotationValue(label="correct", score=1.0),
            CategoricalAnnotationValue(label="incorrect", score=0.0),
        ],
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

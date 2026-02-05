import json
import re
from collections.abc import AsyncIterator
from datetime import datetime, timezone
from typing import Any, Optional

import pytest
from openai import AsyncOpenAI
from openinference.semconv.trace import MessageAttributes, SpanAttributes, ToolCallAttributes
from opentelemetry.semconv.attributes.url_attributes import URL_FULL, URL_PATH
from strawberry.relay import GlobalID

from phoenix.db import models
from phoenix.db.types.annotation_configs import (
    CategoricalAnnotationConfig,
    CategoricalAnnotationValue,
    OptimizationDirection,
)
from phoenix.db.types.db_helper_types import UNDEFINED
from phoenix.db.types.evaluators import InputMapping
from phoenix.db.types.identifier import Identifier
from phoenix.db.types.model_provider import ModelProvider
from phoenix.server.api.evaluators import (
    BuiltInEvaluator,
    LLMEvaluator,
    apply_input_mapping,
    cast_template_variable_types,
    get_evaluators,
    json_diff_count,
    levenshtein_distance,
    validate_template_variables,
)
from phoenix.server.api.evaluators import (
    LLMEvaluator as LLMEvaluatorClass,
)
from phoenix.server.api.exceptions import BadRequest, NotFound
from phoenix.server.api.helpers.evaluators import (
    _LLMEvaluatorPromptErrorMessage,
    validate_evaluator_prompt_and_config,
)
from phoenix.server.api.helpers.playground_clients import OpenAIStreamingClient
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
from phoenix.server.api.types.ChatCompletionSubscriptionPayload import TextChunk
from phoenix.server.api.types.Evaluator import DatasetEvaluator as DatasetEvaluatorNode
from phoenix.server.daemons.generative_model_store import GenerativeModelStore
from phoenix.server.daemons.span_cost_calculator import SpanCostCalculator
from phoenix.server.types import DbSessionFactory
from phoenix.trace.attributes import flatten
from phoenix.tracers import Tracer
from tests.unit.vcr import CustomVCR


def validate_consistent_llm_evaluator_and_prompt_version(
    prompt_version: models.PromptVersion,
    output_config: CategoricalAnnotationConfig,
    annotation_name: str,
    description: Optional[str] = None,
) -> None:
    """Test helper that wraps validate_evaluator_prompt_and_config."""
    validate_evaluator_prompt_and_config(
        prompt_tools=prompt_version.tools,
        prompt_response_format=prompt_version.response_format,
        evaluator_annotation_name=annotation_name,
        evaluator_output_config=output_config,
        evaluator_description=description,
    )


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
        # Invalid JSONPath expressions are now validated at construction time
        with pytest.raises(BadRequest, match=r"Invalid JSONPath expression for key 'key'"):
            EvaluatorInputMappingInput(
                path_mapping={"key": "[[[invalid jsonpath"},
                literal_mapping={},
            )

    def test_raises_when_jsonpath_has_no_matches(self) -> None:
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
        with pytest.raises(
            ValueError,
            match=r"JSONPath expression '\$\.nonexistent\.path' for key 'key' "
            r"did not match any values",
        ):
            apply_input_mapping(
                input_schema=input_schema,
                input_mapping=input_mapping,
                context=context,
            )

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
        with pytest.raises(
            ValueError,
            match=r"JSONPath expression '\$\.output\[0\]\.message\.content' for key 'content' "
            r"did not match any values",
        ):
            apply_input_mapping(
                input_schema=input_schema,
                input_mapping=input_mapping,
                context=context,
            )

    def test_path_mapping_with_complex_nested_tool_calls(self) -> None:
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

    async def test_contains_evaluator_with_deep_path_into_output_messages(self) -> None:
        """Test ContainsEvaluator with path mapping into nested message structures."""
        from phoenix.server.api.evaluators import ContainsEvaluator

        evaluator = ContainsEvaluator()
        output_config = evaluator.output_config
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
        result = await evaluator.evaluate(
            context=context,
            input_mapping=input_mapping,
            name="contains",
            output_config=output_config,
        )
        assert result["error"] is None
        assert result["score"] == 1.0
        assert result["explanation"] is not None
        assert "found" in result["explanation"]

    async def test_contains_evaluator_with_dataset_context_structure(self) -> None:
        """Test ContainsEvaluator with dataset experiment context structure."""
        from phoenix.server.api.evaluators import ContainsEvaluator

        evaluator = ContainsEvaluator()
        output_config = evaluator.output_config
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
        result = await evaluator.evaluate(
            context=context,
            input_mapping=input_mapping,
            name="contains",
            output_config=output_config,
        )
        assert result["error"] is None
        assert result["score"] == 1.0

    async def test_exact_match_evaluator_with_nested_paths(self) -> None:
        """Test ExactMatchEvaluator extracting values from nested structures."""
        from phoenix.server.api.evaluators import ExactMatchEvaluator

        evaluator = ExactMatchEvaluator()
        output_config = evaluator.output_config
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
        result = await evaluator.evaluate(
            context=context,
            input_mapping=input_mapping,
            name="exact_match",
            output_config=output_config,
        )
        assert result["error"] is None
        assert result["score"] == 1.0
        assert result["explanation"] is not None
        assert "matches" in result["explanation"]

    async def test_exact_match_evaluator_mismatch_with_nested_paths(self) -> None:
        """Test ExactMatchEvaluator with mismatched values from nested paths."""
        from phoenix.server.api.evaluators import ExactMatchEvaluator

        evaluator = ExactMatchEvaluator()
        output_config = evaluator.output_config
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
        result = await evaluator.evaluate(
            context=context,
            input_mapping=input_mapping,
            name="exact_match",
            output_config=output_config,
        )
        assert result["error"] is None
        assert result["score"] == 0.0
        assert result["explanation"] is not None
        assert "does not match" in result["explanation"]

    async def test_json_distance_evaluator_with_json_string_values(self) -> None:
        """Test JSONDistanceEvaluator with JSON string values in context.

        Note: JSONDistanceEvaluator expects valid JSON strings, not Python objects.
        When extracting objects via JSONPath and casting to string, they become
        Python repr strings (single quotes), not valid JSON. For this evaluator,
        context values should be pre-serialized JSON strings or provided via literals.
        """
        import json

        from phoenix.server.api.evaluators import JSONDistanceEvaluator

        evaluator = JSONDistanceEvaluator()
        output_config = evaluator.output_config
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
        result = await evaluator.evaluate(
            context=context,
            input_mapping=input_mapping,
            name="json_distance",
            output_config=output_config,
        )
        assert result["error"] is None
        # Distance is 1 because one element differs
        assert result["score"] == 1.0

    async def test_contains_evaluator_with_context_fallback(self) -> None:
        """Test evaluator using context fallback when no path mapping provided."""
        from phoenix.server.api.evaluators import ContainsEvaluator

        evaluator = ContainsEvaluator()
        output_config = evaluator.output_config
        # Direct context values (fallback behavior)
        context = {
            "words": "hello,world",
            "text": "Hello, World! How are you?",
        }
        input_mapping = EvaluatorInputMappingInput(
            path_mapping={},
            literal_mapping={},
        )
        result = await evaluator.evaluate(
            context=context,
            input_mapping=input_mapping,
            name="contains",
            output_config=output_config,
        )
        assert result["error"] is None
        assert result["score"] == 1.0

    async def test_levenshtein_evaluator_with_message_content_paths(self) -> None:
        """Test LevenshteinDistanceEvaluator with LLM message structures."""
        from phoenix.server.api.evaluators import LevenshteinDistanceEvaluator

        evaluator = LevenshteinDistanceEvaluator()
        output_config = evaluator.output_config
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
        result = await evaluator.evaluate(
            context=context,
            input_mapping=input_mapping,
            name="levenshtein_distance",
            output_config=output_config,
        )
        assert result["error"] is None
        # Distance between "Hello" and "Hallo" is 1
        assert result["score"] == 1.0

    async def test_regex_evaluator_with_deep_path_extraction(self) -> None:
        """Test RegexEvaluator extracting text from nested structures."""
        from phoenix.server.api.evaluators import RegexEvaluator

        evaluator = RegexEvaluator()
        output_config = evaluator.output_config
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
        result = await evaluator.evaluate(
            context=context,
            input_mapping=input_mapping,
            name="regex",
            output_config=output_config,
        )
        assert result["error"] is None
        assert result["score"] == 1.0
        assert result["explanation"] is not None
        assert "matched" in result["explanation"]

    async def test_evaluator_handles_list_values_from_context(self) -> None:
        """Test that evaluators can handle list values extracted from context."""
        from phoenix.server.api.evaluators import ContainsEvaluator

        evaluator = ContainsEvaluator()
        output_config = evaluator.output_config
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
        result = await evaluator.evaluate(
            context=context,
            input_mapping=input_mapping,
            name="contains",
            output_config=output_config,
        )
        assert result["error"] is None
        # The list gets stringified and searched
        assert result["score"] == 1.0

    async def test_evaluator_handles_dict_values_cast_to_string(self) -> None:
        """Test that dict values are properly cast to strings for evaluators expecting string input."""
        from phoenix.server.api.evaluators import ContainsEvaluator

        evaluator = ContainsEvaluator()
        output_config = evaluator.output_config
        context = {
            "output": {"nested": {"value": "contains target word"}},
        }
        # Extracting the whole nested object, which will be stringified
        input_mapping = EvaluatorInputMappingInput(
            path_mapping={"text": "$.output.nested"},
            literal_mapping={"words": "target"},
        )
        result = await evaluator.evaluate(
            context=context,
            input_mapping=input_mapping,
            name="contains",
            output_config=output_config,
        )
        assert result["error"] is None
        assert result["score"] == 1.0


class TestBuiltInEvaluatorOutputConfigUsage:
    """Tests for builtin evaluator output_config usage at execution time."""

    async def test_contains_evaluator_uses_name_from_output_config(self) -> None:
        """Test that ContainsEvaluator uses the name in the result."""
        from phoenix.server.api.evaluators import ContainsEvaluator

        evaluator = ContainsEvaluator()
        output_config = evaluator.output_config
        context = {"words": "hello", "text": "hello world"}
        input_mapping = EvaluatorInputMappingInput(path_mapping={}, literal_mapping={})
        result = await evaluator.evaluate(
            context=context,
            input_mapping=input_mapping,
            name="My Custom Contains",
            output_config=output_config,
        )
        assert result["name"] == "My Custom Contains"
        assert result["error"] is None

    async def test_contains_evaluator_maps_true_to_label_from_output_config(self) -> None:
        """Test that ContainsEvaluator maps a true result to the correct label."""
        from phoenix.server.api.evaluators import ContainsEvaluator

        evaluator = ContainsEvaluator()
        output_config = evaluator.output_config
        context = {"words": "hello", "text": "hello world"}
        input_mapping = EvaluatorInputMappingInput(path_mapping={}, literal_mapping={})
        result = await evaluator.evaluate(
            context=context,
            input_mapping=input_mapping,
            name="contains",
            output_config=output_config,
        )
        assert result["label"] == "true"
        assert result["score"] == 1.0

    async def test_contains_evaluator_maps_false_to_label_from_output_config(self) -> None:
        """Test that ContainsEvaluator maps a false result to the correct label."""
        from phoenix.server.api.evaluators import ContainsEvaluator

        evaluator = ContainsEvaluator()
        output_config = evaluator.output_config
        context = {"words": "hello", "text": "goodbye world"}
        input_mapping = EvaluatorInputMappingInput(path_mapping={}, literal_mapping={})
        result = await evaluator.evaluate(
            context=context,
            input_mapping=input_mapping,
            name="contains",
            output_config=output_config,
        )
        assert result["label"] == "false"
        assert result["score"] == 0.0

    async def test_exact_match_evaluator_uses_custom_output_config(self) -> None:
        """Test that ExactMatchEvaluator uses a custom output config."""
        from phoenix.server.api.evaluators import ExactMatchEvaluator

        evaluator = ExactMatchEvaluator()
        # Create a custom output config with different labels
        custom_config = CategoricalAnnotationConfig(
            type="CATEGORICAL",
            name="exact",
            optimization_direction=OptimizationDirection.MAXIMIZE,
            values=[
                CategoricalAnnotationValue(label="match", score=1.0),
                CategoricalAnnotationValue(label="no_match", score=0.0),
            ],
        )
        context = {"expected": "Paris", "actual": "Paris"}
        input_mapping = EvaluatorInputMappingInput(path_mapping={}, literal_mapping={})
        result = await evaluator.evaluate(
            context=context,
            input_mapping=input_mapping,
            name="Exact Match Custom",
            output_config=custom_config,
        )
        assert result["name"] == "Exact Match Custom"
        assert result["label"] == "match"
        assert result["score"] == 1.0

    async def test_regex_evaluator_uses_custom_output_config(self) -> None:
        """Test that RegexEvaluator uses a custom output config."""
        from phoenix.server.api.evaluators import RegexEvaluator

        evaluator = RegexEvaluator()
        # Create a custom output config with different labels
        custom_config = CategoricalAnnotationConfig(
            type="CATEGORICAL",
            name="regex",
            optimization_direction=OptimizationDirection.MAXIMIZE,
            values=[
                CategoricalAnnotationValue(label="pattern_found", score=1.0),
                CategoricalAnnotationValue(label="pattern_not_found", score=0.0),
            ],
        )
        context = {"pattern": r"\d+", "text": "The answer is 42"}
        input_mapping = EvaluatorInputMappingInput(path_mapping={}, literal_mapping={})
        result = await evaluator.evaluate(
            context=context,
            input_mapping=input_mapping,
            name="Regex Custom",
            output_config=custom_config,
        )
        assert result["name"] == "Regex Custom"
        assert result["label"] == "pattern_found"
        assert result["score"] == 1.0

    async def test_contains_evaluator_uses_custom_scores(self) -> None:
        """Test that ContainsEvaluator correctly uses custom scores from output config."""
        from phoenix.server.api.evaluators import ContainsEvaluator

        evaluator = ContainsEvaluator()
        custom_config = CategoricalAnnotationConfig(
            type="CATEGORICAL",
            name="contains_custom_scores",
            optimization_direction=OptimizationDirection.MAXIMIZE,
            values=[
                CategoricalAnnotationValue(label="Pass", score=100.0),
                CategoricalAnnotationValue(label="Fail", score=-50.0),
            ],
        )
        input_mapping = EvaluatorInputMappingInput(path_mapping={}, literal_mapping={})

        result_match = await evaluator.evaluate(
            context={"words": "hello", "text": "hello world"},
            input_mapping=input_mapping,
            name="Contains Custom",
            output_config=custom_config,
        )
        assert result_match["label"] == "Pass"
        assert result_match["score"] == 100.0

        result_no_match = await evaluator.evaluate(
            context={"words": "goodbye", "text": "hello world"},
            input_mapping=input_mapping,
            name="Contains Custom",
            output_config=custom_config,
        )
        assert result_no_match["label"] == "Fail"
        assert result_no_match["score"] == -50.0

    async def test_levenshtein_evaluator_uses_name(self) -> None:
        """Test that LevenshteinDistanceEvaluator uses the name in the result."""
        from phoenix.server.api.evaluators import LevenshteinDistanceEvaluator

        evaluator = LevenshteinDistanceEvaluator()
        output_config = evaluator.output_config
        context = {"expected": "hello", "actual": "hallo"}
        input_mapping = EvaluatorInputMappingInput(path_mapping={}, literal_mapping={})
        result = await evaluator.evaluate(
            context=context,
            input_mapping=input_mapping,
            name="Edit Distance",
            output_config=output_config,
        )
        assert result["name"] == "Edit Distance"
        assert result["score"] == 1.0
        assert result["label"] is None

    async def test_json_distance_evaluator_uses_name(self) -> None:
        """Test that JSONDistanceEvaluator uses the name in the result."""
        import json

        from phoenix.server.api.evaluators import JSONDistanceEvaluator

        evaluator = JSONDistanceEvaluator()
        output_config = evaluator.output_config
        context = {
            "expected": json.dumps({"a": 1}),
            "actual": json.dumps({"a": 1}),
        }
        input_mapping = EvaluatorInputMappingInput(path_mapping={}, literal_mapping={})
        result = await evaluator.evaluate(
            context=context,
            input_mapping=input_mapping,
            name="JSON Diff",
            output_config=output_config,
        )
        assert result["name"] == "JSON Diff"
        assert result["score"] == 0.0
        assert result["label"] is None


class TestLLMEvaluator:
    @pytest.fixture
    async def project(self, db: DbSessionFactory) -> models.Project:
        project = models.Project(name="test-project")
        async with db() as session:
            session.add(project)
        return project

    @pytest.fixture
    async def gpt_4o_mini_generative_model(self, db: DbSessionFactory) -> models.GenerativeModel:
        model = models.GenerativeModel(
            name="gpt-4o-mini",
            provider="openai",
            start_time=datetime(2024, 1, 1, tzinfo=timezone.utc),
            name_pattern=re.compile("gpt-4o-mini"),
            is_built_in=True,
            token_prices=[
                models.TokenPrice(
                    token_type="input",
                    is_prompt=True,
                    base_rate=0.15 / 1_000_000,  # $0.15 per million tokens
                    customization=None,
                ),
                models.TokenPrice(
                    token_type="output",
                    is_prompt=False,
                    base_rate=0.60 / 1_000_000,  # $0.60 per million tokens
                    customization=None,
                ),
            ],
        )
        async with db() as session:
            session.add(model)

        return model

    @pytest.fixture
    async def generative_model_store(
        self,
        db: DbSessionFactory,
        gpt_4o_mini_generative_model: models.GenerativeModel,
    ) -> GenerativeModelStore:
        store = GenerativeModelStore(db=db)
        await store._fetch_models()
        return store

    @pytest.fixture
    def span_cost_calculator(
        self,
        db: DbSessionFactory,
        generative_model_store: GenerativeModelStore,
    ) -> SpanCostCalculator:
        return SpanCostCalculator(db=db, model_store=generative_model_store)

    @pytest.fixture
    def tracer(self, span_cost_calculator: SpanCostCalculator) -> Tracer:
        return Tracer(span_cost_calculator=span_cost_calculator)

    @pytest.fixture
    def openai_streaming_client(
        self,
        openai_api_key: str,
    ) -> "OpenAIStreamingClient":
        def create_openai_client() -> AsyncOpenAI:
            return AsyncOpenAI()

        return OpenAIStreamingClient(
            client_factory=create_openai_client,
            model_name="gpt-4o-mini",
            provider="openai",
        )

    @pytest.fixture
    def llm_evaluator_prompt_version(self) -> models.PromptVersion:
        return models.PromptVersion(
            prompt_id=1,
            template_type=PromptTemplateType.CHAT,
            template_format=PromptTemplateFormat.MUSTACHE,
            template=PromptChatTemplate(
                type="chat",
                messages=[
                    PromptMessage(
                        role="system",
                        content="You are an evaluator. Assess whether the output correctly answers the input question.",
                    ),
                    PromptMessage(
                        role="user",
                        content="Input: {{input}}\n\nOutput: {{output}}\n\nIs this output correct?",
                    ),
                ],
            ),
            invocation_parameters=PromptOpenAIInvocationParameters(
                type="openai",
                openai=PromptOpenAIInvocationParametersContent(temperature=0.0),
            ),
            tools=PromptTools(
                type="tools",
                tools=[
                    PromptToolFunction(
                        type="function",
                        function=PromptToolFunctionDefinition(
                            name="correctness_evaluator",
                            description="Evaluates the correctness of the output",
                            parameters={
                                "type": "object",
                                "properties": {
                                    "label": {
                                        "type": "string",
                                        "enum": ["correct", "incorrect"],
                                        "description": "correctness",
                                    },
                                    "explanation": {
                                        "type": "string",
                                        "description": "Brief explanation for the label",
                                    },
                                },
                                "required": ["label", "explanation"],
                            },
                        ),
                    )
                ],
                tool_choice=PromptToolChoiceOneOrMore(type="one_or_more"),
            ),
            response_format=None,
            model_provider=ModelProvider.OPENAI,
            model_name="gpt-4o-mini",
            metadata_={},
        )

    @pytest.fixture
    def llm_evaluator(
        self,
        llm_evaluator_prompt_version: models.PromptVersion,
        output_config: CategoricalAnnotationConfig,
        openai_streaming_client: "OpenAIStreamingClient",
    ) -> LLMEvaluator:
        template = llm_evaluator_prompt_version.template
        assert isinstance(template, PromptChatTemplate)
        tools = llm_evaluator_prompt_version.tools
        assert tools is not None

        return LLMEvaluator(
            name="correctness",
            description="Evaluates correctness",
            template=template,
            template_format=llm_evaluator_prompt_version.template_format,
            tools=tools,
            invocation_parameters=llm_evaluator_prompt_version.invocation_parameters,
            model_provider=llm_evaluator_prompt_version.model_provider,
            llm_client=openai_streaming_client,
            output_config=output_config,
            prompt_name="test-prompt",
        )

    @pytest.fixture
    def input_mapping(self) -> EvaluatorInputMappingInput:
        return EvaluatorInputMappingInput(
            path_mapping={},
            literal_mapping={},
        )

    @pytest.fixture
    def multipart_llm_evaluator_prompt_version(self) -> models.PromptVersion:
        return models.PromptVersion(
            prompt_id=1,
            template_type=PromptTemplateType.CHAT,
            template_format=PromptTemplateFormat.MUSTACHE,
            template=PromptChatTemplate(
                type="chat",
                messages=[
                    PromptMessage(
                        role="system",
                        content=[
                            TextContentPart(
                                type="text",
                                text="You are an evaluator. ",
                            ),
                            TextContentPart(
                                type="text",
                                text="Assess whether the output correctly answers the input question.",
                            ),
                        ],
                    ),
                    PromptMessage(
                        role="user",
                        content=[
                            TextContentPart(
                                type="text",
                                text="Input: {{input}}\n\nOutput: {{output}}\n\nIs this output correct?",
                            ),
                        ],
                    ),
                ],
            ),
            invocation_parameters=PromptOpenAIInvocationParameters(
                type="openai",
                openai=PromptOpenAIInvocationParametersContent(temperature=0.0),
            ),
            tools=PromptTools(
                type="tools",
                tools=[
                    PromptToolFunction(
                        type="function",
                        function=PromptToolFunctionDefinition(
                            name="correctness_evaluator",
                            description="Evaluates the correctness of the output",
                            parameters={
                                "type": "object",
                                "properties": {
                                    "label": {
                                        "type": "string",
                                        "enum": ["correct", "incorrect"],
                                        "description": "correctness",
                                    },
                                    "explanation": {
                                        "type": "string",
                                        "description": "Brief explanation for the label",
                                    },
                                },
                                "required": ["label", "explanation"],
                            },
                        ),
                    )
                ],
                tool_choice=PromptToolChoiceOneOrMore(type="one_or_more"),
            ),
            response_format=None,
            model_provider=ModelProvider.OPENAI,
            model_name="gpt-4o-mini",
            metadata_={},
        )

    @pytest.fixture
    def multipart_llm_evaluator(
        self,
        multipart_llm_evaluator_prompt_version: models.PromptVersion,
        output_config: CategoricalAnnotationConfig,
        openai_streaming_client: "OpenAIStreamingClient",
    ) -> LLMEvaluator:
        template = multipart_llm_evaluator_prompt_version.template
        assert isinstance(template, PromptChatTemplate)
        tools = multipart_llm_evaluator_prompt_version.tools
        assert tools is not None

        return LLMEvaluator(
            name="correctness",
            description="Evaluates correctness",
            template=template,
            template_format=multipart_llm_evaluator_prompt_version.template_format,
            tools=tools,
            invocation_parameters=multipart_llm_evaluator_prompt_version.invocation_parameters,
            model_provider=multipart_llm_evaluator_prompt_version.model_provider,
            llm_client=openai_streaming_client,
            output_config=output_config,
            prompt_name="test-prompt",
        )

    async def test_evaluate_returns_correct_result(
        self,
        db: DbSessionFactory,
        project: models.Project,
        tracer: Tracer,
        llm_evaluator: LLMEvaluator,
        output_config: CategoricalAnnotationConfig,
        input_mapping: EvaluatorInputMappingInput,
        custom_vcr: CustomVCR,
        gpt_4o_mini_generative_model: models.GenerativeModel,
    ) -> None:
        with custom_vcr.use_cassette():
            evaluation_result = await llm_evaluator.evaluate(
                context={"input": "What is 2 + 2?", "output": "4"},
                input_mapping=input_mapping,
                name="correctness",
                output_config=output_config,
                tracer=tracer,
            )

        result = dict(evaluation_result)
        assert result.pop("error") is None
        assert result.pop("label") == "correct"
        assert result.pop("score") == 1.0
        assert result.pop("explanation") is not None
        assert result.pop("annotator_kind") == "LLM"
        assert result.pop("name") == "correctness"
        trace_id = result.pop("trace_id")
        assert isinstance(trace_id, str)
        assert isinstance(result.pop("start_time"), datetime)
        assert isinstance(result.pop("end_time"), datetime)
        assert result.pop("metadata") == {}
        assert not result

        async with db() as session:
            db_traces = await tracer.save_db_traces(session=session, project_id=project.id)

        assert len(db_traces) == 1
        db_trace = db_traces[0]
        assert db_trace.trace_id == trace_id
        db_spans = db_trace.spans
        span_costs = db_trace.span_costs
        assert len(db_spans) == 5

        evaluator_span = None
        input_mapping_span = None
        prompt_span = None
        llm_span = None
        parse_eval_result_span = None
        for span in db_spans:
            if span.span_kind == "EVALUATOR":
                evaluator_span = span
            elif span.span_kind == "PROMPT":
                prompt_span = span
            elif span.span_kind == "LLM":
                llm_span = span
            elif span.span_kind == "CHAIN":
                if span.name == "Input Mapping":
                    input_mapping_span = span
                elif span.name == "Parse Eval Result":
                    parse_eval_result_span = span

        assert evaluator_span is not None
        assert input_mapping_span is not None
        assert prompt_span is not None
        assert llm_span is not None
        assert parse_eval_result_span is not None
        assert evaluator_span.parent_id is None
        assert input_mapping_span.parent_id == evaluator_span.span_id
        assert prompt_span.parent_id == evaluator_span.span_id
        assert llm_span.parent_id == evaluator_span.span_id
        assert parse_eval_result_span.parent_id == evaluator_span.span_id

        # evaluator span
        assert evaluator_span.name == "Evaluator: correctness"
        assert evaluator_span.status_code == "OK"
        assert not evaluator_span.events
        attributes = dict(flatten(evaluator_span.attributes, recurse_on_sequence=True))
        assert attributes.pop(OPENINFERENCE_SPAN_KIND) == "EVALUATOR"
        raw_input_value = attributes.pop(INPUT_VALUE)
        assert raw_input_value is not None
        input_value = json.loads(raw_input_value)
        assert set(input_value.keys()) == {"input", "output"}
        assert attributes.pop(INPUT_MIME_TYPE) == "application/json"
        raw_output_value = attributes.pop(OUTPUT_VALUE)
        assert raw_output_value is not None
        output_value = json.loads(raw_output_value)
        assert set(output_value.keys()) == {"score", "label", "explanation"}
        assert output_value["label"] == "correct"
        assert output_value["score"] == 1.0
        assert attributes.pop(OUTPUT_MIME_TYPE) == "application/json"
        assert not attributes

        # Input Mapping span
        assert input_mapping_span.name == "Input Mapping"
        assert input_mapping_span.status_code == "OK"
        assert not input_mapping_span.events
        attributes = dict(flatten(input_mapping_span.attributes, recurse_on_sequence=True))
        assert attributes.pop(OPENINFERENCE_SPAN_KIND) == "CHAIN"
        raw_input_value = attributes.pop(INPUT_VALUE)
        input_value = json.loads(raw_input_value)
        assert input_value == {
            "input_mapping": {"path_mapping": {}, "literal_mapping": {}},
            "template_variables": {"input": "What is 2 + 2?", "output": "4"},
        }
        assert attributes.pop(INPUT_MIME_TYPE) == "application/json"
        raw_output_value = attributes.pop(OUTPUT_VALUE)
        output_value = json.loads(raw_output_value)
        assert output_value == {"input": "What is 2 + 2?", "output": "4"}
        assert attributes.pop(OUTPUT_MIME_TYPE) == "application/json"
        assert not attributes

        # Prompt span
        assert prompt_span.name == "Prompt: test-prompt"
        assert prompt_span.status_code == "OK"
        assert not prompt_span.events
        attributes = dict(flatten(prompt_span.attributes, recurse_on_sequence=True))
        assert attributes.pop(OPENINFERENCE_SPAN_KIND) == "PROMPT"
        raw_input_value = attributes.pop(INPUT_VALUE)
        input_value = json.loads(raw_input_value)
        assert input_value == {"input": "What is 2 + 2?", "output": "4"}
        assert attributes.pop(INPUT_MIME_TYPE) == "application/json"
        raw_output_value = attributes.pop(OUTPUT_VALUE)
        output_value = json.loads(raw_output_value)
        assert output_value == {
            "messages": [
                {
                    "role": "system",
                    "content": "You are an evaluator. Assess whether the output correctly answers the input question.",
                },
                {
                    "role": "user",
                    "content": "Input: What is 2 + 2?\n\nOutput: 4\n\nIs this output correct?",
                },
            ]
        }
        assert attributes.pop(OUTPUT_MIME_TYPE) == "application/json"
        assert not attributes

        # llm span
        assert llm_span.name == "gpt-4o-mini"
        assert llm_span.status_code == "OK"
        assert not llm_span.events
        assert llm_span.llm_token_count_prompt is not None
        assert llm_span.llm_token_count_prompt > 0
        assert llm_span.llm_token_count_completion is not None
        assert llm_span.llm_token_count_completion > 0
        assert llm_span.cumulative_llm_token_count_prompt > 0
        assert llm_span.cumulative_llm_token_count_completion > 0
        attributes = dict(flatten(llm_span.attributes, recurse_on_sequence=True))
        assert attributes.pop(OPENINFERENCE_SPAN_KIND) == "LLM"
        assert attributes.pop(LLM_MODEL_NAME) == "gpt-4o-mini"
        assert attributes.pop(LLM_PROVIDER) == "openai"
        assert attributes.pop(LLM_SYSTEM) == "openai"
        assert attributes.pop(f"{LLM_INPUT_MESSAGES}.0.{MESSAGE_ROLE}") == "system"
        assert "evaluator" in attributes.pop(f"{LLM_INPUT_MESSAGES}.0.{MESSAGE_CONTENT}").lower()
        assert attributes.pop(f"{LLM_INPUT_MESSAGES}.1.{MESSAGE_ROLE}") == "user"
        user_message = attributes.pop(f"{LLM_INPUT_MESSAGES}.1.{MESSAGE_CONTENT}")
        assert "What is 2 + 2?" in user_message
        assert "4" in user_message
        # Check token count attributes exist and are integers
        token_count_attribute_keys = [
            key for key in attributes if key.startswith("llm.token_count.")
        ]
        for key in token_count_attribute_keys:
            assert isinstance(attributes.pop(key), int)
        assert attributes.pop(URL_FULL) == "https://api.openai.com/v1/chat/completions"
        assert attributes.pop(URL_PATH) == "chat/completions"
        assert attributes.pop(OUTPUT_MIME_TYPE) == "application/json"
        raw_output_value = attributes.pop(OUTPUT_VALUE)
        output_value = json.loads(raw_output_value)
        messages = output_value.pop("messages")
        assert not output_value
        assert messages is not None
        assert len(messages) == 1
        message = messages[0]
        assert message.pop("role") == "assistant"
        tool_calls = message.pop("tool_calls")
        assert not message
        assert len(tool_calls) == 1
        tool_call = tool_calls[0]
        assert isinstance(tool_call.pop("id"), str)
        function = tool_call.pop("function")
        assert isinstance(function, dict)
        assert function.pop("name") == "correctness_evaluator"
        raw_arguments = function.pop("arguments")
        assert isinstance(raw_arguments, str)
        arguments = json.loads(raw_arguments)
        assert arguments.pop("label") == "correct"
        assert isinstance(arguments.pop("explanation"), str)
        assert not arguments
        assert not function
        assert attributes.pop(f"{LLM_OUTPUT_MESSAGES}.0.{MESSAGE_ROLE}") == "assistant"
        assert isinstance(
            attributes.pop(
                f"{LLM_OUTPUT_MESSAGES}.0.{MessageAttributes.MESSAGE_TOOL_CALLS}.0.{TOOL_CALL_ID}"
            ),
            str,
        )
        assert (
            attributes.pop(
                f"{LLM_OUTPUT_MESSAGES}.0.{MessageAttributes.MESSAGE_TOOL_CALLS}.0.{TOOL_CALL_FUNCTION_NAME}"
            )
            == "correctness_evaluator"
        )
        raw_arguments = attributes.pop(
            f"{LLM_OUTPUT_MESSAGES}.0.{MessageAttributes.MESSAGE_TOOL_CALLS}.0.{TOOL_CALL_FUNCTION_ARGUMENTS}"
        )
        assert isinstance(raw_arguments, str)
        arguments = json.loads(raw_arguments)
        assert arguments.pop("label") == "correct"
        assert isinstance(arguments.pop("explanation"), str)
        assert not arguments
        assert not attributes

        # Parse Eval Result span
        assert parse_eval_result_span.name == "Parse Eval Result"
        assert parse_eval_result_span.status_code == "OK"
        assert not parse_eval_result_span.events
        attributes = dict(flatten(parse_eval_result_span.attributes, recurse_on_sequence=True))
        assert attributes.pop(OPENINFERENCE_SPAN_KIND) == "CHAIN"
        raw_input_value = attributes.pop(INPUT_VALUE)
        assert raw_input_value is not None
        input_value = json.loads(raw_input_value)
        tool_calls = input_value.pop("tool_calls")
        assert len(tool_calls) == 1
        tool_call = next(
            iter(tool_calls.values())
        )  # the key is a random tool call ID from the LLM response
        assert tool_call == {
            "name": "correctness_evaluator",
            "arguments": '{"label":"correct","explanation":"The output correctly states that 2 + 2 equals 4."}',
        }
        assert input_value == {
            "output_config": {
                "values": [
                    {"label": "correct", "score": 1.0},
                    {"label": "incorrect", "score": 0.0},
                ],
            },
        }
        assert attributes.pop(INPUT_MIME_TYPE) == "application/json"
        assert json.loads(attributes.pop(OUTPUT_VALUE)) == {
            "label": "correct",
            "score": 1.0,
            "explanation": "The output correctly states that 2 + 2 equals 4.",
        }
        assert attributes.pop(OUTPUT_MIME_TYPE) == "application/json"
        assert not attributes

        # Verify span costs for LLM span
        assert len(span_costs) == 1
        span_cost = span_costs[0]

        assert span_cost.span_rowid == llm_span.id
        assert span_cost.trace_rowid == llm_span.trace_rowid
        assert span_cost.model_id == gpt_4o_mini_generative_model.id
        assert span_cost.span_start_time == llm_span.start_time
        prompt_token_prices = next(
            p for p in gpt_4o_mini_generative_model.token_prices if p.is_prompt
        )
        completion_token_prices = next(
            p for p in gpt_4o_mini_generative_model.token_prices if not p.is_prompt
        )
        prompt_base_rate = prompt_token_prices.base_rate
        completion_base_rate = completion_token_prices.base_rate
        expected_prompt_cost = llm_span.llm_token_count_prompt * prompt_base_rate
        expected_completion_cost = llm_span.llm_token_count_completion * completion_base_rate
        expected_total_cost = expected_prompt_cost + expected_completion_cost
        assert span_cost.total_cost == pytest.approx(expected_total_cost)
        assert span_cost.total_tokens == llm_span.llm_token_count_total
        assert span_cost.prompt_tokens == llm_span.llm_token_count_prompt
        assert span_cost.prompt_cost == pytest.approx(expected_prompt_cost)
        assert span_cost.completion_tokens == llm_span.llm_token_count_completion
        assert span_cost.completion_cost == pytest.approx(expected_completion_cost)

        # Verify span cost details
        assert len(span_cost.span_cost_details) >= 2
        input_detail = next(
            d for d in span_cost.span_cost_details if d.is_prompt and d.token_type == "input"
        )
        output_detail = next(
            d for d in span_cost.span_cost_details if not d.is_prompt and d.token_type == "output"
        )

        assert input_detail.span_cost_id == span_cost.id
        assert input_detail.token_type == "input"
        assert input_detail.is_prompt is True
        assert input_detail.tokens == llm_span.llm_token_count_prompt
        assert input_detail.cost == pytest.approx(expected_prompt_cost)
        assert input_detail.cost_per_token == prompt_base_rate

        assert output_detail.span_cost_id == span_cost.id
        assert output_detail.token_type == "output"
        assert output_detail.is_prompt is False
        assert output_detail.tokens == llm_span.llm_token_count_completion
        assert output_detail.cost == pytest.approx(expected_completion_cost)
        assert output_detail.cost_per_token == completion_base_rate

    async def test_evaluate_with_invalid_jsonpath_rejected_at_construction(
        self,
        db: DbSessionFactory,
        project: models.Project,
        tracer: Tracer,
        llm_evaluator: LLMEvaluator,
        output_config: CategoricalAnnotationConfig,
    ) -> None:
        # Invalid JSONPath expressions are now validated at construction time
        with pytest.raises(BadRequest) as exc_info:
            EvaluatorInputMappingInput(
                path_mapping={"output": "[[[invalid jsonpath"},  # invalid JSONPath syntax
                literal_mapping={},
            )
        assert "Invalid JSONPath expression for key 'output'" in str(exc_info.value)

    async def test_evaluate_with_nonexistent_path_records_error_on_template_span(
        self,
        db: DbSessionFactory,
        project: models.Project,
        tracer: Tracer,
        llm_evaluator: LLMEvaluator,
        output_config: CategoricalAnnotationConfig,
    ) -> None:
        # Valid JSONPath syntax but path doesn't exist in context
        input_mapping = EvaluatorInputMappingInput(
            path_mapping={"output": "nonexistent.path"},
            literal_mapping={},
        )
        evaluation_result = await llm_evaluator.evaluate(
            context={"input": "What is 2 + 2?", "output": "4"},
            input_mapping=input_mapping,
            name="correctness",
            output_config=output_config,
            tracer=tracer,
        )

        result = dict(evaluation_result)
        error = result.pop("error")
        assert isinstance(error, str)
        assert result.pop("label") is None
        assert result.pop("score") is None
        assert result.pop("explanation") is None
        assert result.pop("annotator_kind") == "LLM"
        assert result.pop("name") == "correctness"
        trace_id = result.pop("trace_id")
        assert isinstance(trace_id, str)
        assert isinstance(result.pop("start_time"), datetime)
        assert isinstance(result.pop("end_time"), datetime)
        assert result.pop("metadata") == {}
        assert not result

        # Check spans
        async with db() as session:
            db_traces = await tracer.save_db_traces(session=session, project_id=project.id)
        assert len(db_traces) == 1
        db_trace = db_traces[0]
        db_spans = db_trace.spans
        db_span_costs = db_trace.span_costs
        assert len(db_spans) == 2  # Only EVALUATOR and Input Mapping (CHAIN) (no Prompt or LLM)
        assert len(db_span_costs) == 0  # no span costs since there's no LLM span

        evaluator_span = None
        input_mapping_span = None
        for span in db_spans:
            if span.span_kind == "EVALUATOR":
                evaluator_span = span
            elif span.span_kind == "CHAIN":
                input_mapping_span = span

        assert evaluator_span is not None
        assert input_mapping_span is not None
        assert evaluator_span.parent_id is None
        assert input_mapping_span.parent_id == evaluator_span.span_id

        # Verify evaluator span has error
        assert evaluator_span.status_code == "ERROR"
        assert len(evaluator_span.events) == 1
        exception_event = dict(evaluator_span.events[0])
        assert exception_event.pop("name") == "exception"
        assert isinstance(exception_event.pop("timestamp"), str)
        event_attributes = dict(exception_event.pop("attributes"))
        assert event_attributes.pop("exception.type") == "ValueError"
        assert event_attributes.pop("exception.escaped") == "False"
        assert "Traceback" in event_attributes.pop("exception.stacktrace")
        event_attributes.pop("exception.message")  # Don't assert on specific message
        assert not event_attributes
        assert not exception_event

        attributes = dict(flatten(evaluator_span.attributes, recurse_on_sequence=True))
        assert attributes.pop(OPENINFERENCE_SPAN_KIND) == "EVALUATOR"
        assert json.loads(attributes.pop(INPUT_VALUE)) == {"input": "What is 2 + 2?", "output": "4"}
        assert attributes.pop(INPUT_MIME_TYPE) == "application/json"
        assert not attributes

        # Verify Input Mapping span has error
        assert input_mapping_span.status_code == "ERROR"
        assert len(input_mapping_span.events) == 1
        exception_event = dict(input_mapping_span.events[0])
        assert exception_event.pop("name") == "exception"
        assert isinstance(exception_event.pop("timestamp"), str)
        event_attributes = dict(exception_event.pop("attributes"))
        assert event_attributes.pop("exception.type") == "ValueError"
        assert "did not match any values" in event_attributes.pop("exception.message")
        assert event_attributes.pop("exception.escaped") == "False"
        assert "Traceback" in event_attributes.pop("exception.stacktrace")
        assert not event_attributes
        assert not exception_event

        attributes = dict(flatten(input_mapping_span.attributes, recurse_on_sequence=True))
        assert attributes.pop(OPENINFERENCE_SPAN_KIND) == "CHAIN"
        assert json.loads(attributes.pop(INPUT_VALUE)) == {
            "input_mapping": {
                "path_mapping": {"output": "nonexistent.path"},
                "literal_mapping": {},
            },
            "template_variables": {"input": "What is 2 + 2?", "output": "4"},
        }
        assert attributes.pop(INPUT_MIME_TYPE) == "application/json"
        assert not attributes

    async def test_evaluate_with_invalid_api_key_returns_error(
        self,
        db: DbSessionFactory,
        project: models.Project,
        tracer: Tracer,
        llm_evaluator: LLMEvaluator,
        output_config: CategoricalAnnotationConfig,
        input_mapping: EvaluatorInputMappingInput,
        custom_vcr: CustomVCR,
    ) -> None:
        with custom_vcr.use_cassette():
            evaluation_result = await llm_evaluator.evaluate(
                context={"input": "What is 2 + 2?", "output": "4"},
                input_mapping=input_mapping,
                name="correctness",
                output_config=output_config,
                tracer=tracer,
            )

        result = dict(evaluation_result)
        error = result.pop("error")
        assert isinstance(error, str)
        assert "401" in error
        assert "invalid_api_key" in error
        assert result.pop("label") is None
        assert result.pop("score") is None
        assert result.pop("explanation") is None
        assert result.pop("annotator_kind") == "LLM"
        assert result.pop("name") == "correctness"
        trace_id = result.pop("trace_id")
        assert isinstance(trace_id, str)
        assert isinstance(result.pop("start_time"), datetime)
        assert isinstance(result.pop("end_time"), datetime)
        assert result.pop("metadata") == {}
        assert not result

        async with db() as session:
            db_traces = await tracer.save_db_traces(session=session, project_id=project.id)

        assert len(db_traces) == 1
        db_trace = db_traces[0]
        db_spans = db_trace.spans
        db_span_costs = db_trace.span_costs
        assert trace_id == db_trace.trace_id

        assert (
            len(db_spans) == 4
        )  # EVALUATOR, Input Mapping (CHAIN), Prompt (PROMPT), LLM (no Parse Eval Result due to error)

        evaluator_span = None
        input_mapping_span = None
        prompt_span = None
        llm_span = None
        for span in db_spans:
            if span.span_kind == "EVALUATOR":
                evaluator_span = span
            elif span.span_kind == "CHAIN":
                input_mapping_span = span
            elif span.span_kind == "PROMPT":
                prompt_span = span
            elif span.span_kind == "LLM":
                llm_span = span

        assert evaluator_span is not None
        assert input_mapping_span is not None
        assert prompt_span is not None
        assert llm_span is not None
        assert evaluator_span.parent_id is None
        assert input_mapping_span.parent_id == evaluator_span.span_id
        assert prompt_span.parent_id == evaluator_span.span_id
        assert llm_span.parent_id == evaluator_span.span_id

        assert len(db_span_costs) == 0  # LLM span has no token counts due to API error

        # Input Mapping span (CHAIN)
        assert input_mapping_span.name == "Input Mapping"
        assert input_mapping_span.status_code == "OK"
        assert not input_mapping_span.events
        attributes = dict(flatten(input_mapping_span.attributes, recurse_on_sequence=True))
        assert attributes.pop(OPENINFERENCE_SPAN_KIND) == "CHAIN"
        assert json.loads(attributes.pop(INPUT_VALUE)) == {
            "input_mapping": {"path_mapping": {}, "literal_mapping": {}},
            "template_variables": {"input": "What is 2 + 2?", "output": "4"},
        }
        assert attributes.pop(INPUT_MIME_TYPE) == "application/json"
        assert json.loads(attributes.pop(OUTPUT_VALUE)) == {
            "input": "What is 2 + 2?",
            "output": "4",
        }
        assert attributes.pop(OUTPUT_MIME_TYPE) == "application/json"
        assert not attributes

        # Prompt span
        assert prompt_span.name == "Prompt: test-prompt"
        assert prompt_span.status_code == "OK"
        assert not prompt_span.events
        attributes = dict(flatten(prompt_span.attributes, recurse_on_sequence=True))
        assert attributes.pop(OPENINFERENCE_SPAN_KIND) == "PROMPT"
        assert json.loads(attributes.pop(INPUT_VALUE)) == {
            "input": "What is 2 + 2?",
            "output": "4",
        }
        assert attributes.pop(INPUT_MIME_TYPE) == "application/json"
        assert json.loads(attributes.pop(OUTPUT_VALUE)) == {
            "messages": [
                {
                    "role": "system",
                    "content": "You are an evaluator. Assess whether the output correctly answers the input question.",
                },
                {
                    "role": "user",
                    "content": "Input: What is 2 + 2?\n\nOutput: 4\n\nIs this output correct?",
                },
            ]
        }
        assert attributes.pop(OUTPUT_MIME_TYPE) == "application/json"
        assert not attributes

        # evaluator span
        assert evaluator_span.name == "Evaluator: correctness"
        assert evaluator_span.status_code == "ERROR"
        assert "401" in evaluator_span.status_message
        assert "invalid_api_key" in evaluator_span.status_message
        assert len(evaluator_span.events) == 1
        exception_event = dict(evaluator_span.events[0])
        assert exception_event.pop("name") == "exception"
        assert isinstance(exception_event.pop("timestamp"), str)
        event_attributes = dict(exception_event.pop("attributes"))
        assert event_attributes.pop("exception.type") == "openai.AuthenticationError"
        exception_message = event_attributes.pop("exception.message")
        assert "401" in exception_message
        assert "invalid_api_key" in exception_message
        assert event_attributes.pop("exception.escaped") == "False"
        assert "Traceback" in event_attributes.pop("exception.stacktrace")
        assert not event_attributes
        assert not exception_event
        attributes = dict(flatten(evaluator_span.attributes, recurse_on_sequence=True))
        assert attributes.pop(OPENINFERENCE_SPAN_KIND) == "EVALUATOR"
        assert json.loads(attributes.pop(INPUT_VALUE)) == {"input": "What is 2 + 2?", "output": "4"}
        assert attributes.pop(INPUT_MIME_TYPE) == "application/json"
        assert not attributes

        # llm span
        assert llm_span.name == "gpt-4o-mini"
        assert llm_span.status_code == "ERROR"
        assert len(llm_span.events) == 1
        exception_event = dict(llm_span.events[0])
        assert exception_event.pop("name") == "exception"
        assert isinstance(exception_event.pop("timestamp"), str)
        event_attributes = dict(exception_event.pop("attributes"))
        assert event_attributes.pop("exception.type") == "openai.AuthenticationError"
        exception_message = event_attributes.pop("exception.message")
        assert "401" in exception_message
        assert "invalid_api_key" in exception_message
        assert event_attributes.pop("exception.escaped") == "False"
        assert "Traceback" in event_attributes.pop("exception.stacktrace")
        assert not event_attributes
        assert not exception_event
        attributes = dict(flatten(llm_span.attributes, recurse_on_sequence=True))
        assert attributes.pop(OPENINFERENCE_SPAN_KIND) == "LLM"
        assert attributes.pop(LLM_MODEL_NAME) == "gpt-4o-mini"
        assert attributes.pop(LLM_PROVIDER) == "openai"
        assert attributes.pop(LLM_SYSTEM) == "openai"
        assert attributes.pop(f"{LLM_INPUT_MESSAGES}.0.{MESSAGE_ROLE}") == "system"
        assert "evaluator" in attributes.pop(f"{LLM_INPUT_MESSAGES}.0.{MESSAGE_CONTENT}").lower()
        assert attributes.pop(f"{LLM_INPUT_MESSAGES}.1.{MESSAGE_ROLE}") == "user"
        user_message = attributes.pop(f"{LLM_INPUT_MESSAGES}.1.{MESSAGE_CONTENT}")
        assert "What is 2 + 2?" in user_message
        assert "4" in user_message
        assert attributes.pop(URL_FULL) == "https://api.openai.com/v1/chat/completions"
        assert attributes.pop(URL_PATH) == "chat/completions"
        assert not attributes

    async def test_evaluate_with_no_tool_calls_records_error_on_chain_span(
        self,
        db: DbSessionFactory,
        project: models.Project,
        tracer: Tracer,
        llm_evaluator: LLMEvaluator,
        output_config: CategoricalAnnotationConfig,
        input_mapping: EvaluatorInputMappingInput,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        async def mock_chat_completion(*args: Any, **kwargs: Any) -> AsyncIterator[TextChunk]:
            yield TextChunk(content="I cannot evaluate this.")

        monkeypatch.setattr(
            llm_evaluator._llm_client, "chat_completion_create", mock_chat_completion
        )

        evaluation_result = await llm_evaluator.evaluate(
            context={"input": "What is 2 + 2?", "output": "4"},
            input_mapping=input_mapping,
            name="correctness",
            output_config=output_config,
            tracer=tracer,
        )

        # Check evaluation result
        result = dict(evaluation_result)
        error = result.pop("error")
        assert isinstance(error, str)
        assert "No tool calls received from LLM" in error
        assert result.pop("label") is None
        assert result.pop("score") is None
        assert result.pop("explanation") is None
        assert result.pop("annotator_kind") == "LLM"
        assert result.pop("name") == "correctness"
        trace_id = result.pop("trace_id")
        assert isinstance(trace_id, str)
        assert isinstance(result.pop("start_time"), datetime)
        assert isinstance(result.pop("end_time"), datetime)
        assert result.pop("metadata") == {}
        assert not result

        # Check spans
        async with db() as session:
            db_traces = await tracer.save_db_traces(session=session, project_id=project.id)

        assert len(db_traces) == 1
        db_trace = db_traces[0]
        db_spans = db_trace.spans
        assert (
            len(db_spans) == 5
        )  # EVALUATOR, Input Mapping (CHAIN), Prompt (PROMPT), LLM, Parse Eval Result (CHAIN) with error

        evaluator_span = None
        input_mapping_span = None
        prompt_span = None
        llm_span = None
        parse_eval_result_span = None
        for span in db_spans:
            if span.span_kind == "EVALUATOR":
                evaluator_span = span
            elif span.span_kind == "PROMPT":
                prompt_span = span
            elif span.span_kind == "LLM":
                llm_span = span
            elif span.span_kind == "CHAIN":
                if span.name == "Input Mapping":
                    input_mapping_span = span
                elif span.name == "Parse Eval Result":
                    parse_eval_result_span = span

        assert evaluator_span is not None
        assert input_mapping_span is not None
        assert prompt_span is not None
        assert llm_span is not None
        assert parse_eval_result_span is not None

        # Verify parent-child relationships
        assert evaluator_span.parent_id is None
        assert input_mapping_span.parent_id == evaluator_span.span_id
        assert prompt_span.parent_id == evaluator_span.span_id
        assert llm_span.parent_id == evaluator_span.span_id
        assert parse_eval_result_span.parent_id == evaluator_span.span_id

        # Input Mapping span
        assert input_mapping_span.name == "Input Mapping"
        assert input_mapping_span.status_code == "OK"
        assert not input_mapping_span.events

        # Prompt span
        assert prompt_span.name == "Prompt: test-prompt"
        assert prompt_span.status_code == "OK"
        assert not prompt_span.events

        # llm span
        assert llm_span.status_code == "OK"
        assert not llm_span.events

        # Parse Eval Result span (has error)
        assert parse_eval_result_span.name == "Parse Eval Result"
        assert parse_eval_result_span.status_code == "ERROR"
        assert "No tool calls received from LLM" in parse_eval_result_span.status_message
        assert len(parse_eval_result_span.events) == 1
        exception_event = dict(parse_eval_result_span.events[0])
        assert exception_event.pop("name") == "exception"
        assert isinstance(exception_event.pop("timestamp"), str)
        event_attributes = dict(exception_event.pop("attributes"))
        assert event_attributes.pop("exception.type") == "ValueError"
        assert "No tool calls received from LLM" in event_attributes.pop("exception.message")
        assert event_attributes.pop("exception.escaped") == "False"
        assert "Traceback" in event_attributes.pop("exception.stacktrace")
        assert not event_attributes
        assert not exception_event
        attributes = dict(flatten(parse_eval_result_span.attributes, recurse_on_sequence=True))
        assert attributes.pop(OPENINFERENCE_SPAN_KIND) == "CHAIN"
        assert json.loads(attributes.pop(INPUT_VALUE)) == {
            "tool_calls": {},
            "output_config": {
                "values": [
                    {"label": "correct", "score": 1.0},
                    {"label": "incorrect", "score": 0.0},
                ]
            },
        }
        assert attributes.pop(INPUT_MIME_TYPE) == "application/json"
        assert not attributes

        # evaluator span
        assert evaluator_span.name == "Evaluator: correctness"
        assert evaluator_span.status_code == "ERROR"
        assert "No tool calls received from LLM" in evaluator_span.status_message
        assert len(evaluator_span.events) == 1
        exception_event = dict(evaluator_span.events[0])
        assert exception_event.pop("name") == "exception"
        assert isinstance(exception_event.pop("timestamp"), str)
        event_attributes = dict(exception_event.pop("attributes"))
        assert event_attributes.pop("exception.type") == "ValueError"
        assert "No tool calls received from LLM" in event_attributes.pop("exception.message")
        assert event_attributes.pop("exception.escaped") == "False"
        assert "Traceback" in event_attributes.pop("exception.stacktrace")
        assert not event_attributes
        assert not exception_event
        attributes = dict(flatten(evaluator_span.attributes, recurse_on_sequence=True))
        assert attributes.pop(OPENINFERENCE_SPAN_KIND) == "EVALUATOR"
        assert json.loads(attributes.pop(INPUT_VALUE)) == {"input": "What is 2 + 2?", "output": "4"}
        assert attributes.pop(INPUT_MIME_TYPE) == "application/json"
        assert not attributes

    async def test_evaluate_with_multipart_template(
        self,
        db: DbSessionFactory,
        project: models.Project,
        tracer: Tracer,
        output_config: CategoricalAnnotationConfig,
        input_mapping: EvaluatorInputMappingInput,
        multipart_llm_evaluator: LLMEvaluator,
        custom_vcr: CustomVCR,
        gpt_4o_mini_generative_model: models.GenerativeModel,
    ) -> None:
        with custom_vcr.use_cassette():
            evaluation_result = await multipart_llm_evaluator.evaluate(
                context={"input": "What is 2 + 2?", "output": "4"},
                input_mapping=input_mapping,
                name="correctness",
                output_config=output_config,
                tracer=tracer,
            )

        result = dict(evaluation_result)
        assert result.pop("error") is None
        assert result.pop("label") == "correct"
        assert result.pop("score") == 1.0
        assert result.pop("explanation") is not None
        assert result.pop("annotator_kind") == "LLM"
        assert result.pop("name") == "correctness"
        trace_id = result.pop("trace_id")
        assert isinstance(trace_id, str)
        assert isinstance(result.pop("start_time"), datetime)
        assert isinstance(result.pop("end_time"), datetime)
        assert result.pop("metadata") == {}
        assert not result

        async with db() as session:
            db_traces = await tracer.save_db_traces(session=session, project_id=project.id)

        assert len(db_traces) == 1
        db_trace = db_traces[0]
        assert db_trace.trace_id == trace_id
        db_spans = db_trace.spans

        prompt_span = None
        for span in db_spans:
            if span.span_kind == "PROMPT":
                prompt_span = span
                break

        assert prompt_span is not None
        assert prompt_span.name == "Prompt: test-prompt"
        attributes = dict(flatten(prompt_span.attributes, recurse_on_sequence=True))
        assert attributes.pop(OPENINFERENCE_SPAN_KIND) == "PROMPT"
        input_value = json.loads(attributes.pop(INPUT_VALUE))
        assert input_value == {"input": "What is 2 + 2?", "output": "4"}
        assert attributes.pop(INPUT_MIME_TYPE) == "application/json"
        output_value = json.loads(attributes.pop(OUTPUT_VALUE))
        assert output_value == {
            "messages": [
                {
                    "role": "system",
                    "content": "You are an evaluator. Assess whether the output correctly answers the input question.",
                },
                {
                    "role": "user",
                    "content": "Input: What is 2 + 2?\n\nOutput: 4\n\nIs this output correct?",
                },
            ]
        }
        assert attributes.pop(OUTPUT_MIME_TYPE) == "application/json"
        assert not attributes


class TestGetEvaluators:
    async def test_returns_evaluators_in_input_order_with_interspersed_types(
        self,
        db: Any,
        correctness_llm_evaluator: models.LLMEvaluator,
        openai_api_key: str,
        synced_builtin_evaluators: None,
    ) -> None:
        from sqlalchemy import select

        # Look up builtin evaluator IDs from the database by key
        async with db() as session:
            contains_id = await session.scalar(
                select(models.BuiltinEvaluator.id).where(models.BuiltinEvaluator.key == "contains")
            )
            exact_match_id = await session.scalar(
                select(models.BuiltinEvaluator.id).where(
                    models.BuiltinEvaluator.key == "exact_match"
                )
            )
            regex_id = await session.scalar(
                select(models.BuiltinEvaluator.id).where(models.BuiltinEvaluator.key == "regex")
            )
        assert contains_id is not None
        assert exact_match_id is not None
        assert regex_id is not None

        # Create a dataset and DatasetEvaluators
        async with db() as session:
            dataset = models.Dataset(name="test-dataset", metadata_={})
            session.add(dataset)
            await session.flush()

            # Create DatasetEvaluators for each evaluator type
            de_contains = models.DatasetEvaluators(
                dataset_id=dataset.id,
                evaluator_id=contains_id,
                name=Identifier("contains-eval"),
                input_mapping=InputMapping(literal_mapping={}, path_mapping={}),
                project=models.Project(name="contains-project", description=""),
            )
            de_llm = models.DatasetEvaluators(
                dataset_id=dataset.id,
                evaluator_id=correctness_llm_evaluator.id,
                name=Identifier("llm-eval"),
                input_mapping=InputMapping(literal_mapping={}, path_mapping={}),
                project=models.Project(name="llm-project", description=""),
            )
            de_exact_match = models.DatasetEvaluators(
                dataset_id=dataset.id,
                evaluator_id=exact_match_id,
                name=Identifier("exact-match-eval"),
                input_mapping=InputMapping(literal_mapping={}, path_mapping={}),
                project=models.Project(name="exact-match-project", description=""),
            )
            de_regex = models.DatasetEvaluators(
                dataset_id=dataset.id,
                evaluator_id=regex_id,
                name=Identifier("regex-eval"),
                input_mapping=InputMapping(literal_mapping={}, path_mapping={}),
                project=models.Project(name="regex-project", description=""),
            )
            session.add_all([de_contains, de_llm, de_exact_match, de_regex])
            await session.flush()

            input_node_ids = [
                GlobalID(type_name=DatasetEvaluatorNode.__name__, node_id=str(de_contains.id)),
                GlobalID(type_name=DatasetEvaluatorNode.__name__, node_id=str(de_llm.id)),
                GlobalID(type_name=DatasetEvaluatorNode.__name__, node_id=str(de_exact_match.id)),
                GlobalID(type_name=DatasetEvaluatorNode.__name__, node_id=str(de_regex.id)),
            ]

            evaluators = await get_evaluators(
                dataset_evaluator_node_ids=input_node_ids,
                session=session,
                decrypt=lambda x: x,
                credentials=None,
            )

        assert len(evaluators) == 4
        assert isinstance(evaluators[0], BuiltInEvaluator)
        assert evaluators[0].name == "contains"
        assert isinstance(evaluators[1], LLMEvaluatorClass)
        assert evaluators[1].name == correctness_llm_evaluator.name.root
        assert isinstance(evaluators[2], BuiltInEvaluator)
        assert evaluators[2].name == "exact_match"
        assert isinstance(evaluators[3], BuiltInEvaluator)
        assert evaluators[3].name == "regex"

    async def test_raises_value_error_for_missing_dataset_evaluator(
        self,
        db: Any,
    ) -> None:
        non_existent_id = 999999
        input_node_ids = [
            GlobalID(type_name=DatasetEvaluatorNode.__name__, node_id=str(non_existent_id)),
        ]

        async with db() as session:
            with pytest.raises(NotFound, match="DatasetEvaluator.*not found"):
                await get_evaluators(
                    dataset_evaluator_node_ids=input_node_ids,
                    session=session,
                    decrypt=lambda x: x,
                    credentials=None,
                )

    async def test_raises_value_error_for_non_dataset_evaluator_type(
        self,
        db: Any,
    ) -> None:
        input_node_ids = [
            GlobalID(type_name="LLMEvaluator", node_id="123"),
        ]

        async with db() as session:
            with pytest.raises(BadRequest, match="Expected DatasetEvaluator ID"):
                await get_evaluators(
                    dataset_evaluator_node_ids=input_node_ids,
                    session=session,
                    decrypt=lambda x: x,
                    credentials=None,
                )

    async def test_returns_empty_list_for_empty_input(
        self,
        db: Any,
    ) -> None:
        async with db() as session:
            evaluators = await get_evaluators(
                dataset_evaluator_node_ids=[],
                session=session,
                decrypt=lambda x: x,
                credentials=None,
            )

        assert evaluators == []

    async def test_preserves_order_with_only_builtin_evaluators(
        self,
        db: Any,
        synced_builtin_evaluators: None,
    ) -> None:
        from sqlalchemy import select

        # Look up builtin evaluator IDs from the database by key
        async with db() as session:
            levenshtein_id = await session.scalar(
                select(models.BuiltinEvaluator.id).where(
                    models.BuiltinEvaluator.key == "levenshtein_distance"
                )
            )
            json_distance_id = await session.scalar(
                select(models.BuiltinEvaluator.id).where(
                    models.BuiltinEvaluator.key == "json_distance"
                )
            )
            contains_id = await session.scalar(
                select(models.BuiltinEvaluator.id).where(models.BuiltinEvaluator.key == "contains")
            )
        assert levenshtein_id is not None
        assert json_distance_id is not None
        assert contains_id is not None

        async with db() as session:
            dataset = models.Dataset(name="test-dataset-builtins", metadata_={})
            session.add(dataset)
            await session.flush()

            de_levenshtein = models.DatasetEvaluators(
                dataset_id=dataset.id,
                evaluator_id=levenshtein_id,
                name=Identifier("levenshtein-eval"),
                input_mapping=InputMapping(literal_mapping={}, path_mapping={}),
                project=models.Project(name="levenshtein-project", description=""),
            )
            de_json_distance = models.DatasetEvaluators(
                dataset_id=dataset.id,
                evaluator_id=json_distance_id,
                name=Identifier("json-distance-eval"),
                input_mapping=InputMapping(literal_mapping={}, path_mapping={}),
                project=models.Project(name="json-distance-project", description=""),
            )
            de_contains = models.DatasetEvaluators(
                dataset_id=dataset.id,
                evaluator_id=contains_id,
                name=Identifier("contains-eval"),
                input_mapping=InputMapping(literal_mapping={}, path_mapping={}),
                project=models.Project(name="contains-project", description=""),
            )
            session.add_all([de_levenshtein, de_json_distance, de_contains])
            await session.flush()

            input_node_ids = [
                GlobalID(type_name=DatasetEvaluatorNode.__name__, node_id=str(de_levenshtein.id)),
                GlobalID(type_name=DatasetEvaluatorNode.__name__, node_id=str(de_json_distance.id)),
                GlobalID(type_name=DatasetEvaluatorNode.__name__, node_id=str(de_contains.id)),
            ]

            evaluators = await get_evaluators(
                dataset_evaluator_node_ids=input_node_ids,
                session=session,
                decrypt=lambda x: x,
                credentials=None,
            )

        assert len(evaluators) == 3
        assert all(isinstance(e, BuiltInEvaluator) for e in evaluators)
        assert evaluators[0].name == "levenshtein_distance"
        assert evaluators[1].name == "json_distance"
        assert evaluators[2].name == "contains"


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


# message attributes
MESSAGE_CONTENT = MessageAttributes.MESSAGE_CONTENT
MESSAGE_CONTENTS = MessageAttributes.MESSAGE_CONTENTS
MESSAGE_ROLE = MessageAttributes.MESSAGE_ROLE

# span attributes
OPENINFERENCE_SPAN_KIND = SpanAttributes.OPENINFERENCE_SPAN_KIND
LLM_MODEL_NAME = SpanAttributes.LLM_MODEL_NAME
LLM_SYSTEM = SpanAttributes.LLM_SYSTEM
LLM_PROVIDER = SpanAttributes.LLM_PROVIDER
LLM_INPUT_MESSAGES = SpanAttributes.LLM_INPUT_MESSAGES
LLM_OUTPUT_MESSAGES = SpanAttributes.LLM_OUTPUT_MESSAGES
INPUT_VALUE = SpanAttributes.INPUT_VALUE
INPUT_MIME_TYPE = SpanAttributes.INPUT_MIME_TYPE
OUTPUT_VALUE = SpanAttributes.OUTPUT_VALUE
OUTPUT_MIME_TYPE = SpanAttributes.OUTPUT_MIME_TYPE

# tool call attributes
TOOL_CALL_ID = ToolCallAttributes.TOOL_CALL_ID
TOOL_CALL_FUNCTION_NAME = ToolCallAttributes.TOOL_CALL_FUNCTION_NAME
TOOL_CALL_FUNCTION_ARGUMENTS = ToolCallAttributes.TOOL_CALL_FUNCTION_ARGUMENTS_JSON

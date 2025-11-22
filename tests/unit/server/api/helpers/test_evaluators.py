import pytest

from phoenix.db import models
from phoenix.db.types.annotation_configs import (
    CategoricalAnnotationConfig,
    CategoricalAnnotationValue,
    OptimizationDirection,
)
from phoenix.db.types.db_models import UNDEFINED
from phoenix.db.types.identifier import Identifier
from phoenix.db.types.model_provider import ModelProvider
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
                            "hallucination": {
                                "type": "string",
                                "enum": ["hallucinated", "not_hallucinated"],
                            }
                        },
                        "required": ["hallucination"],
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

    def test_evaluator_and_function_name_mismatch_raises(
        self,
        llm_evaluator: models.LLMEvaluator,
        prompt_version: models.PromptVersion,
    ) -> None:
        llm_evaluator.name = Identifier("different_name")
        with pytest.raises(
            ValueError,
            match=_LLMEvaluatorPromptErrorMessage.EVALUATOR_NAME_MUST_MATCH_FUNCTION_NAME,
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
            match="^'correctness_evaluator' function has errors. At 'properties': Dictionary should have at least 1 item after validation, not 0.$",
        ):
            validate_consistent_llm_evaluator_and_prompt_version(prompt_version, llm_evaluator)

    def test_multiple_function_parameters_properties_raises(
        self,
        llm_evaluator: models.LLMEvaluator,
        prompt_version: models.PromptVersion,
    ) -> None:
        assert prompt_version.tools is not None
        prompt_version.tools.tools[0].function.parameters = {
            "type": "object",
            "properties": {
                "correctness": {
                    "type": "string",
                    "enum": ["correct", "incorrect"],
                },
                "confidence": {
                    "type": "string",
                    "enum": ["low", "high"],
                },
            },
            "required": ["correctness", "confidence"],
        }
        with pytest.raises(
            ValueError,
            match="^'correctness_evaluator' function has errors. At 'properties': Dictionary should have at most 1 item after validation, not 2.$",
        ):
            validate_consistent_llm_evaluator_and_prompt_version(prompt_version, llm_evaluator)

    def test_function_parameters_property_type_not_string_raises(
        self,
        llm_evaluator: models.LLMEvaluator,
        prompt_version: models.PromptVersion,
    ) -> None:
        assert prompt_version.tools is not None
        prompt_version.tools.tools[0].function.parameters = {
            "type": "object",
            "properties": {
                "correctness": {
                    "type": "number",
                    "enum": ["0", "1"],
                }
            },
            "required": ["correctness"],
        }
        with pytest.raises(
            ValueError,
            match="^'correctness_evaluator' function has errors. At 'properties.correctness.type': Input should be 'string'.$",
        ):
            validate_consistent_llm_evaluator_and_prompt_version(prompt_version, llm_evaluator)

    def test_function_parameters_enum_less_than_two_items_raises(
        self,
        llm_evaluator: models.LLMEvaluator,
        prompt_version: models.PromptVersion,
    ) -> None:
        assert prompt_version.tools is not None
        prompt_version.tools.tools[0].function.parameters = {
            "type": "object",
            "properties": {
                "correctness": {
                    "type": "string",
                    "enum": ["correct"],
                }
            },
            "required": ["correctness"],
        }
        with pytest.raises(
            ValueError,
            match="^'correctness_evaluator' function has errors. At 'properties.correctness.enum': List should have at least 2 items after validation, not 1.$",
        ):
            validate_consistent_llm_evaluator_and_prompt_version(prompt_version, llm_evaluator)

    def test_function_parameters_missing_enum_field_raises(
        self,
        llm_evaluator: models.LLMEvaluator,
        prompt_version: models.PromptVersion,
    ) -> None:
        assert prompt_version.tools is not None
        prompt_version.tools.tools[0].function.parameters = {
            "type": "object",
            "properties": {
                "correctness": {
                    "type": "string",
                }
            },
            "required": ["correctness"],
        }
        with pytest.raises(
            ValueError,
            match="^'correctness_evaluator' function has errors. At 'properties.correctness.enum': Field required.$",
        ):
            validate_consistent_llm_evaluator_and_prompt_version(prompt_version, llm_evaluator)

    def test_duplicate_function_parameters_required_values_raises(
        self,
        llm_evaluator: models.LLMEvaluator,
        prompt_version: models.PromptVersion,
    ) -> None:
        assert prompt_version.tools is not None
        prompt_version.tools.tools[0].function.parameters["required"] = [
            "correctness",
            "correctness",
        ]
        with pytest.raises(
            ValueError,
            match=_LLMEvaluatorPromptErrorMessage.REQUIRED_VALUES_MUST_BE_UNIQUE,
        ):
            validate_consistent_llm_evaluator_and_prompt_version(prompt_version, llm_evaluator)

    def test_defined_but_not_required_function_parameters_property_raises(
        self,
        llm_evaluator: models.LLMEvaluator,
        prompt_version: models.PromptVersion,
    ) -> None:
        assert prompt_version.tools is not None
        prompt_version.tools.tools[0].function.parameters = {
            "type": "object",
            "properties": {
                "correctness": {
                    "type": "string",
                    "enum": ["correct", "incorrect"],
                }
            },
            "required": [],
        }
        with pytest.raises(
            ValueError,
            match=_LLMEvaluatorPromptErrorMessage.ALL_DEFINED_PROPERTIES_MUST_BE_REQUIRED,
        ):
            validate_consistent_llm_evaluator_and_prompt_version(prompt_version, llm_evaluator)

    def test_required_but_not_defined_function_parameters_property_raises(
        self,
        llm_evaluator: models.LLMEvaluator,
        prompt_version: models.PromptVersion,
    ) -> None:
        assert prompt_version.tools is not None
        prompt_version.tools.tools[0].function.parameters = {
            "type": "object",
            "properties": {
                "correctness": {
                    "type": "string",
                    "enum": ["correct", "incorrect"],
                }
            },
            "required": ["correctness", "confidence"],
        }
        with pytest.raises(
            ValueError,
            match=_LLMEvaluatorPromptErrorMessage.ALL_REQUIRED_PROPERTIES_SHOULD_BE_DEFINED,
        ):
            validate_consistent_llm_evaluator_and_prompt_version(prompt_version, llm_evaluator)

    def test_annotation_name_mismatch_raises(
        self,
        llm_evaluator: models.LLMEvaluator,
        prompt_version: models.PromptVersion,
    ) -> None:
        assert prompt_version.tools is not None
        prompt_version.tools.tools[0].function.parameters = {
            "type": "object",
            "properties": {
                "different_name": {
                    "type": "string",
                    "enum": ["correct", "incorrect"],
                }
            },
            "required": ["different_name"],
        }
        with pytest.raises(
            ValueError,
            match=_LLMEvaluatorPromptErrorMessage.EVALUATOR_ANNOTATION_NAME_MUST_MATCH_FUNCTION_PROPERTY_NAME,
        ):
            validate_consistent_llm_evaluator_and_prompt_version(prompt_version, llm_evaluator)

    def test_choices_mismatch_raises(
        self,
        llm_evaluator: models.LLMEvaluator,
        prompt_version: models.PromptVersion,
    ) -> None:
        assert prompt_version.tools is not None
        prompt_version.tools.tools[0].function.parameters["properties"]["correctness"][
            "enum"
        ].append("neutral")
        with pytest.raises(
            ValueError,
            match=_LLMEvaluatorPromptErrorMessage.EVALUATOR_CHOICES_MUST_MATCH_FUNCTION_PROPERTY_ENUM,
        ):
            validate_consistent_llm_evaluator_and_prompt_version(prompt_version, llm_evaluator)


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
                                "correctness": {
                                    "type": "string",
                                    "enum": ["correct", "incorrect"],
                                }
                            },
                            "required": ["correctness"],
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

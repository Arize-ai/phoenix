from contextlib import nullcontext
from typing import Any, Optional

import pytest

from phoenix.db import models
from phoenix.db.types.annotation_configs import (
    CategoricalAnnotationConfig,
    CategoricalAnnotationValue,
    OptimizationDirection,
)
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


def _prompt_tools_with_params(parameters: dict[str, Any]) -> PromptTools:
    return PromptTools(
        type="tools",
        tools=[
            PromptToolFunction(
                type="function",
                function=PromptToolFunctionDefinition(
                    name="correctness_evaluator",
                    description="evaluates the correctness of the output",
                    parameters=parameters,
                ),
            )
        ],
        tool_choice=PromptToolChoiceSpecificFunctionTool(
            type="specific_function",
            function_name="correctness_evaluator",
        ),
    )


@pytest.mark.parametrize(
    "evaluator_patches,prompt_version_patches,expected_error",
    [
        # Happy path - valid configuration
        pytest.param(
            {},
            {},
            None,
            id="valid-configuration",
        ),
        # Happy path - both descriptions are None
        pytest.param(
            {"description": None},
            {
                "tools": PromptTools(
                    type="tools",
                    tools=[
                        PromptToolFunction(
                            type="function",
                            function=PromptToolFunctionDefinition(
                                name="correctness_evaluator",
                                # Omit description field entirely
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
                    tool_choice=PromptToolChoiceSpecificFunctionTool(
                        type="specific_function",
                        function_name="correctness_evaluator",
                    ),
                )
            },
            None,
            id="valid-both-descriptions-none",
        ),
        pytest.param(
            {},
            {
                "response_format": PromptResponseFormatJSONSchema(
                    type="json_schema",
                    json_schema=PromptResponseFormatJSONSchemaDefinition(
                        name="test",
                        schema={"type": "object"},
                    ),
                ),
            },
            _LLMEvaluatorPromptErrorMessage.RESPONSE_FORMAT_NOT_SUPPORTED.value,
            id="response-format-not-none",
        ),
        pytest.param(
            {},
            {"tools": None},
            _LLMEvaluatorPromptErrorMessage.TOOLS_REQUIRED.value,
            id="tools-is-none",
        ),
        pytest.param(
            {},
            {
                "tools": PromptTools.model_construct(
                    type="tools",
                    tools=[],
                    tool_choice=PromptToolChoiceSpecificFunctionTool(
                        type="specific_function",
                        function_name="test",
                    ),
                )
            },
            _LLMEvaluatorPromptErrorMessage.TOOLS_MUST_BE_ONE.value,
            id="tools-list-empty",
        ),
        pytest.param(
            {},
            {
                "tools": PromptTools(
                    type="tools",
                    tools=[
                        PromptToolFunction(
                            type="function",
                            function=PromptToolFunctionDefinition(
                                name="correctness_evaluator",
                                description="evaluates the correctness of the output",
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
                        ),
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
                        ),
                    ],
                    tool_choice=PromptToolChoiceSpecificFunctionTool(
                        type="specific_function",
                        function_name="correctness_evaluator",
                    ),
                )
            },
            _LLMEvaluatorPromptErrorMessage.TOOLS_MUST_BE_ONE.value,
            id="tools-list-has-multiple",
        ),
        pytest.param(
            {},
            {
                "tools": PromptTools(
                    type="tools",
                    tools=[
                        PromptToolFunction(
                            type="function",
                            function=PromptToolFunctionDefinition(
                                name="correctness_evaluator",
                                description="evaluates the correctness of the output",
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
                    tool_choice=PromptToolChoiceNone(type="none"),
                )
            },
            _LLMEvaluatorPromptErrorMessage.TOOL_CHOICE_MUST_BE_SPECIFIC_FUNCTION_TOOL.value,
            id="tool-choice-is-none",
        ),
        pytest.param(
            {},
            {
                "tools": PromptTools(
                    type="tools",
                    tools=[
                        PromptToolFunction(
                            type="function",
                            function=PromptToolFunctionDefinition(
                                name="correctness_evaluator",
                                description="evaluates the correctness of the output",
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
                    tool_choice=PromptToolChoiceZeroOrMore(type="zero_or_more"),
                )
            },
            _LLMEvaluatorPromptErrorMessage.TOOL_CHOICE_MUST_BE_SPECIFIC_FUNCTION_TOOL.value,
            id="tool-choice-is-zero-or-more",
        ),
        pytest.param(
            {},
            {
                "tools": PromptTools(
                    type="tools",
                    tools=[
                        PromptToolFunction(
                            type="function",
                            function=PromptToolFunctionDefinition(
                                name="correctness_evaluator",
                                description="evaluates the correctness of the output",
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
                    tool_choice=PromptToolChoiceOneOrMore(type="one_or_more"),
                )
            },
            _LLMEvaluatorPromptErrorMessage.TOOL_CHOICE_MUST_BE_SPECIFIC_FUNCTION_TOOL.value,
            id="tool-choice-is-one-or-more",
        ),
        pytest.param(
            {"name": Identifier("different_name")},
            {},
            _LLMEvaluatorPromptErrorMessage.EVALUATOR_NAME_MUST_MATCH_FUNCTION_NAME.value,
            id="name-mismatch",
        ),
        pytest.param(
            {"description": "a different description"},
            {},
            _LLMEvaluatorPromptErrorMessage.EVALUATOR_DESCRIPTION_MUST_MATCH_FUNCTION_DESCRIPTION.value,
            id="description-both-strings-different",
        ),
        pytest.param(
            {},
            {
                "tools": PromptTools(
                    type="tools",
                    tools=[
                        PromptToolFunction(
                            type="function",
                            function=PromptToolFunctionDefinition(
                                name="correctness_evaluator",
                                # Omit description field entirely
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
                    tool_choice=PromptToolChoiceSpecificFunctionTool(
                        type="specific_function",
                        function_name="correctness_evaluator",
                    ),
                )
            },
            _LLMEvaluatorPromptErrorMessage.EVALUATOR_DESCRIPTION_MUST_MATCH_FUNCTION_DESCRIPTION.value,
            id="description-evaluator-string-function-none",
        ),
        pytest.param(
            {"description": None},
            {},
            _LLMEvaluatorPromptErrorMessage.EVALUATOR_DESCRIPTION_MUST_MATCH_FUNCTION_DESCRIPTION.value,
            id="description-evaluator-none-function-string",
        ),
        pytest.param(
            {},
            {
                "tools": _prompt_tools_with_params(
                    {
                        "type": "array",
                        "items": {"type": "string"},
                    }
                )
            },
            "validation error",
            id="parameters-type-not-object",
        ),
        pytest.param(
            {},
            {
                "tools": _prompt_tools_with_params(
                    {
                        "type": "object",
                        "properties": {},
                        "required": [],
                    }
                )
            },
            "validation error",
            id="parameters-properties-empty",
        ),
        pytest.param(
            {},
            {
                "tools": _prompt_tools_with_params(
                    {
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
                )
            },
            "validation error",
            id="parameters-multiple-properties",
        ),
        pytest.param(
            {},
            {
                "tools": _prompt_tools_with_params(
                    {
                        "type": "object",
                        "properties": {
                            "correctness": {
                                "type": "number",
                                "enum": [0, 1],
                            }
                        },
                        "required": ["correctness"],
                    }
                )
            },
            "validation error",
            id="parameters-property-type-not-string",
        ),
        pytest.param(
            {},
            {
                "tools": _prompt_tools_with_params(
                    {
                        "type": "object",
                        "properties": {
                            "correctness": {
                                "type": "string",
                                "enum": ["correct"],
                            }
                        },
                        "required": ["correctness"],
                    }
                )
            },
            "validation error",
            id="parameters-enum-less-than-two-items",
        ),
        pytest.param(
            {},
            {
                "tools": _prompt_tools_with_params(
                    {
                        "type": "object",
                        "properties": {
                            "correctness": {
                                "type": "string",
                            }
                        },
                        "required": ["correctness"],
                    }
                )
            },
            "validation error",
            id="parameters-missing-enum-field",
        ),
        pytest.param(
            {},
            {
                "tools": _prompt_tools_with_params(
                    {
                        "type": "object",
                        "properties": {
                            "correctness": {
                                "type": "string",
                                "enum": ["correct", "incorrect"],
                            }
                        },
                        "required": ["correctness", "correctness"],
                    }
                )
            },
            _LLMEvaluatorPromptErrorMessage.REQUIRED_VALUES_MUST_BE_UNIQUE.value,
            id="parameters-duplicate-required-values",
        ),
        pytest.param(
            {},
            {
                "tools": _prompt_tools_with_params(
                    {
                        "type": "object",
                        "properties": {
                            "correctness": {
                                "type": "string",
                                "enum": ["correct", "incorrect"],
                            }
                        },
                        "required": [],
                    }
                )
            },
            _LLMEvaluatorPromptErrorMessage.ALL_DEFINED_PROPERTIES_MUST_BE_REQUIRED.value,
            id="parameters-defined-property-not-required",
        ),
        pytest.param(
            {},
            {
                "tools": _prompt_tools_with_params(
                    {
                        "type": "object",
                        "properties": {
                            "correctness": {
                                "type": "string",
                                "enum": ["correct", "incorrect"],
                            }
                        },
                        "required": ["correctness", "confidence"],
                    }
                )
            },
            _LLMEvaluatorPromptErrorMessage.ALL_REQUIRED_PROPERTIES_SHOULD_BE_DEFINED.value,
            id="parameters-required-property-not-defined",
        ),
    ],
)
def test_validate_consistent_llm_evaluator_and_prompt_version(
    evaluator_patches: dict[str, Any],
    prompt_version_patches: dict[str, Any],
    expected_error: Optional[str],
) -> None:
    base_tools = PromptTools(
        type="tools",
        tools=[
            PromptToolFunction(
                type="function",
                function=PromptToolFunctionDefinition(
                    name="correctness_evaluator",
                    description="evaluates the correctness of the output",
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
        tool_choice=PromptToolChoiceSpecificFunctionTool(
            type="specific_function",
            function_name="correctness_evaluator",
        ),
    )

    prompt_version_params = {
        "prompt_id": 1,
        "template_type": PromptTemplateType.CHAT,
        "template_format": PromptTemplateFormat.MUSTACHE,
        "template": PromptChatTemplate(
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
        "invocation_parameters": PromptOpenAIInvocationParameters(
            type="openai",
            openai=PromptOpenAIInvocationParametersContent(),
        ),
        "tools": base_tools,
        "response_format": None,
        "model_provider": ModelProvider.OPENAI,
        "model_name": "gpt-4",
        "metadata_": {},
    }
    prompt_version_params.update(prompt_version_patches)
    prompt_version = models.PromptVersion(**prompt_version_params)

    evaluator_params = {
        "name": Identifier("correctness_evaluator"),
        "description": "evaluates the correctness of the output",
        "kind": "LLM",
        "prompt_id": 1,
        "annotation_name": "correctness",
        "output_config": CategoricalAnnotationConfig(
            type="CATEGORICAL",
            optimization_direction=OptimizationDirection.MAXIMIZE,
            description="correctness evaluation",
            values=[
                CategoricalAnnotationValue(label="correct", score=1.0),
                CategoricalAnnotationValue(label="incorrect", score=0.0),
            ],
        ),
    }
    evaluator_params.update(evaluator_patches)
    evaluator = models.LLMEvaluator(**evaluator_params)

    expectation = (
        pytest.raises(ValueError, match=expected_error) if expected_error else nullcontext()
    )
    with expectation:
        validate_consistent_llm_evaluator_and_prompt_version(prompt_version, evaluator)

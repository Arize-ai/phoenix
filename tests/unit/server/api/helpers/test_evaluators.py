from contextlib import ExitStack
from typing import Any, Optional

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
    ("patch_evaluator_params", "patch_prompt_version_params", "expected_error"),
    (
        pytest.param(
            {},
            {},
            None,
            id="consistent-evaluator-and-prompt-version-does-not-raise",
        ),
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
                    tool_choice=PromptToolChoiceSpecificFunctionTool(
                        type="specific_function",
                        function_name="correctness_evaluator",
                    ),
                )
            },
            None,
            id="both-descriptions-none-does-not-raise",
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
            id="non-null-response-format-raises",
        ),
        pytest.param(
            {},
            {"tools": None},
            _LLMEvaluatorPromptErrorMessage.TOOLS_REQUIRED.value,
            id="null-tools-raises",
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
            id="empty-tools-list-raises",
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
            id="multiple-tools-raises",
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
            id="null-tool-choice-raises",
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
            id="zero-or-more-tool-choice-raises",
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
            id="one-or-more-tool-choice-raises",
        ),
        pytest.param(
            {"name": Identifier("different_name")},
            {},
            _LLMEvaluatorPromptErrorMessage.EVALUATOR_NAME_MUST_MATCH_FUNCTION_NAME.value,
            id="evaluator-and-function-name-mismatch-raises",
        ),
        pytest.param(
            {"description": "a different description"},
            {},
            _LLMEvaluatorPromptErrorMessage.EVALUATOR_DESCRIPTION_MUST_MATCH_FUNCTION_DESCRIPTION.value,
            id="evaluator-and-function-description-mismatch-raises",
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
            id="non-null-evaluator-description-and-null-function-description-raises",
        ),
        pytest.param(
            {"description": None},
            {},
            _LLMEvaluatorPromptErrorMessage.EVALUATOR_DESCRIPTION_MUST_MATCH_FUNCTION_DESCRIPTION.value,
            id="null-evaluator-description-and-non-null-function-description-raises",
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
            id="function-parameters-type-not-object-raises",
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
            id="empty-function-parameters-properties-raises",
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
            id="multiple-function-parameters-properties-raises",
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
            id="function-parameters-property-type-not-string-raises",
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
            id="function-parameters-enum-less-than-two-items-raises",
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
            id="function-parameters-missing-enum-field-raises",
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
            id="duplicate-function-parameters-required-values-raises",
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
            id="defined-but-not-required-function-parameters-property-raises",
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
            id="required-but-not-defined-function-parameters-property-raises",
        ),
    ),
)
def test_validate_consistent_llm_evaluator_and_prompt_version(
    patch_evaluator_params: dict[str, Any],
    patch_prompt_version_params: dict[str, Any],
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
    base_prompt_version_params = {
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
    assert all(
        base_prompt_version_params[key] != patch_prompt_version_params[key]
        for key in patch_prompt_version_params
    ), (
        "Each patch prompt version parameter should differ from the corresponding base prompt version parameter"
    )
    prompt_version = models.PromptVersion(
        **{**base_prompt_version_params, **patch_prompt_version_params}
    )

    base_evaluator_params = {
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
    assert all(
        base_evaluator_params[key] != patch_evaluator_params[key] for key in patch_evaluator_params
    ), (
        "Each patch evaluator parameter should differ from the corresponding base evaluator parameter"
    )
    evaluator = models.LLMEvaluator(**{**base_evaluator_params, **patch_evaluator_params})

    with ExitStack() as stack:
        if expected_error:
            stack.enter_context(pytest.raises(ValueError, match=expected_error))
        validate_consistent_llm_evaluator_and_prompt_version(prompt_version, evaluator)

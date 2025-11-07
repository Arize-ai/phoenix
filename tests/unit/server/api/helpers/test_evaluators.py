from phoenix.db import models
from phoenix.db.types.annotation_configs import (
    CategoricalAnnotationConfig,
    CategoricalAnnotationValue,
    OptimizationDirection,
)
from phoenix.db.types.identifier import Identifier
from phoenix.db.types.model_provider import ModelProvider
from phoenix.server.api.helpers.evaluators import (
    validate_consistent_llm_evaluator_and_prompt_version,
)
from phoenix.server.api.helpers.prompts.models import (
    PromptChatTemplate,
    PromptMessage,
    PromptOpenAIInvocationParameters,
    PromptOpenAIInvocationParametersContent,
    PromptTemplateFormat,
    PromptTemplateType,
    PromptToolChoiceSpecificFunctionTool,
    PromptToolFunction,
    PromptToolFunctionDefinition,
    PromptTools,
    TextContentPart,
)


class TestValidateConsistentLLMEvaluatorAndPromptVersion:
    def test_does_not_raise_for_consistent_evaluator_and_prompt_version(
        self,
    ) -> None:
        evaluator_name = "correctness_evaluator"
        evaluator_description = "evaluates the correctness of the output"
        function_definition = PromptToolFunctionDefinition(
            name=evaluator_name,
            description=evaluator_description,
            parameters={
                "type": "object",
                "properties": {
                    "correctness": {
                        "type": "string",
                        "enum": [
                            "correct",
                            "incorrect",
                        ],
                    }
                },
                "required": ["correctness"],
            },
        )
        tools = PromptTools(
            type="tools",
            tools=[
                PromptToolFunction(
                    type="function",
                    function=function_definition,
                )
            ],
            tool_choice=PromptToolChoiceSpecificFunctionTool(
                type="specific_function",
                function_name=evaluator_name,
            ),
        )
        prompt_version = models.PromptVersion(
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
            tools=tools,
            response_format=None,
            model_provider=ModelProvider.OPENAI,
            model_name="gpt-4",
            metadata_={},
        )
        evaluator = models.LLMEvaluator(
            name=Identifier(evaluator_name),
            description=evaluator_description,
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
        validate_consistent_llm_evaluator_and_prompt_version(prompt_version, evaluator)

from unittest.mock import MagicMock

from phoenix.db.types.model_provider import ModelProvider
from phoenix.server.api.evaluators import create_llm_evaluator_from_inline
from phoenix.server.api.helpers.prompts.models import (
    PromptChatTemplate,
    PromptMessage,
    PromptOpenAIInvocationParameters,
    PromptOpenAIInvocationParametersContent,
    PromptTemplateFormat,
    PromptToolFunction,
    PromptToolFunctionDefinition,
    PromptTools,
)


def _make_prompt_version_orm() -> MagicMock:
    """Create a minimal mock PromptVersion ORM object."""
    orm = MagicMock()
    orm.template = PromptChatTemplate(
        type="chat",
        messages=[PromptMessage(role="system", content="You are an evaluator.")],
    )
    orm.tools = PromptTools(
        type="tools",
        tools=[
            PromptToolFunction(
                type="function",
                function=PromptToolFunctionDefinition(
                    name="score",
                    parameters={"type": "object", "properties": {}},
                ),
            )
        ],
    )
    orm.template_format = PromptTemplateFormat.MUSTACHE
    orm.invocation_parameters = PromptOpenAIInvocationParameters(
        type="openai",
        openai=PromptOpenAIInvocationParametersContent(),
    )
    orm.model_provider = ModelProvider.OPENAI
    return orm


class TestCreateLLMEvaluatorFromInline:
    def test_name_is_passed_through(self) -> None:
        evaluator = create_llm_evaluator_from_inline(
            prompt_version_orm=_make_prompt_version_orm(),
            llm_client=MagicMock(),
            output_configs=[],
            name="Helpfulness",
        )
        assert evaluator.name == "Helpfulness"

    def test_description_is_passed_through(self) -> None:
        evaluator = create_llm_evaluator_from_inline(
            prompt_version_orm=_make_prompt_version_orm(),
            llm_client=MagicMock(),
            output_configs=[],
            name="test",
            description="A test evaluator",
        )
        assert evaluator.description == "A test evaluator"

    def test_output_configs_are_passed_through(self) -> None:
        configs = [MagicMock(), MagicMock()]
        evaluator = create_llm_evaluator_from_inline(
            prompt_version_orm=_make_prompt_version_orm(),
            llm_client=MagicMock(),
            output_configs=configs,
            name="test",
        )
        assert list(evaluator.output_configs) == configs

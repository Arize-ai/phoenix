"""Every evaluator kind returns one result per output name, on success and on failure."""

import json
from dataclasses import dataclass
from typing import Any, AsyncIterator, Optional
from unittest.mock import AsyncMock

import pytest
from pydantic import SecretStr
from sqlalchemy import select

from phoenix.db import models
from phoenix.db.types.annotation_configs import (
    CategoricalAnnotationValue,
    CategoricalOutputConfig,
    OptimizationDirection,
)
from phoenix.db.types.decisions import (
    ChoiceOption,
    ChoiceQuestion,
    JsonState,
    PredicateQuestion,
)
from phoenix.db.types.evaluator_definition import (
    BuiltInEvaluatorDefinition,
    EvaluatorDefinition,
    InlineCodeEvaluatorDefinition,
    InlineDecisionEvaluatorDefinition,
    InlineLLMEvaluatorDefinition,
    InlineLLMEvaluatorPromptVersion,
)
from phoenix.db.types.evaluators import InputMapping
from phoenix.db.types.model_provider import ModelProvider
from phoenix.db.types.prompts import (
    PromptChatTemplate,
    PromptMessage,
    PromptOpenAIInvocationParameters,
    PromptOpenAIInvocationParametersContent,
    PromptTemplateFormat,
    PromptToolChoiceOneOrMore,
    PromptToolFunction,
    PromptToolFunctionDefinition,
    PromptTools,
)
from phoenix.server.api.helpers.decision_clients import (
    ChoiceAnswer,
    DecisionResponse,
    PredicateAnswer,
    TypeSafeDecisionClient,
)
from phoenix.server.api.input_types.GenerativeCredentialInput import GenerativeCredentialInput
from phoenix.server.api.types.ChatCompletionSubscriptionPayload import (
    FunctionCallChunk,
    ToolCallChunk,
)
from phoenix.server.evaluators.resolution import build_evaluator_from_definition
from phoenix.server.evaluators.runtime.base import EvaluatorResultValidationError
from phoenix.server.sandbox.result_protocol import PHOENIX_RESULT_BEGIN, PHOENIX_RESULT_END
from phoenix.server.sandbox.types import BaseNoSessionBackend, ExecutionResult
from phoenix.server.types import DbSessionFactory


def _config(name: str, *labels: str) -> CategoricalOutputConfig:
    return CategoricalOutputConfig(
        type="CATEGORICAL",
        name=name,
        optimization_direction=OptimizationDirection.MAXIMIZE,
        values=[
            CategoricalAnnotationValue(label=label, score=float(index == 0))
            for index, label in enumerate(labels)
        ],
    )


_CONFIGS = [_config("quality", "good", "bad"), _config("relevance", "relevant", "irrelevant")]
_CONTEXT = {"input": {"question": "2 + 2"}, "output": {"answer": "4"}}


class _JudgeClient:
    """Answers with the given tool calls, in order."""

    supports_forced_tool_choice = True

    def __init__(self, *tool_calls: tuple[str, dict[str, Any]]) -> None:
        self._tool_calls = tool_calls

    async def chat_completion_create(self, **_: Any) -> AsyncIterator[Any]:
        for index, (name, arguments) in enumerate(self._tool_calls):
            yield ToolCallChunk(
                id=f"call-{index}",
                function=FunctionCallChunk(name=name, arguments=json.dumps(arguments)),
            )


class _SandboxBackend(BaseNoSessionBackend):
    async def execute(
        self, code: str, session_key: str = "", timeout: Optional[int] = None
    ) -> ExecutionResult:
        payload = json.dumps({"quality": "good", "relevance": "relevant"})
        return ExecutionResult(
            stdout=f"{PHOENIX_RESULT_BEGIN}\n{payload}\n{PHOENIX_RESULT_END}\n", stderr=""
        )

    async def close(self) -> None:
        return None


def _llm_definition() -> InlineLLMEvaluatorDefinition:
    return InlineLLMEvaluatorDefinition(
        type="inline_llm_evaluator",
        name="judge",
        prompt_version=InlineLLMEvaluatorPromptVersion(
            template_format=PromptTemplateFormat.MUSTACHE,
            template=PromptChatTemplate(
                type="chat",
                messages=[PromptMessage(role="user", content="Q: {{input}}\nA: {{output}}")],
            ),
            tools=PromptTools(
                type="tools",
                tools=[
                    PromptToolFunction(
                        type="function",
                        function=PromptToolFunctionDefinition(
                            name=config.name,
                            parameters={
                                "type": "object",
                                "properties": {
                                    "label": {
                                        "type": "string",
                                        "enum": [value.label for value in config.values],
                                        "description": config.name,
                                    }
                                },
                                "required": ["label"],
                            },
                        ),
                    )
                    for config in _CONFIGS
                ],
                tool_choice=PromptToolChoiceOneOrMore(type="one_or_more"),
            ),
            invocation_parameters=PromptOpenAIInvocationParameters(
                type="openai", openai=PromptOpenAIInvocationParametersContent()
            ),
            model_provider=ModelProvider.OPENAI,
            model_name="gpt-4",
        ),
        output_configs=_CONFIGS,
    )


def _code_definition(sandbox_config_id: int) -> InlineCodeEvaluatorDefinition:
    return InlineCodeEvaluatorDefinition(
        type="inline_code_evaluator",
        name="judge",
        language="PYTHON",
        source_code="def evaluate(output):\n    return {}\n",
        sandbox_config_id=sandbox_config_id,
        output_configs=list(_CONFIGS),
    )


def _decision_definition() -> InlineDecisionEvaluatorDefinition:
    return InlineDecisionEvaluatorDefinition(
        type="inline_decision_evaluator",
        name="judge",
        template_format=PromptTemplateFormat.MUSTACHE,
        state=JsonState(type="json", template="{{answer}}"),
        questions=[
            PredicateQuestion(type="predicate", name="correct", instructions="Is it correct?"),
            ChoiceQuestion(
                type="choice",
                name="route",
                instructions="Pick a route",
                choices=[ChoiceOption(value="accept"), ChoiceOption(value="review")],
            ),
        ],
        model_provider=ModelProvider.TYPESAFE,
        model_name="jev-latest",
    )


@dataclass(frozen=True)
class _Kind:
    """One kind's definition, the mapping it runs with, and a mapping that fails it early."""

    definition: EvaluatorDefinition
    output_configs: list[Any]
    mapping: InputMapping
    failing_mapping: InputMapping
    names: list[str]


@pytest.fixture
async def kinds(
    db: DbSessionFactory,
    sandbox_config: models.SandboxConfig,
    synced_builtin_evaluators: None,
    monkeypatch: pytest.MonkeyPatch,
) -> dict[str, _Kind]:
    async def _judge_client(**_: Any) -> _JudgeClient:
        return _JudgeClient(("quality", {"label": "good"}), ("relevance", {"label": "relevant"}))

    async def _sandbox_backend(*_: Any, **__: Any) -> _SandboxBackend:
        return _SandboxBackend()

    monkeypatch.setattr("phoenix.server.evaluators.resolution.get_playground_client", _judge_client)
    monkeypatch.setattr(
        "phoenix.server.evaluators.resolution.build_sandbox_backend", _sandbox_backend
    )
    monkeypatch.setattr(
        TypeSafeDecisionClient,
        "invoke",
        AsyncMock(
            return_value=DecisionResponse(
                model="jev-latest",
                answers={
                    "correct": PredicateAnswer(probability=0.9),
                    "route": ChoiceAnswer(
                        choice="accept",
                        confidence=0.9,
                        probabilities={"accept": 0.9, "review": 0.1},
                    ),
                },
                input_tokens=1,
                output_tokens=1,
            )
        ),
    )
    async with db() as session:
        exact_match_id = await session.scalar(
            select(models.BuiltinEvaluator.id).where(models.BuiltinEvaluator.key == "exact_match")
        )
    assert exact_match_id is not None
    unmapped = InputMapping(literal_mapping={}, path_mapping={})
    names = ["judge.quality", "judge.relevance"]
    return {
        "LLM": _Kind(
            definition=_llm_definition(),
            output_configs=_CONFIGS,
            mapping=unmapped,
            failing_mapping=InputMapping(
                literal_mapping={}, path_mapping={"output": "output.gone"}
            ),
            names=names,
        ),
        "CODE": _Kind(
            definition=_code_definition(sandbox_config.id),
            output_configs=_CONFIGS,
            mapping=unmapped,
            failing_mapping=InputMapping(
                literal_mapping={}, path_mapping={"output": "output.gone"}
            ),
            names=names,
        ),
        "DECISION": _Kind(
            definition=_decision_definition(),
            output_configs=[],
            mapping=InputMapping(literal_mapping={}, path_mapping={"answer": "output.answer"}),
            failing_mapping=InputMapping(
                literal_mapping={}, path_mapping={"answer": "output.gone"}
            ),
            names=["judge.correct", "judge.route"],
        ),
        "BUILTIN": _Kind(
            definition=BuiltInEvaluatorDefinition(
                type="builtin_evaluator", builtin_evaluator_id=exact_match_id
            ),
            output_configs=_CONFIGS,
            mapping=InputMapping(
                literal_mapping={"expected": "4"}, path_mapping={"actual": "output.answer"}
            ),
            failing_mapping=InputMapping(
                literal_mapping={"expected": "4"}, path_mapping={"actual": "output.gone"}
            ),
            names=names,
        ),
    }


async def _evaluate(
    db: DbSessionFactory, kind: _Kind, mapping: InputMapping
) -> list[tuple[str, Optional[str]]]:
    async with db() as session:
        evaluator = await build_evaluator_from_definition(
            definition=kind.definition,
            session=session,
            decrypt=lambda value: value,
            credentials=[
                GenerativeCredentialInput(env_var_name="TYPESAFE_API_KEY", value=SecretStr("test"))
            ],
        )
    results = await evaluator.evaluate(
        context=_CONTEXT,
        input_mapping=mapping,
        name="judge",
        output_configs=kind.output_configs or list(evaluator.output_configs),
    )
    return [(result["name"], result["error"]) for result in results]


@pytest.mark.parametrize("kind_name", ["LLM", "CODE", "DECISION", "BUILTIN"])
async def test_one_result_per_output_on_success(
    db: DbSessionFactory, kinds: dict[str, _Kind], kind_name: str
) -> None:
    kind = kinds[kind_name]
    results = await _evaluate(db, kind, kind.mapping)
    assert results == [(name, None) for name in kind.names]


@pytest.mark.parametrize("kind_name", ["LLM", "CODE", "DECISION", "BUILTIN"])
async def test_one_error_per_output_on_early_failure(
    db: DbSessionFactory, kinds: dict[str, _Kind], kind_name: str
) -> None:
    kind = kinds[kind_name]
    results = await _evaluate(db, kind, kind.failing_mapping)
    assert [name for name, _ in results] == kind.names
    assert all(error for _, error in results)


async def test_llm_unanswered_output_and_disallowed_label_are_errors_per_output(
    db: DbSessionFactory, kinds: dict[str, _Kind], monkeypatch: pytest.MonkeyPatch
) -> None:
    async def _misfit_client(**_: Any) -> _JudgeClient:
        return _JudgeClient(("quality", {"label": "great"}))

    monkeypatch.setattr(
        "phoenix.server.evaluators.resolution.get_playground_client", _misfit_client
    )
    async with db() as session:
        evaluator = await build_evaluator_from_definition(
            definition=kinds["LLM"].definition, session=session, decrypt=lambda value: value
        )
    results = await evaluator.evaluate(
        context=_CONTEXT, input_mapping=kinds["LLM"].mapping, name="judge", output_configs=_CONFIGS
    )
    assert [result["name"] for result in results] == ["judge.quality", "judge.relevance"]
    assert all(
        isinstance(result.get("error_exc"), EvaluatorResultValidationError) for result in results
    )
    assert all(result["label"] is None and result["score"] is None for result in results)

"""A stored evaluator gives the same outcome in a preview, an experiment and online."""

import json
from secrets import token_hex
from typing import Any, AsyncIterator
from unittest.mock import Mock

import pytest
from strawberry.relay import GlobalID

from phoenix.db import models
from phoenix.db.types.annotation_configs import (
    CategoricalAnnotationValue,
    CategoricalOutputConfig,
    OptimizationDirection,
)
from phoenix.db.types.evaluators import InputMapping
from phoenix.db.types.identifier import Identifier
from phoenix.db.types.model_provider import ModelProvider
from phoenix.db.types.prompts import (
    PromptChatTemplate,
    PromptMessage,
    PromptOpenAIInvocationParameters,
    PromptOpenAIInvocationParametersContent,
    PromptTemplateFormat,
    PromptTemplateType,
    PromptToolChoiceOneOrMore,
    PromptToolFunction,
    PromptToolFunctionDefinition,
    PromptTools,
)
from phoenix.server.api.exceptions import BadRequest
from phoenix.server.api.types.ChatCompletionSubscriptionPayload import (
    FunctionCallChunk,
    ToolCallChunk,
)
from phoenix.server.evaluators.resolution import get_evaluators
from phoenix.server.online_eval.consumer import EvaluationConsumer
from phoenix.server.sandbox.session_manager import SandboxSessionManager
from phoenix.server.types import DbSessionFactory
from phoenix.tracers import Tracer
from tests.unit._helpers import _add_project, _add_span, _add_trace
from tests.unit.graphql import AsyncGraphQLClient
from tests.unit.server.online_eval.test_consumer import (
    _cycle_to_completion,
    _get_unit,
    _queue_unit,
)

_NAME = "judge"
_TEMPLATE = "Question: {{input}}\nAnswer: {{output}}"
_CONTEXT = {"input": "2 + 2", "output": "4"}
_UNMAPPED = InputMapping(literal_mapping={}, path_mapping={})
# The tool offers labels its output config does not allow; writes don't check fit.
_TOOL_LABELS = {"quality": ["great", "poor"], "relevance": ["relevant", "irrelevant"]}
_CONFIG_LABELS = {"quality": ["good", "bad"], "relevance": ["relevant", "irrelevant"]}
_PREVIEW = """
  mutation($input: EvaluatorPreviewInput!) {
    previewEvaluator(input: $input) {
      results { key error results { evaluatorName error } }
    }
  }
"""


def _tool_parameters(name: str) -> dict[str, Any]:
    return {
        "type": "object",
        "properties": {"label": {"type": "string", "enum": _TOOL_LABELS[name]}},
        "required": ["label"],
    }


def _output_configs() -> list[CategoricalOutputConfig]:
    return [
        CategoricalOutputConfig(
            type="CATEGORICAL",
            name=name,
            optimization_direction=OptimizationDirection.MAXIMIZE,
            values=[
                CategoricalAnnotationValue(label=label, score=float(index == 0))
                for index, label in enumerate(labels)
            ],
        )
        for name, labels in _CONFIG_LABELS.items()
    ]


def _llm_preview_definition() -> dict[str, Any]:
    """The stored evaluator below, as a preview sends it."""
    return {
        "inlineLlmEvaluator": {
            "name": _NAME,
            "promptVersion": {
                "templateFormat": "MUSTACHE",
                "template": {
                    "messages": [{"role": "USER", "content": [{"text": {"text": _TEMPLATE}}]}]
                },
                "invocationParameters": {"openai": {}},
                "tools": {
                    "tools": [
                        {"function": {"name": name, "parameters": _tool_parameters(name)}}
                        for name in _TOOL_LABELS
                    ],
                    "toolChoice": {"oneOrMore": True},
                },
                "modelProvider": "OPENAI",
                "modelName": "gpt-4",
            },
            "outputConfigs": [
                {
                    "categorical": {
                        "name": name,
                        "optimizationDirection": "MAXIMIZE",
                        "values": [
                            {"label": label, "score": float(index == 0)}
                            for index, label in enumerate(labels)
                        ],
                    }
                }
                for name, labels in _CONFIG_LABELS.items()
            ],
        }
    }


class _JudgeClient:
    """Answers the quality output with a label its config does not allow, and nothing else."""

    supports_forced_tool_choice = True

    async def chat_completion_create(self, **_: Any) -> AsyncIterator[Any]:
        yield ToolCallChunk(
            id="call-1",
            function=FunctionCallChunk(name="quality", arguments=json.dumps({"label": "great"})),
        )

    def is_rate_limit_error(self, error: Exception) -> bool:
        return False

    def is_transient_error(self, error: Exception) -> bool:
        return False


async def _bind(session: Any, evaluator: models.Evaluator, project_id: int) -> tuple[int, int]:
    """A dataset binding and a span project binding, both named like the evaluator, so every
    context names its results the same way."""
    dataset = models.Dataset(name=f"dataset-{token_hex(4)}", metadata_={})
    session.add(dataset)
    await session.flush()
    dataset_evaluator = models.DatasetEvaluators(
        dataset_id=dataset.id,
        evaluator_id=evaluator.id,
        name=evaluator.name,
        input_mapping=_UNMAPPED,
        project=models.Project(name=f"dataset-evaluator-{token_hex(4)}"),
    )
    project_evaluator = models.ProjectEvaluator(
        trace_project=models.Project(name=f"project-evaluator-{token_hex(4)}"),
        project_id=project_id,
        evaluator_id=evaluator.id,
        name=evaluator.name,
        filter_condition="",
        sampling_rate=1.0,
        evaluation_target="SPAN",
    )
    session.add_all([dataset_evaluator, project_evaluator])
    await session.flush()
    return dataset_evaluator.id, project_evaluator.id


async def _seed_span(db: DbSessionFactory) -> tuple[int, int]:
    async with db() as session:
        project = await _add_project(session)
        trace = await _add_trace(session, project)
        span = await _add_span(
            session,
            trace,
            attributes={"input": {"value": _CONTEXT["input"]}, "output": {"value": "4"}},
        )
    return project.id, span.id


async def _run_online(
    db: DbSessionFactory, span_id: int, evaluator_id: int, project_evaluator_id: int
) -> str:
    unit_id, _ = await _queue_unit(db, span_id, evaluator_id, project_evaluator_id)
    consumer = EvaluationConsumer(
        db,
        decrypt=lambda value: value,
        sandbox_session_manager=SandboxSessionManager(),
        tracer_factory=lambda: Tracer(span_cost_calculator=Mock()),
    )
    await _cycle_to_completion(consumer)
    error = (await _get_unit(db, unit_id)).error
    assert error is not None
    return error


async def test_a_misfit_llm_evaluator_errors_the_same_way_in_every_context(
    db: DbSessionFactory, gql_client: AsyncGraphQLClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def _judge_client(**_: Any) -> _JudgeClient:
        return _JudgeClient()

    monkeypatch.setattr("phoenix.server.evaluators.resolution.get_playground_client", _judge_client)
    project_id, span_id = await _seed_span(db)
    async with db() as session:
        evaluator = models.LLMEvaluator(
            name=Identifier(_NAME),
            description=None,
            kind="LLM",
            output_configs=_output_configs(),
            prompt=models.Prompt(
                name=Identifier(f"prompt-{token_hex(4)}"),
                prompt_versions=[
                    models.PromptVersion(
                        template_type=PromptTemplateType.CHAT,
                        template_format=PromptTemplateFormat.MUSTACHE,
                        template=PromptChatTemplate(
                            type="chat", messages=[PromptMessage(role="user", content=_TEMPLATE)]
                        ),
                        invocation_parameters=PromptOpenAIInvocationParameters(
                            type="openai", openai=PromptOpenAIInvocationParametersContent()
                        ),
                        tools=PromptTools(
                            type="tools",
                            tools=[
                                PromptToolFunction(
                                    type="function",
                                    function=PromptToolFunctionDefinition(
                                        name=name, parameters=_tool_parameters(name)
                                    ),
                                )
                                for name in _TOOL_LABELS
                            ],
                            tool_choice=PromptToolChoiceOneOrMore(type="one_or_more"),
                        ),
                        response_format=None,
                        model_provider=ModelProvider.OPENAI,
                        model_name="gpt-4",
                        metadata_={},
                    )
                ],
            ),
        )
        session.add(evaluator)
        await session.flush()
        evaluator_id = evaluator.id
        dataset_evaluator_id, project_evaluator_id = await _bind(session, evaluator, project_id)

    preview = await gql_client.execute(
        _PREVIEW,
        {
            "input": {
                "evaluator": _llm_preview_definition(),
                "inputMapping": {"literalMapping": {}, "pathMapping": {}},
                "subjects": [{"key": "subject", "context": _CONTEXT}],
            }
        },
    )
    assert preview.data and not preview.errors, preview.errors
    (subject,) = preview.data["previewEvaluator"]["results"]
    assert subject["error"] is None, subject["error"]
    preview_results = [(result["evaluatorName"], result["error"]) for result in subject["results"]]

    async with db() as session:
        (experiment_evaluator,) = await get_evaluators(
            dataset_evaluator_ids=[dataset_evaluator_id],
            session=session,
            decrypt=lambda value: value,
            experiment_id=0,
            sandbox_session_manager=SandboxSessionManager(),
        )
    experiment_results = [
        (result["name"], result["error"])
        for result in await experiment_evaluator.evaluate(
            context=_CONTEXT,
            input_mapping=_UNMAPPED,
            name=_NAME,
            output_configs=experiment_evaluator.output_configs,
        )
    ]

    online_error = await _run_online(db, span_id, evaluator_id, project_evaluator_id)

    assert [name for name, _ in preview_results] == [f"{_NAME}.quality", f"{_NAME}.relevance"]
    assert all(error for _, error in preview_results)
    assert experiment_results == preview_results
    assert online_error == f"EVALUATOR_RESULT_INVALID: {preview_results[0][1]}"


async def test_an_unbuildable_code_sandbox_is_refused_the_same_way_in_every_context(
    db: DbSessionFactory, gql_client: AsyncGraphQLClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    # The provider is enabled in the database, but this server does not allow it, so no
    # backend can be built for it.
    monkeypatch.setenv("PHOENIX_ALLOWED_SANDBOX_PROVIDERS", "MONTY")
    project_id, span_id = await _seed_span(db)
    async with db() as session:
        if await session.get(models.Language, "PYTHON") is None:
            session.add(models.Language(name="PYTHON"))
        provider = await session.get(models.SandboxProvider, "DOCKER")
        if provider is None:
            session.add(models.SandboxProvider(backend_type="DOCKER", enabled=True, config={}))
        else:
            provider.enabled = True
        await session.flush()
        sandbox_config = models.SandboxConfig(
            backend_type="DOCKER",
            language="PYTHON",
            name=Identifier(f"docker-{token_hex(4)}"),
            config={"language": "PYTHON"},
            timeout=30,
        )
        session.add(sandbox_config)
        await session.flush()
        evaluator = models.CodeEvaluator(
            name=Identifier("answer-length"),
            input_mapping=_UNMAPPED,
            output_configs=[],
            language="PYTHON",
            sandbox_config_id=sandbox_config.id,
        )
        session.add(evaluator)
        await session.flush()
        session.add(
            models.CodeEvaluatorVersion(
                code_evaluator_id=evaluator.id,
                source_code="def evaluate(output):\n    return len(output)\n",
            )
        )
        await session.flush()
        evaluator_id = evaluator.id
        dataset_evaluator_id, project_evaluator_id = await _bind(session, evaluator, project_id)

    preview = await gql_client.execute(
        _PREVIEW,
        {
            "input": {
                "evaluator": {"codeEvaluatorId": str(GlobalID("CodeEvaluator", str(evaluator_id)))},
                "inputMapping": {"literalMapping": {}, "pathMapping": {}},
                "subjects": [{"key": "subject", "context": _CONTEXT}],
            }
        },
    )
    assert preview.errors
    preview_error = preview.errors[0].message

    async with db() as session:
        with pytest.raises(BadRequest) as experiment_refusal:
            await get_evaluators(
                dataset_evaluator_ids=[dataset_evaluator_id],
                session=session,
                decrypt=lambda value: value,
                experiment_id=0,
                sandbox_session_manager=SandboxSessionManager(),
            )

    online_error = await _run_online(db, span_id, evaluator_id, project_evaluator_id)

    assert str(experiment_refusal.value) == preview_error
    assert online_error == preview_error

import asyncio
from collections.abc import Callable, Coroutine, Iterable
from secrets import token_hex
from typing import Any, cast

import pytest
from sqlalchemy import event, text
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession
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
    TextContentPart,
)
from phoenix.server.api.helpers import dataset_evaluator_service as dataset_service
from phoenix.server.api.helpers import project_evaluator_service as project_service
from phoenix.server.api.helpers.evaluator_management import lock_evaluators as lock_evaluator_rows
from phoenix.server.api.helpers.evaluator_prompt_source import FromPromptVersion
from phoenix.server.api.helpers.evaluator_service import EvaluatorServiceContext
from phoenix.server.app import _db
from phoenix.server.sandbox.types import SandboxRuntimeContext
from phoenix.server.types import DbSessionFactory


def _prompt_version(text: str) -> models.PromptVersion:
    return models.PromptVersion(
        template_type=PromptTemplateType.CHAT,
        template_format=PromptTemplateFormat.MUSTACHE,
        template=PromptChatTemplate(
            type="chat",
            messages=[
                PromptMessage(role="user", content=[TextContentPart(type="text", text=text)])
            ],
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
                        name="correctness",
                        description="correctness",
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
            tool_choice=PromptToolChoiceOneOrMore(type="one_or_more"),
        ),
        response_format=None,
        model_provider=ModelProvider.OPENAI,
        model_name="gpt-4o-mini",
        metadata_={},
    )


def _output_config() -> CategoricalOutputConfig:
    return CategoricalOutputConfig(
        type="CATEGORICAL",
        name="correctness",
        optimization_direction=OptimizationDirection.MAXIMIZE,
        values=[
            CategoricalAnnotationValue(label="correct", score=1.0),
            CategoricalAnnotationValue(label="incorrect", score=0.0),
        ],
    )


def _input_mapping(path: str) -> InputMapping:
    return InputMapping(literal_mapping={}, path_mapping={"output": path})


async def _seed_binding(
    db: DbSessionFactory, binding_kind: str
) -> tuple[int, int, int, Identifier]:
    suffix = token_hex(4)
    version = _prompt_version("Judge {{output}}")
    prompt = models.Prompt(
        name=Identifier(f"delete-lock-prompt-{suffix}"),
        description="lock ordering",
        metadata_={},
        prompt_versions=[version],
    )
    binding_name = Identifier(f"delete-lock-binding-{suffix}")
    evaluator = models.LLMEvaluator(
        name=binding_name,
        description="correctness",
        output_configs=[_output_config()],
        prompt=prompt,
    )

    async with db() as session:
        session.add(evaluator)
        await session.flush()
        tag = models.PromptVersionTag(
            name=Identifier(f"delete-lock-tag-{suffix}"),
            prompt_id=prompt.id,
            prompt_version_id=version.id,
        )
        session.add(tag)
        await session.flush()
        evaluator.prompt_version_tag = tag

        if binding_kind == "dataset":
            dataset_binding = models.DatasetEvaluators(
                dataset=models.Dataset(name=f"delete-lock-dataset-{suffix}", metadata_={}),
                evaluator_id=evaluator.id,
                name=binding_name,
                input_mapping=_input_mapping("$.output"),
                project=models.Project(name=f"delete-lock-dataset-trace-{suffix}"),
            )
            session.add(dataset_binding)
            await session.flush()
            return dataset_binding.id, dataset_binding.dataset_id, version.id, binding_name

        project_binding = models.ProjectEvaluator(
            project=models.Project(name=f"delete-lock-project-{suffix}"),
            evaluator_id=evaluator.id,
            trace_project=models.Project(name=f"delete-lock-project-trace-{suffix}"),
            name=binding_name,
            filter_condition="",
            sampling_rate=1.0,
            evaluation_target="TRACE",
            input_mapping=_input_mapping("$.output"),
            enabled=True,
        )
        session.add(project_binding)
        await session.flush()
        return project_binding.id, project_binding.project_id, version.id, binding_name


async def _wait_for_postgres_blocker(
    engine: AsyncEngine, *, waiting_pid: int, blocker_pid: int
) -> None:
    statement = text(
        "SELECT wait_event_type, pg_blocking_pids(pid) FROM pg_stat_activity WHERE pid = :pid"
    )
    async with engine.connect() as connection:
        while True:
            await connection.execute(text("SELECT pg_stat_clear_snapshot()"))
            row = (await connection.execute(statement, {"pid": waiting_pid})).one_or_none()
            if row is not None and row[0] == "Lock" and blocker_pid in row[1]:
                return


async def _run_delete_interleaving(
    postgresql_engine: AsyncEngine,
    *,
    update_call: Callable[[], Coroutine[Any, Any, Any]],
    delete_call: Callable[[], Coroutine[Any, Any, list[GlobalID]]],
    update_has_evaluator_lock: asyncio.Event,
    release_update: asyncio.Event,
    delete_entered_lock_helper: asyncio.Event,
    backend_pids: dict[str, int],
    delete_table: str,
) -> tuple[Any, list[GlobalID]]:
    binding_delete_started = asyncio.Event()

    def before_cursor_execute(
        _connection: Any,
        _cursor: Any,
        statement: str,
        _parameters: Any,
        _context: Any,
        _executemany: bool,
    ) -> None:
        normalized = " ".join(statement.lower().replace('"', "").split())
        if f"delete from {delete_table}" in normalized:
            binding_delete_started.set()
            if not release_update.is_set():
                raise AssertionError(
                    f"{delete_table} delete started before the evaluator edit released its lock"
                )

    event.listen(postgresql_engine.sync_engine, "before_cursor_execute", before_cursor_execute)
    update_task: asyncio.Task[Any] = asyncio.create_task(update_call())
    delete_task: asyncio.Task[list[GlobalID]] | None = None
    try:
        await asyncio.wait_for(update_has_evaluator_lock.wait(), timeout=10)
        delete_task = asyncio.create_task(delete_call())
        await asyncio.wait_for(delete_entered_lock_helper.wait(), timeout=10)
        assert "update" in backend_pids
        assert "delete" in backend_pids
        await asyncio.wait_for(
            _wait_for_postgres_blocker(
                postgresql_engine,
                waiting_pid=backend_pids["delete"],
                blocker_pid=backend_pids["update"],
            ),
            timeout=10,
        )
        assert not binding_delete_started.is_set()
    finally:
        release_update.set()
        event.remove(postgresql_engine.sync_engine, "before_cursor_execute", before_cursor_execute)
        service_tasks: list[asyncio.Task[Any]] = [update_task]
        if delete_task is not None:
            service_tasks.append(delete_task)
        try:
            results = await asyncio.wait_for(
                asyncio.gather(*service_tasks, return_exceptions=True), timeout=15
            )
        except TimeoutError:
            for task in service_tasks:
                if not task.done():
                    task.cancel()
            await asyncio.gather(*service_tasks, return_exceptions=True)
            raise

    update_result, delete_result = results
    if isinstance(update_result, BaseException):
        raise update_result
    if isinstance(delete_result, BaseException):
        raise delete_result
    assert delete_task is not None
    return update_result, delete_result


@pytest.mark.postgres_only
async def test_dataset_binding_delete_waits_for_llm_edit(
    postgresql_engine: AsyncEngine, monkeypatch: pytest.MonkeyPatch
) -> None:
    db = DbSessionFactory(db=_db(postgresql_engine), dialect="postgresql")
    context = EvaluatorServiceContext(
        db=db,
        sandbox_runtime=SandboxRuntimeContext(monty=cast(Any, None)),
    )
    binding_id, dataset_id, version_id, binding_name = await _seed_binding(db, "dataset")
    binding_gid = GlobalID("DatasetEvaluator", str(binding_id))
    version_gid = GlobalID("PromptVersion", str(version_id))
    update_has_evaluator_lock = asyncio.Event()
    release_update = asyncio.Event()
    delete_entered_lock_helper = asyncio.Event()
    backend_pids: dict[str, int] = {}

    original_write = dataset_service._write_dataset_evaluator

    async def gated_write(
        session: AsyncSession, row_id: int, values: dict[str, Any]
    ) -> models.DatasetEvaluators:
        pid = await session.scalar(text("SELECT pg_backend_pid()"))
        assert isinstance(pid, int)
        backend_pids["update"] = pid
        update_has_evaluator_lock.set()
        await release_update.wait()
        return await original_write(session, row_id, values)

    async def observe_delete_lock(session: AsyncSession, evaluator_ids: Iterable[int]) -> None:
        pid = await session.scalar(text("SELECT pg_backend_pid()"))
        assert isinstance(pid, int)
        backend_pids["delete"] = pid
        delete_entered_lock_helper.set()
        await lock_evaluator_rows(session, evaluator_ids)

    monkeypatch.setattr(dataset_service, "_write_dataset_evaluator", gated_write)
    monkeypatch.setattr(dataset_service, "lock_evaluators", observe_delete_lock)

    async def update_binding() -> models.DatasetEvaluators:
        return await dataset_service.update_dataset_llm_evaluator(
            context,
            dataset_service.UpdateDatasetLLMEvaluatorInput(
                dataset_evaluator_id=binding_gid,
                dataset_id=GlobalID("Dataset", str(dataset_id)),
                name=binding_name,
                prompt_source=FromPromptVersion(version_gid),
                output_configs=[_output_config()],
                input_mapping=_input_mapping("$.answer"),
            ),
        )

    async def delete_binding() -> list[GlobalID]:
        return await dataset_service.delete_dataset_evaluators(
            context,
            dataset_service.DeleteDatasetEvaluatorsInput(dataset_evaluator_ids=[binding_gid]),
        )

    update_result, delete_result = await _run_delete_interleaving(
        postgresql_engine,
        update_call=update_binding,
        delete_call=delete_binding,
        update_has_evaluator_lock=update_has_evaluator_lock,
        release_update=release_update,
        delete_entered_lock_helper=delete_entered_lock_helper,
        backend_pids=backend_pids,
        delete_table="dataset_evaluators",
    )
    assert isinstance(update_result, models.DatasetEvaluators)
    assert update_result.input_mapping == _input_mapping("$.answer")
    assert delete_result == [binding_gid]
    async with db() as session:
        assert await session.get(models.DatasetEvaluators, binding_id) is None


@pytest.mark.postgres_only
async def test_project_binding_delete_waits_for_llm_edit(
    postgresql_engine: AsyncEngine, monkeypatch: pytest.MonkeyPatch
) -> None:
    db = DbSessionFactory(db=_db(postgresql_engine), dialect="postgresql")
    context = EvaluatorServiceContext(
        db=db,
        sandbox_runtime=SandboxRuntimeContext(monty=cast(Any, None)),
    )
    binding_id, _project_id, version_id, binding_name = await _seed_binding(db, "project")
    binding_gid = GlobalID("ProjectEvaluator", str(binding_id))
    version_gid = GlobalID("PromptVersion", str(version_id))
    update_has_evaluator_lock = asyncio.Event()
    release_update = asyncio.Event()
    delete_entered_lock_helper = asyncio.Event()
    backend_pids: dict[str, int] = {}

    original_write = project_service._write_project_evaluator

    async def gated_write(
        session: AsyncSession, row_id: int, values: dict[str, Any]
    ) -> models.ProjectEvaluator:
        pid = await session.scalar(text("SELECT pg_backend_pid()"))
        assert isinstance(pid, int)
        backend_pids["update"] = pid
        update_has_evaluator_lock.set()
        await release_update.wait()
        return await original_write(session, row_id, values)

    async def observe_delete_lock(session: AsyncSession, evaluator_ids: Iterable[int]) -> None:
        pid = await session.scalar(text("SELECT pg_backend_pid()"))
        assert isinstance(pid, int)
        backend_pids["delete"] = pid
        delete_entered_lock_helper.set()
        await lock_evaluator_rows(session, evaluator_ids)

    monkeypatch.setattr(project_service, "_write_project_evaluator", gated_write)
    monkeypatch.setattr(project_service, "lock_evaluators", observe_delete_lock)

    async def update_binding() -> models.ProjectEvaluator:
        return await project_service.update_project_llm_evaluator(
            context,
            project_service.UpdateProjectLLMEvaluatorInput(
                project_evaluator_id=binding_gid,
                name=binding_name,
                prompt_source=FromPromptVersion(version_gid),
                output_configs=[_output_config()],
                input_mapping=_input_mapping("$.answer"),
                sampling_rate=0.5,
                evaluation_target="TRACE",
                filter_condition="",
            ),
        )

    async def delete_binding() -> list[GlobalID]:
        return await project_service.delete_project_evaluators(
            context,
            project_service.DeleteProjectEvaluatorsInput(project_evaluator_ids=[binding_gid]),
        )

    update_result, delete_result = await _run_delete_interleaving(
        postgresql_engine,
        update_call=update_binding,
        delete_call=delete_binding,
        update_has_evaluator_lock=update_has_evaluator_lock,
        release_update=release_update,
        delete_entered_lock_helper=delete_entered_lock_helper,
        backend_pids=backend_pids,
        delete_table="project_evaluators",
    )
    assert isinstance(update_result, models.ProjectEvaluator)
    assert update_result.input_mapping == _input_mapping("$.answer")
    assert update_result.sampling_rate == 0.5
    assert delete_result == [binding_gid]
    async with db() as session:
        assert await session.get(models.ProjectEvaluator, binding_id) is None

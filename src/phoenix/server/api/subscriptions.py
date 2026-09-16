import asyncio
import logging
from collections import deque
from collections.abc import AsyncIterator, Mapping, Sequence
from dataclasses import dataclass, replace
from typing import (
    Any,
    AsyncGenerator,
    Callable,
    Coroutine,
    Optional,
    TypeVar,
    cast,
)

import anyio
import strawberry
from anyio.streams.memory import MemoryObjectReceiveStream, MemoryObjectSendStream
from openinference.semconv.trace import SpanAttributes
from opentelemetry.context import Context as OtelContext
from pydantic import ValidationError
from sqlalchemy import and_, insert, select
from sqlalchemy import func as sa_func
from sqlalchemy.ext.asyncio import AsyncSession
from strawberry.relay import GlobalID
from strawberry.types import Info
from typing_extensions import TypeAlias

from phoenix.config import PLAYGROUND_PROJECT_NAME
from phoenix.db import models
from phoenix.db.helpers import (
    get_dataset_example_revisions,
    insert_experiment_with_examples_snapshot,
)
from phoenix.db.types.evaluator_definition import EvaluatorDefinition, evaluator_kind_of
from phoenix.db.types.experiment_config import PlaygroundConfig
from phoenix.db.types.identifier import Identifier
from phoenix.server.api.auth import IsLocked, IsNotReadOnly, IsNotViewer
from phoenix.server.api.context import Context
from phoenix.server.api.evaluators import (
    BaseEvaluator,
    build_evaluator_from_definition,
    pin_evaluator_definition,
)
from phoenix.server.api.exceptions import BadRequest, NotFound
from phoenix.server.api.helpers.message_helpers import (
    formatted_messages,
    prompt_chat_template_to_playground_messages,
)
from phoenix.server.api.helpers.playground_clients import (
    PlaygroundClient,
    get_playground_client,
    initialize_playground_clients,
)
from phoenix.server.api.helpers.playground_users import get_user
from phoenix.server.api.input_types.ChatCompletionInput import ChatCompletionInput
from phoenix.server.api.input_types.ConnectionConfigInput import to_connection_config
from phoenix.server.api.input_types.ExperimentsOverDatasetInput import (
    EvaluatorTaskInput,
    ExperimentsOverDatasetInput,
    ExperimentTaskInput,
    PromptTaskInput,
)
from phoenix.server.api.input_types.GenerativeCredentialInput import GenerativeCredentialInput
from phoenix.server.api.types.ChatCompletionSubscriptionPayload import (
    ChatCompletionSubscriptionError,
    ChatCompletionSubscriptionExperiment,
    ChatCompletionSubscriptionPayload,
    ChatCompletionSubscriptionResult,
)
from phoenix.server.api.types.Dataset import Dataset
from phoenix.server.api.types.DatasetExample import DatasetExample
from phoenix.server.api.types.DatasetVersion import DatasetVersion
from phoenix.server.api.types.Experiment import Experiment, to_gql_experiment
from phoenix.server.api.types.node import from_global_id_with_expected_type
from phoenix.server.api.types.Span import Span
from phoenix.server.daemons.span_cost_calculator import SpanCostCalculator
from phoenix.server.dml_event import SpanInsertEvent
from phoenix.server.experiments.utils import generate_experiment_project_name
from phoenix.server.types import DbSessionFactory
from phoenix.tracers import Tracer

GenericType = TypeVar("GenericType")

logger = logging.getLogger(__name__)

initialize_playground_clients()

RepetitionNumber: TypeAlias = int
ChatStream: TypeAlias = AsyncGenerator[ChatCompletionSubscriptionPayload, None]
PayloadStream: TypeAlias = MemoryObjectReceiveStream[ChatCompletionSubscriptionPayload]

# Each experiment's subscriber stream buffers this many payloads in the runner
_EXPERIMENT_STREAM_BUFFER_SIZE = 1000


async def _stream_single_chat_completion(
    *,
    input: ChatCompletionInput,
    llm_client: "PlaygroundClient[Any]",
    repetition_number: RepetitionNumber,
    db: DbSessionFactory,
    project_id: int,
    on_span_insertion: Callable[[], None],
    span_cost_calculator: SpanCostCalculator,
    otel_context: OtelContext,
) -> ChatStream:
    tracer = Tracer(span_cost_calculator=span_cost_calculator)
    try:
        messages = prompt_chat_template_to_playground_messages(
            input.prompt_version.template.to_orm()
        )
        if template_options := input.template:
            messages = formatted_messages(
                messages=messages,
                template_format=template_options.format,
                template_variables=cast(Mapping[str, Any], template_options.variables),
            )
        invocation_parameters = input.prompt_version.invocation_parameters.to_orm()
        tools = input.prompt_version.tools.to_orm() if input.prompt_version.tools else None
        response_format = (
            input.prompt_version.response_format.to_orm()
            if input.prompt_version.response_format
            else None
        )

        async for chunk in llm_client.chat_completion_create(
            messages=messages,
            tools=tools,
            response_format=response_format,
            invocation_parameters=invocation_parameters,
            tracer=tracer,
            otel_context=otel_context,
            stream_model_output=input.stream_model_output,
        ):
            chunk.repetition_number = repetition_number
            yield chunk
    except Exception as error:
        yield ChatCompletionSubscriptionError(
            message=str(error),
            repetition_number=repetition_number,
        )

    db_traces = tracer.get_db_traces(project_id=project_id)
    async with db() as session:
        session.add_all(db_traces)
        await session.flush()
    if db_traces and db_traces[0].spans:
        db_span = db_traces[0].spans[0]
        yield ChatCompletionSubscriptionResult(
            span=Span(id=db_span.id, db_record=db_span),
            repetition_number=repetition_number,
        )
        on_span_insertion()


async def _cleanup_chat_completion_resources(
    in_progress: list[
        tuple[
            RepetitionNumber,
            ChatStream,
            asyncio.Task[ChatCompletionSubscriptionPayload],
        ]
    ],
    not_started: deque[tuple[RepetitionNumber, ChatStream]],
) -> None:
    """
    Cleanup all resources on cancellation or error. MUST be called in a finally block.

    The cleanup sequence (cancel → await tasks → aclose generators) is critical and must
    not be reordered. task.cancel() only *schedules* a CancelledError—it doesn't wait for
    the task to process it. If we call stream.aclose() immediately, the task still "owns"
    the generator and we get "async generator is already running". By awaiting all tasks
    first, we let them process cancellation and release their generators.

    We cancel all tasks uniformly (including done ones—it's a no-op) because a task being
    "done" doesn't mean its generator is closed; it just completed one iteration. We use
    explicit aclose() rather than relying on GC to ensure generators run their finally
    blocks immediately, preventing data loss and resource leaks.
    """
    import inspect

    logger.info(f"Cleaning up: {len(in_progress)} in progress, {len(not_started)} not started")

    # 1. Cancel all tasks (no-op for done tasks)
    for _, _, task in in_progress:
        task.cancel()

    # 2. Wait for tasks to process cancellation and release generators
    if in_progress:
        await asyncio.gather(
            *[task for _, _, task in in_progress],
            return_exceptions=True,
        )

    # 3. Now it's safe to close generators
    if in_progress:
        await asyncio.gather(
            *[stream.aclose() for _, stream, _ in in_progress if inspect.isasyncgen(stream)],
            return_exceptions=True,
        )

    # 4. Close not-started generators (no tasks to cancel, just close directly)
    if not_started:
        await asyncio.gather(
            *[stream.aclose() for _, stream in not_started if inspect.isasyncgen(stream)],
            return_exceptions=True,
        )

    logger.info("Resource cleanup complete")


@strawberry.type
class Subscription:
    @strawberry.subscription(permission_classes=[IsNotReadOnly, IsNotViewer, IsLocked])  # type: ignore
    async def chat_completion(
        self, info: Info[Context, None], input: ChatCompletionInput
    ) -> AsyncIterator[ChatCompletionSubscriptionPayload]:
        model_provider = input.prompt_version.model_provider.to_model_provider()
        custom_provider_id = input.prompt_version.resolved_custom_provider_id
        connection = (
            custom_provider_id
            if custom_provider_id is not None
            else to_connection_config(model_provider, input.connection_config)
        )
        headers = cast(dict[str, str], input.headers) if input.headers else None
        async with info.context.db() as session:
            llm_client = await get_playground_client(
                model_provider=model_provider,
                model_name=input.prompt_version.model_name,
                session=session,
                decrypt=info.context.decrypt,
                credentials=input.credentials,
                connection=connection,
                headers=headers,
            )
            if (
                playground_project_id := await session.scalar(
                    select(models.Project.id).where(models.Project.name == PLAYGROUND_PROJECT_NAME)
                )
            ) is None:
                playground_project_id = await session.scalar(
                    insert(models.Project)
                    .returning(models.Project.id)
                    .values(
                        name=PLAYGROUND_PROJECT_NAME,
                        description="Traces from prompt playground",
                    )
                )

        not_started: deque[tuple[RepetitionNumber, ChatStream]] = deque(
            (
                repetition_number,
                _stream_single_chat_completion(
                    input=input,
                    llm_client=llm_client,
                    repetition_number=repetition_number,
                    db=info.context.db,
                    project_id=playground_project_id,
                    on_span_insertion=lambda: info.context.event_queue.put(
                        SpanInsertEvent(ids=(playground_project_id,))
                    ),
                    span_cost_calculator=info.context.span_cost_calculator,
                    otel_context=OtelContext(),
                ),
            )
            for repetition_number in range(1, input.repetitions + 1)
        )
        in_progress: list[
            tuple[
                RepetitionNumber,
                ChatStream,
                asyncio.Task[ChatCompletionSubscriptionPayload],
            ]
        ] = []
        max_in_progress = 3

        try:
            while not_started or in_progress:
                while not_started and len(in_progress) < max_in_progress:
                    rep_num, stream = not_started.popleft()
                    task = _create_task_with_timeout(stream)
                    in_progress.append((rep_num, stream, task))
                async_tasks_to_run = [task for _, _, task in in_progress]
                completed_tasks, _ = await asyncio.wait(
                    async_tasks_to_run, return_when=asyncio.FIRST_COMPLETED
                )
                for completed_task in completed_tasks:
                    idx = [task for _, _, task in in_progress].index(completed_task)
                    repetition_number, stream, _ = in_progress[idx]
                    try:
                        yield completed_task.result()
                    except StopAsyncIteration:
                        del in_progress[idx]  # removes exhausted stream
                    except asyncio.TimeoutError:
                        del in_progress[idx]  # removes timed-out stream
                        yield ChatCompletionSubscriptionError(
                            message="Playground task timed out",
                            repetition_number=repetition_number,
                        )
                    except Exception as error:
                        del in_progress[idx]  # removes failed stream
                        yield ChatCompletionSubscriptionError(
                            message="An unexpected error occurred",
                            repetition_number=repetition_number,
                        )
                        logger.exception(error)
                    else:
                        task = _create_task_with_timeout(stream)
                        in_progress[idx] = (repetition_number, stream, task)
        finally:
            await _cleanup_chat_completion_resources(
                in_progress=in_progress,
                not_started=not_started,
            )

    @strawberry.subscription(permission_classes=[IsNotReadOnly, IsNotViewer, IsLocked])  # type: ignore
    async def experiments_over_dataset(
        self, info: Info[Context, None], input: ExperimentsOverDatasetInput
    ) -> AsyncIterator[ChatCompletionSubscriptionPayload]:
        """
        Run every task over the dataset as its own experiment, in the background via
        ExperimentRunner, and stream all their payloads to the client.

        One ``ChatCompletionSubscriptionExperiment`` per task arrives first, in ``tasks``
        order; every payload carries the ``experimentId`` it belongs to.
        """
        async for payload in _stream_experiments_over_dataset(info, input):
            yield payload


@dataclass(frozen=True)
class _DatasetRunTarget:
    """The dataset rows a run covers, resolved from the input's global ids."""

    dataset_id: int
    dataset_version_id: int
    split_ids: Optional[list[int]]
    example_ids: Optional[list[int]]


@dataclass(frozen=True)
class _ResolvedEvaluatorTask:
    """An evaluator task whose evaluator was built once to validate it and read its name."""

    definition: EvaluatorDefinition
    evaluator: BaseEvaluator
    name: Identifier


async def _stream_experiments_over_dataset(
    info: Info[Context, None],
    input: ExperimentsOverDatasetInput,
) -> AsyncIterator[ChatCompletionSubscriptionPayload]:
    """Create one experiment per task, start them all, and merge their payload streams."""
    credentials = input.credentials or ()

    async with info.context.db() as session:
        target = await _resolve_dataset_run_target(session, input)
        # Building the evaluators up front rejects a bad definition (missing sandbox, judge
        # prompt tools that do not match) before any experiment row exists. The runner
        # rebuilds them from the frozen definition when it starts each experiment.
        resolved_evaluator_tasks = [
            await _resolve_evaluator_task(
                task.evaluator, info=info, session=session, credentials=credentials
            )
            if task.evaluator
            else None
            for task in input.tasks
        ]

    async with info.context.db() as session:
        user_id = get_user(info)
        experiments: list[models.Experiment] = []
        for task, resolved_evaluator_task in zip(input.tasks, resolved_evaluator_tasks):
            project_name = generate_experiment_project_name()
            await _ensure_project(session, project_name)
            experiment = models.Experiment(
                dataset_id=target.dataset_id,
                dataset_version_id=target.dataset_version_id,
                name=input.experiment_name
                or _default_experiment_name(task, resolved_evaluator_task),
                description=input.experiment_description,
                repetitions=input.repetitions,
                metadata_=input.experiment_metadata or dict(),
                is_ephemeral=bool(input.create_ephemeral_experiment),
                project_name=project_name,
                user_id=user_id,
            )
            if target.split_ids:
                experiment.experiment_dataset_splits = [
                    models.ExperimentDatasetSplit(dataset_split_id=split_id)
                    for split_id in target.split_ids
                ]
            await insert_experiment_with_examples_snapshot(
                session, experiment, example_ids=target.example_ids
            )
            # The job rows inherit from ExperimentJob (polymorphic joined table
            # inheritance), so adding one inserts into both tables. claimed_at=NULL means
            # not running; start_experiment(experiment.id) claims it.
            if task.prompt:
                _add_prompt_task(
                    session, experiment, task.prompt, max_concurrency=input.max_concurrency
                )
            else:
                assert task.evaluator and resolved_evaluator_task is not None
                session.add(
                    models.ExperimentEvaluatorTask(
                        id=experiment.id,
                        max_concurrency=input.max_concurrency,
                        name=resolved_evaluator_task.name,
                        evaluator_kind=evaluator_kind_of(resolved_evaluator_task.definition),
                        definition=resolved_evaluator_task.definition,
                        input_mapping=task.evaluator.input_mapping.to_orm(),
                        output_configs=list(resolved_evaluator_task.evaluator.output_configs),
                    )
                )
            experiments.append(experiment)

    experiment_ids = [
        GlobalID(Experiment.__name__, str(experiment.id)) for experiment in experiments
    ]
    # === Yield the experiments immediately, in task order ===
    for experiment, experiment_id in zip(experiments, experiment_ids):
        yield ChatCompletionSubscriptionExperiment(
            experiment=to_gql_experiment(experiment),
            experiment_id=experiment_id,
        )

    # === Register with the daemon and stream results ===
    # Credentials are passed as ephemeral data (not stored in DB)
    runner = info.context.experiment_runner
    streams: list[tuple[GlobalID, PayloadStream]] = []
    send_stream, receive_stream = anyio.create_memory_object_stream[
        ChatCompletionSubscriptionPayload
    ](max_buffer_size=_EXPERIMENT_STREAM_BUFFER_SIZE * len(experiments))
    merge_task: Optional[asyncio.Task[None]] = None
    try:
        try:
            for experiment, experiment_id in zip(experiments, experiment_ids):
                _, experiment_stream = await runner.start_experiment(
                    experiment.id,
                    credentials=credentials,
                    subscribe=True,
                )
                streams.append((experiment_id, experiment_stream))
        except BaseException:
            # The run is all-or-nothing from the user's side: if a later task fails to
            # start, stop the ones already running rather than leave a partial run
            # going in the background that nothing is streaming.
            for experiment in experiments:
                await runner.stop_experiment(experiment.id)
            raise
        merge_task = asyncio.create_task(_merge_experiment_streams(streams, send_stream))
        # Stream results until every experiment closes its stream (completion or stop)
        async for payload in receive_stream:
            yield payload
    finally:
        # Close the streams; the experiments continue in the background unless they are
        # ephemeral, in which case the user's disconnect ends them.
        if merge_task is not None:
            merge_task.cancel()
            await asyncio.gather(merge_task, return_exceptions=True)
        await receive_stream.aclose()
        for _, experiment_stream in streams:
            await experiment_stream.aclose()
        if input.create_ephemeral_experiment:
            for experiment in experiments:
                await runner.stop_experiment(experiment.id)


async def _merge_experiment_streams(
    streams: Sequence[tuple[GlobalID, PayloadStream]],
    send_stream: MemoryObjectSendStream[ChatCompletionSubscriptionPayload],
) -> None:
    """Forward every experiment's payloads into one stream, stamped with their experiment id.

    Runs as its own task because a task group cannot stay open across a generator's yields.
    The merged stream closes once every experiment's stream has closed.
    """
    async with send_stream:
        async with anyio.create_task_group() as task_group:
            for experiment_id, experiment_stream in streams:
                task_group.start_soon(
                    _forward_experiment_payloads,
                    experiment_id,
                    experiment_stream,
                    send_stream.clone(),
                )


async def _forward_experiment_payloads(
    experiment_id: GlobalID,
    experiment_stream: PayloadStream,
    send_stream: MemoryObjectSendStream[ChatCompletionSubscriptionPayload],
) -> None:
    async with send_stream:
        async for payload in experiment_stream:
            # The runner broadcasts one payload object to every subscriber, so stamp a
            # copy rather than writing to the shared instance.
            await send_stream.send(replace(payload, experiment_id=experiment_id))


async def _resolve_dataset_run_target(
    session: AsyncSession,
    input: ExperimentsOverDatasetInput,
) -> _DatasetRunTarget:
    dataset_id = from_global_id_with_expected_type(input.dataset_id, Dataset.__name__)
    version_id = (
        from_global_id_with_expected_type(
            global_id=input.dataset_version_id, expected_type_name=DatasetVersion.__name__
        )
        if input.dataset_version_id
        else None
    )

    # Validate dataset exists
    if (
        await session.scalar(select(models.Dataset).where(models.Dataset.id == dataset_id))
    ) is None:
        raise NotFound(f"Could not find dataset with ID {dataset_id}")

    # Resolve version ID
    if version_id is None:
        if (
            resolved_version_id := await session.scalar(
                select(models.DatasetVersion.id)
                .where(models.DatasetVersion.dataset_id == dataset_id)
                .order_by(models.DatasetVersion.id.desc())
                .limit(1)
            )
        ) is None:
            raise NotFound(f"No versions found for dataset with ID {dataset_id}")
    else:
        if (
            resolved_version_id := await session.scalar(
                select(models.DatasetVersion.id).where(
                    and_(
                        models.DatasetVersion.dataset_id == dataset_id,
                        models.DatasetVersion.id == version_id,
                    )
                )
            )
        ) is None:
            raise NotFound(f"Could not find dataset version with ID {version_id}")

    # Parse split IDs if provided
    resolved_split_ids: Optional[list[int]] = None
    if input.split_ids is not None and len(input.split_ids) > 0:
        resolved_split_ids = [
            from_global_id_with_expected_type(split_id, models.DatasetSplit.__name__)
            for split_id in input.split_ids
        ]

    # Parse example IDs if provided: a row's play button runs one example
    resolved_example_ids: Optional[list[int]] = None
    if input.example_ids is not None and len(input.example_ids) > 0:
        resolved_example_ids = [
            from_global_id_with_expected_type(example_id, DatasetExample.__name__)
            for example_id in input.example_ids
        ]

    # Validate at least one example exists (don't load all - daemon will paginate)
    example_count = await session.scalar(
        select(sa_func.count()).select_from(
            get_dataset_example_revisions(
                resolved_version_id,
                split_ids=resolved_split_ids,
                example_ids=resolved_example_ids,
            ).subquery()
        )
    )
    if not example_count:
        raise NotFound("No examples found for the given dataset and version")

    return _DatasetRunTarget(
        dataset_id=dataset_id,
        dataset_version_id=resolved_version_id,
        split_ids=resolved_split_ids,
        example_ids=resolved_example_ids,
    )


async def _resolve_evaluator_task(
    task: EvaluatorTaskInput,
    *,
    info: Info[Context, None],
    session: AsyncSession,
    credentials: Sequence[GenerativeCredentialInput],
) -> _ResolvedEvaluatorTask:
    # Pin what the experiment freezes: a stored evaluator's current version, not a
    # pointer its owner can edit while the experiment is paused.
    definition = await pin_evaluator_definition(task.evaluator.to_definition(), session=session)
    evaluator = await build_evaluator_from_definition(
        definition=definition,
        session=session,
        decrypt=info.context.decrypt,
        credentials=credentials,
        sandbox_runtime=info.context.sandbox_runtime,
    )
    try:
        name = Identifier.model_validate(evaluator.name)
    except ValidationError:
        raise BadRequest(
            f"Evaluator name '{evaluator.name}' must use lowercase letters, digits, hyphens "
            "and underscores, and start and end with a letter or digit"
        )
    return _ResolvedEvaluatorTask(definition=definition, evaluator=evaluator, name=name)


async def _ensure_project(session: AsyncSession, project_name: str) -> None:
    if (
        await session.scalar(select(models.Project.id).where(models.Project.name == project_name))
    ) is None:
        await session.scalar(
            insert(models.Project)
            .returning(models.Project.id)
            .values(
                name=project_name,
                description="Traces from prompt playground",
            )
        )


def _add_prompt_task(
    session: AsyncSession,
    experiment: models.Experiment,
    task: PromptTaskInput,
    *,
    max_concurrency: int,
) -> None:
    """Freeze the prompt in an ExperimentPromptTask row and attach its dataset evaluators."""
    try:
        prompt_version: models.PromptVersion = task.prompt_version.to_orm_prompt_version()
    except ValidationError as error:
        raise BadRequest(str(error))
    # Connection JSON is mutually exclusive with custom_provider_id (DB constraint).
    # If custom provider is set, connection overrides are ignored.
    task_connection = (
        None
        if prompt_version.custom_provider_id is not None
        else to_connection_config(prompt_version.model_provider, task.connection_config)
    )
    prompt_version_id = (
        from_global_id_with_expected_type(task.prompt_version_id, "PromptVersion")
        if task.prompt_version_id
        else None
    )
    session.add(
        models.ExperimentPromptTask(
            id=experiment.id,
            max_concurrency=max_concurrency,
            prompt_version_id=prompt_version_id,
            model_provider=prompt_version.model_provider,
            model_name=prompt_version.model_name,
            custom_provider_id=prompt_version.custom_provider_id,
            template_type=prompt_version.template_type,
            template_format=prompt_version.template_format,
            template=prompt_version.template,
            tools=prompt_version.tools,
            response_format=prompt_version.response_format,
            invocation_parameters=prompt_version.invocation_parameters,
            connection=task_connection,
            playground_config=PlaygroundConfig(
                template_variables_path=task.template_variables_path,
                appended_messages_path=task.appended_messages_path,
            ),
            stream_model_output=task.stream_model_output,
        )
    )
    for evaluator_input in task.evaluators:
        session.add(
            models.ExperimentDatasetEvaluator(
                experiment_id=experiment.id,
                dataset_evaluator_id=from_global_id_with_expected_type(
                    evaluator_input.id, "DatasetEvaluator"
                ),
            )
        )


def _default_experiment_name(
    task: ExperimentTaskInput,
    resolved_evaluator_task: Optional[_ResolvedEvaluatorTask],
) -> str:
    if task.prompt:
        return _default_playground_experiment_name(task.prompt.prompt_name)
    assert resolved_evaluator_task is not None
    return f"playground-experiment evaluator:{resolved_evaluator_task.name}"


def _create_task_with_timeout(
    iterable: AsyncIterator[GenericType], timeout_in_seconds: int = 90
) -> asyncio.Task[GenericType]:
    return asyncio.create_task(
        _wait_for(
            _as_coroutine(iterable),
            timeout=timeout_in_seconds,
            timeout_message="Playground task timed out",
        )
    )


async def _wait_for(
    coro: Coroutine[None, None, GenericType],
    timeout: float,
    timeout_message: Optional[str] = None,
) -> GenericType:
    """
    A function that imitates asyncio.wait_for, but allows the task to be
    cancelled with a custom message.
    """
    task = asyncio.create_task(coro)
    done, pending = await asyncio.wait([task], timeout=timeout)
    assert len(done) + len(pending) == 1
    if done:
        task = done.pop()
        return task.result()
    task = pending.pop()
    task.cancel(msg=timeout_message)
    try:
        return await task
    except asyncio.CancelledError:
        raise asyncio.TimeoutError()


async def _as_coroutine(iterable: AsyncIterator[GenericType]) -> GenericType:
    return await iterable.__anext__()


def _default_playground_experiment_name(prompt_name: Optional[Identifier] = None) -> str:
    name = "playground-experiment"
    if prompt_name:
        name = f"{name} prompt:{prompt_name}"
    return name


LLM_INPUT_MESSAGES = SpanAttributes.LLM_INPUT_MESSAGES
LLM_OUTPUT_MESSAGES = SpanAttributes.LLM_OUTPUT_MESSAGES

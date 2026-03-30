import asyncio
import logging
from collections import deque
from collections.abc import AsyncIterator
from typing import (
    Any,
    AsyncGenerator,
    Callable,
    Coroutine,
    Optional,
    TypeVar,
)

import strawberry
from openinference.semconv.trace import SpanAttributes
from sqlalchemy import and_, insert, select
from sqlalchemy import func as sa_func
from strawberry.types import Info
from typing_extensions import TypeAlias

from phoenix.config import PLAYGROUND_PROJECT_NAME
from phoenix.db import models
from phoenix.db.helpers import (
    get_dataset_example_revisions,
    insert_experiment_with_examples_snapshot,
)
from phoenix.db.types.experiment_config import PlaygroundConfig
from phoenix.server.api.auth import IsLocked, IsNotReadOnly, IsNotViewer
from phoenix.server.api.context import Context
from phoenix.server.api.exceptions import NotFound
from phoenix.server.api.helpers.message_helpers import (
    formatted_messages,
    prompt_chat_template_to_playground_messages,
)
from phoenix.server.api.helpers.playground_clients import (
    PlaygroundStreamingClient,
    get_playground_client,
    initialize_playground_clients,
)
from phoenix.server.api.helpers.playground_users import get_user
from phoenix.server.api.input_types.ChatCompletionInput import (
    ChatCompletionInput,
    ChatCompletionOverDatasetInput,
)
from phoenix.server.api.input_types.ConnectionConfigInput import to_connection_config
from phoenix.server.api.types.ChatCompletionSubscriptionPayload import (
    ChatCompletionSubscriptionError,
    ChatCompletionSubscriptionExperiment,
    ChatCompletionSubscriptionPayload,
    ChatCompletionSubscriptionResult,
)
from phoenix.server.api.types.Dataset import Dataset
from phoenix.server.api.types.DatasetVersion import DatasetVersion
from phoenix.server.api.types.Experiment import to_gql_experiment
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


async def _stream_single_chat_completion(
    *,
    input: ChatCompletionInput,
    llm_client: "PlaygroundStreamingClient[Any]",
    repetition_number: RepetitionNumber,
    db: DbSessionFactory,
    project_id: int,
    on_span_insertion: Callable[[], None],
    span_cost_calculator: SpanCostCalculator,
) -> ChatStream:
    messages = prompt_chat_template_to_playground_messages(input.prompt_version.template.to_orm())
    if template_options := input.template:
        messages = formatted_messages(
            messages=messages,
            template_format=template_options.format,
            template_variables=template_options.variables,
        )
    invocation_parameters = dict(input.prompt_version.invocation_parameters)

    tools = input.prompt_version.tools.to_orm() if input.prompt_version.tools else None
    response_format = (
        input.prompt_version.response_format.to_orm()
        if input.prompt_version.response_format
        else None
    )

    tracer = Tracer(span_cost_calculator=span_cost_calculator)
    try:
        async for chunk in llm_client.chat_completion_create(
            messages=messages,
            tools=tools,
            response_format=response_format,
            invocation_parameters=invocation_parameters,
            tracer=tracer,
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
        headers = dict(input.headers) if input.headers else None
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
    async def chat_completion_over_dataset(
        self, info: Info[Context, None], input: ChatCompletionOverDatasetInput
    ) -> AsyncIterator[ChatCompletionSubscriptionPayload]:
        """
        Run dataset playground experiment in the background via ExperimentRunner and stream
        subscription payloads (chunks, results, errors) to the client.
        """
        dataset_id = from_global_id_with_expected_type(input.dataset_id, Dataset.__name__)
        version_id = (
            from_global_id_with_expected_type(
                global_id=input.dataset_version_id, expected_type_name=DatasetVersion.__name__
            )
            if input.dataset_version_id
            else None
        )

        async with info.context.db() as session:
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

            # Validate at least one example exists (don't load all - daemon will paginate)
            example_count = await session.scalar(
                select(sa_func.count()).select_from(
                    get_dataset_example_revisions(
                        resolved_version_id,
                        split_ids=resolved_split_ids,
                    ).subquery()
                )
            )
            if not example_count:
                raise NotFound("No examples found for the given dataset and version")

            # === Create project (same as chat_completion_over_dataset) ===
            project_name = generate_experiment_project_name()
            if (
                await session.scalar(
                    select(models.Project.id).where(models.Project.name == project_name)
                )
            ) is None:
                await session.scalar(
                    insert(models.Project)
                    .returning(models.Project.id)
                    .values(
                        name=project_name,
                        description="Traces from prompt playground",
                    )
                )

            # === Create experiment (same as chat_completion_over_dataset) ===
            user_id = get_user(info)
            experiment = models.Experiment(
                dataset_id=from_global_id_with_expected_type(input.dataset_id, Dataset.__name__),
                dataset_version_id=resolved_version_id,
                name=input.experiment_name
                or _default_playground_experiment_name(input.prompt_name),
                description=input.experiment_description,
                repetitions=input.repetitions,
                metadata_=input.experiment_metadata or dict(),
                is_ephemeral=bool(input.create_ephemeral_experiment),
                project_name=project_name,
                user_id=user_id,
            )
            if resolved_split_ids:
                experiment.experiment_dataset_splits = [
                    models.ExperimentDatasetSplit(dataset_split_id=split_id)
                    for split_id in resolved_split_ids
                ]
            await insert_experiment_with_examples_snapshot(session, experiment)

            # === Create execution config (task prompt frozen in JSON; evaluators via junction) ===
            prompt_version: models.PromptVersion = input.prompt_version.to_orm_prompt_version()
            # Connection JSON is mutually exclusive with custom_provider_id (DB constraint).
            # If custom provider is set, connection overrides are ignored.
            task_connection = (
                None
                if prompt_version.custom_provider_id is not None
                else to_connection_config(prompt_version.model_provider, input.connection_config)
            )

            prompt_version_id = (
                from_global_id_with_expected_type(input.prompt_version_id, "PromptVersion")
                if input.prompt_version_id
                else None
            )

            # ExperimentPromptTask inherits from ExperimentJob
            # (polymorphic joined table inheritance), so creating it
            # automatically inserts into both tables.
            execution_config = models.ExperimentPromptTask(
                id=experiment.id,
                # claimed_at=NULL means not running; start_experiment(experiment.id) will claim it
                max_concurrency=input.max_concurrency,
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
                    template_variables_path=input.template_variables_path,
                    appended_messages_path=input.appended_messages_path,
                ),
                stream_model_output=input.stream_model_output,
            )
            session.add(execution_config)
            for evaluator_input in input.evaluators:
                session.add(
                    models.ExperimentDatasetEvaluator(
                        experiment_id=experiment.id,
                        dataset_evaluator_id=from_global_id_with_expected_type(
                            evaluator_input.id, "DatasetEvaluator"
                        ),
                    )
                )

        # === Yield experiment immediately ===
        yield ChatCompletionSubscriptionExperiment(experiment=to_gql_experiment(experiment))

        # === Register with daemon and stream results ===
        # Pass credentials as ephemeral data (not stored in DB)
        credentials = input.credentials or ()
        _, receive_stream = await info.context.experiment_runner.start_experiment(
            experiment.id,
            credentials=credentials,
            subscribe=True,
        )

        # Stream results until producer closes the stream (signals completion via EndOfStream)
        try:
            async for payload in receive_stream:
                yield payload
        finally:
            # Close the receive stream - experiment continues in background
            # User must explicitly cancel via mutation if they want to stop it
            await receive_stream.aclose()
            # Stop the experiment if it's ephemeral
            if input.create_ephemeral_experiment:
                await info.context.experiment_runner.stop_experiment(experiment.id)


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


def _default_playground_experiment_name(prompt_name: Optional[str] = None) -> str:
    name = "playground-experiment"
    if prompt_name:
        name = f"{name} prompt:{prompt_name}"
    return name


LLM_INPUT_MESSAGES = SpanAttributes.LLM_INPUT_MESSAGES
LLM_OUTPUT_MESSAGES = SpanAttributes.LLM_OUTPUT_MESSAGES

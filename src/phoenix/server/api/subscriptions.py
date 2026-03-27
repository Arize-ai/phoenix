import asyncio
import logging
from collections import deque
from collections.abc import AsyncIterator, Iterator
from datetime import datetime, timezone
from typing import (
    Any,
    AsyncGenerator,
    Callable,
    Coroutine,
    Iterable,
    Mapping,
    Optional,
    TypeVar,
    cast,
)

import strawberry
from openinference.semconv.trace import SpanAttributes
from opentelemetry.context import Context as OtelContext
from sqlalchemy import and_, insert, select
from sqlalchemy.orm import load_only
from strawberry.relay.types import GlobalID
from strawberry.types import Info
from typing_extensions import TypeAlias, assert_never

from phoenix.config import PLAYGROUND_PROJECT_NAME
from phoenix.datetime_utils import local_now, normalize_datetime
from phoenix.db import models
from phoenix.db.helpers import (
    get_dataset_example_revisions,
    insert_experiment_with_examples_snapshot,
)
from phoenix.db.types.prompts import PromptTemplateFormat
from phoenix.server.api.auth import IsLocked, IsNotReadOnly, IsNotViewer
from phoenix.server.api.context import Context
from phoenix.server.api.evaluators import (
    BaseEvaluator,
    EvaluationResult,
    evaluation_result_to_model,
    get_evaluator_project_ids,
    get_evaluators,
)
from phoenix.server.api.exceptions import NotFound
from phoenix.server.api.helpers.evaluators import (
    get_evaluator_output_configs,
)
from phoenix.server.api.helpers.message_helpers import (
    PlaygroundMessage,
    build_template_variables,
    create_playground_message,
    extract_and_convert_example_messages,
    prompt_chat_template_to_playground_messages,
)
from phoenix.server.api.helpers.playground_clients import (
    PlaygroundStreamingClient,
    get_playground_client,
    initialize_playground_clients,
)
from phoenix.server.api.helpers.playground_experiment_runs import (
    get_db_experiment_run,
)
from phoenix.server.api.helpers.playground_users import get_user
from phoenix.server.api.input_types.ChatCompletionInput import (
    ChatCompletionInput,
    ChatCompletionOverDatasetInput,
)
from phoenix.server.api.types.ChatCompletionSubscriptionPayload import (
    ChatCompletionSubscriptionError,
    ChatCompletionSubscriptionExperiment,
    ChatCompletionSubscriptionPayload,
    ChatCompletionSubscriptionResult,
    EvaluationChunk,
)
from phoenix.server.api.types.Dataset import Dataset
from phoenix.server.api.types.DatasetExample import DatasetExample
from phoenix.server.api.types.DatasetVersion import DatasetVersion
from phoenix.server.api.types.Evaluator import DatasetEvaluator
from phoenix.server.api.types.Experiment import to_gql_experiment
from phoenix.server.api.types.ExperimentRun import ExperimentRun
from phoenix.server.api.types.ExperimentRunAnnotation import ExperimentRunAnnotation
from phoenix.server.api.types.node import from_global_id_with_expected_type
from phoenix.server.api.types.Span import Span
from phoenix.server.api.types.Trace import Trace
from phoenix.server.daemons.span_cost_calculator import SpanCostCalculator
from phoenix.server.dml_event import SpanInsertEvent
from phoenix.server.experiments.utils import generate_experiment_project_name
from phoenix.server.types import DbSessionFactory
from phoenix.tracers import Tracer
from phoenix.utilities.template_formatters import (
    FStringTemplateFormatter,
    MustacheTemplateFormatter,
    NoOpFormatter,
    TemplateFormatter,
    TemplateFormatterError,
)

GenericType = TypeVar("GenericType")

logger = logging.getLogger(__name__)

initialize_playground_clients()

RepetitionNumber: TypeAlias = int
DatasetExampleNodeID: TypeAlias = GlobalID
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
    messages = prompt_chat_template_to_playground_messages(input.prompt_version.template)
    if template_options := input.template:
        messages = list(
            _formatted_messages(
                messages=messages,
                template_format=template_options.format,
                template_variables=template_options.variables,
            )
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


async def _cleanup_chat_completion_over_dataset_resources(
    in_progress: list[
        tuple[
            DatasetExampleNodeID,
            RepetitionNumber,
            ChatStream,
            asyncio.Task[ChatCompletionSubscriptionPayload],
        ]
    ],
    not_started: list[tuple[DatasetExampleNodeID, RepetitionNumber, ChatStream]],
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
    for _, _, _, task in in_progress:
        task.cancel()

    # 2. Wait for tasks to process cancellation and release generators
    if in_progress:
        await asyncio.gather(
            *[task for _, _, _, task in in_progress],
            return_exceptions=True,
        )

    # 3. Now safe to close generators
    if in_progress:
        await asyncio.gather(
            *[stream.aclose() for _, _, stream, _ in in_progress if inspect.isasyncgen(stream)],
            return_exceptions=True,
        )

    # 4. Close not-started generators (no tasks to cancel, just close directly)
    if not_started:
        await asyncio.gather(
            *[stream.aclose() for _, _, stream in not_started if inspect.isasyncgen(stream)],
            return_exceptions=True,
        )

    logger.info("Resource cleanup complete")


@strawberry.type
class Subscription:
    @strawberry.subscription(permission_classes=[IsNotReadOnly, IsNotViewer, IsLocked])  # type: ignore
    async def chat_completion(
        self, info: Info[Context, None], input: ChatCompletionInput
    ) -> AsyncIterator[ChatCompletionSubscriptionPayload]:
        async with info.context.db() as session:
            llm_client = await get_playground_client(
                model_provider=input.prompt_version.model_provider.to_model_provider(),
                model_name=input.prompt_version.model_name,
                custom_provider_id=input.prompt_version.resolved_custom_provider_id(),
                session=session,
                decrypt=info.context.decrypt,
                credentials=input.credentials,
                client_options=input.client_options,
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
        dataset_id = from_global_id_with_expected_type(input.dataset_id, Dataset.__name__)
        version_id = (
            from_global_id_with_expected_type(
                global_id=input.dataset_version_id, expected_type_name=DatasetVersion.__name__
            )
            if input.dataset_version_id
            else None
        )
        async with info.context.db() as session:
            llm_client = await get_playground_client(
                model_provider=input.prompt_version.model_provider.to_model_provider(),
                model_name=input.prompt_version.model_name,
                custom_provider_id=input.prompt_version.resolved_custom_provider_id(),
                session=session,
                decrypt=info.context.decrypt,
                credentials=input.credentials,
                client_options=input.client_options,
            )
            dataset_evaluator_ids = [
                from_global_id_with_expected_type(evaluator.id, DatasetEvaluator.__name__)
                for evaluator in input.evaluators
            ]
            evaluators = await get_evaluators(
                dataset_evaluator_ids=dataset_evaluator_ids,
                session=session,
                decrypt=info.context.decrypt,
                credentials=input.credentials,
            )
            project_ids = await get_evaluator_project_ids(
                dataset_evaluator_ids=dataset_evaluator_ids,
                session=session,
            )
            if (
                await session.scalar(select(models.Dataset).where(models.Dataset.id == dataset_id))
            ) is None:
                raise NotFound(f"Could not find dataset with ID {dataset_id}")
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

            if not (
                revisions := [
                    rev
                    async for rev in await session.stream_scalars(
                        get_dataset_example_revisions(
                            resolved_version_id,
                            split_ids=resolved_split_ids,
                        )
                        .order_by(models.DatasetExampleRevision.dataset_example_id.asc())
                        .options(
                            load_only(
                                models.DatasetExampleRevision.dataset_example_id,
                                models.DatasetExampleRevision.input,
                                models.DatasetExampleRevision.output,
                                models.DatasetExampleRevision.metadata_,
                            )
                        )
                    )
                ]
            ):
                raise NotFound("No examples found for the given dataset and version")
            project_name = generate_experiment_project_name()
            if (
                playground_project_id := await session.scalar(
                    select(models.Project.id).where(models.Project.name == project_name)
                )
            ) is None:
                playground_project_id = await session.scalar(
                    insert(models.Project)
                    .returning(models.Project.id)
                    .values(
                        name=project_name,
                        description="Traces from prompt playground",
                    )
                )
            user_id = get_user(info)
            experiment = models.Experiment(
                dataset_id=from_global_id_with_expected_type(input.dataset_id, Dataset.__name__),
                dataset_version_id=resolved_version_id,
                name=input.experiment_name
                or _default_playground_experiment_name(input.prompt_name),
                description=input.experiment_description,
                repetitions=input.repetitions,
                metadata_=input.experiment_metadata or dict(),
                project_name=project_name,
                user_id=user_id,
            )
            if resolved_split_ids:
                experiment.experiment_dataset_splits = [
                    models.ExperimentDatasetSplit(dataset_split_id=split_id)
                    for split_id in resolved_split_ids
                ]
            await insert_experiment_with_examples_snapshot(session, experiment)
        yield ChatCompletionSubscriptionExperiment(
            experiment=to_gql_experiment(experiment)
        )  # eagerly yields experiment so it can be linked by consumers of the subscription

        not_started: list[tuple[DatasetExampleNodeID, RepetitionNumber, ChatStream]] = [
            (
                GlobalID(DatasetExample.__name__, str(revision.dataset_example_id)),
                repetition_number,
                _stream_chat_completion_over_dataset_example(
                    input=input,
                    llm_client=llm_client,
                    revision=revision,
                    db=info.context.db,
                    repetition_number=repetition_number,
                    span_cost_calculator=info.context.span_cost_calculator,
                    experiment_id=experiment.id,
                    playground_project_id=playground_project_id,
                    on_span_insertion=lambda: info.context.event_queue.put(
                        SpanInsertEvent(ids=(playground_project_id,))
                    ),
                    evaluators=evaluators,
                    evaluator_project_ids=project_ids,
                ),
            )
            for revision in revisions
            for repetition_number in reversed(
                range(1, input.repetitions + 1)
            )  # since we pop right, this runs the repetitions in increasing order
        ]
        in_progress: list[
            tuple[
                DatasetExampleNodeID,
                RepetitionNumber,
                ChatStream,
                asyncio.Task[ChatCompletionSubscriptionPayload],
            ]
        ] = []
        max_in_progress = 3
        try:
            while not_started or in_progress:
                while not_started and len(in_progress) < max_in_progress:
                    ex_id, rep_num, stream = not_started.pop()
                    task = _create_task_with_timeout(stream)
                    in_progress.append((ex_id, rep_num, stream, task))
                async_tasks_to_run = [task for _, _, _, task in in_progress]
                completed_tasks, _ = await asyncio.wait(
                    async_tasks_to_run, return_when=asyncio.FIRST_COMPLETED
                )
                for completed_task in completed_tasks:
                    idx = [task for _, _, _, task in in_progress].index(completed_task)
                    example_id, repetition_number, stream, _ = in_progress[idx]
                    try:
                        yield completed_task.result()
                    except StopAsyncIteration:
                        del in_progress[idx]  # removes exhausted stream
                    except asyncio.TimeoutError:
                        del in_progress[idx]  # removes timed-out stream
                        yield ChatCompletionSubscriptionError(
                            message="Playground task timed out",
                            dataset_example_id=example_id,
                            repetition_number=repetition_number,
                        )
                    except Exception as error:
                        del in_progress[idx]  # removes failed stream
                        yield ChatCompletionSubscriptionError(
                            message="An unexpected error occurred",
                            dataset_example_id=example_id,
                            repetition_number=repetition_number,
                        )
                        logger.exception(error)
                    else:
                        task = _create_task_with_timeout(stream)
                        in_progress[idx] = (example_id, repetition_number, stream, task)
        finally:
            await _cleanup_chat_completion_over_dataset_resources(
                in_progress=in_progress,
                not_started=not_started,
            )


async def _stream_chat_completion_over_dataset_example(
    *,
    input: ChatCompletionOverDatasetInput,
    llm_client: "PlaygroundStreamingClient[Any]",
    revision: models.DatasetExampleRevision,
    repetition_number: RepetitionNumber,
    db: DbSessionFactory,
    span_cost_calculator: SpanCostCalculator,
    experiment_id: int,
    playground_project_id: int,
    on_span_insertion: Callable[[], None],
    evaluators: list[BaseEvaluator],
    evaluator_project_ids: list[int],
) -> ChatStream:
    example_id = GlobalID(DatasetExample.__name__, str(revision.dataset_example_id))
    invocation_parameters = dict(input.prompt_version.invocation_parameters)
    tools = input.prompt_version.tools.to_orm() if input.prompt_version.tools else None
    response_format = (
        input.prompt_version.response_format.to_orm()
        if input.prompt_version.response_format
        else None
    )
    db_run: Optional[models.ExperimentRun] = None
    messages = prompt_chat_template_to_playground_messages(input.prompt_version.template)
    try:
        format_start_time = cast(datetime, normalize_datetime(dt=local_now(), tz=timezone.utc))
        # Build template variables using shared helper
        template_variables = build_template_variables(
            input_data=revision.input,
            output_data=revision.output,
            metadata=revision.metadata_,
            template_variables_path=input.template_variables_path,
        )
        messages = list(
            _formatted_messages(
                messages=messages,
                template_format=input.prompt_version.template_format,
                template_variables=template_variables,
            )
        )
        # Append messages from dataset example if path is specified
        if input.appended_messages_path:
            appended = extract_and_convert_example_messages(
                revision.input, input.appended_messages_path
            )
            messages.extend(appended)
    except (TemplateFormatterError, KeyError, TypeError, ValueError) as error:
        format_end_time = cast(datetime, normalize_datetime(dt=local_now(), tz=timezone.utc))
        yield ChatCompletionSubscriptionError(
            message=str(error),
            dataset_example_id=example_id,
            repetition_number=repetition_number,
        )
        db_run = models.ExperimentRun(
            experiment_id=experiment_id,
            dataset_example_id=revision.dataset_example_id,
            trace_id=None,
            output={},
            repetition_number=repetition_number,
            start_time=format_start_time,
            end_time=format_end_time,
            error=str(error),
            trace=None,
        )
        async with db() as session:
            session.add(db_run)
            await session.flush()
        yield ChatCompletionSubscriptionResult(
            span=None,
            experiment_run=ExperimentRun(id=db_run.id, db_record=db_run),
            dataset_example_id=GlobalID(DatasetExample.__name__, str(revision.dataset_example_id)),
            repetition_number=repetition_number,
        )
        return

    tracer = Tracer(span_cost_calculator=span_cost_calculator)
    try:
        async for chunk in llm_client.chat_completion_create(
            messages=messages,
            tools=tools,
            response_format=response_format,
            invocation_parameters=invocation_parameters,
            tracer=tracer,
            # Pass an empty OTel context so the LLM span starts as a fresh root
            # span and does not inherit the ambient context from server-side
            # instrumentation (e.g. Strawberry's OpenTelemetryExtension).
            # Without this, every dataset-example call within the same
            # subscription would share the subscription span's trace_id, causing
            # a duplicate-key violation on uq_traces_trace_id when more than one
            # example is flushed.
            otel_context=OtelContext(),
            stream_model_output=input.stream_model_output,
        ):
            chunk.dataset_example_id = example_id
            chunk.repetition_number = repetition_number
            yield chunk
    except Exception as error:
        yield ChatCompletionSubscriptionError(
            message=str(error),
            dataset_example_id=example_id,
            repetition_number=repetition_number,
        )
    task_db_traces = tracer.get_db_traces(project_id=playground_project_id)
    task_db_trace = task_db_traces[0] if task_db_traces else None
    all_db_traces: list[models.Trace] = list(task_db_traces)
    if task_db_trace is not None and task_db_trace.spans:
        db_span = task_db_trace.spans[0]
        db_run = get_db_experiment_run(
            db_span,
            task_db_trace,
            experiment_id=experiment_id,
            example_id=revision.dataset_example_id,
            repetition_number=repetition_number,
        )
    if db_run is not None and not db_run.error and evaluators and evaluator_project_ids:
        context_dict: dict[str, Any] = {
            "input": revision.input,
            "reference": revision.output,
            "output": db_run.output["task_output"],
            "metadata": revision.metadata_,
        }
        for evaluator, evaluator_input, eval_project_id in zip(
            evaluators, input.evaluators, evaluator_project_ids
        ):
            name = str(evaluator_input.name)
            configs = get_evaluator_output_configs(evaluator_input, evaluator)
            eval_tracer: Optional[Tracer] = None
            if input.tracing_enabled:
                eval_tracer = Tracer(span_cost_calculator=span_cost_calculator)
            try:
                eval_results: list[EvaluationResult] = await evaluator.evaluate(
                    context=context_dict,
                    input_mapping=evaluator_input.input_mapping.to_orm(),
                    name=name,
                    output_configs=configs,
                    tracer=eval_tracer,
                )
            except Exception as eval_error:
                logger.exception(eval_error)
                yield EvaluationChunk(
                    evaluator_name=name,
                    error=str(eval_error),
                    dataset_example_id=example_id,
                    repetition_number=repetition_number,
                )
                continue
            finally:
                if eval_tracer is not None:
                    all_db_traces.extend(eval_tracer.get_db_traces(project_id=eval_project_id))
            db_run.annotations.extend([evaluation_result_to_model(r) for r in eval_results])
    # Capture annotation objects from the in-memory collections before the session takes
    # ownership and expires them on flush/close, making lazy loads impossible afterward.
    # The same Python objects get their IDs back-filled during flush and remain accessible
    # as detached objects (primary keys are always available on detached instances).
    pre_captured_annotations = list(db_run.annotations) if db_run is not None else []
    async with db() as session:
        session.add_all(all_db_traces)
        if db_run is not None:
            session.add(db_run)
        await session.flush()
    if all_db_traces:
        on_span_insertion()
    if db_run is None:
        return
    task_db_trace = all_db_traces[0] if all_db_traces else None
    maybe_db_span = task_db_trace.spans[0] if task_db_trace and task_db_trace.spans else None
    yield ChatCompletionSubscriptionResult(
        span=Span(id=maybe_db_span.id, db_record=maybe_db_span) if maybe_db_span else None,
        experiment_run=ExperimentRun(id=db_run.id, db_record=db_run),
        dataset_example_id=GlobalID(DatasetExample.__name__, str(revision.dataset_example_id)),
        repetition_number=repetition_number,
    )
    if pre_captured_annotations:
        traces_by_trace_id = {t.trace_id: t for t in all_db_traces}
        for annotation in pre_captured_annotations:
            eval_db_trace = (
                traces_by_trace_id.get(annotation.trace_id) if annotation.trace_id else None
            )
            yield EvaluationChunk(
                evaluator_name=annotation.name,
                experiment_run_evaluation=ExperimentRunAnnotation(
                    id=annotation.id,
                    db_record=annotation,
                )
                if not annotation.error
                else None,
                trace=Trace(id=eval_db_trace.id, db_record=eval_db_trace)
                if eval_db_trace
                else None,
                error=annotation.error,
                dataset_example_id=GlobalID(
                    DatasetExample.__name__, str(revision.dataset_example_id)
                ),
                repetition_number=repetition_number,
            )


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


def _formatted_messages(
    *,
    messages: Iterable[PlaygroundMessage],
    template_format: PromptTemplateFormat,
    template_variables: Mapping[str, Any],
) -> Iterator[PlaygroundMessage]:
    """
    Formats the messages using the given template options.
    """
    messages_list = list(messages)
    if not messages_list:
        return iter([])
    template_formatter = _template_formatter(template_format=template_format)
    result: list[PlaygroundMessage] = []
    for msg in messages_list:
        formatted_content = template_formatter.format(msg["content"], **template_variables)
        result.append(
            create_playground_message(
                msg["role"],
                formatted_content,
                msg.get("tool_call_id"),
                msg.get("tool_calls"),
            )
        )
    return iter(result)


def _template_formatter(template_format: PromptTemplateFormat) -> TemplateFormatter:
    """
    Instantiates the appropriate template formatter for the template format
    """
    if template_format is PromptTemplateFormat.MUSTACHE:
        return MustacheTemplateFormatter()
    if template_format is PromptTemplateFormat.F_STRING:
        return FStringTemplateFormatter()
    if template_format is PromptTemplateFormat.NONE:
        return NoOpFormatter()
    assert_never(template_format)


def _default_playground_experiment_name(prompt_name: Optional[str] = None) -> str:
    name = "playground-experiment"
    if prompt_name:
        name = f"{name} prompt:{prompt_name}"
    return name


LLM_INPUT_MESSAGES = SpanAttributes.LLM_INPUT_MESSAGES
LLM_OUTPUT_MESSAGES = SpanAttributes.LLM_OUTPUT_MESSAGES

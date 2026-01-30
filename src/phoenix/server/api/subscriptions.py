import asyncio
import logging
from collections import deque
from collections.abc import AsyncIterator, Iterator
from datetime import datetime, timedelta, timezone
from typing import (
    Any,
    AsyncGenerator,
    Callable,
    Coroutine,
    Iterable,
    Mapping,
    Optional,
    Sequence,
    TypeVar,
    cast,
)

import strawberry
from openinference.semconv.trace import SpanAttributes
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
from phoenix.server.api.auth import IsLocked, IsNotReadOnly, IsNotViewer
from phoenix.server.api.context import Context
from phoenix.server.api.evaluators import (
    EvaluationResult,
    evaluation_result_to_model,
    get_evaluator_project_ids,
    get_evaluators,
)
from phoenix.server.api.exceptions import NotFound
from phoenix.server.api.helpers.annotation_configs import (
    apply_overrides_to_annotation_config,
    get_annotation_config_override,
)
from phoenix.server.api.helpers.message_helpers import (
    ChatCompletionMessage,
    extract_and_convert_example_messages,
    extract_value_from_path,
)
from phoenix.server.api.helpers.playground_clients import (
    PlaygroundStreamingClient,
    get_playground_client,
    initialize_playground_clients,
)
from phoenix.server.api.helpers.playground_spans import (
    get_db_experiment_run,
)
from phoenix.server.api.helpers.playground_users import get_user
from phoenix.server.api.helpers.prompts.models import PromptTemplateFormat
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
    EvaluationErrorChunk,
)
from phoenix.server.api.types.Dataset import Dataset
from phoenix.server.api.types.DatasetExample import DatasetExample
from phoenix.server.api.types.DatasetVersion import DatasetVersion
from phoenix.server.api.types.Experiment import to_gql_experiment
from phoenix.server.api.types.ExperimentRun import ExperimentRun
from phoenix.server.api.types.ExperimentRunAnnotation import ExperimentRunAnnotation
from phoenix.server.api.types.node import from_global_id_with_expected_type
from phoenix.server.api.types.Span import Span
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
DatasetExampleRowID: TypeAlias = int
ChatCompletionResult: TypeAlias = tuple[
    DatasetExampleRowID,
    RepetitionNumber,
    Optional[Tracer],
    Optional[models.ExperimentRun],
]
ChatStream: TypeAlias = AsyncGenerator[ChatCompletionSubscriptionPayload, None]


async def _stream_single_chat_completion(
    *,
    input: ChatCompletionInput,
    llm_client: "PlaygroundStreamingClient[Any]",
    repetition_number: int,
    results: asyncio.Queue[tuple[Tracer, int]],
    span_cost_calculator: SpanCostCalculator,
) -> ChatStream:
    messages = [
        (
            message.role,
            message.content,
            message.tool_call_id if isinstance(message.tool_call_id, str) else None,
            message.tool_calls if isinstance(message.tool_calls, list) else None,
        )
        for message in input.messages
    ]
    if template_options := input.template:
        messages = list(
            _formatted_messages(
                messages=messages,
                template_format=template_options.format,
                template_variables=template_options.variables,
            )
        )
    invocation_parameters = llm_client.construct_invocation_parameters(input.invocation_parameters)
    tracer = Tracer(span_cost_calculator=span_cost_calculator)
    try:
        async for chunk in llm_client.chat_completion_create(
            messages=messages,
            tools=input.tools or [],
            tracer=tracer,
            **invocation_parameters,
        ):
            chunk.repetition_number = repetition_number
            yield chunk
    except Exception as error:
        yield ChatCompletionSubscriptionError(
            message=str(error),
            repetition_number=repetition_number,
        )

    await results.put((tracer, repetition_number))


async def _chat_completion_span_result_payloads(
    *,
    db: DbSessionFactory,
    results: Sequence[tuple[Tracer, int]],
    project_id: int,
    on_span_insertion: Callable[[], None],
) -> ChatStream:
    if not results:
        return
    db_spans: list[models.Span] = []
    repetition_numbers: list[int] = []
    async with db() as session:
        for tracer, repetition_number in results:
            db_traces = await tracer.save_db_traces(session=session, project_id=project_id)
            if not db_traces:
                continue
            db_trace = db_traces[0]
            if not db_trace.spans:
                continue
            db_span = db_trace.spans[0]
            db_spans.append(db_span)
            repetition_numbers.append(repetition_number)
    for db_span, repetition_number in zip(db_spans, repetition_numbers):
        yield ChatCompletionSubscriptionResult(
            span=Span(id=db_span.id, db_record=db_span),
            repetition_number=repetition_number,
        )
        on_span_insertion()


def _is_span_result_payloads_stream(
    stream: ChatStream,
) -> bool:
    """
    Checks if the given generator was instantiated from
    `_chat_completion_span_result_payloads`
    """
    return stream.ag_code == _chat_completion_span_result_payloads.__code__  # type: ignore


@strawberry.type
class Subscription:
    @strawberry.subscription(permission_classes=[IsNotReadOnly, IsNotViewer, IsLocked])  # type: ignore
    async def chat_completion(
        self, info: Info[Context, None], input: ChatCompletionInput
    ) -> AsyncIterator[ChatCompletionSubscriptionPayload]:
        async with info.context.db() as session:
            llm_client = await get_playground_client(
                model=input.model,
                session=session,
                decrypt=info.context.decrypt,
                credentials=input.credentials,
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

        results: asyncio.Queue[tuple[Tracer, int]] = asyncio.Queue()
        not_started: deque[tuple[int, ChatStream]] = deque(
            (
                repetition_number,
                _stream_single_chat_completion(
                    input=input,
                    llm_client=llm_client,
                    repetition_number=repetition_number,
                    results=results,
                    span_cost_calculator=info.context.span_cost_calculator,
                ),
            )
            for repetition_number in range(1, input.repetitions + 1)
        )
        in_progress: list[
            tuple[
                Optional[int],
                ChatStream,
                asyncio.Task[ChatCompletionSubscriptionPayload],
            ]
        ] = []
        max_in_progress = 3
        write_batch_size = 10
        write_interval = timedelta(seconds=10)
        last_write_time = datetime.now()
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
                    if repetition_number is not None:
                        yield ChatCompletionSubscriptionError(
                            message="Playground task timed out",
                            repetition_number=repetition_number,
                        )
                except Exception as error:
                    del in_progress[idx]  # removes failed stream
                    if repetition_number is not None:
                        yield ChatCompletionSubscriptionError(
                            message="An unexpected error occurred",
                            repetition_number=repetition_number,
                        )
                    logger.exception(error)
                else:
                    task = _create_task_with_timeout(stream)
                    in_progress[idx] = (repetition_number, stream, task)

                exceeded_write_batch_size = results.qsize() >= write_batch_size
                exceeded_write_interval = datetime.now() - last_write_time > write_interval
                write_already_in_progress = any(
                    _is_span_result_payloads_stream(stream) for _, stream, _ in in_progress
                )
                if (
                    not results.empty()
                    and (exceeded_write_batch_size or exceeded_write_interval)
                    and not write_already_in_progress
                ):
                    result_payloads_stream = _chat_completion_span_result_payloads(
                        db=info.context.db,
                        results=_drain_no_wait(results),
                        project_id=playground_project_id,
                        on_span_insertion=lambda: info.context.event_queue.put(
                            SpanInsertEvent(ids=(playground_project_id,))
                        ),
                    )
                    task = _create_task_with_timeout(result_payloads_stream)
                    in_progress.append((None, result_payloads_stream, task))
                    last_write_time = datetime.now()
        if remaining_results := await _drain(results):
            async for result_payload in _chat_completion_span_result_payloads(
                db=info.context.db,
                results=remaining_results,
                project_id=playground_project_id,
                on_span_insertion=lambda: info.context.event_queue.put(
                    SpanInsertEvent(ids=(playground_project_id,))
                ),
            ):
                yield result_payload

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
                model=input.model,
                session=session,
                decrypt=info.context.decrypt,
                credentials=input.credentials,
            )
            dataset_evaluator_node_ids = [evaluator.id for evaluator in input.evaluators]
            evaluators = await get_evaluators(
                dataset_evaluator_node_ids=dataset_evaluator_node_ids,
                session=session,
                decrypt=info.context.decrypt,
                credentials=input.credentials,
            )
            project_ids = await get_evaluator_project_ids(
                dataset_evaluator_node_ids=dataset_evaluator_node_ids,
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

        results: asyncio.Queue[ChatCompletionResult] = asyncio.Queue()
        not_started: list[tuple[DatasetExampleNodeID, ChatStream]] = [
            (
                GlobalID(DatasetExample.__name__, str(revision.dataset_example_id)),
                _stream_chat_completion_over_dataset_example(
                    input=input,
                    llm_client=llm_client,
                    revision=revision,
                    results=results,
                    repetition_number=repetition_number,
                    span_cost_calculator=info.context.span_cost_calculator,
                    experiment_id=experiment.id,
                ),
            )
            for revision in revisions
            for repetition_number in reversed(
                range(1, input.repetitions + 1)
            )  # since we pop right, this runs the repetitions in increasing order
        ]
        in_progress: list[
            tuple[
                Optional[DatasetExampleNodeID],
                ChatStream,
                asyncio.Task[ChatCompletionSubscriptionPayload],
            ]
        ] = []
        max_in_progress = 3
        write_batch_size = 10
        write_interval = timedelta(seconds=10)
        last_write_time = datetime.now()
        while not_started or in_progress:
            while not_started and len(in_progress) < max_in_progress:
                ex_id, stream = not_started.pop()
                task = _create_task_with_timeout(stream)
                in_progress.append((ex_id, stream, task))
            async_tasks_to_run = [task for _, _, task in in_progress]
            completed_tasks, _ = await asyncio.wait(
                async_tasks_to_run, return_when=asyncio.FIRST_COMPLETED
            )
            for completed_task in completed_tasks:
                idx = [task for _, _, task in in_progress].index(completed_task)
                example_id, stream, _ = in_progress[idx]
                try:
                    yield completed_task.result()
                except StopAsyncIteration:
                    del in_progress[idx]  # removes exhausted stream
                except asyncio.TimeoutError:
                    del in_progress[idx]  # removes timed-out stream
                    if example_id is not None:
                        yield ChatCompletionSubscriptionError(
                            message="Playground task timed out", dataset_example_id=example_id
                        )
                except Exception as error:
                    del in_progress[idx]  # removes failed stream
                    if example_id is not None:
                        yield ChatCompletionSubscriptionError(
                            message="An unexpected error occurred", dataset_example_id=example_id
                        )
                    logger.exception(error)
                else:
                    task = _create_task_with_timeout(stream)
                    in_progress[idx] = (example_id, stream, task)

                exceeded_write_batch_size = results.qsize() >= write_batch_size
                exceeded_write_interval = datetime.now() - last_write_time > write_interval
                write_already_in_progress = any(
                    _is_result_payloads_stream(stream) for _, stream, _ in in_progress
                )
                if (
                    not results.empty()
                    and (exceeded_write_batch_size or exceeded_write_interval)
                    and not write_already_in_progress
                ):
                    result_payloads_stream = _chat_completion_result_payloads(
                        db=info.context.db,
                        experiment_id=experiment.id,
                        results=_drain_no_wait(results),
                        project_id=playground_project_id,
                    )
                    task = _create_task_with_timeout(result_payloads_stream)
                    in_progress.append((None, result_payloads_stream, task))
                    last_write_time = datetime.now()
        if remaining_results := await _drain(results):
            async for result_payload in _chat_completion_result_payloads(
                db=info.context.db,
                experiment_id=experiment.id,
                results=remaining_results,
                project_id=playground_project_id,
            ):
                yield result_payload

        if input.evaluators:
            for revision in revisions:
                example_id = GlobalID(DatasetExample.__name__, str(revision.dataset_example_id))
                for repetition_number in range(1, input.repetitions + 1):
                    async with info.context.db() as session:
                        run = await session.scalar(  # pyright: ignore
                            select(models.ExperimentRun).where(
                                models.ExperimentRun.experiment_id == experiment.id,
                                models.ExperimentRun.dataset_example_id
                                == revision.dataset_example_id,
                                models.ExperimentRun.repetition_number == repetition_number,
                            )
                        )
                    if run is None or run.error is not None:
                        continue
                    context_dict: dict[str, Any] = {
                        "input": revision.input,
                        "reference": revision.output,
                        "output": run.output.get("task_output", run.output),
                    }
                    for evaluator, evaluator_input, project_id in zip(
                        evaluators, input.evaluators, project_ids
                    ):
                        name = str(evaluator_input.name)
                        annotation_config_override = get_annotation_config_override(evaluator_input)
                        merged_config = apply_overrides_to_annotation_config(
                            annotation_config=evaluator.output_config,
                            annotation_config_override=annotation_config_override,
                            name=name,
                            description_override=evaluator_input.description,
                        )

                        tracer: Tracer | None = None
                        if input.tracing_enabled:
                            tracer = Tracer(span_cost_calculator=info.context.span_cost_calculator)

                        result: EvaluationResult = await evaluator.evaluate(
                            context=context_dict,
                            input_mapping=evaluator_input.input_mapping,
                            name=name,
                            output_config=merged_config,
                            tracer=tracer,
                        )

                        if tracer is not None:
                            async with info.context.db() as session:
                                traces = await tracer.save_db_traces(
                                    session=session, project_id=project_id
                                )
                            result["trace_id"] = traces[0].trace_id

                        if result["error"] is not None:
                            yield EvaluationErrorChunk(
                                evaluator_name=name,
                                message=result["error"],
                                dataset_example_id=example_id,
                                repetition_number=repetition_number,
                            )
                            continue
                        annotation_model = evaluation_result_to_model(
                            result,
                            experiment_run_id=run.id,
                        )
                        async with info.context.db() as session:
                            session.add(annotation_model)
                            await session.flush()
                        evaluation_chunk = EvaluationChunk(
                            experiment_run_evaluation=ExperimentRunAnnotation(
                                id=annotation_model.id,
                                db_record=annotation_model,
                            ),
                            span_evaluation=None,
                            dataset_example_id=example_id,
                            repetition_number=repetition_number,
                        )
                        yield evaluation_chunk


async def _stream_chat_completion_over_dataset_example(
    *,
    input: ChatCompletionOverDatasetInput,
    llm_client: "PlaygroundStreamingClient[Any]",
    revision: models.DatasetExampleRevision,
    repetition_number: int,
    results: asyncio.Queue[ChatCompletionResult],
    span_cost_calculator: SpanCostCalculator,
    experiment_id: int,
) -> ChatStream:
    example_id = GlobalID(DatasetExample.__name__, str(revision.dataset_example_id))
    invocation_parameters = llm_client.construct_invocation_parameters(input.invocation_parameters)
    messages = [
        (
            message.role,
            message.content,
            message.tool_call_id if isinstance(message.tool_call_id, str) else None,
            message.tool_calls if isinstance(message.tool_calls, list) else None,
        )
        for message in input.messages
    ]
    try:
        format_start_time = cast(datetime, normalize_datetime(dt=local_now(), tz=timezone.utc))
        # Build the full context with input, reference (expected output), and metadata
        full_context: dict[str, Any] = {
            "input": revision.input,
            "reference": revision.output,
            "metadata": revision.metadata_,
        }
        # Resolve template variables based on the configured path
        if input.template_variables_path:
            template_variables = extract_value_from_path(
                full_context, input.template_variables_path
            )
        else:
            template_variables = full_context
        messages = list(
            _formatted_messages(
                messages=messages,
                template_format=input.template_format,
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
        await results.put(
            (
                revision.dataset_example_id,
                repetition_number,
                None,
                models.ExperimentRun(
                    experiment_id=experiment_id,
                    dataset_example_id=revision.dataset_example_id,
                    trace_id=None,
                    output={},
                    repetition_number=repetition_number,
                    start_time=format_start_time,
                    end_time=format_end_time,
                    error=str(error),
                    trace=None,
                ),
            )
        )
        return

    tracer = Tracer(span_cost_calculator=span_cost_calculator)
    try:
        async for chunk in llm_client.chat_completion_create(
            messages=messages,
            tools=input.tools or [],
            tracer=tracer,
            **invocation_parameters,
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
    await results.put((revision.dataset_example_id, repetition_number, tracer, None))


async def _chat_completion_result_payloads(
    *,
    db: DbSessionFactory,
    project_id: int,
    experiment_id: int,
    results: Sequence[ChatCompletionResult],
) -> ChatStream:
    if not results:
        return
    example_ids: list[int] = []
    repetition_numbers: list[int] = []
    db_spans: list[models.Span | None] = []
    db_runs: list[models.ExperimentRun] = []
    async with db() as session:
        for example_id, repetition_number, tracer, run in results:
            if tracer is not None:
                db_traces = await tracer.save_db_traces(session=session, project_id=project_id)
                if not db_traces:
                    continue
                db_trace = db_traces[0]
                if not db_trace.spans:
                    continue
                db_span = db_trace.spans[0]
                db_run = get_db_experiment_run(
                    db_span,
                    db_trace,
                    experiment_id=experiment_id,
                    example_id=example_id,
                    repetition_number=repetition_number,
                )
                session.add(db_run)
                example_ids.append(example_id)
                repetition_numbers.append(repetition_number)
                db_spans.append(db_span)
                db_runs.append(db_run)
            elif run is not None:
                session.add(run)
                example_ids.append(example_id)
                repetition_numbers.append(repetition_number)
                db_spans.append(None)
                db_runs.append(run)
        await session.flush()
    for example_id, repetition_number, maybe_db_span, db_run in zip(
        example_ids, repetition_numbers, db_spans, db_runs
    ):
        yield ChatCompletionSubscriptionResult(
            span=Span(id=maybe_db_span.id, db_record=maybe_db_span) if maybe_db_span else None,
            experiment_run=ExperimentRun(id=db_run.id, db_record=db_run),
            dataset_example_id=GlobalID(DatasetExample.__name__, str(example_id)),
            repetition_number=repetition_number,
        )


def _is_result_payloads_stream(
    stream: ChatStream,
) -> bool:
    """
    Checks if the given generator was instantiated from
    `_chat_completion_result_payloads`
    """
    return stream.ag_code == _chat_completion_result_payloads.__code__  # type: ignore


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


async def _drain(queue: asyncio.Queue[GenericType]) -> list[GenericType]:
    values: list[GenericType] = []
    while not queue.empty():
        values.append(await queue.get())
    return values


def _drain_no_wait(queue: asyncio.Queue[GenericType]) -> list[GenericType]:
    values: list[GenericType] = []
    while True:
        try:
            values.append(queue.get_nowait())
        except asyncio.QueueEmpty:
            break
    return values


async def _as_coroutine(iterable: AsyncIterator[GenericType]) -> GenericType:
    return await iterable.__anext__()


def _formatted_messages(
    *,
    messages: Iterable[ChatCompletionMessage],
    template_format: PromptTemplateFormat,
    template_variables: Mapping[str, Any],
) -> Iterator[ChatCompletionMessage]:
    """
    Formats the messages using the given template options.
    """
    # Convert to list to check if empty and allow multiple iterations
    messages_list = list(messages)
    if not messages_list:
        return iter([])
    template_formatter = _template_formatter(template_format=template_format)
    (
        roles,
        templates,
        tool_call_id,
        tool_calls,
    ) = zip(*messages_list)
    formatted_templates = map(
        lambda template: template_formatter.format(template, **template_variables),
        templates,
    )
    formatted_messages = zip(roles, formatted_templates, tool_call_id, tool_calls)
    return formatted_messages


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

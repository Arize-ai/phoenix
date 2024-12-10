import asyncio
import logging
from collections.abc import AsyncIterator, Iterator
from datetime import datetime, timedelta, timezone
from typing import (
    Any,
    AsyncGenerator,
    Coroutine,
    Iterable,
    Mapping,
    Optional,
    Sequence,
    TypeVar,
    cast,
)

import strawberry
from openinference.instrumentation import safe_json_dumps
from openinference.semconv.trace import SpanAttributes
from sqlalchemy import and_, func, insert, select
from sqlalchemy.orm import load_only
from strawberry.relay.types import GlobalID
from strawberry.types import Info
from typing_extensions import TypeAlias, assert_never

from phoenix.datetime_utils import local_now, normalize_datetime
from phoenix.db import models
from phoenix.server.api.auth import IsLocked, IsNotReadOnly
from phoenix.server.api.context import Context
from phoenix.server.api.exceptions import BadRequest, CustomGraphQLError, NotFound
from phoenix.server.api.helpers.playground_clients import (
    PlaygroundStreamingClient,
    initialize_playground_clients,
)
from phoenix.server.api.helpers.playground_registry import (
    PLAYGROUND_CLIENT_REGISTRY,
)
from phoenix.server.api.helpers.playground_spans import (
    get_db_experiment_run,
    get_db_span,
    get_db_trace,
    streaming_llm_span,
)
from phoenix.server.api.input_types.ChatCompletionInput import (
    ChatCompletionInput,
    ChatCompletionOverDatasetInput,
)
from phoenix.server.api.types.ChatCompletionMessageRole import ChatCompletionMessageRole
from phoenix.server.api.types.ChatCompletionSubscriptionPayload import (
    ChatCompletionSubscriptionError,
    ChatCompletionSubscriptionExperiment,
    ChatCompletionSubscriptionPayload,
    ChatCompletionSubscriptionResult,
)
from phoenix.server.api.types.Dataset import Dataset
from phoenix.server.api.types.DatasetExample import DatasetExample
from phoenix.server.api.types.DatasetVersion import DatasetVersion
from phoenix.server.api.types.Experiment import to_gql_experiment
from phoenix.server.api.types.ExperimentRun import to_gql_experiment_run
from phoenix.server.api.types.node import from_global_id_with_expected_type
from phoenix.server.api.types.Span import to_gql_span
from phoenix.server.api.types.TemplateLanguage import TemplateLanguage
from phoenix.server.dml_event import SpanInsertEvent
from phoenix.server.types import DbSessionFactory
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

ChatCompletionMessage: TypeAlias = tuple[
    ChatCompletionMessageRole, str, Optional[str], Optional[list[str]]
]
DatasetExampleID: TypeAlias = GlobalID
ChatCompletionResult: TypeAlias = tuple[
    DatasetExampleID, Optional[models.Span], models.ExperimentRun
]
ChatStream: TypeAlias = AsyncGenerator[ChatCompletionSubscriptionPayload, None]
PLAYGROUND_PROJECT_NAME = "playground"


@strawberry.type
class Subscription:
    @strawberry.subscription(permission_classes=[IsNotReadOnly, IsLocked])  # type: ignore
    async def chat_completion(
        self, info: Info[Context, None], input: ChatCompletionInput
    ) -> AsyncIterator[ChatCompletionSubscriptionPayload]:
        provider_key = input.model.provider_key
        llm_client_class = PLAYGROUND_CLIENT_REGISTRY.get_client(provider_key, input.model.name)
        if llm_client_class is None:
            raise BadRequest(f"Unknown LLM provider: '{provider_key.value}'")
        try:
            llm_client = llm_client_class(
                model=input.model,
                api_key=input.api_key,
            )
        except CustomGraphQLError:
            raise
        except Exception as error:
            raise BadRequest(
                f"Failed to connect to LLM API for {provider_key.value} {input.model.name}: "
                f"{str(error)}"
            )

        messages = [
            (
                message.role,
                message.content,
                message.tool_call_id if isinstance(message.tool_call_id, str) else None,
                message.tool_calls if isinstance(message.tool_calls, list) else None,
            )
            for message in input.messages
        ]
        attributes = None
        if template_options := input.template:
            messages = list(
                _formatted_messages(
                    messages=messages,
                    template_language=template_options.language,
                    template_variables=template_options.variables,
                )
            )
            attributes = {PROMPT_TEMPLATE_VARIABLES: safe_json_dumps(template_options.variables)}
        invocation_parameters = llm_client.construct_invocation_parameters(
            input.invocation_parameters
        )
        async with streaming_llm_span(
            input=input,
            messages=messages,
            invocation_parameters=invocation_parameters,
            attributes=attributes,
        ) as span:
            async for chunk in llm_client.chat_completion_create(
                messages=messages, tools=input.tools or [], **invocation_parameters
            ):
                span.add_response_chunk(chunk)
                yield chunk
        span.set_attributes(llm_client.attributes)
        if span.status_message is not None:
            yield ChatCompletionSubscriptionError(message=span.status_message)
        async with info.context.db() as session:
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
            db_trace = get_db_trace(span, playground_project_id)
            db_span = get_db_span(span, db_trace)
            session.add(db_span)
            await session.flush()
        info.context.event_queue.put(SpanInsertEvent(ids=(playground_project_id,)))
        yield ChatCompletionSubscriptionResult(span=to_gql_span(db_span))

    @strawberry.subscription(permission_classes=[IsNotReadOnly, IsLocked])  # type: ignore
    async def chat_completion_over_dataset(
        self, info: Info[Context, None], input: ChatCompletionOverDatasetInput
    ) -> AsyncIterator[ChatCompletionSubscriptionPayload]:
        provider_key = input.model.provider_key
        llm_client_class = PLAYGROUND_CLIENT_REGISTRY.get_client(provider_key, input.model.name)
        if llm_client_class is None:
            raise BadRequest(f"Unknown LLM provider: '{provider_key.value}'")
        try:
            llm_client = llm_client_class(
                model=input.model,
                api_key=input.api_key,
            )
        except CustomGraphQLError:
            raise
        except Exception as error:
            raise BadRequest(
                f"Failed to connect to LLM API for {provider_key.value} {input.model.name}: "
                f"{str(error)}"
            )

        dataset_id = from_global_id_with_expected_type(input.dataset_id, Dataset.__name__)
        version_id = (
            from_global_id_with_expected_type(
                global_id=input.dataset_version_id, expected_type_name=DatasetVersion.__name__
            )
            if input.dataset_version_id
            else None
        )
        async with info.context.db() as session:
            if (
                dataset := await session.scalar(
                    select(models.Dataset).where(models.Dataset.id == dataset_id)
                )
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
            revision_ids = (
                select(func.max(models.DatasetExampleRevision.id))
                .join(models.DatasetExample)
                .where(
                    and_(
                        models.DatasetExample.dataset_id == dataset_id,
                        models.DatasetExampleRevision.dataset_version_id <= resolved_version_id,
                    )
                )
                .group_by(models.DatasetExampleRevision.dataset_example_id)
            )
            if not (
                revisions := [
                    rev
                    async for rev in await session.stream_scalars(
                        select(models.DatasetExampleRevision)
                        .where(
                            and_(
                                models.DatasetExampleRevision.id.in_(revision_ids),
                                models.DatasetExampleRevision.revision_kind != "DELETE",
                            )
                        )
                        .order_by(models.DatasetExampleRevision.dataset_example_id.asc())
                        .options(
                            load_only(
                                models.DatasetExampleRevision.dataset_example_id,
                                models.DatasetExampleRevision.input,
                            )
                        )
                    )
                ]
            ):
                raise NotFound("No examples found for the given dataset and version")
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
            experiment = models.Experiment(
                dataset_id=from_global_id_with_expected_type(input.dataset_id, Dataset.__name__),
                dataset_version_id=resolved_version_id,
                name=input.experiment_name or _default_playground_experiment_name(),
                description=input.experiment_description
                or _default_playground_experiment_description(dataset_name=dataset.name),
                repetitions=1,
                metadata_=input.experiment_metadata
                or _default_playground_experiment_metadata(
                    dataset_name=dataset.name,
                    dataset_id=input.dataset_id,
                    version_id=GlobalID(DatasetVersion.__name__, str(resolved_version_id)),
                ),
                project_name=PLAYGROUND_PROJECT_NAME,
            )
            session.add(experiment)
            await session.flush()
        yield ChatCompletionSubscriptionExperiment(
            experiment=to_gql_experiment(experiment)
        )  # eagerly yields experiment so it can be linked by consumers of the subscription

        results: asyncio.Queue[ChatCompletionResult] = asyncio.Queue()
        not_started: list[tuple[DatasetExampleID, ChatStream]] = [
            (
                GlobalID(DatasetExample.__name__, str(revision.dataset_example_id)),
                _stream_chat_completion_over_dataset_example(
                    input=input,
                    llm_client=llm_client,
                    revision=revision,
                    results=results,
                    experiment_id=experiment.id,
                    project_id=playground_project_id,
                ),
            )
            for revision in revisions
        ]
        in_progress: list[
            tuple[
                Optional[DatasetExampleID],
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
                        db=info.context.db, results=_drain_no_wait(results)
                    )
                    task = _create_task_with_timeout(result_payloads_stream)
                    in_progress.append((None, result_payloads_stream, task))
                    last_write_time = datetime.now()
        if remaining_results := await _drain(results):
            async for result_payload in _chat_completion_result_payloads(
                db=info.context.db, results=remaining_results
            ):
                yield result_payload


async def _stream_chat_completion_over_dataset_example(
    *,
    input: ChatCompletionOverDatasetInput,
    llm_client: PlaygroundStreamingClient,
    revision: models.DatasetExampleRevision,
    results: asyncio.Queue[ChatCompletionResult],
    experiment_id: int,
    project_id: int,
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
        messages = list(
            _formatted_messages(
                messages=messages,
                template_language=input.template_language,
                template_variables=revision.input,
            )
        )
    except TemplateFormatterError as error:
        format_end_time = cast(datetime, normalize_datetime(dt=local_now(), tz=timezone.utc))
        yield ChatCompletionSubscriptionError(message=str(error), dataset_example_id=example_id)
        await results.put(
            (
                example_id,
                None,
                models.ExperimentRun(
                    experiment_id=experiment_id,
                    dataset_example_id=revision.dataset_example_id,
                    trace_id=None,
                    output={},
                    repetition_number=1,
                    start_time=format_start_time,
                    end_time=format_end_time,
                    error=str(error),
                    trace=None,
                ),
            )
        )
        return
    async with streaming_llm_span(
        input=input,
        messages=messages,
        invocation_parameters=invocation_parameters,
        attributes={PROMPT_TEMPLATE_VARIABLES: safe_json_dumps(revision.input)},
    ) as span:
        async for chunk in llm_client.chat_completion_create(
            messages=messages, tools=input.tools or [], **invocation_parameters
        ):
            span.add_response_chunk(chunk)
            chunk.dataset_example_id = example_id
            yield chunk
        span.set_attributes(llm_client.attributes)
    db_trace = get_db_trace(span, project_id)
    db_span = get_db_span(span, db_trace)
    db_run = get_db_experiment_run(
        db_span, db_trace, experiment_id=experiment_id, example_id=revision.dataset_example_id
    )
    await results.put((example_id, db_span, db_run))
    if span.status_message is not None:
        yield ChatCompletionSubscriptionError(
            message=span.status_message, dataset_example_id=example_id
        )


async def _chat_completion_result_payloads(
    *,
    db: DbSessionFactory,
    results: Sequence[ChatCompletionResult],
) -> ChatStream:
    if not results:
        return
    async with db() as session:
        for _, span, run in results:
            if span:
                session.add(span)
            session.add(run)
        await session.flush()
    for example_id, span, run in results:
        yield ChatCompletionSubscriptionResult(
            span=to_gql_span(span) if span else None,
            experiment_run=to_gql_experiment_run(run),
            dataset_example_id=example_id,
        )


def _is_result_payloads_stream(
    stream: ChatStream,
) -> bool:
    """
    Checks if the given generator was instantiated from
    `_chat_completion_result_payloads`
    """
    return stream.ag_code == _chat_completion_result_payloads.__code__


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
    template_language: TemplateLanguage,
    template_variables: Mapping[str, Any],
) -> Iterator[tuple[ChatCompletionMessageRole, str, Optional[str], Optional[list[str]]]]:
    """
    Formats the messages using the given template options.
    """
    template_formatter = _template_formatter(template_language=template_language)
    (
        roles,
        templates,
        tool_call_id,
        tool_calls,
    ) = zip(*messages)
    formatted_templates = map(
        lambda template: template_formatter.format(template, **template_variables),
        templates,
    )
    formatted_messages = zip(roles, formatted_templates, tool_call_id, tool_calls)
    return formatted_messages


def _template_formatter(template_language: TemplateLanguage) -> TemplateFormatter:
    """
    Instantiates the appropriate template formatter for the template language.
    """
    if template_language is TemplateLanguage.MUSTACHE:
        return MustacheTemplateFormatter()
    if template_language is TemplateLanguage.F_STRING:
        return FStringTemplateFormatter()
    if template_language is TemplateLanguage.NONE:
        return NoOpFormatter()
    assert_never(template_language)


def _default_playground_experiment_name() -> str:
    return "playground-experiment"


def _default_playground_experiment_description(dataset_name: str) -> str:
    return f'Playground experiment for dataset "{dataset_name}"'


def _default_playground_experiment_metadata(
    dataset_name: str, dataset_id: GlobalID, version_id: GlobalID
) -> dict[str, Any]:
    return {
        "dataset_name": dataset_name,
        "dataset_id": str(dataset_id),
        "dataset_version_id": str(version_id),
    }


LLM_OUTPUT_MESSAGES = SpanAttributes.LLM_OUTPUT_MESSAGES
LLM_TOKEN_COUNT_COMPLETION = SpanAttributes.LLM_TOKEN_COUNT_COMPLETION
LLM_TOKEN_COUNT_PROMPT = SpanAttributes.LLM_TOKEN_COUNT_PROMPT
PROMPT_TEMPLATE_VARIABLES = SpanAttributes.LLM_PROMPT_TEMPLATE_VARIABLES

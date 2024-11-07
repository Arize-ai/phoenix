import logging
from asyncio import FIRST_COMPLETED, Queue, Task, create_task, wait
from collections.abc import Iterator
from typing import (
    Any,
    AsyncIterator,
    Collection,
    Iterable,
    Mapping,
    Optional,
    TypeVar,
)

import strawberry
from openinference.semconv.trace import SpanAttributes
from sqlalchemy import and_, func, insert, select
from sqlalchemy.orm import load_only
from strawberry.relay.types import GlobalID
from strawberry.types import Info
from typing_extensions import TypeAlias, assert_never

from phoenix.db import models
from phoenix.server.api.context import Context
from phoenix.server.api.exceptions import BadRequest, NotFound
from phoenix.server.api.helpers.playground_clients import (
    PlaygroundStreamingClient,
    initialize_playground_clients,
)
from phoenix.server.api.helpers.playground_registry import (
    PLAYGROUND_CLIENT_REGISTRY,
)
from phoenix.server.api.helpers.playground_spans import streaming_llm_span
from phoenix.server.api.input_types.ChatCompletionInput import (
    ChatCompletionInput,
    ChatCompletionOverDatasetInput,
)
from phoenix.server.api.types.ChatCompletionMessageRole import ChatCompletionMessageRole
from phoenix.server.api.types.ChatCompletionSubscriptionPayload import (
    ChatCompletionSubscriptionError,
    ChatCompletionSubscriptionExperiment,
    ChatCompletionSubscriptionPayload,
    ChatCompletionSubscriptionSpan,
)
from phoenix.server.api.types.Dataset import Dataset
from phoenix.server.api.types.DatasetExample import DatasetExample
from phoenix.server.api.types.DatasetVersion import DatasetVersion
from phoenix.server.api.types.Experiment import to_gql_experiment
from phoenix.server.api.types.node import from_global_id_with_expected_type
from phoenix.server.api.types.Span import to_gql_span
from phoenix.server.api.types.TemplateLanguage import TemplateLanguage
from phoenix.server.dml_event import SpanInsertEvent
from phoenix.trace.attributes import get_attribute_value
from phoenix.utilities.template_formatters import (
    FStringTemplateFormatter,
    MustacheTemplateFormatter,
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
PLAYGROUND_PROJECT_NAME = "playground"


@strawberry.type
class Subscription:
    @strawberry.subscription
    async def chat_completion(
        self, info: Info[Context, None], input: ChatCompletionInput
    ) -> AsyncIterator[ChatCompletionSubscriptionPayload]:
        provider_key = input.model.provider_key
        llm_client_class = PLAYGROUND_CLIENT_REGISTRY.get_client(provider_key, input.model.name)
        if llm_client_class is None:
            raise BadRequest(f"No LLM client registered for provider '{provider_key}'")
        llm_client = llm_client_class(
            model=input.model,
            api_key=input.api_key,
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
        if template_options := input.template:
            messages = list(
                _formatted_messages(
                    messages=messages,
                    template_language=template_options.language,
                    template_variables=template_options.variables,
                )
            )
        invocation_parameters = llm_client.construct_invocation_parameters(
            input.invocation_parameters
        )
        async with streaming_llm_span(
            input=input,
            messages=messages,
            invocation_parameters=invocation_parameters,
        ) as span:
            async for chunk in llm_client.chat_completion_create(
                messages=messages, tools=input.tools or [], **invocation_parameters
            ):
                span.add_response_chunk(chunk)
                yield chunk
            span.set_attributes(llm_client.attributes)
        if span.error_message is not None:
            yield ChatCompletionSubscriptionError(message=span.error_message)
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
            db_span = span.to_db_span(playground_project_id)
            session.add(db_span)
            await session.flush()
        info.context.event_queue.put(SpanInsertEvent(ids=(playground_project_id,)))
        yield ChatCompletionSubscriptionSpan(span=to_gql_span(db_span))

    @strawberry.subscription
    async def chat_completion_over_dataset(
        self, info: Info[Context, None], input: ChatCompletionOverDatasetInput
    ) -> AsyncIterator[ChatCompletionSubscriptionPayload]:
        provider_key = input.model.provider_key
        llm_client_class = PLAYGROUND_CLIENT_REGISTRY.get_client(provider_key, input.model.name)
        if llm_client_class is None:
            raise BadRequest(f"No LLM client registered for provider '{provider_key}'")

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
                name=input.experiment_name or _DEFAULT_PLAYGROUND_EXPERIMENT_NAME,
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
        yield ChatCompletionSubscriptionExperiment(experiment=to_gql_experiment(experiment))

        spans: Queue[tuple[DatasetExampleID, models.Span]] = Queue()
        runs: Queue[tuple[DatasetExampleID, models.ExperimentRun]] = Queue()
        async for payload in _merge_iterators(
            [
                _stream_chat_completion_over_dataset_example(
                    input=input,
                    llm_client_class=llm_client_class,
                    revision=revision,
                    spans=spans,
                    runs=runs,
                    experiment_id=experiment.id,
                    project_id=playground_project_id,
                )
                for revision in revisions
            ]
        ):
            yield payload

        async with info.context.db() as session:
            while not spans.empty():
                example_id, span = await spans.get()
                session.add(span)
                await session.flush()
                yield ChatCompletionSubscriptionSpan(
                    span=to_gql_span(span),
                    dataset_example_id=example_id,
                )
            while not runs.empty():
                _, run = await runs.get()
                session.add(run)
            await session.flush()


async def _stream_chat_completion_over_dataset_example(
    *,
    input: ChatCompletionOverDatasetInput,
    llm_client_class: type["PlaygroundStreamingClient"],
    revision: models.DatasetExampleRevision,
    spans: Queue[tuple[DatasetExampleID, models.Span]],
    runs: Queue[tuple[DatasetExampleID, models.ExperimentRun]],
    experiment_id: int,
    project_id: int,
) -> AsyncIterator[ChatCompletionSubscriptionPayload]:
    example_id = GlobalID(DatasetExample.__name__, str(revision.dataset_example_id))
    llm_client = llm_client_class(
        model=input.model,
        api_key=input.api_key,
    )
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
        messages = list(
            _formatted_messages(
                messages=messages,
                template_language=input.template_language,
                template_variables=revision.input,
            )
        )
    except TemplateFormatterError as error:
        yield ChatCompletionSubscriptionError(message=str(error), dataset_example_id=example_id)
        return
    async with streaming_llm_span(
        input=input,
        messages=messages,
        invocation_parameters=invocation_parameters,
    ) as span:
        async for chunk in llm_client.chat_completion_create(
            messages=messages, tools=input.tools or [], **invocation_parameters
        ):
            span.add_response_chunk(chunk)
            chunk.dataset_example_id = example_id
            yield chunk
        span.set_attributes(llm_client.attributes)
    db_span = span.to_db_span(project_id)
    await spans.put((example_id, db_span))
    await runs.put(
        (
            example_id,
            models.ExperimentRun(
                experiment_id=experiment_id,
                dataset_example_id=from_global_id_with_expected_type(
                    example_id, DatasetExample.__name__
                ),
                trace_id=span.trace_id,
                output=models.ExperimentRunOutput(
                    task_output=get_attribute_value(db_span.attributes, LLM_OUTPUT_MESSAGES),
                ),
                repetition_number=1,
                start_time=span.start_time,
                end_time=span.end_time,
                error=error_message if (error_message := span.error_message) is not None else None,
                prompt_token_count=get_attribute_value(db_span.attributes, LLM_TOKEN_COUNT_PROMPT),
                completion_token_count=get_attribute_value(
                    db_span.attributes, LLM_TOKEN_COUNT_COMPLETION
                ),
            ),
        )
    )
    if span.error_message is not None:
        yield ChatCompletionSubscriptionError(
            message=span.error_message, dataset_example_id=example_id
        )


async def _merge_iterators(
    iterators: Collection[AsyncIterator[GenericType]],
) -> AsyncIterator[GenericType]:
    tasks: dict[AsyncIterator[GenericType], Task[GenericType]] = {
        iterable: _as_task(iterable) for iterable in iterators
    }
    while tasks:
        completed_tasks, _ = await wait(tasks.values(), return_when=FIRST_COMPLETED)
        for task in completed_tasks:
            iterator = next(it for it, t in tasks.items() if t == task)
            try:
                yield task.result()
            except StopAsyncIteration:
                del tasks[iterator]
            except Exception as error:
                del tasks[iterator]
                logger.exception(error)
            else:
                tasks[iterator] = _as_task(iterator)


def _as_task(iterable: AsyncIterator[GenericType]) -> Task[GenericType]:
    return create_task(_as_coroutine(iterable))


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
    assert_never(template_language)


_DEFAULT_PLAYGROUND_EXPERIMENT_NAME = "playground-experiment"


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

import asyncio
from collections.abc import Iterator
from typing import (
    TYPE_CHECKING,
    Any,
    AsyncIterator,
    Iterable,
    Mapping,
    Optional,
    Sequence,
    TypeVar,
)

import strawberry
from sqlalchemy import insert, select
from strawberry.relay.types import GlobalID
from strawberry.types import Info
from typing_extensions import TypeAlias, assert_never

from phoenix.db import models
from phoenix.server.api.context import Context
from phoenix.server.api.exceptions import BadRequest
from phoenix.server.api.helpers.playground_clients import initialize_playground_clients
from phoenix.server.api.helpers.playground_registry import (
    PLAYGROUND_CLIENT_REGISTRY,
)
from phoenix.server.api.helpers.playground_spans import streaming_llm_span
from phoenix.server.api.input_types.ChatCompletionInput import (
    ChatCompletionInput,
    ChatCompletionOverDatasetInput,
)
from phoenix.server.api.input_types.TemplateOptions import TemplateOptions
from phoenix.server.api.types.ChatCompletionMessageRole import ChatCompletionMessageRole
from phoenix.server.api.types.ChatCompletionSubscriptionPayload import (
    ChatCompletionSubscriptionError,
    ChatCompletionSubscriptionPayload,
    FinishedChatCompletion,
)
from phoenix.server.api.types.Dataset import Dataset
from phoenix.server.api.types.node import from_global_id_with_expected_type
from phoenix.server.api.types.Span import to_gql_span
from phoenix.server.api.types.TemplateLanguage import TemplateLanguage
from phoenix.server.dml_event import SpanInsertEvent
from phoenix.utilities.template_formatters import (
    FStringTemplateFormatter,
    MustacheTemplateFormatter,
    TemplateFormatter,
    TemplateFormatterError,
)

if TYPE_CHECKING:
    from phoenix.server.api.helpers.playground_clients import PlaygroundStreamingClient

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
        attributes: dict[str, Any] = {}
        llm_client = llm_client_class(
            model=input.model,
            api_key=input.api_key,
            set_span_attributes=lambda attrs: attributes.update(attrs),
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
            messages = list(_formatted_messages(messages, template_options))
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
            db_span = span.add_to_session(session, playground_project_id)
            await session.flush()
            yield FinishedChatCompletion(
                span=to_gql_span(db_span), error_message=span.error_message
            )
        info.context.event_queue.put(SpanInsertEvent(ids=(playground_project_id,)))

    @strawberry.subscription
    async def chat_completion_over_dataset(
        self, info: Info[Context, None], input: "ChatCompletionOverDatasetInput"
    ) -> AsyncIterator[ChatCompletionSubscriptionPayload]:
        provider_key = input.model.provider_key
        llm_client_class = PLAYGROUND_CLIENT_REGISTRY.get_client(provider_key, input.model.name)
        if llm_client_class is None:
            raise BadRequest(f"No LLM client registered for provider '{provider_key}'")
        attributes: dict[str, Any] = {}
        llm_client = llm_client_class(
            model=input.model,
            api_key=input.api_key,
            set_span_attributes=lambda attrs: attributes.update(attrs),
        )
        unformatted_messages = [
            (
                message.role,
                message.content,
                message.tool_call_id if isinstance(message.tool_call_id, str) else None,
                message.tool_calls if isinstance(message.tool_calls, list) else None,
            )
            for message in input.messages
        ]
        messages: dict[DatasetExampleID, list[ChatCompletionMessage]] = {}
        async with info.context.db() as session:
            async for example in await session.stream_scalars(
                select(models.DatasetExample).where(
                    models.DatasetExample.dataset_id
                    == from_global_id_with_expected_type(input.dataset_id, Dataset.__name__)
                )
            ):
                example_node_id = GlobalID(Dataset.__name__, str(example.id))
                if template_options := input.template:
                    try:
                        messages[example_node_id] = list(
                            _formatted_messages(unformatted_messages, template_options)
                        )
                    except TemplateFormatterError as error:
                        yield ChatCompletionSubscriptionError(
                            message=str(error), dataset_example_id=example_node_id
                        )
                else:
                    messages[example_node_id] = unformatted_messages
        invocation_parameters = llm_client.construct_invocation_parameters(
            input.invocation_parameters
        )
        spans = {
            example_id: streaming_llm_span(
                input=input,
                messages=messages[example_id],
                invocation_parameters=invocation_parameters,
                attributes=attributes,
            )
            for example_id in messages
        }
        async for payload in _yield_concurrently(
            [
                _stream(
                    llm_client=llm_client,
                    input=input,
                    span=spans[example_id],
                    invocation_parameters=invocation_parameters,
                    messages=messages[example_id],
                    example_id=example_id,
                )
                for example_id in messages
            ]
        ):
            yield payload
            await asyncio.sleep(0.2)  # todo: remove this line
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
            for span in spans.values():
                db_span = span.add_to_session(session, playground_project_id)
                yield FinishedChatCompletion(
                    span=to_gql_span(db_span), error_message=span.error_message
                )


async def _stream(
    *,
    llm_client: "PlaygroundStreamingClient",
    input: ChatCompletionOverDatasetInput,
    messages: list[ChatCompletionMessage],
    invocation_parameters: Mapping[str, Any],
    span: streaming_llm_span,
    example_id: DatasetExampleID,
) -> AsyncIterator[ChatCompletionSubscriptionPayload]:
    async with span:
        async for chunk in llm_client.chat_completion_create(
            messages=messages, tools=input.tools or [], **invocation_parameters
        ):
            span.add_response_chunk(chunk)
            chunk.dataset_example_id = example_id
            yield chunk
    if span.error_message is not None:
        yield ChatCompletionSubscriptionError(
            message=span.error_message, dataset_example_id=example_id
        )


def _formatted_messages(
    messages: Iterable[ChatCompletionMessage],
    template_options: TemplateOptions,
) -> Iterator[tuple[ChatCompletionMessageRole, str, Optional[str], Optional[list[str]]]]:
    """
    Formats the messages using the given template options.
    """
    template_formatter = _template_formatter(template_language=template_options.language)
    (
        roles,
        templates,
        tool_call_id,
        tool_calls,
    ) = zip(*messages)
    formatted_templates = map(
        lambda template: template_formatter.format(template, **template_options.variables),
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


GenericType = TypeVar("GenericType")


async def _yield_concurrently(
    iters: Sequence[AsyncIterator[GenericType]],
) -> AsyncIterator[GenericType]:
    """
    Yields from multiple async iterables concurrently.
    """
    tasks: list[asyncio.Task[GenericType]] = [
        asyncio.create_task(it.__aiter__().__anext__())  # type: ignore[arg-type]
        for it in iters
    ]

    while tasks:
        done, _ = await asyncio.wait(tasks, return_when=asyncio.FIRST_COMPLETED)
        for task in done:
            try:
                result = task.result()
                yield result
                index = tasks.index(task)
                tasks[index] = asyncio.create_task(iters[index].__anext__())  # type: ignore[arg-type]
            except StopAsyncIteration:
                tasks.remove(task)

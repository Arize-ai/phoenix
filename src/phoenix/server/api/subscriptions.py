from collections.abc import AsyncIterator, Iterable, Iterator
from typing import (
    Any,
    Optional,
)

import strawberry
from sqlalchemy import insert, select
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
from phoenix.server.api.input_types.ChatCompletionInput import ChatCompletionInput
from phoenix.server.api.input_types.TemplateOptions import TemplateOptions
from phoenix.server.api.types.ChatCompletionMessageRole import ChatCompletionMessageRole
from phoenix.server.api.types.ChatCompletionSubscriptionPayload import (
    ChatCompletionSubscriptionPayload,
    FinishedChatCompletion,
)
from phoenix.server.api.types.Span import to_gql_span
from phoenix.server.api.types.TemplateLanguage import TemplateLanguage
from phoenix.server.dml_event import SpanInsertEvent
from phoenix.utilities.template_formatters import (
    FStringTemplateFormatter,
    MustacheTemplateFormatter,
    TemplateFormatter,
)

initialize_playground_clients()

ChatCompletionMessage: TypeAlias = tuple[
    ChatCompletionMessageRole, str, Optional[str], Optional[list[str]]
]
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

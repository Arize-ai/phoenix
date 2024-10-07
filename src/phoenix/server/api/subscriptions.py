from datetime import datetime
from typing import TYPE_CHECKING, AsyncIterator, List

import strawberry
from sqlalchemy import insert, select
from strawberry.types import Info

from phoenix.db import models
from phoenix.server.api.context import Context
from phoenix.server.api.input_types.ChatCompletionMessageInput import ChatCompletionMessageInput
from phoenix.server.api.types.ChatCompletionMessageRole import ChatCompletionMessageRole

if TYPE_CHECKING:
    from openai.types.chat import (
        ChatCompletionMessageParam,
    )


@strawberry.input
class ChatCompletionInput:
    messages: List[ChatCompletionMessageInput]


def to_openai_chat_completion_param(
    message: ChatCompletionMessageInput,
) -> "ChatCompletionMessageParam":
    from openai.types.chat import (
        ChatCompletionAssistantMessageParam,
        ChatCompletionSystemMessageParam,
        ChatCompletionUserMessageParam,
    )

    if message.role is ChatCompletionMessageRole.USER:
        return ChatCompletionUserMessageParam(
            {
                "content": message.content,
                "role": "user",
            }
        )
    if message.role is ChatCompletionMessageRole.SYSTEM:
        return ChatCompletionSystemMessageParam(
            {
                "content": message.content,
                "role": "system",
            }
        )
    if message.role is ChatCompletionMessageRole.AI:
        return ChatCompletionAssistantMessageParam(
            {
                "content": message.content,
                "role": "assistant",
            }
        )
    raise ValueError(f"Unsupported role: {message.role}")


@strawberry.type
class Subscription:
    @strawberry.subscription
    async def chat_completion(
        self, info: Info[Context, None], input: ChatCompletionInput
    ) -> AsyncIterator[str]:
        from openai import AsyncOpenAI

        client = AsyncOpenAI()

        # Loop over the input messages and map them to the OpenAI format

        messages: List[ChatCompletionMessageParam] = [
            to_openai_chat_completion_param(message) for message in input.messages
        ]
        chunk_contents = []
        start_time = datetime.now()
        async for chunk in await client.chat.completions.create(
            messages=messages,
            model="gpt-4",
            stream=True,
        ):
            choice = chunk.choices[0]
            if choice.finish_reason is None:
                assert isinstance(chunk_content := chunk.choices[0].delta.content, str)
                yield chunk_content
                chunk_contents.append(chunk_content)
        end_time = datetime.now()
        async with info.context.db() as session:
            # insert dummy data
            trace_id = str(start_time)
            span_id = str(end_time)
            default_project_id = await session.scalar(
                select(models.Project.id).where(models.Project.name == "default")
            )
            trace_rowid = await session.scalar(
                insert(models.Trace)
                .returning(models.Trace.id)
                .values(
                    project_rowid=default_project_id,
                    trace_id=trace_id,
                    start_time=start_time,
                    end_time=end_time,
                )
            )
            await session.execute(
                insert(models.Span).values(
                    trace_rowid=trace_rowid,
                    span_id=span_id,
                    parent_id=None,
                    name="AsyncOpenAI.chat.completion.create",
                    span_kind="LLM",
                    start_time=start_time,
                    end_time=end_time,
                    attributes={},
                    events=[],
                    status_code="OK",
                    status_message="",
                    cumulative_error_count=0,
                    cumulative_llm_token_count_prompt=0,
                    cumulative_llm_token_count_completion=0,
                    llm_token_count_prompt=0,
                    llm_token_count_completion=0,
                )
            )

from __future__ import annotations

from collections.abc import AsyncIterator, Sequence
from uuid import UUID

from pydantic_ai.ui.vercel_ai.response_types import (
    BaseChunk,
    DataChunk,
    ErrorChunk,
    FileChunk,
    FinishChunk,
    MessageMetadataChunk,
    ReasoningDeltaChunk,
    ReasoningEndChunk,
    ReasoningStartChunk,
    SourceDocumentChunk,
    SourceUrlChunk,
    StartChunk,
    StartStepChunk,
    TextDeltaChunk,
    TextEndChunk,
    TextStartChunk,
    ToolInputAvailableChunk,
    ToolInputDeltaChunk,
    ToolInputStartChunk,
    ToolOutputAvailableChunk,
)

from phoenix.db.types.data_stream_protocol import (
    UIDataPart,
    UIFilePart,
    UIMessage,
    UIReasoningPart,
    UISourceDocumentPart,
    UISourceUrlPart,
    UIStepStartPart,
    UITextPart,
    UIToolPart,
)
from phoenix.server.agents.data_stream_protocol import (
    accumulate_ui_message_chunks_to_ui_messages,
)


async def _iter_chunks(chunks: Sequence[BaseChunk]) -> AsyncIterator[BaseChunk]:
    for chunk in chunks:
        yield chunk


async def _collect_messages(chunks: Sequence[BaseChunk]) -> list[UIMessage]:
    return [
        message
        async for message in accumulate_ui_message_chunks_to_ui_messages(_iter_chunks(chunks))
    ]


async def _collect_messages_with_initial(
    chunks: Sequence[BaseChunk],
    *,
    initial_message: UIMessage,
) -> list[UIMessage]:
    return [
        message
        async for message in accumulate_ui_message_chunks_to_ui_messages(
            _iter_chunks(chunks),
            initial_message=initial_message,
        )
    ]


class TestAccumulateUIMessageChunksToUIMessages:
    async def test_mints_a_unique_uuid_without_a_start_chunk(self) -> None:
        first = await _collect_messages([TextStartChunk(id="text-1")])
        second = await _collect_messages([TextStartChunk(id="text-2")])

        assert UUID(first[-1].id).version == 4
        assert UUID(second[-1].id).version == 4
        assert first[-1].id != second[-1].id

    async def test_extends_an_initial_assistant_message(self) -> None:
        initial_message = UIMessage(
            id="message-1",
            role="assistant",
            metadata={"initial": True},
            parts=[UITextPart(type="text", text="before", state="done")],
        )

        messages = await _collect_messages_with_initial(
            [
                StartChunk(message_id="message-1"),
                StartStepChunk(),
                TextStartChunk(id="text-2"),
                TextDeltaChunk(id="text-2", delta="after"),
                TextEndChunk(id="text-2"),
                MessageMetadataChunk(message_metadata={"continued": True}),
            ],
            initial_message=initial_message,
        )

        final_message = messages[-1]
        assert final_message.id == initial_message.id
        assert final_message.metadata == {"initial": True, "continued": True}
        assert final_message.parts[0] == initial_message.parts[0]
        assert isinstance(final_message.parts[1], UIStepStartPart)
        assert isinstance(final_message.parts[2], UITextPart)
        assert final_message.parts[2].text == "after"
        assert initial_message.parts == [UITextPart(type="text", text="before", state="done")]

    async def test_accumulates_text_reasoning_metadata_and_step_boundaries(self) -> None:
        messages = await _collect_messages(
            [
                StartChunk(
                    message_id="message-1",
                    message_metadata={"start": True},
                ),
                StartStepChunk(),
                TextStartChunk(
                    id="text-1",
                    provider_metadata={"provider": {"start": "text"}},
                ),
                TextDeltaChunk(
                    id="text-1",
                    delta="hello ",
                    provider_metadata={"provider": {"delta": "text"}},
                ),
                TextDeltaChunk(id="text-1", delta="world"),
                TextEndChunk(
                    id="text-1",
                    provider_metadata={"provider": {"end": "text"}},
                ),
                ReasoningStartChunk(id="reasoning-1"),
                ReasoningDeltaChunk(id="reasoning-1", delta="thinking"),
                ReasoningEndChunk(id="reasoning-1"),
                MessageMetadataChunk(message_metadata={"middle": True}),
                FinishChunk(message_metadata={"finish": True}),
            ]
        )

        final_message = messages[-1]
        assert final_message.id == "message-1"
        assert final_message.metadata == {
            "start": True,
            "middle": True,
            "finish": True,
        }
        assert isinstance(final_message.parts[0], UIStepStartPart)
        text_part = final_message.parts[1]
        assert isinstance(text_part, UITextPart)
        assert text_part.text == "hello world"
        assert text_part.state == "done"
        assert text_part.provider_metadata == {
            "provider": {
                "end": "text",
            }
        }
        reasoning_part = final_message.parts[2]
        assert isinstance(reasoning_part, UIReasoningPart)
        assert reasoning_part.text == "thinking"
        assert reasoning_part.state == "done"

    async def test_accumulates_tool_input_and_output_parts(self) -> None:
        messages = await _collect_messages(
            [
                ToolInputStartChunk(
                    tool_call_id="tool-call-1",
                    tool_name="lookup",
                    provider_metadata={"provider": {"call": "lookup"}},
                ),
                ToolInputDeltaChunk(
                    tool_call_id="tool-call-1",
                    input_text_delta='{"query":',
                ),
                ToolInputDeltaChunk(
                    tool_call_id="tool-call-1",
                    input_text_delta='"latency"}',
                ),
                ToolInputAvailableChunk(
                    tool_call_id="tool-call-1",
                    tool_name="lookup",
                    input={"query": "latency"},
                ),
                ToolOutputAvailableChunk(
                    tool_call_id="tool-call-1",
                    output={"rows": 3},
                    preliminary=True,
                ),
            ]
        )

        [tool_part] = messages[-1].parts
        assert isinstance(tool_part, UIToolPart)
        assert tool_part.type == "tool-lookup"
        assert tool_part.tool_call_id == "tool-call-1"
        assert tool_part.input == {"query": "latency"}
        assert tool_part.output == {"rows": 3}
        assert tool_part.preliminary is True

    async def test_accumulates_data_source_file_and_error_chunks(self) -> None:
        messages = await _collect_messages(
            [
                DataChunk(type="data-status", data="working", transient=True),
                DataChunk(type="data-progress", id="data-1", data={"percent": 50}),
                SourceUrlChunk(
                    source_id="source-url-1",
                    url="https://example.com",
                    title="Example",
                ),
                SourceDocumentChunk(
                    source_id="source-document-1",
                    media_type="text/plain",
                    title="Document",
                    filename="document.txt",
                ),
                FileChunk(url="data:text/plain;base64,aGk=", media_type="text/plain"),
                ErrorChunk(error_text="subagent failed"),
            ]
        )

        data_part, source_url_part, source_document_part, file_part, error_part = messages[-1].parts
        assert isinstance(data_part, UIDataPart)
        assert data_part.type == "data-progress"
        assert data_part.id == "data-1"
        assert data_part.data == {"percent": 50}
        assert isinstance(source_url_part, UISourceUrlPart)
        assert source_url_part.url == "https://example.com"
        assert source_url_part.title == "Example"
        assert isinstance(source_document_part, UISourceDocumentPart)
        assert source_document_part.media_type == "text/plain"
        assert source_document_part.filename == "document.txt"
        assert isinstance(file_part, UIFilePart)
        assert file_part.url == "data:text/plain;base64,aGk="
        assert isinstance(error_part, UIDataPart)
        assert error_part.type == "data-error"
        assert error_part.data == {"errorText": "subagent failed"}

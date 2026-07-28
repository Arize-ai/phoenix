from __future__ import annotations

from collections.abc import AsyncIterator, Sequence

from pydantic_ai.exceptions import ModelHTTPError
from pydantic_ai.ui.vercel_ai.request_types import (
    DataUIPart,
    FileUIPart,
    ReasoningUIPart,
    SourceDocumentUIPart,
    SourceUrlUIPart,
    StepStartUIPart,
    TextUIPart,
    ToolOutputAvailablePart,
    UIMessage,
)
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

from phoenix.server.agents.data_stream_protocol import (
    accumulate_ui_message_chunks_to_ui_messages,
    build_stream_error_chunk,
    format_stream_error_text,
    is_api_key_error,
)
from phoenix.server.agents.exceptions import (
    ProviderConfigError,
    ProviderCredentialsError,
    SummarizationError,
)


async def _iter_chunks(chunks: Sequence[BaseChunk]) -> AsyncIterator[BaseChunk]:
    for chunk in chunks:
        yield chunk


async def _collect_messages(chunks: Sequence[BaseChunk]) -> list[UIMessage]:
    return [
        message
        async for message in accumulate_ui_message_chunks_to_ui_messages(_iter_chunks(chunks))
    ]


class TestAccumulateUIMessageChunksToUIMessages:
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
        assert isinstance(final_message.parts[0], StepStartUIPart)
        text_part = final_message.parts[1]
        assert isinstance(text_part, TextUIPart)
        assert text_part.text == "hello world"
        assert text_part.state == "done"
        assert text_part.provider_metadata == {
            "provider": {
                "end": "text",
            }
        }
        reasoning_part = final_message.parts[2]
        assert isinstance(reasoning_part, ReasoningUIPart)
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
        assert isinstance(tool_part, ToolOutputAvailablePart)
        assert tool_part.type == "tool-lookup"
        assert tool_part.tool_call_id == "tool-call-1"
        assert tool_part.input == {"query": "latency"}
        assert tool_part.output == {"rows": 3}
        assert tool_part.preliminary is True

    async def test_accumulates_data_source_file_and_error_chunks(self) -> None:
        messages = await _collect_messages(
            [
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
        assert isinstance(data_part, DataUIPart)
        assert data_part.type == "data-progress"
        assert data_part.id == "data-1"
        assert data_part.data == {"percent": 50}
        assert isinstance(source_url_part, SourceUrlUIPart)
        assert source_url_part.url == "https://example.com"
        assert source_url_part.title == "Example"
        assert isinstance(source_document_part, SourceDocumentUIPart)
        assert source_document_part.media_type == "text/plain"
        assert source_document_part.filename == "document.txt"
        assert isinstance(file_part, FileUIPart)
        assert file_part.url == "data:text/plain;base64,aGk="
        assert isinstance(error_part, DataUIPart)
        assert error_part.type == "data-error"
        assert error_part.data == {"errorText": "subagent failed"}


class TestIsApiKeyError:
    def test_detects_credential_exceptions(self) -> None:
        assert is_api_key_error(ProviderCredentialsError("missing key"))
        assert is_api_key_error(ProviderConfigError("bad config"))

    def test_detects_provider_http_auth_status_codes(self) -> None:
        for status_code in (401, 403):
            error = ModelHTTPError(
                status_code=status_code,
                model_name="gpt-4o",
                body="Incorrect API key provided",
            )
            assert is_api_key_error(error)

    def test_ignores_non_auth_http_status_codes(self) -> None:
        error = ModelHTTPError(status_code=500, model_name="gpt-4o", body="boom")
        assert not is_api_key_error(error)

    def test_matches_message_keywords_as_fallback(self) -> None:
        assert is_api_key_error(RuntimeError("401 Unauthorized"))
        assert is_api_key_error(ValueError("Invalid x-api-key header"))
        assert is_api_key_error(RuntimeError("authentication_error"))

    def test_does_not_flag_unrelated_errors(self) -> None:
        assert not is_api_key_error(RuntimeError("connection reset by peer"))
        assert not is_api_key_error(SummarizationError("no summary produced"))


class TestFormatStreamErrorText:
    def test_api_key_error_includes_remediation_and_detail(self) -> None:
        text = format_stream_error_text(ProviderCredentialsError("no OPENAI_API_KEY"))
        assert "API key" in text
        assert "Settings" in text
        # underlying detail is preserved for debugging
        assert "no OPENAI_API_KEY" in text

    def test_non_api_key_error_falls_back_to_detail(self) -> None:
        text = format_stream_error_text(RuntimeError("connection reset by peer"))
        assert text == "connection reset by peer"

    def test_empty_message_falls_back_to_exception_type(self) -> None:
        text = format_stream_error_text(RuntimeError())
        assert text == "RuntimeError"


class TestBuildStreamErrorChunk:
    def test_wraps_message_in_error_chunk(self) -> None:
        chunk = build_stream_error_chunk(ProviderCredentialsError("no OPENAI_API_KEY"))
        assert isinstance(chunk, ErrorChunk)
        assert "API key" in chunk.error_text
        assert "no OPENAI_API_KEY" in chunk.error_text

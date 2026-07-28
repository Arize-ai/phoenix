"""Tests for Phoenix's UI-message-stream error helpers."""

from pydantic_ai.exceptions import ModelHTTPError
from pydantic_ai.ui.vercel_ai.response_types import ErrorChunk

from phoenix.server.agents.exceptions import (
    ProviderConfigError,
    ProviderCredentialsError,
    SummarizationError,
)
from phoenix.server.agents.ui_message_stream import (
    build_stream_error_chunk,
    format_stream_error_text,
    is_api_key_error,
)


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

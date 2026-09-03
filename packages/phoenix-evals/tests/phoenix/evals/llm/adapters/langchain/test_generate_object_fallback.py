# type: ignore
"""Tests for ``LangChainModelAdapter.generate_object`` AUTO-mode fallback.

Covers the drift fixed by consolidating into ``BaseLLMAdapter._try_with_fallback``
(#12722): when only one generation method is supported by the underlying
client, a failure used to be swallowed into a generic "neither ... succeeded"
``ValueError`` that dropped the real error entirely.
"""

from unittest.mock import MagicMock

import httpx2
import pytest
from openai import BadRequestError

pytest.importorskip("langchain_core")

from phoenix.evals.llm.adapters.langchain.adapter import LangChainModelAdapter  # noqa: E402

SIMPLE_SCHEMA = {
    "type": "object",
    "properties": {
        "label": {"type": "string", "enum": ["yes", "no"]},
    },
    "required": ["label"],
}


def _bad_request(message: str) -> BadRequestError:
    """A real capability-mismatch signal -- the only kind of error the
    adapter now treats as eligible for the structured-output/tool-calling
    fallback."""
    request = httpx2.Request("POST", "https://api.openai.com/v1/chat/completions")
    response = httpx2.Response(400, request=request)
    return BadRequestError(message, response=response, body=None)


def _make_structured_only_adapter() -> LangChainModelAdapter:
    client = MagicMock(spec=["invoke", "with_structured_output"])
    client.__module__ = "langchain_openai"
    return LangChainModelAdapter(client=client, model="model")


def test_only_structured_output_supported_propagates_real_error() -> None:
    """Regression test: previously this raised a generic 'neither ... succeeded'
    error instead of the actual failure from with_structured_output()."""
    adapter = _make_structured_only_adapter()
    adapter.client.with_structured_output.return_value.invoke.side_effect = RuntimeError(
        "SCHEMA_REJECTED_MARKER"
    )

    with pytest.raises(RuntimeError, match="SCHEMA_REJECTED_MARKER"):
        adapter.generate_object("test prompt", SIMPLE_SCHEMA)


def test_both_supported_falls_back_and_combines_errors_on_double_failure() -> None:
    client = MagicMock()
    client.__module__ = "langchain_openai"
    adapter = LangChainModelAdapter(client=client, model="model")
    adapter.client.with_structured_output.return_value.invoke.side_effect = _bad_request(
        "STRUCTURED_OUTPUT_MARKER"
    )
    adapter.client.bind_tools.return_value.invoke.side_effect = _bad_request("TOOL_CALLING_MARKER")

    with pytest.raises(ValueError, match="failed with both") as exc_info:
        adapter.generate_object("test prompt", SIMPLE_SCHEMA)

    message = str(exc_info.value)
    assert "STRUCTURED_OUTPUT_MARKER" in message
    assert "TOOL_CALLING_MARKER" in message


def test_non_capability_error_does_not_trigger_fallback() -> None:
    """A rate-limit-shaped error (not BadRequestError) must propagate
    directly instead of wasting a second request against tool calling."""
    client = MagicMock()
    client.__module__ = "langchain_openai"
    adapter = LangChainModelAdapter(client=client, model="model")
    adapter.client.with_structured_output.return_value.invoke.side_effect = RuntimeError(
        "TRANSIENT_ERROR"
    )

    with pytest.raises(RuntimeError, match="TRANSIENT_ERROR"):
        adapter.generate_object("test prompt", SIMPLE_SCHEMA)

    adapter.client.bind_tools.return_value.invoke.assert_not_called()

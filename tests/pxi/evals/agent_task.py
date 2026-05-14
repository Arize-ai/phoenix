from __future__ import annotations

import json
import os
import sys
from typing import Any, Literal, cast

from pydantic_ai.agent import AgentRunResult
from pydantic_ai.mcp import MCPServerStreamableHTTP
from pydantic_ai.models import Model as PydanticAIModel

from phoenix.config import (
    get_env_allow_external_resources,
    get_env_dangerously_enable_agents,
)
from phoenix.server.agents.agent_factory import build_agent
from phoenix.server.agents.context import ProjectContext, ResolvedContexts
from phoenix.server.agents.model_factory import (
    _anthropic_cache_settings as anthropic_cache_settings,
)
from phoenix.server.agents.model_factory import (
    _build_openai_model as build_openai_model,
)
from phoenix.server.agents.model_factory import (
    azure_endpoint_to_base_url,
)
from phoenix.server.agents.toolsets.docs_mcp import MintlifyDocsMCPServer
from phoenix.server.agents.types import AgentDependencies, AgentOutput

DEFAULT_ASSISTANT_PROVIDER = "OPENAI"
DEFAULT_ASSISTANT_MODEL = "gpt-5.4"
DEFAULT_PROJECT_NODE_ID = "UHJvamVjdDox"
ENV_ASSISTANT_PROVIDER = "PHOENIX_AGENTS_ASSISTANT_PROVIDER"
ENV_ASSISTANT_MODEL = "PHOENIX_AGENTS_ASSISTANT_MODEL"
ENV_ASSISTANT_OPENAI_API_TYPE = "PHOENIX_AGENTS_ASSISTANT_OPENAI_API_TYPE"
_MAX_ERROR_MESSAGE_LEN = 200


def _warn_placeholder_api_key(provider: str, base_url: str) -> None:
    print(
        f"warning: {provider} placeholder API key is being used against custom "
        f"base URL {base_url}. Verify this URL is intentional before running.",
        file=sys.stderr,
    )


async def _build_model() -> PydanticAIModel:
    provider = os.getenv(ENV_ASSISTANT_PROVIDER, DEFAULT_ASSISTANT_PROVIDER).upper()
    model_name = os.getenv(ENV_ASSISTANT_MODEL, DEFAULT_ASSISTANT_MODEL)
    openai_api_type = os.getenv(ENV_ASSISTANT_OPENAI_API_TYPE, "responses")
    if openai_api_type not in ("chat_completions", "responses"):
        raise RuntimeError(f"Unsupported {ENV_ASSISTANT_OPENAI_API_TYPE}: {openai_api_type}")
    typed_openai_api_type = cast(Literal["chat_completions", "responses"], openai_api_type)

    if provider == "OPENAI":
        from openai import AsyncOpenAI
        from pydantic_ai.providers.openai import OpenAIProvider

        api_key = os.getenv("OPENAI_API_KEY")
        base_url = os.getenv("OPENAI_BASE_URL")
        if not api_key and not base_url:
            raise RuntimeError("OPENAI_API_KEY is required for OPENAI PXI eval runs")
        if not api_key and base_url:
            _warn_placeholder_api_key("OPENAI", base_url)
        openai_provider = OpenAIProvider(
            openai_client=AsyncOpenAI(
                api_key=api_key or "sk-placeholder",
                base_url=base_url,
                max_retries=0,
            )
        )
        return build_openai_model(
            model_name=model_name,
            provider=openai_provider,
            openai_api_type=typed_openai_api_type,
        )

    if provider == "AZURE_OPENAI":
        from openai import AsyncOpenAI
        from pydantic_ai.providers.openai import OpenAIProvider

        api_key = os.getenv("AZURE_OPENAI_API_KEY")
        endpoint = os.getenv("AZURE_OPENAI_ENDPOINT")
        if not endpoint:
            raise RuntimeError("AZURE_OPENAI_ENDPOINT is required for AZURE_OPENAI PXI eval runs")
        if not api_key:
            _warn_placeholder_api_key("AZURE_OPENAI", endpoint)
        openai_provider = OpenAIProvider(
            openai_client=AsyncOpenAI(
                api_key=api_key or "sk-placeholder",
                base_url=azure_endpoint_to_base_url(endpoint),
                max_retries=0,
            )
        )
        return build_openai_model(
            model_name=model_name,
            provider=openai_provider,
            openai_api_type=typed_openai_api_type,
        )

    if provider == "ANTHROPIC":
        from anthropic import AsyncAnthropic
        from pydantic_ai.models.anthropic import AnthropicModel
        from pydantic_ai.providers.anthropic import AnthropicProvider

        api_key = os.getenv("ANTHROPIC_API_KEY")
        if not api_key:
            raise RuntimeError("ANTHROPIC_API_KEY is required for ANTHROPIC PXI eval runs")
        return AnthropicModel(
            model_name,
            provider=AnthropicProvider(
                anthropic_client=AsyncAnthropic(api_key=api_key, max_retries=0)
            ),
            settings=anthropic_cache_settings(),
        )

    raise RuntimeError(f"Unsupported {ENV_ASSISTANT_PROVIDER} for evals: {provider}")


def should_build_docs_mcp_server() -> bool:
    """Mirror the production gate so callers know whether to build the toolset.

    See ``phoenix.server.app:1191-1195`` — the real server only constructs
    the docs MCP toolset when both env toggles are true.
    """
    return get_env_dangerously_enable_agents() and get_env_allow_external_resources()


def build_shared_docs_mcp_server() -> MCPServerStreamableHTTP | None:
    """Build a single docs-MCP toolset to share across all eval task runs.

    The production server constructs this once at startup and enters its
    async context manager via the FastAPI lifespan
    (``phoenix.server.app:697-698``). The harness must do the same: a fresh
    toolset per task plus concurrency causes anyio to fail with "Attempted
    to exit cancel scope in a different task than it was entered in"
    because the underlying streamable-HTTP client opens/closes scopes that
    cross task boundaries.
    """
    if not should_build_docs_mcp_server():
        return None
    return MintlifyDocsMCPServer()


def _build_dependencies() -> AgentDependencies:
    contexts = ResolvedContexts(
        project=ProjectContext(
            type="project",
            project_node_id=DEFAULT_PROJECT_NODE_ID,
            span_filter="",
            root_spans_only=False,
        )
    )
    return AgentDependencies(contexts=contexts)


def _serialize_new_messages(result: AgentRunResult[AgentOutput]) -> list[dict[str, Any]]:
    return cast(list[dict[str, Any]], json.loads(result.new_messages_json()))


def _assistant_text_from_messages(messages: list[dict[str, Any]]) -> str | None:
    text_parts: list[str] = []
    for message in messages:
        parts = message.get("parts", [])
        if not isinstance(parts, list):
            continue
        text_parts.extend(
            content
            for part in parts
            if isinstance(part, dict)
            and part.get("part_kind") == "text"
            and isinstance(content := part.get("content"), str)
        )
    return "\n".join(text_parts) if text_parts else None


def agent_task_output(result: AgentRunResult[AgentOutput]) -> dict[str, Any]:
    output = result.output
    messages = _serialize_new_messages(result)
    assistant_text = _assistant_text_from_messages(messages)

    return {
        "assistant_text": assistant_text or output if isinstance(output, str) else assistant_text,
        "messages": messages,
        "raw_output_type": type(output).__name__,
    }


def make_task(
    docs_mcp_server: MCPServerStreamableHTTP | None = None,
) -> Any:
    """Build a Phoenix experiment task callable bound to a shared toolset.

    The returned coroutine receives an experiment example dict
    (``{id, input, ...}``) and routes it to :func:`run_pxi_example`,
    attaching the example's stable id so the failure report can map back
    to YAML example IDs. The single shared ``docs_mcp_server`` is reused
    across every concurrent task to satisfy anyio's single-owner cancel
    scope rule.
    """

    async def task(example: dict[str, Any]) -> dict[str, Any]:
        input_value = example["input"]
        query = input_value.get("query")
        if not isinstance(query, str):
            raise ValueError("PXI eval examples must define input.query")
        return await run_pxi_example(
            {"query": query},
            stable_example_id=example.get("id"),
            docs_mcp_server=docs_mcp_server,
        )

    return task


async def task(example: dict[str, Any]) -> dict[str, Any]:
    """Backwards-compatible task callable that builds no docs MCP toolset.

    Prefer :func:`make_task` so the toolset is shared across concurrent
    runs. This entrypoint is kept for callers that don't need the docs
    toolset and for backwards compatibility with the original
    ``from tests.pxi.evals.agent_task import task`` import.
    """
    input_value = example["input"]
    query = input_value.get("query")
    if not isinstance(query, str):
        raise ValueError("PXI eval examples must define input.query")
    return await run_pxi_example({"query": query}, stable_example_id=example.get("id"))


async def run_pxi_example(
    input: dict[str, Any],
    *,
    stable_example_id: str | None = None,
    docs_mcp_server: MCPServerStreamableHTTP | None = None,
) -> dict[str, Any]:
    """Run a single PXI agent turn imperatively.

    ``input`` is an example input dict; only ``input["query"]`` is
    consumed. Failures anywhere in setup or in ``agent.run`` are caught and
    returned with ``error`` set, so the failure report can still resolve a
    stable example ID for the row.

    ``docs_mcp_server`` should be a single shared, already-entered
    :class:`MCPServerStreamableHTTP` (built via
    :func:`build_shared_docs_mcp_server` at the top of an async run, then
    entered with ``async with``). Pass ``None`` to skip the docs toolset.

    The returned ``error`` field is bounded in length and contains only the
    exception type plus a truncated message (no stack traces). When the
    harness is pointed at a shared Phoenix the value is uploaded as-is, so
    avoid pasting credentials into request URLs while debugging.
    """
    try:
        query = input["query"]
        model = await _build_model()
        agent = build_agent(model=model, docs_mcp_server=docs_mcp_server)
        result = await agent.run(query, deps=_build_dependencies())
        output = agent_task_output(result)
    except Exception as exc:
        message = str(exc)
        if len(message) > _MAX_ERROR_MESSAGE_LEN:
            message = message[:_MAX_ERROR_MESSAGE_LEN] + "…"
        output = {
            "assistant_text": None,
            "messages": [],
            "raw_output_type": type(exc).__name__,
            "error": f"{type(exc).__name__}: {message}" if message else type(exc).__name__,
        }
    payload = output
    if stable_example_id is not None:
        payload["stable_example_id"] = stable_example_id
    return payload

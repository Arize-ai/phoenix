from __future__ import annotations

import json
import os
import sys
from collections.abc import Mapping
from typing import Literal, NoReturn, cast

from phoenix.client.resources.datasets import DatasetExample as PhoenixDatasetExample
from phoenix.client.resources.experiments.types import ExperimentTask
from pydantic_ai import DeferredToolRequests
from pydantic_ai.mcp import MCPServerStreamableHTTP
from pydantic_ai.models import Model as PydanticAIModel

from phoenix.config import get_env_allow_external_resources, get_env_dangerously_enable_agents
from phoenix.server.agents.capabilities import AgentCapabilities
from phoenix.server.agents.chat_v2.dependencies import ChatDependencies
from phoenix.server.agents.chat_v2.mintlify_docs import build_mintlify_docs_toolset
from phoenix.server.agents.chat_v2.pxi_agent import ChatOutput, create_pxi_agent
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
from phoenix.server.types import DbSessionFactory
from tests.pxi.evals.types import (
    AgentTaskOutput,
    ExampleInput,
    JsonObject,
    JsonValue,
    ToolCall,
)

DEFAULT_ASSISTANT_PROVIDER = "OPENAI"
DEFAULT_ASSISTANT_MODEL = "gpt-5.4"
DEFAULT_PROJECT_NODE_ID = "UHJvamVjdDox"
_MAX_ERROR_MESSAGE_LEN = 200


async def _empty_db_context() -> NoReturn:
    raise RuntimeError("PXI eval task does not provide a database session")


def _warn_placeholder_api_key(provider: str, base_url: str) -> None:
    print(
        f"warning: {provider} placeholder API key is being used against custom "
        f"base URL {base_url}. Verify this URL is intentional before running.",
        file=sys.stderr,
    )


async def _build_model() -> PydanticAIModel:
    provider = os.getenv("PXI_E2E_ASSISTANT_PROVIDER", DEFAULT_ASSISTANT_PROVIDER).upper()
    model_name = os.getenv("PXI_E2E_ASSISTANT_MODEL", DEFAULT_ASSISTANT_MODEL)
    openai_api_type = os.getenv("PXI_E2E_ASSISTANT_OPENAI_API_TYPE", "responses")
    if openai_api_type not in ("chat_completions", "responses"):
        raise RuntimeError(f"Unsupported PXI_E2E_ASSISTANT_OPENAI_API_TYPE: {openai_api_type}")
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

    raise RuntimeError(f"Unsupported PXI_E2E_ASSISTANT_PROVIDER for evals: {provider}")


def should_build_docs_mcp_toolset() -> bool:
    """Mirror the production gate so callers know whether to build the toolset.

    See ``phoenix.server.app:1191-1195`` — the real server only constructs
    the docs MCP toolset when both env toggles are true.
    """
    return get_env_dangerously_enable_agents() and get_env_allow_external_resources()


def build_shared_docs_mcp_toolset() -> MCPServerStreamableHTTP | None:
    """Build a single docs-MCP toolset to share across all eval task runs.

    The production server constructs this once at startup and enters its
    async context manager via the FastAPI lifespan
    (``phoenix.server.app:697-698``). The harness must do the same: a fresh
    toolset per task plus concurrency causes anyio to fail with "Attempted
    to exit cancel scope in a different task than it was entered in"
    because the underlying streamable-HTTP client opens/closes scopes that
    cross task boundaries.
    """
    if not should_build_docs_mcp_toolset():
        return None
    return build_mintlify_docs_toolset()


def _build_dependencies(
    docs_mcp_toolset: MCPServerStreamableHTTP | None = None,
) -> ChatDependencies:
    contexts = ResolvedContexts(
        project=ProjectContext(
            type="project",
            project_node_id=os.getenv("PXI_E2E_PROJECT_NODE_ID", DEFAULT_PROJECT_NODE_ID),
            span_filter="",
            root_spans_only=False,
        )
    )
    return ChatDependencies(
        user=None,
        db=cast(DbSessionFactory, _empty_db_context),
        contexts=contexts,
        capabilities=AgentCapabilities(),
        docs_mcp_toolset=docs_mcp_toolset,
    )


def _jsonish(value: object) -> JsonValue:
    try:
        json.dumps(value)
    except TypeError:
        if hasattr(value, "model_dump"):
            return cast(JsonValue, value.model_dump(mode="json"))
        if hasattr(value, "__dict__"):
            return {
                key: _jsonish(item) for key, item in vars(value).items() if not key.startswith("_")
            }
        return f"<unserializable {type(value).__name__}>"
    return cast(JsonValue, value)


def _normalize_args(args: object) -> JsonObject:
    if args is None:
        return {}
    if hasattr(args, "args_as_dict"):
        args = args.args_as_dict()
    elif isinstance(args, str):
        try:
            args = json.loads(args)
        except json.JSONDecodeError:
            return {"__raw_args": cast(str, args)}
    return cast(JsonObject, args) if isinstance(args, dict) else {"__raw_args": _jsonish(args)}


def _normalize_tool_call(call: object) -> ToolCall | None:
    name = getattr(call, "tool_name", None) or getattr(call, "name", None)
    if not isinstance(name, str):
        return None
    args = getattr(call, "args", None) or getattr(call, "arguments", None)
    return {"name": name, "args": _normalize_args(args)}


def _normalize_part(part: object) -> JsonObject:
    part_kind = getattr(part, "part_kind", type(part).__name__)
    normalized: JsonObject = {"part_kind": part_kind}
    content = getattr(part, "content", None)
    if content is not None:
        normalized["content"] = _jsonish(content)
    tool_name = getattr(part, "tool_name", None)
    if isinstance(tool_name, str):
        normalized["tool_name"] = tool_name
    if hasattr(part, "args"):
        normalized["args"] = _normalize_args(getattr(part, "args"))
    tool_call_id = getattr(part, "tool_call_id", None)
    if isinstance(tool_call_id, str):
        normalized["tool_call_id"] = tool_call_id
    return normalized


def _normalize_messages(result: object) -> list[JsonObject]:
    new_messages = getattr(result, "new_messages", None)
    if not callable(new_messages):
        return []
    return [
        {
            "kind": getattr(message, "kind", type(message).__name__),
            "parts": [_normalize_part(part) for part in getattr(message, "parts", [])],
        }
        for message in new_messages()
    ]


def _tool_calls_from_messages(messages: list[JsonObject]) -> list[ToolCall]:
    calls: list[ToolCall] = []
    for message in messages:
        parts = message.get("parts", [])
        if not isinstance(parts, list):
            continue
        for part in parts:
            if not isinstance(part, Mapping) or part.get("part_kind") != "tool-call":
                continue
            tool_name = part.get("tool_name")
            if isinstance(tool_name, str):
                calls.append({"name": tool_name, "args": _normalize_args(part.get("args"))})
    return calls


def _assistant_text_from_messages(messages: list[JsonObject]) -> str | None:
    text_parts = [
        content
        for message in messages
        for part in cast(list[object], message.get("parts", []))
        if isinstance(part, Mapping)
        and part.get("part_kind") == "text"
        and isinstance(content := part.get("content"), str)
    ]
    return "\n".join(text_parts) if text_parts else None


def _tool_call_key(call: Mapping[str, object]) -> tuple[str, str]:
    """Stable identity for a tool call independent of arg normalization path."""
    return str(call.get("name") or ""), json.dumps(
        call.get("args") or {}, sort_keys=True, default=str
    )


def _task_output(
    *,
    output: ChatOutput | object,
    assistant_text: str | None,
    tool_calls: list[ToolCall],
    messages: list[JsonObject],
) -> AgentTaskOutput:
    return {
        "assistant_text": assistant_text,
        "tool_calls": tool_calls,
        "messages": messages,
        "raw_output_type": type(output).__name__,
    }


def normalize_agent_output(result: object) -> AgentTaskOutput:
    output: ChatOutput | object = getattr(result, "output", result)
    messages = _normalize_messages(result)
    tool_calls = _tool_calls_from_messages(messages)
    assistant_text = _assistant_text_from_messages(messages)

    if isinstance(output, str):
        return _task_output(
            output=output,
            assistant_text=assistant_text or output,
            tool_calls=tool_calls,
            messages=messages,
        )

    if isinstance(output, DeferredToolRequests):
        seen_keys = {_tool_call_key(call) for call in tool_calls}
        deferred_calls: list[object] = []
        for attr in ("calls", "tool_calls", "deferred_calls"):
            value = getattr(output, attr, None)
            if value:
                deferred_calls = list(value)
                break
        for item in deferred_calls:
            call = _normalize_tool_call(item)
            if call is None:
                continue
            key = _tool_call_key(call)
            if key in seen_keys:
                continue
            seen_keys.add(key)
            tool_calls.append(call)
        return _task_output(
            output=output,
            assistant_text=assistant_text,
            tool_calls=tool_calls,
            messages=messages,
        )

    return _task_output(
        output=output,
        assistant_text=assistant_text or (str(output) if output is not None else None),
        tool_calls=tool_calls,
        messages=messages,
    )


def make_task(
    docs_mcp_toolset: MCPServerStreamableHTTP | None = None,
) -> ExperimentTask:
    """Build a Phoenix experiment task callable bound to a shared toolset.

    The returned coroutine receives an experiment example dict
    (``{id, input, ...}``) and routes it to :func:`run_pxi_example`,
    attaching the example's stable id so the failure report can map back
    to YAML example IDs. The single shared ``docs_mcp_toolset`` is reused
    across every concurrent task to satisfy anyio's single-owner cancel
    scope rule.
    """

    async def task(example: PhoenixDatasetExample) -> AgentTaskOutput:
        input_value = example["input"]
        query = input_value.get("query")
        if not isinstance(query, str):
            raise ValueError("PXI eval examples must define input.query")
        return await run_pxi_example(
            {"query": query},
            stable_example_id=example.get("id"),
            docs_mcp_toolset=docs_mcp_toolset,
        )

    return cast(ExperimentTask, task)


async def task(example: PhoenixDatasetExample) -> AgentTaskOutput:
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
    input: ExampleInput,
    *,
    stable_example_id: str | None = None,
    docs_mcp_toolset: MCPServerStreamableHTTP | None = None,
) -> AgentTaskOutput:
    """Run a single PXI agent turn imperatively.

    ``input`` is an example input dict; only ``input["query"]`` is
    consumed. Failures anywhere in setup or in ``agent.run`` are caught and
    returned with ``error`` set, so the failure report can still resolve a
    stable example ID for the row.

    ``docs_mcp_toolset`` should be a single shared, already-entered
    :class:`MCPServerStreamableHTTP` (built via
    :func:`build_shared_docs_mcp_toolset` at the top of an async run, then
    entered with ``async with``). Pass ``None`` to skip the docs toolset.

    The returned ``error`` field is bounded in length and contains only the
    exception type plus a truncated message (no stack traces). When the
    harness is pointed at a shared Phoenix the value is uploaded as-is, so
    avoid pasting credentials into request URLs while debugging.
    """
    try:
        query = input["query"]
        model = await _build_model()
        agent = create_pxi_agent(model)
        result = await agent.run(query, deps=_build_dependencies(docs_mcp_toolset=docs_mcp_toolset))
        output = normalize_agent_output(result)
    except Exception as exc:
        message = str(exc)
        if len(message) > _MAX_ERROR_MESSAGE_LEN:
            message = message[:_MAX_ERROR_MESSAGE_LEN] + "…"
        output = {
            "assistant_text": None,
            "tool_calls": [],
            "messages": [],
            "raw_output_type": type(exc).__name__,
            "error": f"{type(exc).__name__}: {message}" if message else type(exc).__name__,
        }
    payload = output
    if stable_example_id is not None:
        payload["stable_example_id"] = stable_example_id
    return payload

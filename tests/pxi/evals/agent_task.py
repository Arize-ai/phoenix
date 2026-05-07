from __future__ import annotations

import json
import os
from collections.abc import Mapping
from typing import Any, Literal, cast

from pydantic_ai import DeferredToolRequests

from phoenix.config import get_env_allow_external_resources, get_env_dangerously_enable_agents
from phoenix.server.agents.capabilities import AgentCapabilities
from phoenix.server.agents.chat_v2.dependencies import ChatDependencies
from phoenix.server.agents.chat_v2.mintlify_docs import build_mintlify_docs_toolset
from phoenix.server.agents.chat_v2.pxi_agent import create_pxi_agent
from phoenix.server.agents.context import ProjectContext, ResolvedContexts
from phoenix.server.agents.model_factory import (
    _anthropic_cache_settings,
    _build_openai_model,
    azure_endpoint_to_base_url,
)
from tests.pxi.evals.types import AgentTaskOutput, ToolCall

DEFAULT_ASSISTANT_PROVIDER = "OPENAI"
DEFAULT_ASSISTANT_MODEL = "gpt-5.4"
DEFAULT_PROJECT_NODE_ID = "UHJvamVjdDox"


async def _empty_db_context() -> Any:
    raise RuntimeError("PXI eval task does not provide a database session")


async def _build_model() -> Any:
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
        openai_provider = OpenAIProvider(
            openai_client=AsyncOpenAI(
                api_key=api_key or "sk-placeholder",
                base_url=base_url,
                max_retries=0,
            )
        )
        return _build_openai_model(
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
        openai_provider = OpenAIProvider(
            openai_client=AsyncOpenAI(
                api_key=api_key or "sk-placeholder",
                base_url=azure_endpoint_to_base_url(endpoint),
                max_retries=0,
            )
        )
        return _build_openai_model(
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
            settings=_anthropic_cache_settings(),
        )

    raise RuntimeError(f"Unsupported PXI_E2E_ASSISTANT_PROVIDER for evals: {provider}")


def _build_dependencies() -> ChatDependencies:
    contexts = ResolvedContexts(
        project=ProjectContext(
            type="project",
            project_node_id=os.getenv("PXI_E2E_PROJECT_NODE_ID", DEFAULT_PROJECT_NODE_ID),
            span_filter="",
            root_spans_only=True,
        )
    )
    docs_mcp_toolset = (
        build_mintlify_docs_toolset()
        if get_env_dangerously_enable_agents() and get_env_allow_external_resources()
        else None
    )
    return ChatDependencies(
        user=None,
        db=cast(Any, _empty_db_context),
        contexts=contexts,
        capabilities=AgentCapabilities(),
        docs_mcp_toolset=docs_mcp_toolset,
    )


def _jsonish(value: Any) -> Any:
    try:
        json.dumps(value)
    except TypeError:
        if hasattr(value, "model_dump"):
            return value.model_dump(mode="json")
        if hasattr(value, "__dict__"):
            return {
                key: _jsonish(item) for key, item in vars(value).items() if not key.startswith("_")
            }
        return repr(value)
    return value


def _normalize_args(args: Any) -> dict[str, Any]:
    if args is None:
        return {}
    if hasattr(args, "args_as_dict"):
        args = args.args_as_dict()
    elif isinstance(args, str):
        try:
            args = json.loads(args)
        except json.JSONDecodeError:
            return {"__raw_args": args}
    return args if isinstance(args, dict) else {"__raw_args": _jsonish(args)}


def _normalize_tool_call(call: Any) -> ToolCall | None:
    name = getattr(call, "tool_name", None) or getattr(call, "name", None)
    if not isinstance(name, str):
        return None
    args = getattr(call, "args", None) or getattr(call, "arguments", None)
    return ToolCall(name=name, args=_normalize_args(args))


def _normalize_part(part: Any) -> dict[str, Any]:
    part_kind = getattr(part, "part_kind", type(part).__name__)
    normalized: dict[str, Any] = {"part_kind": part_kind}
    content = getattr(part, "content", None)
    if content is not None:
        normalized["content"] = _jsonish(content)
    if tool_name := getattr(part, "tool_name", None):
        normalized["tool_name"] = tool_name
    if hasattr(part, "args"):
        normalized["args"] = _normalize_args(getattr(part, "args"))
    if tool_call_id := getattr(part, "tool_call_id", None):
        normalized["tool_call_id"] = tool_call_id
    return normalized


def _normalize_messages(result: Any) -> list[dict[str, Any]]:
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


def _tool_calls_from_messages(messages: list[dict[str, Any]]) -> list[ToolCall]:
    calls = []
    for message in messages:
        for part in message.get("parts", []):
            if not isinstance(part, Mapping) or part.get("part_kind") != "tool-call":
                continue
            tool_name = part.get("tool_name")
            if isinstance(tool_name, str):
                calls.append(ToolCall(name=tool_name, args=_normalize_args(part.get("args"))))
    return calls


def _assistant_text_from_messages(messages: list[dict[str, Any]]) -> str | None:
    text_parts = [
        part["content"]
        for message in messages
        for part in message.get("parts", [])
        if isinstance(part, Mapping)
        and part.get("part_kind") == "text"
        and isinstance(part.get("content"), str)
    ]
    return "\n".join(text_parts) if text_parts else None


def normalize_agent_output(result: Any) -> AgentTaskOutput:
    output = getattr(result, "output", result)
    raw_output_type = type(output).__name__
    messages = _normalize_messages(result)
    tool_calls = _tool_calls_from_messages(messages)
    assistant_text = _assistant_text_from_messages(messages)

    if isinstance(output, str):
        return AgentTaskOutput(
            assistant_text=assistant_text or output,
            tool_calls=tool_calls,
            messages=messages,
            raw_output_type=raw_output_type,
        )

    if isinstance(output, DeferredToolRequests):
        calls = []
        for attr in ("calls", "tool_calls", "deferred_calls"):
            value = getattr(output, attr, None)
            if value:
                calls = list(value)
                break
        for item in calls:
            call = _normalize_tool_call(item)
            if call is not None and call not in tool_calls:
                tool_calls.append(call)
        return AgentTaskOutput(
            assistant_text=assistant_text,
            tool_calls=tool_calls,
            messages=messages,
            raw_output_type=raw_output_type,
        )

    return AgentTaskOutput(
        assistant_text=assistant_text or (str(output) if output is not None else None),
        tool_calls=tool_calls,
        messages=messages,
        raw_output_type=raw_output_type,
    )


async def task(example: dict[str, Any]) -> dict[str, Any]:
    return await run_pxi_example(
        example["input"],
        stable_example_id=example.get("id"),
    )


async def run_pxi_example(
    input: dict[str, Any],
    *,
    stable_example_id: str | None = None,
) -> dict[str, Any]:
    query = input["query"]
    model = await _build_model()
    agent = create_pxi_agent(model)
    try:
        result = await agent.run(query, deps=_build_dependencies())
        output = normalize_agent_output(result)
    except Exception as exc:
        output = AgentTaskOutput(
            raw_output_type=type(exc).__name__,
            error=f"{type(exc).__name__}: {exc}",
        )
    payload = output.model_dump(mode="json")
    if stable_example_id is not None:
        payload["stable_example_id"] = stable_example_id
    return payload

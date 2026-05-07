from __future__ import annotations

import asyncio
import json
import os
from collections.abc import Callable
from typing import Any

from pydantic_ai import DeferredToolRequests

from phoenix.server.agents.capabilities import AgentCapabilities
from phoenix.server.agents.chat_v2.dependencies import ChatDependencies
from phoenix.server.agents.chat_v2.pxi_agent import create_pxi_agent
from phoenix.server.agents.context import ProjectContext, ResolvedContexts
from phoenix.server.agents.model_factory import azure_endpoint_to_base_url
from tests.pxi.evals.types import AgentTaskOutput, ToolCall

DEFAULT_ASSISTANT_PROVIDER = "OPENAI"
DEFAULT_ASSISTANT_MODEL = "gpt-5.4"
DEFAULT_PROJECT_NODE_ID = "UHJvamVjdDox"


async def _empty_db_context() -> Any:
    raise RuntimeError("PXI eval task does not provide a database session")


async def _build_model() -> Any:
    provider = os.getenv("PXI_E2E_ASSISTANT_PROVIDER", DEFAULT_ASSISTANT_PROVIDER).upper()
    model_name = os.getenv("PXI_E2E_ASSISTANT_MODEL", DEFAULT_ASSISTANT_MODEL)
    if provider == "OPENAI":
        from openai import AsyncOpenAI
        from pydantic_ai.models.openai import OpenAIChatModel, OpenAIResponsesModel
        from pydantic_ai.providers.openai import OpenAIProvider

        api_key = os.getenv("OPENAI_API_KEY")
        base_url = os.getenv("OPENAI_BASE_URL")
        if not api_key and not base_url:
            raise RuntimeError("OPENAI_API_KEY is required for OPENAI PXI eval runs")
        openai_provider = OpenAIProvider(
            openai_client=AsyncOpenAI(api_key=api_key or "sk-placeholder", base_url=base_url)
        )
        if os.getenv("PXI_E2E_ASSISTANT_OPENAI_API_TYPE", "responses") == "chat_completions":
            return OpenAIChatModel(model_name, provider=openai_provider)
        return OpenAIResponsesModel(model_name, provider=openai_provider)
    if provider == "AZURE_OPENAI":
        from openai import AsyncOpenAI
        from pydantic_ai.models.openai import OpenAIChatModel, OpenAIResponsesModel
        from pydantic_ai.providers.openai import OpenAIProvider

        api_key = os.getenv("AZURE_OPENAI_API_KEY")
        endpoint = os.getenv("AZURE_OPENAI_ENDPOINT")
        if not endpoint:
            raise RuntimeError("AZURE_OPENAI_ENDPOINT is required for AZURE_OPENAI PXI eval runs")
        openai_provider = OpenAIProvider(
            openai_client=AsyncOpenAI(
                api_key=api_key or "sk-placeholder",
                base_url=azure_endpoint_to_base_url(endpoint),
            )
        )
        if os.getenv("PXI_E2E_ASSISTANT_OPENAI_API_TYPE", "responses") == "chat_completions":
            return OpenAIChatModel(model_name, provider=openai_provider)
        return OpenAIResponsesModel(model_name, provider=openai_provider)
    if provider == "ANTHROPIC":
        from anthropic import AsyncAnthropic
        from pydantic_ai.models.anthropic import AnthropicModel, AnthropicModelSettings
        from pydantic_ai.providers.anthropic import AnthropicProvider

        api_key = os.getenv("ANTHROPIC_API_KEY")
        if not api_key:
            raise RuntimeError("ANTHROPIC_API_KEY is required for ANTHROPIC PXI eval runs")
        return AnthropicModel(
            model_name,
            provider=AnthropicProvider(anthropic_client=AsyncAnthropic(api_key=api_key)),
            settings=AnthropicModelSettings(
                anthropic_cache=True,
                anthropic_cache_instructions=True,
                anthropic_cache_tool_definitions=True,
            ),
        )
    raise RuntimeError(f"Unsupported PXI_E2E_ASSISTANT_PROVIDER for evals: {provider}")


def _build_dependencies() -> ChatDependencies:
    contexts = ResolvedContexts(
        project=ProjectContext(
            type="project",
            projectNodeId=os.getenv("PXI_E2E_PROJECT_NODE_ID", DEFAULT_PROJECT_NODE_ID),
            spanFilter="",
            rootSpansOnly=True,
        )
    )
    return ChatDependencies(
        user=None,
        db=_empty_db_context,
        contexts=contexts,
        capabilities=AgentCapabilities(),
        docs_mcp_toolset=None,
    )


def _jsonish(value: Any) -> Any:
    try:
        json.dumps(value)
    except TypeError:
        if hasattr(value, "model_dump"):
            return value.model_dump(mode="json")
        if hasattr(value, "__dict__"):
            return {
                key: _jsonish(item)
                for key, item in vars(value).items()
                if not key.startswith("_")
            }
        return repr(value)
    return value


def _normalize_tool_call(call: Any) -> ToolCall | None:
    name = getattr(call, "tool_name", None) or getattr(call, "name", None)
    args = getattr(call, "args", None) or getattr(call, "arguments", None)
    if args is None and hasattr(call, "args_as_dict"):
        args = call.args_as_dict()
    if isinstance(args, str):
        try:
            args = json.loads(args)
        except json.JSONDecodeError:
            args = {"__raw_args": args}
    if not isinstance(name, str):
        return None
    return ToolCall(name=name, args=args if isinstance(args, dict) else {"__raw_args": _jsonish(args)})


def normalize_agent_output(result: Any) -> AgentTaskOutput:
    output = getattr(result, "output", result)
    raw_output_type = type(output).__name__
    if isinstance(output, str):
        return AgentTaskOutput(assistant_text=output, raw_output_type=raw_output_type)
    if isinstance(output, DeferredToolRequests):
        calls = []
        for attr in ("calls", "tool_calls", "deferred_calls"):
            value = getattr(output, attr, None)
            if value:
                calls = list(value)
                break
        return AgentTaskOutput(
            tool_calls=[call for item in calls if (call := _normalize_tool_call(item)) is not None],
            raw_output_type=raw_output_type,
        )
    return AgentTaskOutput(
        assistant_text=str(output) if output is not None else None,
        raw_output_type=raw_output_type,
    )


async def run_pxi_example(input: dict[str, Any], *, stable_example_id: str | None = None) -> dict[str, Any]:
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


def build_task() -> Callable[[dict[str, Any]], dict[str, Any]]:
    def task(example: dict[str, Any]) -> dict[str, Any]:
        return asyncio.run(
            run_pxi_example(
                example["input"],
                stable_example_id=example.get("id"),
            )
        )

    return task

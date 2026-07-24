from __future__ import annotations

import json
import os
import sys
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Any, Literal, cast

from openinference.instrumentation import OITracer, TraceConfig
from opentelemetry.sdk.trace import TracerProvider
from pydantic_ai.agent import AgentRunResult
from pydantic_ai.mcp import MCPToolset
from pydantic_ai.messages import (
    ModelMessage,
    ModelRequest,
    ModelResponse,
    TextPart,
    ToolCallPart,
    ToolReturnPart,
    UserPromptPart,
)
from pydantic_ai.models import Model as PydanticAIModel

from phoenix.config import (
    get_env_allow_external_resources,
    get_env_collector_endpoint,
    get_env_disable_agent_assistant,
)
from phoenix.server.agents.agent_factory import build_agent
from phoenix.server.agents.capabilities import MintlifyDocsMCPServer
from phoenix.server.agents.context import (
    ChatContext,
    ProjectContext,
    ResolvedContexts,
    resolve_contexts,
)
from phoenix.server.agents.model_factory import (
    _build_openai_model as build_openai_model,
)
from phoenix.server.agents.model_factory import (
    azure_endpoint_to_base_url,
)
from phoenix.server.agents.pydantic_ai import OpenInferenceModelWrapper
from phoenix.server.agents.types import AgentDependencies, AgentOutput
from phoenix.server.dml_event import DmlEvent
from phoenix.server.types import CanPutItem, DbSessionFactory


@asynccontextmanager
async def _unavailable_db_session(_: Any) -> AsyncIterator[Any]:
    raise RuntimeError("PXI eval harness does not provide a Phoenix database.")
    yield


class _NoOpEventQueue:
    def put(self, item: DmlEvent) -> None:
        return None


DEFAULT_ASSISTANT_PROVIDER = "OPENAI"
DEFAULT_ASSISTANT_MODEL = "gpt-5.4"
DEFAULT_PROJECT_NODE_ID = "UHJvamVjdDox"
ENV_ASSISTANT_PROVIDER = "PHOENIX_AGENTS_ASSISTANT_PROVIDER"
ENV_ASSISTANT_MODEL = "PHOENIX_AGENTS_ASSISTANT_MODEL"
ENV_ASSISTANT_OPENAI_API_TYPE = "PHOENIX_AGENTS_ASSISTANT_OPENAI_API_TYPE"
_MAX_ERROR_MESSAGE_LEN = 200
_OFFLINE_DB = DbSessionFactory(db=_unavailable_db_session, dialect="sqlite")
_OFFLINE_EVENT_QUEUE: CanPutItem[DmlEvent] = _NoOpEventQueue()

# Fallback only: the pytest plugin's capture_spans relabels in-test spans to
# the experiment's project.
_STRAY_SPAN_PROJECT = "pxi-evals"

_tracer_provider: TracerProvider | None = None
_tracer_provider_built = False


def _get_tracer_provider() -> TracerProvider | None:
    """Process-local provider (built once per worker) exporting agent spans
    to the same Phoenix collector the pytest plugin uses. ``None`` when no
    collector is configured or setup fails, in which case the agent runs
    untraced."""
    global _tracer_provider, _tracer_provider_built
    if _tracer_provider_built:
        return _tracer_provider
    _tracer_provider_built = True
    if not get_env_collector_endpoint():
        return None
    try:
        from phoenix.otel import register

        _tracer_provider = register(
            project_name=_STRAY_SPAN_PROJECT,
            batch=True,
            set_global_tracer_provider=False,
            verbose=False,
            # Required: a bare collector endpoint is otherwise rewritten to gRPC :4317.
            protocol="http/protobuf",
        )
    except Exception as exc:  # noqa: BLE001
        print(
            f"warning: PXI eval agent tracing disabled ({type(exc).__name__}: {exc})",
            file=sys.stderr,
        )
    return _tracer_provider


def flush_agent_telemetry(timeout_millis: int = 30_000) -> None:
    """Flush buffered agent spans; conftest calls this at session finish on
    every process."""
    if _tracer_provider is None:
        return
    try:
        _tracer_provider.force_flush(timeout_millis)
    except Exception:  # noqa: BLE001
        pass


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
                max_retries=3,
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
                max_retries=3,
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
                anthropic_client=AsyncAnthropic(api_key=api_key, max_retries=3)
            ),
        )

    raise RuntimeError(f"Unsupported {ENV_ASSISTANT_PROVIDER} for evals: {provider}")


def should_build_docs_mcp_server() -> bool:
    """Mirror the production gate so callers know whether to build the toolset.

    The real server only constructs the docs MCP toolset when the agent
    assistant is not disabled and external resources are allowed.
    """
    return not get_env_disable_agent_assistant() and get_env_allow_external_resources()


def build_shared_docs_mcp_server() -> MCPToolset[Any] | None:
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


def _default_contexts() -> ResolvedContexts:
    contexts = ResolvedContexts(
        project=ProjectContext(
            type="project",
            project_node_id=DEFAULT_PROJECT_NODE_ID,
            span_filter="",
        )
    )
    return contexts


def _build_contexts(input: dict[str, Any]) -> ResolvedContexts:
    raw_contexts = input.get("contexts")
    if raw_contexts is None:
        return _default_contexts()
    if not isinstance(raw_contexts, list):
        raise ValueError("PXI eval input.contexts must be a list when provided")
    return resolve_contexts([ChatContext.model_validate(context) for context in raw_contexts])


def _build_dependencies(input: dict[str, Any]) -> AgentDependencies:
    contexts = _build_contexts(input)
    return AgentDependencies(contexts=contexts)


def _build_run_inputs(
    input: dict[str, Any],
) -> tuple[str | None, list[ModelMessage] | None]:
    """Translate ``input.messages`` into ``(user_prompt, message_history)``.

    Datasets describe an example as a single ``messages`` list -- the full
    conversation prefix the agent should enter the run with. The trailing
    entry drives which step of the agent loop is being scored:

    - **Last entry is ``role: user``.** That user turn is the new user prompt
      for this run; everything before it is replayed as ``message_history``.
    - **Last entry is ``role: tool``.** The harness invokes ``agent.run``
      with ``user_prompt=None`` and the full ``messages`` list as
      ``message_history``, so the agent picks up mid-loop from the primed
      tool return. The action it emits next is what gets scored.
    - **Last entry is ``role: assistant``.** Rejected: nothing remains for
      the agent to do.
    """
    raw_messages = input.get("messages")
    if not isinstance(raw_messages, list) or not raw_messages:
        raise ValueError("PXI eval input.messages must be a non-empty list")
    if not isinstance(raw_messages[-1], dict):
        raise ValueError("PXI eval input.messages[-1] must be an object")
    last_role = raw_messages[-1].get("role")
    if last_role == "user":
        content = raw_messages[-1].get("content")
        if not isinstance(content, str) or not content:
            raise ValueError(
                "PXI eval input.messages: final user turn must have non-empty string content"
            )
        prefix_messages = (
            _materialize_messages(raw_messages[:-1]) if len(raw_messages) > 1 else None
        )
        return content, prefix_messages
    if last_role == "tool":
        return None, _materialize_messages(raw_messages)
    raise ValueError(
        "PXI eval input.messages must end with a user turn (new prompt) or a tool "
        f"return (mid-loop continuation); got role={last_role!r}"
    )


def _materialize_messages(raw_messages: list[Any]) -> list[ModelMessage]:
    """Translate raw message dicts into pydantic_ai ``ModelMessage`` objects.

    Supports four entry shapes so an example can simulate a multi-turn session
    in which the agent has already executed tools, without the harness having
    to actually run those tools:

    1. ``{role: user, content: <str>}`` -- a user turn.
    2. ``{role: assistant, content: <str>}`` -- an assistant text turn.
    3. ``{role: assistant, tool_calls: [{id, name, args}, ...], content?: <str>}``
       -- an assistant turn that issued one or more tool calls (with optional
       accompanying text). ``id`` is a local string used to pair with the
       matching ``tool`` return below; it is passed through to pydantic_ai
       verbatim as the ``tool_call_id``.
    4. ``{role: tool, tool_call_id: <id>, name: <tool>, content: <str>}`` -- a
       tool return that the model previously observed. ``tool_call_id`` MUST
       reference an ``id`` declared on an earlier assistant ``tool_calls``
       entry in the same history; ``name`` MUST match.

    Primed tool calls + returns are exactly the same message shape pydantic_ai
    builds for genuinely-executed tools, so the model cannot tell the
    difference. This lets datasets isolate one step of agent behavior (e.g.
    "given a known latest-trace date, did set_spans_filter get the right
    args?") from the upstream discovery steps that would normally precede it.
    """
    if not isinstance(raw_messages, list):
        raise ValueError("PXI eval input.messages must be a list")

    messages: list[ModelMessage] = []
    # Tracks (tool_call_id -> tool_name) declared by prior assistant tool_calls
    # entries that have not yet been paired with a tool return.
    pending_tool_calls: dict[str, str] = {}
    # Tracks every tool_call_id ever declared (pending or already consumed) so a
    # later assistant turn can't reuse the same id even after it was returned.
    seen_tool_call_ids: set[str] = set()

    for index, item in enumerate(raw_messages):
        if not isinstance(item, dict):
            raise ValueError(f"PXI eval input.messages[{index}] must be an object")
        role = item.get("role")
        if role == "user":
            messages.append(_build_user_turn(item, index))
        elif role in {"assistant", "ai"}:
            messages.append(
                _build_assistant_turn(item, index, pending_tool_calls, seen_tool_call_ids)
            )
        elif role == "tool":
            messages.append(_build_tool_return_turn(item, index, pending_tool_calls))
        else:
            raise ValueError(
                f"PXI eval input.messages[{index}].role must be user, assistant, or tool"
            )

    if pending_tool_calls:
        raise ValueError(
            "PXI eval input.messages primed tool calls without matching tool returns: "
            f"{sorted(pending_tool_calls)}"
        )
    return messages


def _build_user_turn(item: dict[str, Any], index: int) -> ModelMessage:
    content = item.get("content")
    if not isinstance(content, str):
        raise ValueError(
            f"PXI eval input.messages[{index}].content must be a string for user turns"
        )
    return ModelRequest(parts=[UserPromptPart(content=content)])


def _build_assistant_turn(
    item: dict[str, Any],
    index: int,
    pending_tool_calls: dict[str, str],
    seen_tool_call_ids: set[str],
) -> ModelMessage:
    content = item.get("content")
    raw_tool_calls = item.get("tool_calls")
    if content is None and raw_tool_calls is None:
        raise ValueError(
            f"PXI eval input.messages[{index}] assistant turn must have content or tool_calls"
        )
    if content is not None and not isinstance(content, str):
        raise ValueError(f"PXI eval input.messages[{index}].content must be a string when provided")

    parts: list[Any] = []
    if isinstance(content, str):
        parts.append(TextPart(content=content))

    if raw_tool_calls is not None:
        if not isinstance(raw_tool_calls, list) or not raw_tool_calls:
            raise ValueError(
                f"PXI eval input.messages[{index}].tool_calls must be a non-empty list of objects"
            )
        for call_index, call in enumerate(raw_tool_calls):
            if not isinstance(call, dict):
                raise ValueError(
                    f"PXI eval input.messages[{index}].tool_calls[{call_index}] must be an object"
                )
            tool_call_id = call.get("id")
            tool_name = call.get("name")
            args = call.get("args", {})
            if not isinstance(tool_call_id, str) or not tool_call_id:
                raise ValueError(
                    f"PXI eval input.messages[{index}].tool_calls[{call_index}].id "
                    "must be a non-empty string"
                )
            if not isinstance(tool_name, str) or not tool_name:
                raise ValueError(
                    f"PXI eval input.messages[{index}].tool_calls[{call_index}].name "
                    "must be a non-empty string"
                )
            if not isinstance(args, (dict, str)):
                raise ValueError(
                    f"PXI eval input.messages[{index}].tool_calls[{call_index}].args "
                    "must be an object or a JSON string"
                )
            if tool_call_id in seen_tool_call_ids:
                raise ValueError(
                    f"PXI eval input.messages[{index}].tool_calls[{call_index}].id "
                    f"{tool_call_id!r} was already used earlier in the history"
                )
            seen_tool_call_ids.add(tool_call_id)
            pending_tool_calls[tool_call_id] = tool_name
            parts.append(ToolCallPart(tool_name=tool_name, args=args, tool_call_id=tool_call_id))

    return ModelResponse(parts=parts)


def _build_tool_return_turn(
    item: dict[str, Any],
    index: int,
    pending_tool_calls: dict[str, str],
) -> ModelMessage:
    tool_call_id = item.get("tool_call_id")
    tool_name = item.get("name")
    content = item.get("content")
    if not isinstance(tool_call_id, str) or not tool_call_id:
        raise ValueError(
            f"PXI eval input.messages[{index}].tool_call_id must be a non-empty string"
        )
    if not isinstance(tool_name, str) or not tool_name:
        raise ValueError(
            f"PXI eval input.messages[{index}].name must be a non-empty string for tool turns"
        )
    if not isinstance(content, str):
        raise ValueError(
            f"PXI eval input.messages[{index}].content must be a string for tool turns"
        )
    expected_name = pending_tool_calls.pop(tool_call_id, None)
    if expected_name is None:
        raise ValueError(
            f"PXI eval input.messages[{index}] tool return references unknown "
            f"tool_call_id {tool_call_id!r}; declare it on a prior assistant tool_calls entry"
        )
    if expected_name != tool_name:
        raise ValueError(
            f"PXI eval input.messages[{index}] tool return name {tool_name!r} "
            f"does not match prior tool call name {expected_name!r} for id {tool_call_id!r}"
        )
    return ModelRequest(
        parts=[
            ToolReturnPart(
                tool_name=tool_name,
                content=content,
                tool_call_id=tool_call_id,
                timestamp=datetime.now(timezone.utc),
            )
        ]
    )


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
    if assistant_text is None and isinstance(output, str):
        assistant_text = output

    return {
        "assistant_text": assistant_text,
        "messages": messages,
        "raw_output_type": type(output).__name__,
    }


def _example_input(example: dict[str, Any]) -> dict[str, Any]:
    input_value = example["input"]
    if not isinstance(input_value, dict):
        raise ValueError("PXI eval example.input must be an object")
    return input_value


def make_task(
    docs_mcp_server: MCPToolset[Any] | None = None,
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
        input_value = _example_input(example)
        return await run_pxi_example(
            input_value,
            stable_example_id=example.get("id"),
            docs_mcp_server=docs_mcp_server,
        )

    return task


async def task(example: dict[str, Any]) -> dict[str, Any]:
    """Backwards-compatible task callable that builds no docs MCP toolset.

    Prefer :func:`make_task` so the toolset is shared across concurrent
    runs. This entrypoint is kept for callers that don't need the docs
    toolset and for backwards compatibility with the original
    ``from evals.pxi.harness.agent_task import task`` import.
    """
    return await run_pxi_example(_example_input(example), stable_example_id=example.get("id"))


async def run_pxi_example(
    input: dict[str, Any],
    *,
    stable_example_id: str | None = None,
    docs_mcp_server: MCPToolset[Any] | None = None,
) -> dict[str, Any]:
    """Run a single PXI agent turn imperatively.

    ``input`` is an example input dict. ``input["messages"]`` is the full
    conversation prefix; the last entry decides whether the harness invokes
    the agent with a fresh user prompt or as a mid-loop continuation off a
    primed tool return (see :func:`_build_run_inputs`). Optional ``contexts``
    inject realistic Phoenix page state without launching a browser.
    Failures anywhere in setup or in ``agent.run`` are caught and returned
    with ``error`` set, so the failure report can still resolve a stable
    example ID for the row.

    ``docs_mcp_server`` should be a single shared, already-entered
    :class:`MCPToolset` (built via
    :func:`build_shared_docs_mcp_server` at the top of an async run, then
    entered with ``async with``). Pass ``None`` to skip the docs toolset.

    The returned ``error`` field is bounded in length and contains only the
    exception type plus a truncated message (no stack traces). When the
    harness is pointed at a shared Phoenix the value is uploaded as-is, so
    avoid pasting credentials into request URLs while debugging.
    """
    try:
        user_prompt, message_history = _build_run_inputs(input)
        model = await _build_model()
        tracer_provider = _get_tracer_provider()
        if tracer_provider is not None:
            # Mirrors model_factory.build_model: LLM spans come from the model wrapper.
            model = OpenInferenceModelWrapper(
                model,
                tracer=OITracer(
                    tracer_provider.get_tracer("phoenix.server.agents"),
                    config=TraceConfig(),
                ),
            )
        agent = build_agent(
            model=model,
            docs_mcp_server=docs_mcp_server,
            tracer_provider=tracer_provider,
            db=_OFFLINE_DB,
            event_queue=_OFFLINE_EVENT_QUEUE,
            read_only=True,
        )
        result = await agent.run(
            user_prompt,
            deps=_build_dependencies(input),
            message_history=message_history,
        )
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

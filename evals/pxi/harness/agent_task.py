from __future__ import annotations

import json
import os
import sys
from typing import Any, Literal, cast

from openinference.instrumentation import OITracer, TraceConfig
from opentelemetry.sdk.trace import TracerProvider
from pydantic_ai.agent import AgentRunResult
from pydantic_ai.mcp import MCPToolset
from pydantic_ai.messages import ModelMessage
from pydantic_ai.models import Model as PydanticAIModel

from evals.pxi.harness.backend import (
    EvalBackendCapability,
    eval_graphql_schema,
    eval_phoenix_mcp_server,
    unavailable_graphql_context,
)
from evals.pxi.harness.transcript import fixture_messages
from phoenix.config import (
    get_env_allow_external_resources,
    get_env_collector_endpoint,
    get_env_disable_agent_assistant,
)
from phoenix.db.types.data_stream_protocol.phoenix_types import PhoenixUIMessage
from phoenix.server.agents.agent_factory import build_agent
from phoenix.server.agents.capabilities import MintlifyDocsMCPServer
from phoenix.server.agents.context import (
    ChatContext,
    ResolvedContexts,
    resolve_contexts,
)
from phoenix.server.agents.model_factory import (
    _build_openai_model as build_openai_model,
)
from phoenix.server.agents.model_factory import (
    azure_endpoint_to_base_url,
)
from phoenix.server.agents.prompts import UI_STATE_TEMPLATE
from phoenix.server.agents.pydantic_ai import OpenInferenceModelWrapper
from phoenix.server.agents.types import AgentDependencies, AgentOutput
from phoenix.server.api.routers.agents import (
    _get_ui_contexts,
    _get_user_message_metadata,
    _prepend_ui_state_block,
    _prepend_ui_state_blocks_from_metadata,
    _render_ui_state,
    _resolve_browser_clock,
    _to_pydantic_ai_messages,
)

DEFAULT_ASSISTANT_PROVIDER = "OPENAI"
DEFAULT_ASSISTANT_MODEL = "gpt-5.4"
DEFAULT_ASSISTANT_OPENAI_API_TYPE = "responses"
ENV_ASSISTANT_PROVIDER = "PHOENIX_AGENTS_ASSISTANT_PROVIDER"
ENV_ASSISTANT_MODEL = "PHOENIX_AGENTS_ASSISTANT_MODEL"
ENV_ASSISTANT_OPENAI_API_TYPE = "PHOENIX_AGENTS_ASSISTANT_OPENAI_API_TYPE"
_MAX_ERROR_MESSAGE_LEN = 200

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
    openai_api_type = os.getenv(ENV_ASSISTANT_OPENAI_API_TYPE, DEFAULT_ASSISTANT_OPENAI_API_TYPE)
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


def _build_contexts(input: dict[str, Any]) -> ResolvedContexts:
    raw_contexts = input.get("contexts", [])
    if not isinstance(raw_contexts, list):
        raise ValueError("PXI eval input.contexts must be a list when provided")
    messages = fixture_messages(input["messages"]) if "messages" in input else []
    if "contexts" not in input:
        for message in reversed(messages):
            metadata = _get_user_message_metadata(message)
            if metadata is not None and metadata.ui_contexts is not None:
                raw_contexts = list(
                    metadata.ui_contexts.model_dump(exclude_none=True, by_alias=True).values()
                )
                break
    contexts = resolve_contexts([ChatContext.model_validate(context) for context in raw_contexts])
    if (clock := _resolve_browser_clock(messages)) is not None:
        contexts.app = clock
    return contexts


def _build_dependencies(input: dict[str, Any]) -> AgentDependencies:
    messages = fixture_messages(input["messages"]) if "messages" in input else []
    edit_permission = input.get("editPermission")
    if edit_permission is None:
        for message in reversed(messages):
            if (metadata := _get_user_message_metadata(message)) is not None:
                edit_permission = metadata.edit_permission
                break
    if edit_permission is None:
        edit_permission = "manual"
    if edit_permission not in ("manual", "bypass"):
        raise ValueError("PXI eval input.editPermission must be manual or bypass")
    return AgentDependencies(
        contexts=_build_contexts(input),
        edit_permission=cast(Literal["manual", "bypass"], edit_permission),
    )


def _ui_state_block(deps: AgentDependencies) -> str:
    return _render_ui_state(
        _get_ui_contexts(deps.contexts), deps.edit_permission, template=UI_STATE_TEMPLATE
    )


def _prepare_transcript(input: dict[str, Any]) -> list[PhoenixUIMessage]:
    messages = fixture_messages(input.get("messages"))
    rendered = _prepend_ui_state_blocks_from_metadata(messages)
    # Legacy shorthand has no persisted metadata. Its top-level contexts describe
    # the active turn, including a continuation after a primed tool result.
    for index in range(len(messages) - 1, -1, -1):
        message = messages[index]
        if message.role != "user":
            continue
        metadata = _get_user_message_metadata(message)
        if metadata is None or metadata.ui_contexts is None:
            rendered[index] = _prepend_ui_state_block(
                rendered[index], _ui_state_block(_build_dependencies(input))
            )
        elif "contexts" in input or "editPermission" in input:
            raise ValueError(
                "Use per-turn metadata for public transcripts; do not also supply "
                "top-level contexts or editPermission"
            )
        break
    return rendered


def _build_run_inputs(
    input: dict[str, Any],
) -> tuple[None, list[ModelMessage]]:
    """Replay a public session transcript through the production chat adapter.

    The transcript includes the latest user message or completed tool output.
    Returning no separate prompt lets Phoenix's adapter preserve message parts,
    structured outputs and per-turn state exactly as it does for stored sessions.
    """
    return None, _to_pydantic_ai_messages(_prepare_transcript(input))


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

    ``input["messages"]`` is a public session transcript or compact fixture
    notation compiled to one. The last entry supplies a new user message or a
    completed tool output. The production adapter prepares the model history.
    Optional ``contexts`` supplies the active turn's page state for compact
    fixtures; public transcripts carry it in each user message's metadata.
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
        deps = _build_dependencies(input)
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
            name="PXIAgent",
            headless=False,
            model=model,
            docs_mcp_server=docs_mcp_server,
            phoenix_mcp_server=eval_phoenix_mcp_server(),
            schema=eval_graphql_schema(),
            build_graphql_context=unavailable_graphql_context,
            tracer_provider=tracer_provider,
            read_only=True,
        )
        result = await agent.run(
            user_prompt,
            deps=deps,
            message_history=message_history,
            capabilities=[EvalBackendCapability()],
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

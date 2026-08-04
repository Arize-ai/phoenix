from __future__ import annotations

import json
from collections.abc import Iterable
from dataclasses import dataclass, field
from typing import Any
from unittest.mock import Mock

import httpx
import pytest
from anthropic.types.beta import (
    BetaContentBlockParam,
    BetaMessage,
    BetaMessageParam,
    BetaTextBlock,
    BetaTextBlockParam,
    BetaUsage,
)
from anthropic.types.beta.message_create_params import MessageCreateParams
from jinja2 import Template
from opentelemetry.trace import NoOpTracerProvider
from pydantic_ai import RunContext, UserError
from pydantic_ai.models.anthropic import AnthropicModel
from pydantic_ai.models.test import TestModel
from pydantic_ai.native_tools import WebFetchTool, WebSearchTool
from pydantic_ai.profiles import ModelProfile
from pydantic_ai.providers.anthropic import AnthropicProvider
from typing_extensions import TypeIs, assert_never

from phoenix.server.agents.agent_factory import build_agent as _build_agent
from phoenix.server.agents.capabilities import (
    MintlifyDocsMCPServer,
    build_anthropic_prompt_cache_capability,
)
from phoenix.server.agents.context import (
    AgentSpanContext,
    CodeEvaluatorContext,
    DatasetContext,
    LlmEvaluatorContext,
    PlaygroundBuiltinModelContext,
    PlaygroundContext,
    PlaygroundEvaluatorContext,
    PlaygroundInstanceContext,
    ProjectContext,
    ResolvedContexts,
)
from phoenix.server.agents.prompts import AgentPrompts
from phoenix.server.agents.pydantic_ai import OpenInferenceModelWrapper
from phoenix.server.agents.types import (
    AgentDependencies,
    ModelProviderAvailability,
    SandboxAvailability,
)
from phoenix.server.types import DbSessionFactory

_DEFAULT_PROMPTS = AgentPrompts()


def build_agent(**kwargs: Any) -> Any:
    """Build an agent for factory tests with inert DB-backed tool dependencies."""
    kwargs.setdefault("db", Mock(spec=DbSessionFactory))
    kwargs.setdefault("event_queue", Mock())
    return _build_agent(**kwargs)


STATIC_TOOL_INSTRUCTIONS: frozenset[str] = frozenset(
    {
        _DEFAULT_PROMPTS.bash_tool.render(),
        _DEFAULT_PROMPTS.ask_user_tool.render(),
        _DEFAULT_PROMPTS.set_time_range_tool.render(),
        _DEFAULT_PROMPTS.get_current_datetime_tool.render(),
        _DEFAULT_PROMPTS.get_route_info_tool.render(),
    }
)

DYNAMIC_TOOL_INSTRUCTIONS: frozenset[str] = frozenset(
    {
        _DEFAULT_PROMPTS.set_spans_filter_tool.render(),
        _DEFAULT_PROMPTS.set_playground_model_tool.render(),
        _DEFAULT_PROMPTS.list_playground_model_targets_tool.render(),
        _DEFAULT_PROMPTS.read_prompt_instance_tool.render(),
        _DEFAULT_PROMPTS.read_playground_output_tool.render(),
        _DEFAULT_PROMPTS.clone_prompt_instance_tool.render(),
        _DEFAULT_PROMPTS.add_prompt_instance_tool.render(),
        _DEFAULT_PROMPTS.remove_prompt_instance_tool.render(),
        _DEFAULT_PROMPTS.edit_prompt_instance_tool.render(),
        _DEFAULT_PROMPTS.save_prompt_tool.render(),
        _DEFAULT_PROMPTS.run_playground_tool.render(),
        _DEFAULT_PROMPTS.cancel_playground_run_tool.render(),
        _DEFAULT_PROMPTS.set_variable_values_tool.render(),
        _DEFAULT_PROMPTS.set_playground_experiment_recording_tool.render(),
        _DEFAULT_PROMPTS.set_playground_repetitions_tool.render(),
        _DEFAULT_PROMPTS.set_appended_messages_path_tool.render(),
        _DEFAULT_PROMPTS.load_dataset_tool.render(),
    }
)


@dataclass
class CapturedRequest:
    """Holds the JSON body of every Anthropic request the agent triggers."""

    bodies: list[MessageCreateParams] = field(default_factory=list)

    @property
    def body(self) -> MessageCreateParams:
        assert len(self.bodies) == 1, f"expected exactly 1 request, got {len(self.bodies)}"
        return self.bodies[0]


@pytest.fixture
def anthropic_api_key(monkeypatch: pytest.MonkeyPatch) -> str:
    """Set ``ANTHROPIC_API_KEY`` so any client constructed without an injected
    transport fails fast on real network reach-out, and return the value for
    callers that need to pass it explicitly."""
    api_key = "sk-test"
    monkeypatch.setenv("ANTHROPIC_API_KEY", api_key)
    return api_key


@pytest.fixture
def captured_request() -> CapturedRequest:
    return CapturedRequest()


@pytest.fixture
def anthropic_model(
    anthropic_api_key: str,
    captured_request: CapturedRequest,
) -> AnthropicModel:
    """An ``AnthropicModel`` whose underlying HTTP client is an
    ``httpx.MockTransport``."""

    def handler(request: httpx.Request) -> httpx.Response:
        captured_request.bodies.append(json.loads(request.read()))
        stub_response = BetaMessage(
            id="msg_test",
            type="message",
            role="assistant",
            model="claude-haiku-4-5",
            content=[BetaTextBlock(type="text", text="ok", citations=None)],
            stop_reason="end_turn",
            stop_sequence=None,
            usage=BetaUsage(input_tokens=1, output_tokens=1),
        )
        return httpx.Response(200, json=stub_response.model_dump(mode="json"))

    http_client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    provider = AnthropicProvider(api_key=anthropic_api_key, http_client=http_client)
    return AnthropicModel("claude-haiku-4-5", provider=provider)


@pytest.fixture
def wrapped_anthropic_model(
    anthropic_model: AnthropicModel,
) -> OpenInferenceModelWrapper:
    """An ``AnthropicModel`` wrapped as production wraps it — ``build_model``
    always returns an ``OpenInferenceModelWrapper``."""
    return OpenInferenceModelWrapper(
        anthropic_model,
        tracer=NoOpTracerProvider().get_tracer("test"),
    )


class TestPromptCacheCapabilityMounting:
    """The prompt-cache capability mounts through the production model wrapper."""

    def test_builder_returns_capability_for_bare_anthropic_model(
        self, anthropic_model: AnthropicModel
    ) -> None:
        assert build_anthropic_prompt_cache_capability(anthropic_model) is not None

    def test_builder_returns_capability_through_wrapper(
        self, wrapped_anthropic_model: OpenInferenceModelWrapper
    ) -> None:
        assert build_anthropic_prompt_cache_capability(wrapped_anthropic_model) is not None

    def test_builder_returns_none_for_non_anthropic_model(self) -> None:
        assert build_anthropic_prompt_cache_capability(TestModel()) is None

    def test_builder_returns_none_for_wrapped_non_anthropic_model(self) -> None:
        wrapped = OpenInferenceModelWrapper(
            TestModel(), tracer=NoOpTracerProvider().get_tracer("test")
        )
        assert build_anthropic_prompt_cache_capability(wrapped) is None

    async def test_wrapped_model_emits_cache_breakpoint_end_to_end(
        self,
        wrapped_anthropic_model: OpenInferenceModelWrapper,
        captured_request: CapturedRequest,
    ) -> None:
        agent = build_agent(model=wrapped_anthropic_model)
        deps = AgentDependencies(contexts=ResolvedContexts())

        await agent.run("hello", deps=deps)

        cached_blocks, _ = _partition_system_blocks_by_cache_breakpoint(captured_request.body)
        assert _DEFAULT_PROMPTS.base.render() in _get_concatenated_text(cached_blocks)


class _OfflineDocsMCPToolset(MintlifyDocsMCPServer):
    """``MintlifyDocsMCPServer`` with the MCP transport short-circuited.

    Overrides ``get_tools`` to return an empty tool dict and the async
    context-manager protocol to no-op, so the agent run never opens an
    HTTP/SSE session to the real Mintlify endpoint.
    """

    async def get_tools(self, ctx: RunContext[Any]) -> dict[str, Any]:
        return {}

    async def __aenter__(self) -> "_OfflineDocsMCPToolset":
        return self

    async def __aexit__(self, *args: object) -> None:
        return None


@pytest.fixture
def docs_mcp_server() -> _OfflineDocsMCPToolset:
    return _OfflineDocsMCPToolset()


@pytest.fixture
def model_with_web_access() -> TestModel:
    """Model whose profile advertises both native web tools."""
    return TestModel(
        call_tools=[],
        profile=ModelProfile(
            supported_native_tools=frozenset({WebSearchTool, WebFetchTool}),
        ),
    )


@pytest.fixture
def model_without_web_access() -> TestModel:
    """Model whose profile advertises no native web tools."""
    return TestModel(
        call_tools=[],
        profile=ModelProfile(supported_native_tools=frozenset()),
    )


def _get_system_text_blocks(body: MessageCreateParams) -> list[BetaTextBlockParam]:
    """Return the ``system`` field normalized to a list of text block params."""
    system: str | Iterable[BetaTextBlockParam] | None = body.get("system")
    if system is None:
        return []
    if isinstance(system, str):
        return [BetaTextBlockParam(type="text", text=system)]
    if isinstance(system, Iterable):
        return list(system)
    assert_never(system)


def _get_system_texts(body: MessageCreateParams) -> list[str]:
    return [block["text"] for block in _get_system_text_blocks(body) if block.get("type") == "text"]


def _partition_system_blocks_by_cache_breakpoint(
    body: MessageCreateParams,
) -> tuple[list[BetaTextBlockParam], list[BetaTextBlockParam]]:
    """Split the system blocks at the single ``cache_control`` marker.

    Returns ``(cached_blocks, uncached_blocks)`` where ``cached_blocks`` is
    every block up to and including the marker — the prefix Anthropic will
    cache — and ``uncached_blocks`` is every block after it. Pydantic-ai
    sets exactly one marker per request
    when ``anthropic_cache_instructions`` is enabled; zero or multiple markers
    indicate a fixture or model-settings misconfiguration and surface as an
    ``AssertionError`` here rather than a misleading split.
    """
    blocks = _get_system_text_blocks(body)
    indices = [idx for idx, block in enumerate(blocks) if block.get("cache_control") is not None]
    assert len(indices) == 1, (
        f"expected exactly 1 system block to carry cache_control, "
        f"got {len(indices)} at indices {indices}"
    )
    [marker_idx] = indices
    return blocks[: marker_idx + 1], blocks[marker_idx + 1 :]


def _get_last_user_message(body: MessageCreateParams) -> BetaMessageParam:
    user_msgs = [msg for msg in body["messages"] if msg["role"] == "user"]
    return user_msgs[-1]


def _is_text_block(block: BetaContentBlockParam) -> TypeIs[BetaTextBlockParam]:
    return isinstance(block, dict) and block.get("type") == "text"


def _get_last_user_text_contents(body: MessageCreateParams) -> list[str]:
    """Return the text of every text block on the trailing user message."""
    content = _get_last_user_message(body)["content"]
    if isinstance(content, str):
        return [content]
    return [block["text"] for block in content if _is_text_block(block)]


def _get_concatenated_text(blocks: list[BetaTextBlockParam]) -> str:
    """Concatenate all text-block contents into one searchable string."""
    return "\n".join(block["text"] for block in blocks if block.get("type") == "text")


def _get_tool_names(body: MessageCreateParams) -> set[str]:
    """Return the set of tool names advertised on the Anthropic request."""
    tools = body.get("tools") or []
    names: set[str] = set()
    for tool in tools:
        raw_name = tool.get("name")
        if isinstance(raw_name, str):
            names.add(raw_name)
    return names


class TestSystemBlockCacheBoundary:
    """Every system block lands on the correct side of the cache breakpoint."""

    async def test_static_agent_instructions_are_inside_cache_boundary(
        self,
        anthropic_model: AnthropicModel,
        captured_request: CapturedRequest,
    ) -> None:
        agent = build_agent(model=anthropic_model)
        deps = AgentDependencies(contexts=ResolvedContexts())

        await agent.run("hello", deps=deps)

        cached_blocks, _ = _partition_system_blocks_by_cache_breakpoint(captured_request.body)
        assert _DEFAULT_PROMPTS.base.render() in _get_concatenated_text(cached_blocks)

    async def test_static_tool_instructions_are_inside_cache_boundary(
        self,
        anthropic_model: AnthropicModel,
        captured_request: CapturedRequest,
    ) -> None:
        agent = build_agent(model=anthropic_model)
        deps = AgentDependencies(contexts=ResolvedContexts())

        await agent.run("hello", deps=deps)

        cached_blocks, _ = _partition_system_blocks_by_cache_breakpoint(captured_request.body)
        cached_text = _get_concatenated_text(cached_blocks)
        for static_prompt in STATIC_TOOL_INSTRUCTIONS:
            assert static_prompt in cached_text

    async def test_dynamic_tool_instructions_are_outside_cache_boundary(
        self,
        anthropic_model: AnthropicModel,
        captured_request: CapturedRequest,
    ) -> None:
        agent = build_agent(model=anthropic_model)
        deps = AgentDependencies(
            contexts=ResolvedContexts(
                playground=PlaygroundContext(type="playground"),
                project=ProjectContext(
                    type="project",
                    project_node_id="UHJvamVjdDox",
                    span_filter="",
                ),
            ),
        )

        await agent.run("hello", deps=deps)

        _, uncached_blocks = _partition_system_blocks_by_cache_breakpoint(captured_request.body)
        uncached_text = _get_concatenated_text(uncached_blocks)
        for dynamic_prompt in DYNAMIC_TOOL_INSTRUCTIONS:
            assert dynamic_prompt in uncached_text

    async def test_cache_breakpoint_separates_static_from_dynamic_content(
        self,
        anthropic_model: AnthropicModel,
        captured_request: CapturedRequest,
    ) -> None:
        """Everything before the cache marker must be static; everything
        after must be dynamic. Static content includes the base instructions
        and every static tool capability's text; dynamic content includes
        every dynamic tool's text and the GraphQL mutations policy."""
        agent = build_agent(model=anthropic_model)
        deps = AgentDependencies(
            contexts=ResolvedContexts(
                playground=PlaygroundContext(type="playground"),
                project=ProjectContext(
                    type="project",
                    project_node_id="UHJvamVjdDox",
                    span_filter="",
                ),
            ),
        )

        await agent.run("hello", deps=deps)

        cached_blocks, uncached_blocks = _partition_system_blocks_by_cache_breakpoint(
            captured_request.body
        )
        cached_text = _get_concatenated_text(cached_blocks)
        uncached_text = _get_concatenated_text(uncached_blocks)

        assert _DEFAULT_PROMPTS.base.render() in cached_text
        for static_prompt in STATIC_TOOL_INSTRUCTIONS:
            assert static_prompt in cached_text
            assert static_prompt not in uncached_text
        for dynamic_prompt in DYNAMIC_TOOL_INSTRUCTIONS:
            assert dynamic_prompt in uncached_text
            assert dynamic_prompt not in cached_text

    async def test_no_cache_breakpoint_is_marked_on_dynamic_system_blocks(
        self,
        anthropic_model: AnthropicModel,
        captured_request: CapturedRequest,
    ) -> None:
        agent = build_agent(model=anthropic_model)
        deps = AgentDependencies(
            contexts=ResolvedContexts(
                playground=PlaygroundContext(type="playground"),
                project=ProjectContext(
                    type="project",
                    project_node_id="UHJvamVjdDox",
                    span_filter="",
                ),
            ),
        )

        await agent.run("hello", deps=deps)

        cached_blocks, _ = _partition_system_blocks_by_cache_breakpoint(captured_request.body)
        cached_text = _get_concatenated_text(cached_blocks)
        for dynamic_prompt in DYNAMIC_TOOL_INSTRUCTIONS:
            assert dynamic_prompt not in cached_text


class TestUIContextInstructions:
    async def test_playground_context_selected_models_are_outside_cache_boundary(
        self,
        anthropic_model: AnthropicModel,
        captured_request: CapturedRequest,
    ) -> None:
        agent = build_agent(model=anthropic_model)
        deps = AgentDependencies(
            contexts=ResolvedContexts(
                playground=PlaygroundContext(
                    type="playground",
                    instances=[
                        PlaygroundInstanceContext(
                            instance_id=7,
                            model=PlaygroundBuiltinModelContext(
                                type="builtin",
                                provider="OPENAI",
                                model_name="gpt-5",
                            ),
                        )
                    ],
                )
            ),
        )

        await agent.run("hello", deps=deps)

        cached_blocks, uncached_blocks = _partition_system_blocks_by_cache_breakpoint(
            captured_request.body
        )
        cached_text = _get_concatenated_text(cached_blocks)
        uncached_text = _get_concatenated_text(uncached_blocks)
        playground_context_fragments = (
            '<instance label="A" instanceId="7" provider="OPENAI" modelName="gpt-5"/>',
            "list_playground_model_targets",
            "set_playground_model",
        )
        for fragment in playground_context_fragments:
            assert fragment in uncached_text
            assert fragment not in cached_text

    async def test_ui_context_instructions_are_outside_cache_boundary(
        self,
        anthropic_model: AnthropicModel,
        captured_request: CapturedRequest,
    ) -> None:
        """Changes to UI state (project, span filter, playground instances,
        etc.) must not invalidate the cached prefix."""
        agent = build_agent(model=anthropic_model)
        deps = AgentDependencies(
            contexts=ResolvedContexts(
                project=ProjectContext(
                    type="project",
                    project_node_id="UHJvamVjdDox",
                    span_filter='status_code == "ERROR"',
                ),
            ),
        )

        await agent.run("hello", deps=deps)

        cached_blocks, uncached_blocks = _partition_system_blocks_by_cache_breakpoint(
            captured_request.body
        )
        cached_texts = "\n".join(
            block["text"] for block in cached_blocks if block.get("type") == "text"
        )
        uncached_texts = "\n".join(
            block["text"] for block in uncached_blocks if block.get("type") == "text"
        )
        assert "<phoenix_project_context>" in uncached_texts
        assert "<phoenix_gql_mutations_policy>" in uncached_texts
        assert "<phoenix_project_context>" not in cached_texts
        assert "<phoenix_gql_mutations_policy>" not in cached_texts

    async def test_ui_context_instructions_are_absent_when_context_is_empty(
        self,
        anthropic_model: AnthropicModel,
        captured_request: CapturedRequest,
    ) -> None:
        agent = build_agent(model=anthropic_model)
        deps = AgentDependencies(contexts=ResolvedContexts())

        await agent.run("hello", deps=deps)

        all_text = "\n".join(_get_system_texts(captured_request.body))
        for tag in (
            "<phoenix_project_context>",
            "<phoenix_trace_context>",
            "<phoenix_span_context>",
            "<phoenix_playground_context>",
        ):
            assert tag not in all_text
        cached_blocks, uncached_blocks = _partition_system_blocks_by_cache_breakpoint(
            captured_request.body
        )
        uncached_texts = "\n".join(
            block["text"] for block in uncached_blocks if block.get("type") == "text"
        )
        cached_texts = "\n".join(
            block["text"] for block in cached_blocks if block.get("type") == "text"
        )
        assert "<phoenix_gql_mutations_policy>" in uncached_texts
        assert "<phoenix_gql_mutations_policy>" not in cached_texts
        assert "<phoenix_app_context>" in cached_texts
        assert "<phoenix_app_context>" not in uncached_texts


class TestRouteInfoTool:
    async def test_get_route_info_tool_is_advertised_by_default(
        self,
        anthropic_model: AnthropicModel,
        captured_request: CapturedRequest,
    ) -> None:
        agent = build_agent(model=anthropic_model)
        deps = AgentDependencies(contexts=ResolvedContexts())

        await agent.run("hello", deps=deps)

        assert "get_route_info" in _get_tool_names(captured_request.body)
        joined_system = "\n".join(_get_system_texts(captured_request.body))
        assert '<tool name="get_route_info">' in joined_system
        assert "do not render its `path` as a markdown link" in joined_system


class TestAddDatasetExamplesTool:
    async def test_advertised_with_dataset_context(
        self,
        anthropic_model: AnthropicModel,
        captured_request: CapturedRequest,
    ) -> None:
        agent = build_agent(model=anthropic_model)
        deps = AgentDependencies(
            contexts=ResolvedContexts(
                dataset=DatasetContext(type="dataset", dataset_node_id="RGF0YXNldDox"),
            ),
        )

        await agent.run("hello", deps=deps)

        assert "add_dataset_examples" in _get_tool_names(captured_request.body)
        joined_system = "\n".join(_get_system_texts(captured_request.body))
        assert '<tool name="add_dataset_examples">' in joined_system

    async def test_absent_without_dataset_context(
        self,
        anthropic_model: AnthropicModel,
        captured_request: CapturedRequest,
    ) -> None:
        agent = build_agent(model=anthropic_model)
        deps = AgentDependencies(contexts=ResolvedContexts())

        await agent.run("hello", deps=deps)

        assert "add_dataset_examples" not in _get_tool_names(captured_request.body)

    async def test_hidden_for_viewer_but_read_tool_remains(
        self,
        anthropic_model: AnthropicModel,
        captured_request: CapturedRequest,
    ) -> None:
        agent = build_agent(model=anthropic_model)
        deps = AgentDependencies(
            contexts=ResolvedContexts(
                dataset=DatasetContext(type="dataset", dataset_node_id="RGF0YXNldDox"),
            ),
            is_viewer=True,
        )

        await agent.run("hello", deps=deps)

        tool_names = _get_tool_names(captured_request.body)
        assert "add_dataset_examples" not in tool_names
        # Reads stay available to viewers.
        assert "list_dataset_examples" in tool_names


class TestListDatasetSplitsTool:
    async def test_advertised_with_dataset_context(
        self,
        anthropic_model: AnthropicModel,
        captured_request: CapturedRequest,
    ) -> None:
        agent = build_agent(model=anthropic_model)
        deps = AgentDependencies(
            contexts=ResolvedContexts(
                dataset=DatasetContext(type="dataset", dataset_node_id="RGF0YXNldDox"),
            ),
        )

        await agent.run("hello", deps=deps)

        assert "list_dataset_splits" in _get_tool_names(captured_request.body)

    async def test_absent_without_dataset_context(
        self,
        anthropic_model: AnthropicModel,
        captured_request: CapturedRequest,
    ) -> None:
        agent = build_agent(model=anthropic_model)
        deps = AgentDependencies(contexts=ResolvedContexts())

        await agent.run("hello", deps=deps)

        assert "list_dataset_splits" not in _get_tool_names(captured_request.body)


class TestDatasetSplitWriteTools:
    _WRITE_TOOLS = ("create_dataset_split", "set_dataset_example_splits")

    async def test_advertised_with_dataset_context(
        self,
        anthropic_model: AnthropicModel,
        captured_request: CapturedRequest,
    ) -> None:
        agent = build_agent(model=anthropic_model)
        deps = AgentDependencies(
            contexts=ResolvedContexts(
                dataset=DatasetContext(type="dataset", dataset_node_id="RGF0YXNldDox"),
            ),
        )

        await agent.run("hello", deps=deps)

        tool_names = _get_tool_names(captured_request.body)
        for name in self._WRITE_TOOLS:
            assert name in tool_names

    async def test_hidden_for_viewer(
        self,
        anthropic_model: AnthropicModel,
        captured_request: CapturedRequest,
    ) -> None:
        agent = build_agent(model=anthropic_model)
        deps = AgentDependencies(
            contexts=ResolvedContexts(
                dataset=DatasetContext(type="dataset", dataset_node_id="RGF0YXNldDox"),
            ),
            is_viewer=True,
        )

        await agent.run("hello", deps=deps)

        tool_names = _get_tool_names(captured_request.body)
        for name in self._WRITE_TOOLS:
            assert name not in tool_names
        # The split read tool stays available to viewers.
        assert "list_dataset_splits" in tool_names

    async def test_absent_without_dataset_context(
        self,
        anthropic_model: AnthropicModel,
        captured_request: CapturedRequest,
    ) -> None:
        agent = build_agent(model=anthropic_model)
        deps = AgentDependencies(contexts=ResolvedContexts())

        await agent.run("hello", deps=deps)

        tool_names = _get_tool_names(captured_request.body)
        for name in self._WRITE_TOOLS:
            assert name not in tool_names


class TestDatasetLabelTools:
    _WRITE_TOOLS = ("create_dataset_label", "set_dataset_labels")

    async def test_advertised_with_dataset_context(
        self,
        anthropic_model: AnthropicModel,
        captured_request: CapturedRequest,
    ) -> None:
        agent = build_agent(model=anthropic_model)
        deps = AgentDependencies(
            contexts=ResolvedContexts(
                dataset=DatasetContext(type="dataset", dataset_node_id="RGF0YXNldDox"),
            ),
        )

        await agent.run("hello", deps=deps)

        tool_names = _get_tool_names(captured_request.body)
        assert "list_dataset_labels" in tool_names
        for name in self._WRITE_TOOLS:
            assert name in tool_names

    async def test_writes_hidden_for_viewer_but_read_remains(
        self,
        anthropic_model: AnthropicModel,
        captured_request: CapturedRequest,
    ) -> None:
        agent = build_agent(model=anthropic_model)
        deps = AgentDependencies(
            contexts=ResolvedContexts(
                dataset=DatasetContext(type="dataset", dataset_node_id="RGF0YXNldDox"),
            ),
            is_viewer=True,
        )

        await agent.run("hello", deps=deps)

        tool_names = _get_tool_names(captured_request.body)
        assert "list_dataset_labels" in tool_names
        for name in self._WRITE_TOOLS:
            assert name not in tool_names

    async def test_absent_without_dataset_context(
        self,
        anthropic_model: AnthropicModel,
        captured_request: CapturedRequest,
    ) -> None:
        agent = build_agent(model=anthropic_model)
        deps = AgentDependencies(contexts=ResolvedContexts())

        await agent.run("hello", deps=deps)

        tool_names = _get_tool_names(captured_request.body)
        assert "list_dataset_labels" not in tool_names
        for name in self._WRITE_TOOLS:
            assert name not in tool_names


class TestAddSpanToDatasetTool:
    async def test_advertised_with_span_context(
        self,
        anthropic_model: AnthropicModel,
        captured_request: CapturedRequest,
    ) -> None:
        agent = build_agent(model=anthropic_model)
        deps = AgentDependencies(
            contexts=ResolvedContexts(
                span=AgentSpanContext(type="span", span_node_id="U3Bhbjox"),
            ),
        )

        await agent.run("hello", deps=deps)

        assert "add_spans_to_dataset" in _get_tool_names(captured_request.body)

    async def test_hidden_for_viewer(
        self,
        anthropic_model: AnthropicModel,
        captured_request: CapturedRequest,
    ) -> None:
        agent = build_agent(model=anthropic_model)
        deps = AgentDependencies(
            contexts=ResolvedContexts(
                span=AgentSpanContext(type="span", span_node_id="U3Bhbjox"),
            ),
            is_viewer=True,
        )

        await agent.run("hello", deps=deps)

        assert "add_spans_to_dataset" not in _get_tool_names(captured_request.body)

    async def test_absent_without_span_context(
        self,
        anthropic_model: AnthropicModel,
        captured_request: CapturedRequest,
    ) -> None:
        agent = build_agent(model=anthropic_model)
        deps = AgentDependencies(
            contexts=ResolvedContexts(
                dataset=DatasetContext(type="dataset", dataset_node_id="RGF0YXNldDox"),
            ),
        )

        await agent.run("hello", deps=deps)

        assert "add_spans_to_dataset" not in _get_tool_names(captured_request.body)


class TestDatasetCrudTools:
    _WRITE_TOOLS = (
        "patch_dataset",
        "delete_dataset",
        "patch_dataset_examples",
        "delete_dataset_examples",
        "patch_dataset_split",
        "delete_dataset_splits",
        "delete_dataset_labels",
    )

    async def test_advertised_with_dataset_context(
        self,
        anthropic_model: AnthropicModel,
        captured_request: CapturedRequest,
    ) -> None:
        agent = build_agent(model=anthropic_model)
        deps = AgentDependencies(
            contexts=ResolvedContexts(
                dataset=DatasetContext(type="dataset", dataset_node_id="RGF0YXNldDox"),
            ),
        )

        await agent.run("hello", deps=deps)

        tool_names = _get_tool_names(captured_request.body)
        for name in self._WRITE_TOOLS:
            assert name in tool_names

    async def test_hidden_for_viewer(
        self,
        anthropic_model: AnthropicModel,
        captured_request: CapturedRequest,
    ) -> None:
        agent = build_agent(model=anthropic_model)
        deps = AgentDependencies(
            contexts=ResolvedContexts(
                dataset=DatasetContext(type="dataset", dataset_node_id="RGF0YXNldDox"),
            ),
            is_viewer=True,
        )

        await agent.run("hello", deps=deps)

        tool_names = _get_tool_names(captured_request.body)
        for name in self._WRITE_TOOLS:
            assert name not in tool_names

    async def test_absent_without_dataset_context(
        self,
        anthropic_model: AnthropicModel,
        captured_request: CapturedRequest,
    ) -> None:
        agent = build_agent(model=anthropic_model)
        deps = AgentDependencies(contexts=ResolvedContexts())

        await agent.run("hello", deps=deps)

        tool_names = _get_tool_names(captured_request.body)
        for name in self._WRITE_TOOLS:
            assert name not in tool_names


class TestListDatasetsTool:
    async def test_advertised_everywhere_including_for_viewers(
        self,
        anthropic_model: AnthropicModel,
        captured_request: CapturedRequest,
    ) -> None:
        agent = build_agent(model=anthropic_model)
        # No context and a viewer: list_datasets, list_labels, and list_splits
        # are read-only, so they stay available everywhere.
        deps = AgentDependencies(contexts=ResolvedContexts(), is_viewer=True)

        await agent.run("hello", deps=deps)

        tool_names = _get_tool_names(captured_request.body)
        assert "list_datasets" in tool_names
        assert "list_labels" in tool_names
        assert "list_splits" in tool_names
        joined_system = "\n".join(_get_system_texts(captured_request.body))
        assert '<tool name="list_datasets">' in joined_system
        assert '<tool name="list_labels">' in joined_system
        assert '<tool name="list_splits">' in joined_system


class TestListDatasetExamplesTool:
    async def test_advertised_with_dataset_context(
        self,
        anthropic_model: AnthropicModel,
        captured_request: CapturedRequest,
    ) -> None:
        agent = build_agent(model=anthropic_model)
        deps = AgentDependencies(
            contexts=ResolvedContexts(
                dataset=DatasetContext(type="dataset", dataset_node_id="RGF0YXNldDox"),
            ),
        )

        await agent.run("hello", deps=deps)

        assert "list_dataset_examples" in _get_tool_names(captured_request.body)
        joined_system = "\n".join(_get_system_texts(captured_request.body))
        assert '<tool name="list_dataset_examples">' in joined_system

    async def test_absent_without_dataset_context(
        self,
        anthropic_model: AnthropicModel,
        captured_request: CapturedRequest,
    ) -> None:
        agent = build_agent(model=anthropic_model)
        deps = AgentDependencies(contexts=ResolvedContexts())

        await agent.run("hello", deps=deps)

        assert "list_dataset_examples" not in _get_tool_names(captured_request.body)


class TestCreateDatasetTool:
    async def test_advertised_without_any_context(
        self,
        anthropic_model: AnthropicModel,
        captured_request: CapturedRequest,
    ) -> None:
        agent = build_agent(model=anthropic_model)
        deps = AgentDependencies(contexts=ResolvedContexts())

        await agent.run("hello", deps=deps)

        # create_dataset is advertised everywhere (a new dataset has no context
        # to resolve a target from) — except to viewers, who cannot write.
        assert "create_dataset" in _get_tool_names(captured_request.body)
        joined_system = "\n".join(_get_system_texts(captured_request.body))
        assert '<tool name="create_dataset">' in joined_system

    async def test_hidden_for_viewer(
        self,
        anthropic_model: AnthropicModel,
        captured_request: CapturedRequest,
    ) -> None:
        agent = build_agent(model=anthropic_model)
        deps = AgentDependencies(contexts=ResolvedContexts(), is_viewer=True)

        await agent.run("hello", deps=deps)

        assert "create_dataset" not in _get_tool_names(captured_request.body)


class TestPlaygroundTools:
    async def test_run_playground_tool_is_absent_without_playground_context(
        self,
        anthropic_model: AnthropicModel,
        captured_request: CapturedRequest,
    ) -> None:
        agent = build_agent(model=anthropic_model)
        deps = AgentDependencies(contexts=ResolvedContexts())

        await agent.run("hello", deps=deps)

        assert "run_playground" not in _get_tool_names(captured_request.body)
        assert "cancel_playground_run" not in _get_tool_names(captured_request.body)
        assert "read_playground_output" not in _get_tool_names(captured_request.body)
        assert "add_prompt_instance" not in _get_tool_names(captured_request.body)
        assert "remove_prompt_instance" not in _get_tool_names(captured_request.body)
        assert "save_prompt" not in _get_tool_names(captured_request.body)
        assert "set_variable_values" not in _get_tool_names(captured_request.body)
        assert "set_playground_experiment_recording" not in _get_tool_names(captured_request.body)
        assert "set_playground_repetitions" not in _get_tool_names(captured_request.body)
        assert "set_template_variables_path" not in _get_tool_names(captured_request.body)
        assert "set_appended_messages_path" not in _get_tool_names(captured_request.body)
        assert "list_playground_model_targets" not in _get_tool_names(captured_request.body)
        assert "set_playground_model" not in _get_tool_names(captured_request.body)
        assert "load_dataset" not in _get_tool_names(captured_request.body)

    async def test_run_playground_tool_is_advertised_with_playground_context(
        self,
        anthropic_model: AnthropicModel,
        captured_request: CapturedRequest,
    ) -> None:
        agent = build_agent(model=anthropic_model)
        deps = AgentDependencies(
            contexts=ResolvedContexts(
                playground=PlaygroundContext(
                    type="playground",
                    instances=[
                        PlaygroundInstanceContext(
                            instance_id=1,
                            model=PlaygroundBuiltinModelContext(
                                type="builtin",
                                provider="OPENAI",
                                model_name="gpt-5",
                            ),
                        )
                    ],
                )
            )
        )

        await agent.run("hello", deps=deps)

        assert "run_playground" in _get_tool_names(captured_request.body)
        assert "cancel_playground_run" in _get_tool_names(captured_request.body)
        assert "read_playground_output" in _get_tool_names(captured_request.body)
        assert "add_prompt_instance" in _get_tool_names(captured_request.body)
        assert "remove_prompt_instance" in _get_tool_names(captured_request.body)
        assert "save_prompt" in _get_tool_names(captured_request.body)
        assert "set_variable_values" in _get_tool_names(captured_request.body)
        assert "set_playground_experiment_recording" in _get_tool_names(captured_request.body)
        assert "set_playground_repetitions" in _get_tool_names(captured_request.body)
        assert "set_template_variables_path" in _get_tool_names(captured_request.body)
        assert "set_appended_messages_path" in _get_tool_names(captured_request.body)
        assert "list_playground_model_targets" in _get_tool_names(captured_request.body)
        assert "set_playground_model" in _get_tool_names(captured_request.body)
        assert "load_dataset" in _get_tool_names(captured_request.body)


class TestDocsMCPToolset:
    """The optional docs MCP toolset is wired into the system blocks only
    when supplied by the caller."""

    async def test_docs_tool_instructions_are_present_when_docs_mcp_server_is_provided(
        self,
        anthropic_model: AnthropicModel,
        captured_request: CapturedRequest,
        docs_mcp_server: _OfflineDocsMCPToolset,
    ) -> None:
        agent = build_agent(model=anthropic_model, docs_mcp_server=docs_mcp_server)
        deps = AgentDependencies(contexts=ResolvedContexts())

        await agent.run("hello", deps=deps)

        cached_blocks, _ = _partition_system_blocks_by_cache_breakpoint(captured_request.body)
        assert _DEFAULT_PROMPTS.docs_tool.render() in _get_concatenated_text(cached_blocks)

    async def test_docs_tool_instructions_are_absent_when_docs_mcp_server_is_omitted(
        self,
        anthropic_model: AnthropicModel,
        captured_request: CapturedRequest,
    ) -> None:
        agent = build_agent(model=anthropic_model)
        deps = AgentDependencies(contexts=ResolvedContexts())

        await agent.run("hello", deps=deps)

        assert _DEFAULT_PROMPTS.docs_tool.render() not in "\n".join(
            _get_system_texts(captured_request.body)
        )


class TestSkillsCapability:
    async def test_global_bundled_skills_advertised_inside_cache_boundary(
        self,
        anthropic_model: AnthropicModel,
        captured_request: CapturedRequest,
    ) -> None:
        agent = build_agent(model=anthropic_model)
        deps = AgentDependencies(contexts=ResolvedContexts())

        await agent.run("hello", deps=deps)

        cached_blocks, _ = _partition_system_blocks_by_cache_breakpoint(captured_request.body)
        cached_text = _get_concatenated_text(cached_blocks)
        assert "<available_skills>" in cached_text
        assert "<name>debug-trace</name>" in cached_text
        assert "<name>annotate-spans</name>" in cached_text
        assert "<name>span-coding</name>" in cached_text
        assert "<name>playground</name>" not in cached_text
        assert "<name>experiments</name>" not in cached_text

    async def test_skill_tools_are_advertised(
        self,
        anthropic_model: AnthropicModel,
        captured_request: CapturedRequest,
    ) -> None:
        agent = build_agent(model=anthropic_model)
        deps = AgentDependencies(contexts=ResolvedContexts())

        await agent.run("hello", deps=deps)

        tool_names = _get_tool_names(captured_request.body)
        assert "load_skill" in tool_names
        assert "read_skill_resource" in tool_names
        assert "write_span_note" in tool_names


class TestCodeEvaluatorFormToolGates:
    @staticmethod
    def _sandbox_availability() -> SandboxAvailability:
        return SandboxAvailability(has_usable=True)

    async def test_open_form_advertised_for_dataset_backed_playground(
        self,
        anthropic_model: AnthropicModel,
        captured_request: CapturedRequest,
    ) -> None:
        agent = build_agent(model=anthropic_model)
        deps = AgentDependencies(
            contexts=ResolvedContexts(
                playground=PlaygroundContext(
                    type="playground",
                    instances=[PlaygroundInstanceContext(instance_id=1)],
                ),
                dataset=DatasetContext(type="dataset", dataset_node_id="RGF0YXNldDox"),
            ),
            sandbox_availability=self._sandbox_availability(),
        )

        await agent.run("hello", deps=deps)

        tool_names = _get_tool_names(captured_request.body)
        assert "open_code_evaluator_form" in tool_names
        assert "read_code_evaluator_draft" not in tool_names
        assert "edit_code_evaluator_draft" not in tool_names
        assert "test_code_evaluator_draft" not in tool_names

    async def test_open_form_hidden_for_viewer(
        self,
        anthropic_model: AnthropicModel,
        captured_request: CapturedRequest,
    ) -> None:
        agent = build_agent(model=anthropic_model)
        deps = AgentDependencies(
            contexts=ResolvedContexts(
                playground=PlaygroundContext(
                    type="playground",
                    instances=[PlaygroundInstanceContext(instance_id=1)],
                ),
                dataset=DatasetContext(type="dataset", dataset_node_id="RGF0YXNldDox"),
            ),
            is_viewer=True,
            sandbox_availability=self._sandbox_availability(),
        )

        await agent.run("hello", deps=deps)

        tool_names = _get_tool_names(captured_request.body)
        assert "open_code_evaluator_form" not in tool_names

    async def test_open_form_hidden_without_usable_sandbox(
        self,
        anthropic_model: AnthropicModel,
        captured_request: CapturedRequest,
    ) -> None:
        agent = build_agent(model=anthropic_model)
        deps = AgentDependencies(
            contexts=ResolvedContexts(
                playground=PlaygroundContext(
                    type="playground",
                    instances=[PlaygroundInstanceContext(instance_id=1)],
                ),
                dataset=DatasetContext(type="dataset", dataset_node_id="RGF0YXNldDox"),
            ),
            sandbox_availability=SandboxAvailability(),
        )

        await agent.run("hello", deps=deps)

        tool_names = _get_tool_names(captured_request.body)
        assert "open_code_evaluator_form" not in tool_names

    async def test_form_tools_advertised_for_mounted_code_evaluator_form(
        self,
        anthropic_model: AnthropicModel,
        captured_request: CapturedRequest,
    ) -> None:
        agent = build_agent(model=anthropic_model)
        deps = AgentDependencies(
            contexts=ResolvedContexts(
                code_evaluator=CodeEvaluatorContext(
                    type="code_evaluator",
                    evaluator_node_id=None,
                ),
            ),
            sandbox_availability=self._sandbox_availability(),
        )

        await agent.run("hello", deps=deps)

        tool_names = _get_tool_names(captured_request.body)
        assert "open_code_evaluator_form" not in tool_names
        assert "read_code_evaluator_draft" in tool_names
        assert "edit_code_evaluator_draft" in tool_names
        assert "test_code_evaluator_draft" in tool_names
        assert "submit_code_evaluator_draft" in tool_names

    async def test_create_form_hides_write_tools_without_usable_sandbox(
        self,
        anthropic_model: AnthropicModel,
        captured_request: CapturedRequest,
    ) -> None:
        agent = build_agent(model=anthropic_model)
        deps = AgentDependencies(
            contexts=ResolvedContexts(
                code_evaluator=CodeEvaluatorContext(
                    type="code_evaluator",
                    evaluator_node_id=None,
                ),
            ),
            sandbox_availability=SandboxAvailability(),
        )

        await agent.run("hello", deps=deps)

        tool_names = _get_tool_names(captured_request.body)
        assert "read_code_evaluator_draft" in tool_names
        assert "edit_code_evaluator_draft" not in tool_names
        assert "test_code_evaluator_draft" not in tool_names
        assert "submit_code_evaluator_draft" not in tool_names

    async def test_edit_form_advertises_edit_without_usable_sandbox(
        self,
        anthropic_model: AnthropicModel,
        captured_request: CapturedRequest,
    ) -> None:
        agent = build_agent(model=anthropic_model)
        deps = AgentDependencies(
            contexts=ResolvedContexts(
                code_evaluator=CodeEvaluatorContext(
                    type="code_evaluator",
                    evaluator_node_id="Q29kZUV2YWx1YXRvcjox",
                ),
            ),
            sandbox_availability=SandboxAvailability(),
        )

        await agent.run("hello", deps=deps)

        tool_names = _get_tool_names(captured_request.body)
        assert "read_code_evaluator_draft" in tool_names
        assert "edit_code_evaluator_draft" in tool_names
        assert "test_code_evaluator_draft" not in tool_names
        assert "submit_code_evaluator_draft" in tool_names

    async def test_write_and_preview_tools_hidden_for_viewers(
        self,
        anthropic_model: AnthropicModel,
        captured_request: CapturedRequest,
    ) -> None:
        agent = build_agent(model=anthropic_model)
        deps = AgentDependencies(
            contexts=ResolvedContexts(
                code_evaluator=CodeEvaluatorContext(
                    type="code_evaluator",
                    evaluator_node_id=None,
                ),
            ),
            is_viewer=True,
            sandbox_availability=self._sandbox_availability(),
        )

        await agent.run("hello", deps=deps)

        tool_names = _get_tool_names(captured_request.body)
        assert "read_code_evaluator_draft" in tool_names
        assert "edit_code_evaluator_draft" not in tool_names
        assert "test_code_evaluator_draft" not in tool_names
        assert "submit_code_evaluator_draft" not in tool_names


class TestLlmEvaluatorFormToolGates:
    async def test_open_form_advertised_for_dataset_backed_playground(
        self,
        anthropic_model: AnthropicModel,
        captured_request: CapturedRequest,
    ) -> None:
        agent = build_agent(model=anthropic_model)
        deps = AgentDependencies(
            contexts=ResolvedContexts(
                playground=PlaygroundContext(type="playground", instance_ids=[1]),
                dataset=DatasetContext(type="dataset", dataset_node_id="RGF0YXNldDox"),
            ),
            model_provider_availability=ModelProviderAvailability(has_usable=True),
        )

        await agent.run("hello", deps=deps)

        tool_names = _get_tool_names(captured_request.body)
        assert "open_llm_evaluator_form" in tool_names
        assert "read_llm_evaluator_draft" not in tool_names
        assert "edit_llm_evaluator_draft" not in tool_names
        assert "test_llm_evaluator_draft" not in tool_names
        assert "submit_llm_evaluator_draft" not in tool_names

    async def test_open_form_hidden_for_viewer(
        self,
        anthropic_model: AnthropicModel,
        captured_request: CapturedRequest,
    ) -> None:
        agent = build_agent(model=anthropic_model)
        deps = AgentDependencies(
            contexts=ResolvedContexts(
                playground=PlaygroundContext(type="playground", instance_ids=[1]),
                dataset=DatasetContext(type="dataset", dataset_node_id="RGF0YXNldDox"),
            ),
            is_viewer=True,
            model_provider_availability=ModelProviderAvailability(has_usable=True),
        )

        await agent.run("hello", deps=deps)

        tool_names = _get_tool_names(captured_request.body)
        assert "open_llm_evaluator_form" not in tool_names

    async def test_open_form_hidden_without_usable_model_provider(
        self,
        anthropic_model: AnthropicModel,
        captured_request: CapturedRequest,
    ) -> None:
        agent = build_agent(model=anthropic_model)
        deps = AgentDependencies(
            contexts=ResolvedContexts(
                playground=PlaygroundContext(type="playground", instance_ids=[1]),
                dataset=DatasetContext(type="dataset", dataset_node_id="RGF0YXNldDox"),
            ),
            model_provider_availability=ModelProviderAvailability(),
        )

        await agent.run("hello", deps=deps)

        tool_names = _get_tool_names(captured_request.body)
        assert "open_llm_evaluator_form" not in tool_names

    async def test_open_form_hidden_without_playground(
        self,
        anthropic_model: AnthropicModel,
        captured_request: CapturedRequest,
    ) -> None:
        agent = build_agent(model=anthropic_model)
        deps = AgentDependencies(
            contexts=ResolvedContexts(
                dataset=DatasetContext(type="dataset", dataset_node_id="RGF0YXNldDox"),
            ),
            model_provider_availability=ModelProviderAvailability(has_usable=True),
        )

        await agent.run("hello", deps=deps)

        tool_names = _get_tool_names(captured_request.body)
        assert "open_llm_evaluator_form" not in tool_names

    async def test_open_form_hidden_when_llm_evaluator_form_mounted(
        self,
        anthropic_model: AnthropicModel,
        captured_request: CapturedRequest,
    ) -> None:
        agent = build_agent(model=anthropic_model)
        deps = AgentDependencies(
            contexts=ResolvedContexts(
                playground=PlaygroundContext(type="playground", instance_ids=[1]),
                dataset=DatasetContext(type="dataset", dataset_node_id="RGF0YXNldDox"),
                llm_evaluator=LlmEvaluatorContext(
                    type="llm_evaluator",
                    evaluator_node_id=None,
                ),
            ),
            model_provider_availability=ModelProviderAvailability(has_usable=True),
        )

        await agent.run("hello", deps=deps)

        tool_names = _get_tool_names(captured_request.body)
        assert "open_llm_evaluator_form" not in tool_names
        assert "read_llm_evaluator_draft" in tool_names

    async def test_form_tools_absent_without_llm_evaluator_context(
        self,
        anthropic_model: AnthropicModel,
        captured_request: CapturedRequest,
    ) -> None:
        agent = build_agent(model=anthropic_model)
        deps = AgentDependencies(
            contexts=ResolvedContexts(
                playground=PlaygroundContext(type="playground", instance_ids=[1]),
            ),
            model_provider_availability=ModelProviderAvailability(has_usable=True),
        )

        await agent.run("hello", deps=deps)

        tool_names = _get_tool_names(captured_request.body)
        assert "read_llm_evaluator_draft" not in tool_names
        assert "edit_llm_evaluator_draft" not in tool_names
        assert "test_llm_evaluator_draft" not in tool_names
        assert "submit_llm_evaluator_draft" not in tool_names

    async def test_edit_form_advertises_edit_but_hides_test_without_usable_model_provider(
        self,
        anthropic_model: AnthropicModel,
        captured_request: CapturedRequest,
    ) -> None:
        agent = build_agent(model=anthropic_model)
        deps = AgentDependencies(
            contexts=ResolvedContexts(
                llm_evaluator=LlmEvaluatorContext(
                    type="llm_evaluator",
                    evaluator_node_id="TGxtRXZhbHVhdG9yOjE=",
                ),
            ),
            model_provider_availability=ModelProviderAvailability(),
        )

        await agent.run("hello", deps=deps)

        tool_names = _get_tool_names(captured_request.body)
        assert "read_llm_evaluator_draft" in tool_names
        assert "edit_llm_evaluator_draft" in tool_names
        assert "test_llm_evaluator_draft" not in tool_names
        assert "submit_llm_evaluator_draft" in tool_names

    async def test_create_form_hides_write_tools_without_usable_model_provider(
        self,
        anthropic_model: AnthropicModel,
        captured_request: CapturedRequest,
    ) -> None:
        agent = build_agent(model=anthropic_model)
        deps = AgentDependencies(
            contexts=ResolvedContexts(
                llm_evaluator=LlmEvaluatorContext(
                    type="llm_evaluator",
                    evaluator_node_id=None,
                ),
            ),
            model_provider_availability=ModelProviderAvailability(),
        )

        await agent.run("hello", deps=deps)

        tool_names = _get_tool_names(captured_request.body)
        assert "read_llm_evaluator_draft" in tool_names
        assert "edit_llm_evaluator_draft" not in tool_names
        assert "test_llm_evaluator_draft" not in tool_names
        assert "submit_llm_evaluator_draft" not in tool_names

    async def test_create_form_advertises_write_tools_with_usable_model_provider(
        self,
        anthropic_model: AnthropicModel,
        captured_request: CapturedRequest,
    ) -> None:
        agent = build_agent(model=anthropic_model)
        deps = AgentDependencies(
            contexts=ResolvedContexts(
                llm_evaluator=LlmEvaluatorContext(
                    type="llm_evaluator",
                    evaluator_node_id=None,
                ),
            ),
            model_provider_availability=ModelProviderAvailability(has_usable=True),
        )

        await agent.run("hello", deps=deps)

        tool_names = _get_tool_names(captured_request.body)
        assert "read_llm_evaluator_draft" in tool_names
        assert "edit_llm_evaluator_draft" in tool_names
        assert "test_llm_evaluator_draft" in tool_names
        assert "submit_llm_evaluator_draft" in tool_names

    async def test_write_tools_hidden_for_viewer(
        self,
        anthropic_model: AnthropicModel,
        captured_request: CapturedRequest,
    ) -> None:
        agent = build_agent(model=anthropic_model)
        deps = AgentDependencies(
            contexts=ResolvedContexts(
                llm_evaluator=LlmEvaluatorContext(
                    type="llm_evaluator",
                    evaluator_node_id="TGxtRXZhbHVhdG9yOjE=",
                ),
            ),
            is_viewer=True,
            model_provider_availability=ModelProviderAvailability(has_usable=True),
        )

        await agent.run("hello", deps=deps)

        tool_names = _get_tool_names(captured_request.body)
        assert "read_llm_evaluator_draft" in tool_names
        assert "edit_llm_evaluator_draft" not in tool_names
        assert "test_llm_evaluator_draft" not in tool_names
        assert "submit_llm_evaluator_draft" not in tool_names


class TestEvaluatorsSkillLoadContract:
    """The evaluators skill is only reachable if a live surface both advertises
    it in the catalog and directs the agent to ``load_skill`` it. These assert
    that contract so the skill cannot silently become inert."""

    async def test_llm_evaluator_context_directs_load_skill(
        self,
        anthropic_model: AnthropicModel,
        captured_request: CapturedRequest,
    ) -> None:
        agent = build_agent(model=anthropic_model)
        deps = AgentDependencies(
            contexts=ResolvedContexts(
                llm_evaluator=LlmEvaluatorContext(
                    type="llm_evaluator",
                    evaluator_node_id=None,
                ),
            ),
        )

        await agent.run("hello", deps=deps)

        all_text = "\n".join(_get_system_texts(captured_request.body))
        assert "load_skill" in all_text
        assert "evaluators" in all_text

    async def test_evaluators_skill_advertised_with_dataset_context(
        self,
        anthropic_model: AnthropicModel,
        captured_request: CapturedRequest,
    ) -> None:
        agent = build_agent(model=anthropic_model)
        deps = AgentDependencies(
            contexts=ResolvedContexts(
                playground=PlaygroundContext(type="playground", instance_ids=[1]),
                dataset=DatasetContext(type="dataset", dataset_node_id="RGF0YXNldDox"),
            ),
            model_provider_availability=ModelProviderAvailability(has_usable=True),
        )

        await agent.run("hello", deps=deps)

        all_text = "\n".join(_get_system_texts(captured_request.body))
        assert "<name>evaluators</name>" in all_text

    async def test_evaluators_skill_advertised_with_code_evaluator_context(
        self,
        anthropic_model: AnthropicModel,
        captured_request: CapturedRequest,
    ) -> None:
        agent = build_agent(model=anthropic_model)
        deps = AgentDependencies(
            contexts=ResolvedContexts(
                code_evaluator=CodeEvaluatorContext(
                    type="code_evaluator",
                    evaluator_node_id=None,
                ),
            ),
        )

        await agent.run("hello", deps=deps)

        all_text = "\n".join(_get_system_texts(captured_request.body))
        assert "<name>evaluators</name>" in all_text

    async def test_evaluators_skill_absent_without_authoring_surface(
        self,
        anthropic_model: AnthropicModel,
        captured_request: CapturedRequest,
    ) -> None:
        agent = build_agent(model=anthropic_model)
        deps = AgentDependencies(contexts=ResolvedContexts())

        await agent.run("hello", deps=deps)

        all_text = "\n".join(_get_system_texts(captured_request.body))
        assert "<name>evaluators</name>" not in all_text
        assert "<name>llm-evaluator-authoring</name>" not in all_text


class TestExperimentsSkillGate:
    """The experiments skill is dataset-scoped: it advertises iff a dataset
    context is mounted, and stays absent on evaluator-only or empty surfaces."""

    async def test_experiments_skill_advertised_with_dataset_context(
        self,
        anthropic_model: AnthropicModel,
        captured_request: CapturedRequest,
    ) -> None:
        agent = build_agent(model=anthropic_model)
        deps = AgentDependencies(
            contexts=ResolvedContexts(
                dataset=DatasetContext(type="dataset", dataset_node_id="RGF0YXNldDox"),
            ),
        )

        await agent.run("hello", deps=deps)

        all_text = "\n".join(_get_system_texts(captured_request.body))
        assert "<name>experiments</name>" in all_text

    async def test_experiments_skill_absent_for_evaluator_only_context(
        self,
        anthropic_model: AnthropicModel,
        captured_request: CapturedRequest,
    ) -> None:
        agent = build_agent(model=anthropic_model)
        deps = AgentDependencies(
            contexts=ResolvedContexts(
                code_evaluator=CodeEvaluatorContext(
                    type="code_evaluator",
                    evaluator_node_id=None,
                ),
            ),
        )

        await agent.run("hello", deps=deps)

        all_text = "\n".join(_get_system_texts(captured_request.body))
        assert "<name>experiments</name>" not in all_text

    async def test_experiments_skill_absent_without_dataset_context(
        self,
        anthropic_model: AnthropicModel,
        captured_request: CapturedRequest,
    ) -> None:
        agent = build_agent(model=anthropic_model)
        deps = AgentDependencies(contexts=ResolvedContexts())

        await agent.run("hello", deps=deps)

        all_text = "\n".join(_get_system_texts(captured_request.body))
        assert "<name>experiments</name>" not in all_text


class TestCapabilityInstructionsOverride:
    async def test_overridden_base_instruction_appears_inside_cache_boundary(
        self,
        anthropic_model: AnthropicModel,
        captured_request: CapturedRequest,
    ) -> None:
        custom = AgentPrompts(base=Template("CUSTOM_STATIC_SENTINEL"))
        agent = build_agent(model=anthropic_model, prompts=custom)
        deps = AgentDependencies(contexts=ResolvedContexts())

        await agent.run("hello", deps=deps)

        cached_blocks, _ = _partition_system_blocks_by_cache_breakpoint(captured_request.body)
        cached_text = _get_concatenated_text(cached_blocks)
        assert "CUSTOM_STATIC_SENTINEL" in cached_text
        assert _DEFAULT_PROMPTS.base.render() not in cached_text

    async def test_overridden_tool_instruction_replaces_default_in_system_blocks(
        self,
        anthropic_model: AnthropicModel,
        captured_request: CapturedRequest,
    ) -> None:
        custom = AgentPrompts(bash_tool=Template("CUSTOM_BASH_SENTINEL"))
        agent = build_agent(model=anthropic_model, prompts=custom)
        deps = AgentDependencies(contexts=ResolvedContexts())

        await agent.run("hello", deps=deps)

        joined_system = "\n".join(_get_system_texts(captured_request.body))
        assert "CUSTOM_BASH_SENTINEL" in joined_system
        assert _DEFAULT_PROMPTS.bash_tool.render() not in joined_system


class TestWebAccessCapabilities:
    @staticmethod
    def _get_native_tool_types(model: TestModel) -> set[type]:
        """Native tool types the agent advertised on the last ``TestModel`` request."""
        params = model.last_model_request_parameters
        assert params is not None
        return {type(tool) for tool in params.native_tools}

    async def test_web_tools_advertised_when_enabled(
        self,
        model_with_web_access: TestModel,
    ) -> None:
        agent = build_agent(model=model_with_web_access, enable_web_access=True)
        deps = AgentDependencies(contexts=ResolvedContexts())

        # ``TestModel`` refuses to respond when native tools are advertised on
        # the request, but ``last_model_request_parameters`` is recorded before
        # the error is raised — sufficient to verify ``build_agent``'s wiring.
        with pytest.raises(UserError):
            await agent.run("hello", deps=deps)

        native_tool_types = self._get_native_tool_types(model_with_web_access)
        assert WebSearchTool in native_tool_types
        assert WebFetchTool in native_tool_types

    async def test_web_tools_absent_when_disabled(
        self,
        model_with_web_access: TestModel,
    ) -> None:
        agent = build_agent(model=model_with_web_access, enable_web_access=False)
        deps = AgentDependencies(contexts=ResolvedContexts())

        await agent.run("hello", deps=deps)

        native_tool_types = self._get_native_tool_types(model_with_web_access)
        assert WebSearchTool not in native_tool_types
        assert WebFetchTool not in native_tool_types

    async def test_web_tools_absent_when_model_does_not_support_them(
        self,
        model_without_web_access: TestModel,
    ) -> None:
        agent = build_agent(model=model_without_web_access, enable_web_access=True)
        deps = AgentDependencies(contexts=ResolvedContexts())

        await agent.run("hello", deps=deps)

        native_tool_types = self._get_native_tool_types(model_without_web_access)
        assert WebSearchTool not in native_tool_types
        assert WebFetchTool not in native_tool_types


class TestToolSearchCapability:
    async def test_external_tools_use_native_anthropic_tool_search(
        self,
        anthropic_model: AnthropicModel,
        captured_request: CapturedRequest,
    ) -> None:
        agent = build_agent(model=anthropic_model)
        deps = AgentDependencies(contexts=ResolvedContexts())

        await agent.run("hello", deps=deps)

        tools_by_name = {tool.get("name"): tool for tool in captured_request.body.get("tools", [])}
        assert "tool_search_tool_bm25" in tools_by_name
        assert tools_by_name["list_datasets"].get("defer_loading") is True
        assert "defer_loading" not in tools_by_name["get_route_info"]
        assert "defer_loading" not in tools_by_name["write_span_note"]

    async def test_external_tools_are_deferred_to_local_search_fallback(self) -> None:
        model = TestModel(call_tools=[])
        agent = build_agent(model=model)
        deps = AgentDependencies(contexts=ResolvedContexts())

        await agent.run("hello", deps=deps)

        request_parameters = model.last_model_request_parameters
        assert request_parameters is not None
        tools_by_name = {
            tool_definition.name: tool_definition
            for tool_definition in request_parameters.function_tools
        }
        assert "search_tools" in tools_by_name
        assert tools_by_name["search_tools"].tool_kind == "tool-search"
        assert "list_datasets" not in tools_by_name
        assert "get_route_info" in tools_by_name
        assert tools_by_name["get_route_info"].defer_loading is False
        assert "write_span_note" in tools_by_name
        assert tools_by_name["write_span_note"].defer_loading is False


class TestDatasetEvaluatorSelectAndEditToolGates:
    @staticmethod
    def _roster_playground(
        evaluators: list[PlaygroundEvaluatorContext],
    ) -> PlaygroundContext:
        return PlaygroundContext(
            type="playground",
            instances=[PlaygroundInstanceContext(instance_id=1)],
            evaluators=evaluators,
        )

    @staticmethod
    def _code_evaluator() -> PlaygroundEvaluatorContext:
        return PlaygroundEvaluatorContext(
            dataset_evaluator_id="RXY6MQ==",
            name="Exact Match",
            kind="CODE",
            is_builtin=False,
            is_applied=True,
        )

    @staticmethod
    def _builtin_evaluator() -> PlaygroundEvaluatorContext:
        return PlaygroundEvaluatorContext(
            dataset_evaluator_id="RXY6Mg==",
            name="Hallucination",
            kind="BUILTIN",
            is_builtin=True,
            is_applied=False,
        )

    async def test_both_tools_advertised_with_editable_roster(
        self,
        anthropic_model: AnthropicModel,
        captured_request: CapturedRequest,
    ) -> None:
        agent = build_agent(model=anthropic_model)
        deps = AgentDependencies(
            contexts=ResolvedContexts(
                playground=self._roster_playground([self._code_evaluator()]),
                dataset=DatasetContext(type="dataset", dataset_node_id="RGF0YXNldDox"),
            ),
        )

        await agent.run("hello", deps=deps)

        tool_names = _get_tool_names(captured_request.body)
        assert "set_dataset_evaluator_selection" in tool_names
        assert "open_dataset_evaluator_for_edit" in tool_names
        assert "read_dataset_evaluator_definition" in tool_names

    async def test_edit_open_absent_when_only_builtin_evaluators(
        self,
        anthropic_model: AnthropicModel,
        captured_request: CapturedRequest,
    ) -> None:
        agent = build_agent(model=anthropic_model)
        deps = AgentDependencies(
            contexts=ResolvedContexts(
                playground=self._roster_playground(
                    [
                        self._builtin_evaluator(),
                        PlaygroundEvaluatorContext(
                            dataset_evaluator_id="RXY6Mw==",
                            name="Builtin Code",
                            kind="CODE",
                            is_builtin=True,
                            is_applied=True,
                        ),
                    ]
                ),
                dataset=DatasetContext(type="dataset", dataset_node_id="RGF0YXNldDox"),
            ),
        )

        await agent.run("hello", deps=deps)

        tool_names = _get_tool_names(captured_request.body)
        assert "set_dataset_evaluator_selection" in tool_names
        assert "read_dataset_evaluator_definition" in tool_names
        assert "open_dataset_evaluator_for_edit" not in tool_names

    async def test_both_tools_absent_for_empty_roster(
        self,
        anthropic_model: AnthropicModel,
        captured_request: CapturedRequest,
    ) -> None:
        agent = build_agent(model=anthropic_model)
        deps = AgentDependencies(
            contexts=ResolvedContexts(
                playground=self._roster_playground([]),
                dataset=DatasetContext(type="dataset", dataset_node_id="RGF0YXNldDox"),
            ),
        )

        await agent.run("hello", deps=deps)

        tool_names = _get_tool_names(captured_request.body)
        assert "set_dataset_evaluator_selection" not in tool_names
        assert "open_dataset_evaluator_for_edit" not in tool_names
        assert "read_dataset_evaluator_definition" not in tool_names

    async def test_write_tools_hidden_for_viewer_but_read_remains(
        self,
        anthropic_model: AnthropicModel,
        captured_request: CapturedRequest,
    ) -> None:
        agent = build_agent(model=anthropic_model)
        deps = AgentDependencies(
            contexts=ResolvedContexts(
                playground=self._roster_playground([self._code_evaluator()]),
                dataset=DatasetContext(type="dataset", dataset_node_id="RGF0YXNldDox"),
            ),
            is_viewer=True,
        )

        await agent.run("hello", deps=deps)

        tool_names = _get_tool_names(captured_request.body)
        # Selection and edit-open mutate state, so they stay viewer-gated; reading
        # a definition is a pure read and remains available to viewers.
        assert "set_dataset_evaluator_selection" not in tool_names
        assert "open_dataset_evaluator_for_edit" not in tool_names
        assert "read_dataset_evaluator_definition" in tool_names

    async def test_both_tools_hidden_without_dataset(
        self,
        anthropic_model: AnthropicModel,
        captured_request: CapturedRequest,
    ) -> None:
        agent = build_agent(model=anthropic_model)
        deps = AgentDependencies(
            contexts=ResolvedContexts(
                playground=self._roster_playground([self._code_evaluator()]),
            ),
        )

        await agent.run("hello", deps=deps)

        tool_names = _get_tool_names(captured_request.body)
        assert "set_dataset_evaluator_selection" not in tool_names
        assert "open_dataset_evaluator_for_edit" not in tool_names
        assert "read_dataset_evaluator_definition" not in tool_names

from __future__ import annotations

import json
from collections.abc import Iterable
from dataclasses import dataclass, field
from typing import Any
from unittest.mock import Mock

import httpx2
import pytest
import strawberry
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
from pydantic_ai import Agent, RunContext, UserError
from pydantic_ai.capabilities import AbstractCapability, CombinedCapability
from pydantic_ai.models.anthropic import AnthropicModel
from pydantic_ai.models.test import TestModel
from pydantic_ai.native_tools import WebFetchTool, WebSearchTool
from pydantic_ai.profiles import ModelProfile
from pydantic_ai.providers.anthropic import AnthropicProvider
from typing_extensions import TypeIs, assert_never

from phoenix.db.types.data_stream_protocol import EditPermission
from phoenix.db.types.data_stream_protocol.ui_state_types import (
    CodeEvaluatorUIContext,
    DatasetUIContext,
    LlmEvaluatorUIContext,
    PlaygroundBuiltinModelUIContext,
    PlaygroundInstanceUIContext,
    PlaygroundUIContext,
    ProjectUIContext,
)
from phoenix.server.agents.agent_factory import build_agent as _build_agent
from phoenix.server.agents.capabilities import (
    MintlifyDocsMCPServer,
    build_anthropic_prompt_cache_capability,
)
from phoenix.server.agents.capabilities.tools.internal import CallSubAgentCapability
from phoenix.server.agents.capabilities.tools.internal.bash import BashCapability
from phoenix.server.agents.context import ResolvedContexts
from phoenix.server.agents.prompts import AgentPrompts
from phoenix.server.agents.pydantic_ai import (
    OpenInferenceAgentWrapper,
    OpenInferenceModelWrapper,
)
from phoenix.server.agents.skills import get_skills
from phoenix.server.agents.types import (
    AgentDependencies,
)
from phoenix.server.api.context import Context
from phoenix.server.bearer_auth import PhoenixUser
from phoenix.server.types import DbSessionFactory

_DEFAULT_PROMPTS = AgentPrompts()

_BROWSER_TOOL_NAMES = {
    "ask_user",
    "execute_browser_action",
    "get_route_info",
    "render_generative_ui",
    "search_browser_actions",
}

_FULLY_MOUNTED_CONTEXTS = ResolvedContexts(
    project=ProjectUIContext(type="project", project_node_id="UHJvamVjdDox", span_filter="error"),
    playground=PlaygroundUIContext(
        type="playground", instances=[PlaygroundInstanceUIContext(instance_id=1)]
    ),
    dataset=DatasetUIContext(type="dataset", dataset_node_id="RGF0YXNldDox"),
    llm_evaluator=LlmEvaluatorUIContext(type="llm_evaluator", evaluator_node_id=None),
    code_evaluator=CodeEvaluatorUIContext(type="code_evaluator", evaluator_node_id=None),
)
"""A surface with every gate-bearing UI context mounted at once.

Paired with an empty ``ResolvedContexts``, it stands in for a user navigating
between the emptiest and the busiest page in the app."""


def build_agent(**kwargs: Any) -> Any:
    """Build an agent for factory tests with inert DB-backed tool dependencies."""
    kwargs.setdefault("name", "PXIAgent")
    kwargs.setdefault("headless", False)
    kwargs.setdefault("db", Mock(spec=DbSessionFactory))
    kwargs.setdefault("event_queue", Mock())
    return _build_agent(**kwargs)


@strawberry.type
class Query:
    @strawberry.field
    def hello(self) -> str:
        return "world"


@pytest.fixture
def schema() -> strawberry.Schema:
    return strawberry.Schema(query=Query)


@pytest.fixture
def model() -> TestModel:
    return TestModel(call_tools=[])


def _stub_principal(*, is_viewer: bool) -> Any:
    principal = Mock(spec=PhoenixUser)
    principal.identity = "1"
    principal.is_viewer = is_viewer
    return principal


def _iter_capabilities(capability: AbstractCapability[Any]) -> Iterable[AbstractCapability[Any]]:
    yield capability
    if isinstance(capability, CombinedCapability):
        for nested in capability.capabilities:
            yield from _iter_capabilities(nested)
        return
    wrapped = getattr(capability, "wrapped", None)
    if isinstance(wrapped, AbstractCapability):
        yield from _iter_capabilities(wrapped)


def _find_capability(agent: Any, capability_type: type[Any]) -> Any:
    matches = _get_capabilities(agent, capability_type)
    assert len(matches) == 1
    return matches[0]


def _get_capabilities(agent: Any, capability_type: type[Any]) -> list[Any]:
    return [
        capability
        for capability in _iter_capabilities(agent.root_capability)
        if isinstance(capability, capability_type)
    ]


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
    ``httpx2.MockTransport``."""

    def handler(request: httpx2.Request) -> httpx2.Response:
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
        return httpx2.Response(200, json=stub_response.model_dump(mode="json"))

    http_client = httpx2.AsyncClient(transport=httpx2.MockTransport(handler))
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
        assert _DEFAULT_PROMPTS.base in _get_concatenated_text(cached_blocks)


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


def _get_skills_catalog(body: MessageCreateParams) -> str:
    """Return the ``<available_skills>`` block from the request's system blocks."""
    text = "\n".join(_get_system_texts(body))
    start = text.index("<available_skills>")
    end = text.index("</available_skills>", start) + len("</available_skills>")
    return text[start:end]


_SKILL_TOOL_NAMES = ("load_skill", "read_skill_resource")
_RENDERED_UI_STATE_MARKER = "<edit_permission>"


def _get_skill_tool_definitions(body: MessageCreateParams) -> list[Any]:
    """Return the skill tool definitions, in the order they were advertised."""
    return [tool for tool in body.get("tools") or [] if tool.get("name") in _SKILL_TOOL_NAMES]


def _get_tool_names(body: MessageCreateParams) -> set[str]:
    """Return the set of tool names advertised on the Anthropic request."""
    tools = body.get("tools") or []
    names: set[str] = set()
    for tool in tools:
        raw_name = tool.get("name")
        if isinstance(raw_name, str):
            names.add(raw_name)
    return names


def _get_tool_description(body: MessageCreateParams, name: str) -> str:
    """Return the description advertised for ``name`` on the Anthropic request.

    Tool guidance lives in the tool definition rather than the system prompt, so
    assertions about what the agent was told about a tool read it from here.
    """
    for tool in body.get("tools") or []:
        if tool.get("name") == name:
            description = tool.get("description")
            assert isinstance(description, str), f"{name} has no description"
            return description
    raise AssertionError(f"{name} was not advertised on the request")


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
        assert _DEFAULT_PROMPTS.base in _get_concatenated_text(cached_blocks)

    async def test_static_capability_instructions_are_inside_cache_boundary(
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
        assert "<phoenix_project_context>" in cached_text

    async def test_nothing_sits_after_the_cache_breakpoint(
        self,
        anthropic_model: AnthropicModel,
        captured_request: CapturedRequest,
    ) -> None:
        """The system prompt is entirely static, so the breakpoint sits at its
        end and there is nothing behind it to reprocess. Per-run state rides on
        the user's turn as a `<phoenix_ui_state>` block instead."""
        agent = build_agent(model=anthropic_model)
        deps = AgentDependencies(
            contexts=ResolvedContexts(
                playground=PlaygroundUIContext(type="playground"),
                project=ProjectUIContext(
                    type="project",
                    project_node_id="UHJvamVjdDox",
                    span_filter="",
                ),
                dataset=DatasetUIContext(type="dataset", dataset_node_id="RGF0YXNldDox"),
            ),
        )

        await agent.run("hello", deps=deps)

        cached_blocks, uncached_blocks = _partition_system_blocks_by_cache_breakpoint(
            captured_request.body
        )
        assert uncached_blocks == []
        cached_text = _get_concatenated_text(cached_blocks)
        for documented in (
            _DEFAULT_PROMPTS.base,
            "<available_skills>",
            "<phoenix_project_context>",
            "<phoenix_playground_context>",
            "<phoenix_gql_mutations_policy>",
        ):
            assert documented in cached_text
        assert _RENDERED_UI_STATE_MARKER not in cached_text

    async def test_viewer_access_instructions_are_inside_cache_boundary(
        self,
        anthropic_model: AnthropicModel,
        captured_request: CapturedRequest,
    ) -> None:
        """A user's role is fixed for the life of their token, so the viewer
        notice is a static system instruction rather than per-turn state."""
        agent = build_agent(
            model=anthropic_model,
            principal=_stub_principal(is_viewer=True),
        )
        deps = AgentDependencies(contexts=ResolvedContexts(), is_viewer=True)

        await agent.run("hello", deps=deps)

        cached_blocks, uncached_blocks = _partition_system_blocks_by_cache_breakpoint(
            captured_request.body
        )
        assert uncached_blocks == []
        assert _DEFAULT_PROMPTS.viewer_access in _get_concatenated_text(cached_blocks)

    async def test_viewer_access_instructions_are_absent_for_editors(
        self,
        anthropic_model: AnthropicModel,
        captured_request: CapturedRequest,
    ) -> None:
        agent = build_agent(model=anthropic_model)
        deps = AgentDependencies(contexts=ResolvedContexts())

        await agent.run("hello", deps=deps)

        assert "<viewer_access>" not in "\n".join(_get_system_texts(captured_request.body))

    async def test_tool_guidance_is_not_restated_in_the_system_prompt(
        self,
        anthropic_model: AnthropicModel,
        captured_request: CapturedRequest,
    ) -> None:
        """A tool's guidance belongs to its ``description``, and only there.

        Restating it as capability instructions would duplicate every one of
        those tokens on every request and let the two copies drift apart, so
        no advertised tool's description may appear in a system block.
        """
        agent = build_agent(model=anthropic_model)
        deps = AgentDependencies(
            contexts=ResolvedContexts(
                playground=PlaygroundUIContext(type="playground"),
                project=ProjectUIContext(
                    type="project",
                    project_node_id="UHJvamVjdDox",
                    span_filter="",
                ),
                dataset=DatasetUIContext(type="dataset", dataset_node_id="RGF0YXNldDox"),
            ),
        )

        await agent.run("hello", deps=deps)

        system_text = "\n".join(_get_system_texts(captured_request.body))
        # Provider-native tools (tool search) carry no description of their own.
        advertised = [
            tool for tool in captured_request.body.get("tools") or [] if "input_schema" in tool
        ]
        assert advertised, "expected the request to advertise tools"
        for tool in advertised:
            description = tool.get("description")
            assert isinstance(description, str) and description, (
                f"{tool.get('name')} must carry its guidance in its description"
            )
            assert description not in system_text


@pytest.mark.parametrize("headless", [False, True])
class TestPrefixStabilityAcrossNavigation:
    """The cacheable prefix must not move when the user navigates.

    Providers match a cached prefix from the front and stop at the first
    differing byte, so a prefix that tracked the current page would discard the
    conversation behind it on every click. These compare bytes, not fragments."""

    async def test_cached_system_blocks_are_byte_identical(
        self,
        anthropic_model: AnthropicModel,
        captured_request: CapturedRequest,
        headless: bool,
    ) -> None:
        agent = build_agent(model=anthropic_model, headless=headless)

        await agent.run("hello", deps=AgentDependencies(contexts=ResolvedContexts()))
        await agent.run("hello", deps=AgentDependencies(contexts=_FULLY_MOUNTED_CONTEXTS))

        bare, mounted = (
            [block["text"] for block in _partition_system_blocks_by_cache_breakpoint(body)[0]]
            for body in captured_request.bodies
        )
        assert bare == mounted

    async def test_cached_system_blocks_are_byte_identical_across_edit_permissions(
        self,
        anthropic_model: AnthropicModel,
        captured_request: CapturedRequest,
        headless: bool,
    ) -> None:
        """``edit_permission`` is a toggle the user can flip mid-conversation.
        Its value rides on the turn, so the prompt documents both settings."""
        agent = build_agent(model=anthropic_model, headless=headless)

        for edit_permission in ("manual", "bypass"):
            await agent.run(
                "hello",
                deps=AgentDependencies(
                    contexts=ResolvedContexts(),
                    edit_permission=edit_permission,
                ),
            )

        manual, bypass = (
            [block["text"] for block in _partition_system_blocks_by_cache_breakpoint(body)[0]]
            for body in captured_request.bodies
        )
        assert manual == bypass

    async def test_skill_tool_definitions_are_byte_identical_in_content_and_order(
        self,
        anthropic_model: AnthropicModel,
        captured_request: CapturedRequest,
        headless: bool,
    ) -> None:
        """Tool definitions sit even further forward than the system prompt, so
        a reordering is as expensive as a rewrite."""
        agent = build_agent(model=anthropic_model, headless=headless)

        await agent.run("hello", deps=AgentDependencies(contexts=ResolvedContexts()))
        await agent.run("hello", deps=AgentDependencies(contexts=_FULLY_MOUNTED_CONTEXTS))

        bare, mounted = (_get_skill_tool_definitions(body) for body in captured_request.bodies)
        assert bare == mounted
        assert [tool["name"] for tool in bare] == ["load_skill", "read_skill_resource"]

    async def test_identical_inputs_produce_identical_tool_arrays(
        self,
        anthropic_model: AnthropicModel,
        captured_request: CapturedRequest,
        headless: bool,
    ) -> None:
        """Two agents built the same way must advertise the same tools in the
        same order: a run-to-run reshuffle would bust the cache with nothing in
        the request having changed."""
        deps = AgentDependencies(contexts=_FULLY_MOUNTED_CONTEXTS)

        await build_agent(model=anthropic_model, headless=headless).run("hello", deps=deps)
        await build_agent(model=anthropic_model, headless=headless).run("hello", deps=deps)

        first, second = (body.get("tools") for body in captured_request.bodies)
        assert first == second


class TestUIContextInstructions:
    """UI-context prose is documentation; per-run UI state is data.

    The prose covers every case unconditionally and lives in the cached system
    prompt; the values deciding which case applies ride on the user's turn as a
    `<phoenix_ui_state>` block instead."""

    async def test_playground_selection_never_reaches_the_system_prompt(
        self,
        anthropic_model: AnthropicModel,
        captured_request: CapturedRequest,
    ) -> None:
        agent = build_agent(model=anthropic_model)
        deps = AgentDependencies(
            contexts=ResolvedContexts(
                playground=PlaygroundUIContext(
                    type="playground",
                    instances=[
                        PlaygroundInstanceUIContext(
                            instance_id=7,
                            model=PlaygroundBuiltinModelUIContext(
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

        system_text = "\n".join(_get_system_texts(captured_request.body))
        for per_run_value in ('instanceId="7"', "gpt-5"):
            assert per_run_value not in system_text
        cached_blocks, _ = _partition_system_blocks_by_cache_breakpoint(captured_request.body)
        cached_text = _get_concatenated_text(cached_blocks)
        for documented in (
            "<phoenix_playground_context>",
            "ui.playground.model.list",
            "ui.playground.model.set",
        ):
            assert documented in cached_text

    async def test_span_filter_condition_never_reaches_the_system_prompt(
        self,
        anthropic_model: AnthropicModel,
        captured_request: CapturedRequest,
    ) -> None:
        agent = build_agent(model=anthropic_model)
        deps = AgentDependencies(
            contexts=ResolvedContexts(
                project=ProjectUIContext(
                    type="project",
                    project_node_id="UHJvamVjdDox",
                    span_filter='status_code == "ERROR"',
                ),
            ),
        )

        await agent.run("hello", deps=deps)

        system_text = "\n".join(_get_system_texts(captured_request.body))
        assert "UHJvamVjdDox" not in system_text
        assert 'status_code == "ERROR"' not in system_text

    async def test_documentation_is_present_whatever_is_mounted(
        self,
        anthropic_model: AnthropicModel,
        captured_request: CapturedRequest,
    ) -> None:
        """Every context is documented on the emptiest page as on the busiest,
        which is what keeps the prefix stable across navigation."""
        agent = build_agent(model=anthropic_model)

        await agent.run("hello", deps=AgentDependencies(contexts=ResolvedContexts()))
        await agent.run("hello", deps=AgentDependencies(contexts=_FULLY_MOUNTED_CONTEXTS))

        for body in captured_request.bodies:
            cached_blocks, uncached_blocks = _partition_system_blocks_by_cache_breakpoint(body)
            assert uncached_blocks == []
            cached_text = _get_concatenated_text(cached_blocks)
            for tag in (
                "<phoenix_project_context>",
                "<phoenix_trace_context>",
                "<phoenix_span_context>",
                "<phoenix_playground_context>",
                "<phoenix_dataset_context>",
                "<phoenix_gql_mutations_policy>",
            ):
                assert tag in cached_text


@pytest.mark.parametrize("headless", [False, True])
class TestPhoenixMCPTools:
    """The REST API reaches the model as tools only when a server is supplied."""

    @staticmethod
    def _read_only_mcp_server() -> Any:
        from fastapi import FastAPI

        from phoenix.server.mcp_server import build_phoenix_mcp_server
        from phoenix.server.monty_runtime import MontyRuntime

        app = FastAPI()

        @app.get("/v1/projects", tags=["projects"], summary="List projects.")
        async def projects() -> list[str]:
            return []

        server, _ = build_phoenix_mcp_server(
            app,
            monty_runtime=MontyRuntime(),
            code_mode=True,
            monty_consumer="agent",
            read_only=True,
            db=Mock(spec=DbSessionFactory),
        )
        return server

    async def test_absent_without_a_server(
        self,
        anthropic_model: AnthropicModel,
        captured_request: CapturedRequest,
        headless: bool,
    ) -> None:
        agent = build_agent(model=anthropic_model, headless=headless)

        await agent.run("hello", deps=AgentDependencies(contexts=ResolvedContexts()))

        joined_system = "\n".join(_get_system_texts(captured_request.body))
        assert '<tool_group name="phoenix_rest_api">' not in joined_system
        assert "execute" not in _get_tool_names(captured_request.body)

    async def test_advertised_with_a_server(
        self,
        anthropic_model: AnthropicModel,
        captured_request: CapturedRequest,
        headless: bool,
    ) -> None:
        agent = build_agent(
            model=anthropic_model,
            headless=headless,
            phoenix_mcp_server=self._read_only_mcp_server(),
        )

        await agent.run("hello", deps=AgentDependencies(contexts=ResolvedContexts()))

        tool_names = _get_tool_names(captured_request.body)
        # The derived endpoints arrive behind `execute`, not one tool each.
        assert "execute" in tool_names
        assert not any(name.startswith("projects_v1") for name in tool_names)
        assert '<tool_group name="phoenix_rest_api">' in "\n".join(
            _get_system_texts(captured_request.body)
        )


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
        description = _get_tool_description(captured_request.body, "get_route_info")
        assert "do not render its `path` as a markdown link" in description


class TestHeadlessMode:
    @pytest.mark.parametrize("headless", [False, True])
    async def test_shared_tools_and_browser_capabilities(
        self,
        model: TestModel,
        schema: strawberry.Schema,
        headless: bool,
    ) -> None:
        agent = build_agent(
            model=model,
            headless=headless,
            schema=schema,
            build_graphql_context=lambda: Mock(spec=Context),
        )

        result = await agent.run(
            "hello",
            deps=AgentDependencies(contexts=ResolvedContexts()),
        )

        params = model.last_model_request_parameters
        assert params is not None
        tool_names = {tool.name for tool in params.function_tools}
        assert {
            "bash",
            "get_current_datetime",
            "load_skill",
            "read_skill_resource",
            "write_span_note",
        } <= tool_names
        instructions = result.all_messages()[0].instructions
        assert instructions is not None
        if headless:
            assert tool_names.isdisjoint(_BROWSER_TOOL_NAMES)
            assert "<phoenix_project_context>" not in instructions
        else:
            assert _BROWSER_TOOL_NAMES <= tool_names
            assert "<phoenix_project_context>" in instructions

    async def test_headless_tool_order_is_main_order_without_browser_tools(
        self,
    ) -> None:
        main_model = TestModel(call_tools=[])
        headless_model = TestModel(call_tools=[])
        deps = AgentDependencies(contexts=ResolvedContexts())

        await build_agent(model=main_model, headless=False).run("hello", deps=deps)
        await build_agent(model=headless_model, headless=True).run("hello", deps=deps)

        assert main_model.last_model_request_parameters is not None
        assert headless_model.last_model_request_parameters is not None
        main_tools = [tool.name for tool in main_model.last_model_request_parameters.function_tools]
        headless_tools = [
            tool.name for tool in headless_model.last_model_request_parameters.function_tools
        ]
        assert headless_tools == [
            tool_name for tool_name in main_tools if tool_name not in _BROWSER_TOOL_NAMES
        ]


class TestMutationPolicy:
    @pytest.mark.parametrize(
        (
            "headless",
            "edit_permission",
            "graphql_mutations_enabled",
            "allow_mutations",
            "require_mutation_approval",
        ),
        [
            (True, "manual", True, False, False),
            (True, "bypass", True, True, False),
            (False, "manual", True, True, True),
            (False, "bypass", True, True, False),
            (False, "manual", False, False, True),
        ],
    )
    def test_bash_policy_is_derived_from_run_mode_and_edit_permission(
        self,
        schema: strawberry.Schema,
        headless: bool,
        edit_permission: EditPermission,
        graphql_mutations_enabled: bool,
        allow_mutations: bool,
        require_mutation_approval: bool,
    ) -> None:
        agent = build_agent(
            model=TestModel(),
            headless=headless,
            schema=schema,
            build_graphql_context=lambda: Mock(spec=Context),
            edit_permission=edit_permission,
            graphql_mutations_enabled=graphql_mutations_enabled,
        )

        bash = _find_capability(agent, BashCapability)

        assert bash.allow_mutations is allow_mutations
        assert bash.require_mutation_approval is require_mutation_approval


class TestSubagents:
    @pytest.mark.parametrize("headless", [False, True])
    async def test_call_subagent_is_mounted_only_on_the_parent(
        self,
        model: TestModel,
        headless: bool,
    ) -> None:
        agent = build_agent(
            model=model,
            headless=headless,
            enable_subagents=True,
        )

        await agent.run(
            "hello",
            deps=AgentDependencies(contexts=ResolvedContexts()),
        )

        params = model.last_model_request_parameters
        assert params is not None
        assert "call_subagent" in {tool.name for tool in params.function_tools}
        capability = _find_capability(agent, CallSubAgentCapability)
        assert _get_capabilities(capability.subagent, CallSubAgentCapability) == []

    async def test_child_is_a_direct_headless_agent_plus_the_subagent_contract(self) -> None:
        model = TestModel(call_tools=[])
        prompts = AgentPrompts(base="CUSTOM_STATIC_SENTINEL", subagent="SUBAGENT_SENTINEL")
        parent = build_agent(
            model=model,
            headless=False,
            prompts=prompts,
            enable_subagents=True,
        )
        child = _find_capability(parent, CallSubAgentCapability).subagent
        direct_headless_agent = build_agent(
            model=model,
            headless=True,
            prompts=prompts,
        )
        deps = AgentDependencies(contexts=ResolvedContexts())

        child_result = await child.run("hello", deps=deps)
        direct_result = await direct_headless_agent.run("hello", deps=deps)

        child_instructions = child_result.all_messages()[0].instructions
        direct_instructions = direct_result.all_messages()[0].instructions
        assert child_instructions is not None
        assert direct_instructions is not None
        assert "SUBAGENT_SENTINEL" not in direct_instructions
        assert child_instructions.replace("SUBAGENT_SENTINEL", "").strip() == direct_instructions

    @pytest.mark.parametrize("headless", [False, True])
    async def test_subagent_contract_is_absent_unless_built_as_a_subagent(
        self,
        model: TestModel,
        headless: bool,
    ) -> None:
        """The contract is about being invoked by another agent, not about
        running without a browser: a headless agent still answers a human."""
        prompts = AgentPrompts(subagent="SUBAGENT_SENTINEL")
        deps = AgentDependencies(contexts=ResolvedContexts())

        result = await build_agent(model=model, headless=headless, prompts=prompts).run(
            "hello", deps=deps
        )

        instructions = result.all_messages()[0].instructions
        assert instructions is not None
        assert "SUBAGENT_SENTINEL" not in instructions

    async def test_subagent_contract_is_inside_cache_boundary(
        self,
        anthropic_model: AnthropicModel,
        captured_request: CapturedRequest,
    ) -> None:
        parent = build_agent(model=anthropic_model, enable_subagents=True)
        child = _find_capability(parent, CallSubAgentCapability).subagent
        deps = AgentDependencies(contexts=ResolvedContexts())

        await child.run("hello", deps=deps)

        cached_blocks, uncached_blocks = _partition_system_blocks_by_cache_breakpoint(
            captured_request.body
        )
        assert uncached_blocks == []
        assert _DEFAULT_PROMPTS.subagent in _get_concatenated_text(cached_blocks)

    @pytest.mark.parametrize("headless", [False, True])
    def test_factory_returns_an_unwrapped_agent(self, model: TestModel, headless: bool) -> None:
        agent = build_agent(model=model, headless=headless)
        assert type(agent) is Agent

    def test_subagent_is_wrapped_with_its_own_agent_span(self, model: TestModel) -> None:
        parent = build_agent(model=model, enable_subagents=True)
        child = _find_capability(parent, CallSubAgentCapability).subagent
        assert isinstance(child, OpenInferenceAgentWrapper)
        assert type(child.wrapped) is Agent

    @pytest.mark.parametrize("headless", [False, True])
    def test_agent_carries_the_name_it_was_built_with(
        self, model: TestModel, headless: bool
    ) -> None:
        agent = build_agent(model=model, name="CustomName", headless=headless)
        assert agent.name == "CustomName"

    def test_subagent_is_named_pxi_subagent(self, model: TestModel) -> None:
        parent = build_agent(model=model, name="PXIAgent", enable_subagents=True)
        child = _find_capability(parent, CallSubAgentCapability).subagent
        assert child.name == "PXISubagent"


@pytest.mark.parametrize("headless", [False, True])
class TestDocsMCPToolset:
    """The optional docs MCP toolset is wired into the system blocks only
    when supplied by the caller."""

    async def test_docs_tool_instructions_are_present_when_docs_mcp_server_is_provided(
        self,
        anthropic_model: AnthropicModel,
        captured_request: CapturedRequest,
        docs_mcp_server: _OfflineDocsMCPToolset,
        headless: bool,
    ) -> None:
        agent = build_agent(
            model=anthropic_model,
            headless=headless,
            docs_mcp_server=docs_mcp_server,
        )
        deps = AgentDependencies(contexts=ResolvedContexts())

        await agent.run("hello", deps=deps)

        cached_blocks, _ = _partition_system_blocks_by_cache_breakpoint(captured_request.body)
        assert _DEFAULT_PROMPTS.docs_tool in _get_concatenated_text(cached_blocks)

    async def test_docs_tool_instructions_are_absent_when_docs_mcp_server_is_omitted(
        self,
        anthropic_model: AnthropicModel,
        captured_request: CapturedRequest,
        headless: bool,
    ) -> None:
        agent = build_agent(model=anthropic_model, headless=headless)
        deps = AgentDependencies(contexts=ResolvedContexts())

        await agent.run("hello", deps=deps)

        assert _DEFAULT_PROMPTS.docs_tool not in "\n".join(_get_system_texts(captured_request.body))


@pytest.mark.parametrize("headless", [False, True])
class TestSkillsCapability:
    async def test_every_skill_advertised_inside_cache_boundary(
        self,
        anthropic_model: AnthropicModel,
        captured_request: CapturedRequest,
        headless: bool,
    ) -> None:
        agent = build_agent(model=anthropic_model, headless=headless)
        deps = AgentDependencies(contexts=ResolvedContexts())

        await agent.run("hello", deps=deps)

        cached_blocks, _ = _partition_system_blocks_by_cache_breakpoint(captured_request.body)
        cached_text = _get_concatenated_text(cached_blocks)
        assert "<available_skills>" in cached_text
        for skill in get_skills():
            assert f"<name>{skill.name}</name>" in cached_text

    async def test_catalog_is_identical_on_an_empty_and_a_fully_mounted_surface(
        self,
        anthropic_model: AnthropicModel,
        captured_request: CapturedRequest,
        headless: bool,
    ) -> None:
        """The catalog is prefix content, so navigating must not rewrite it."""
        agent = build_agent(model=anthropic_model, headless=headless)

        await agent.run("hello", deps=AgentDependencies(contexts=ResolvedContexts()))
        await agent.run("hello", deps=AgentDependencies(contexts=_FULLY_MOUNTED_CONTEXTS))

        bare, mounted = (_get_skills_catalog(body) for body in captured_request.bodies)
        assert bare == mounted

    async def test_skill_tools_are_advertised(
        self,
        anthropic_model: AnthropicModel,
        captured_request: CapturedRequest,
        headless: bool,
    ) -> None:
        agent = build_agent(model=anthropic_model, headless=headless)
        deps = AgentDependencies(contexts=ResolvedContexts())

        await agent.run("hello", deps=deps)

        tool_names = _get_tool_names(captured_request.body)
        assert "load_skill" in tool_names
        assert "read_skill_resource" in tool_names
        assert "write_span_note" in tool_names


class TestEvaluatorsSkillLoadContract:
    """Advertising the evaluators skill is not enough to make it reachable: a
    live evaluator surface must also point the agent at ``load_skill``. The
    catalog half is unconditional now, so only that direction is asserted."""

    async def test_llm_evaluator_context_directs_load_skill(
        self,
        anthropic_model: AnthropicModel,
        captured_request: CapturedRequest,
    ) -> None:
        agent = build_agent(model=anthropic_model)
        deps = AgentDependencies(
            contexts=ResolvedContexts(
                llm_evaluator=LlmEvaluatorUIContext(
                    type="llm_evaluator",
                    evaluator_node_id=None,
                ),
            ),
        )

        await agent.run("hello", deps=deps)

        all_text = "\n".join(_get_system_texts(captured_request.body))
        assert "load_skill" in all_text
        assert "evaluators" in all_text


class TestCapabilityInstructionsOverride:
    async def test_overridden_base_instruction_appears_inside_cache_boundary(
        self,
        anthropic_model: AnthropicModel,
        captured_request: CapturedRequest,
    ) -> None:
        custom = AgentPrompts(base="CUSTOM_STATIC_SENTINEL")
        agent = build_agent(model=anthropic_model, prompts=custom)
        deps = AgentDependencies(contexts=ResolvedContexts())

        await agent.run("hello", deps=deps)

        cached_blocks, _ = _partition_system_blocks_by_cache_breakpoint(captured_request.body)
        cached_text = _get_concatenated_text(cached_blocks)
        assert "CUSTOM_STATIC_SENTINEL" in cached_text
        assert _DEFAULT_PROMPTS.base not in cached_text

    async def test_overridden_skills_instruction_replaces_default_in_system_blocks(
        self,
        anthropic_model: AnthropicModel,
        captured_request: CapturedRequest,
    ) -> None:
        custom = AgentPrompts(skills=Template("CUSTOM_SKILLS_SENTINEL"))
        agent = build_agent(model=anthropic_model, prompts=custom)
        deps = AgentDependencies(contexts=ResolvedContexts())

        await agent.run("hello", deps=deps)

        joined_system = "\n".join(_get_system_texts(captured_request.body))
        assert "CUSTOM_SKILLS_SENTINEL" in joined_system
        assert "<available_skills>" not in joined_system


@pytest.mark.parametrize("headless", [False, True])
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
        headless: bool,
    ) -> None:
        agent = build_agent(
            model=model_with_web_access,
            headless=headless,
            enable_web_access=True,
        )
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
        headless: bool,
    ) -> None:
        agent = build_agent(
            model=model_with_web_access,
            headless=headless,
            enable_web_access=False,
        )
        deps = AgentDependencies(contexts=ResolvedContexts())

        await agent.run("hello", deps=deps)

        native_tool_types = self._get_native_tool_types(model_with_web_access)
        assert WebSearchTool not in native_tool_types
        assert WebFetchTool not in native_tool_types

    async def test_web_tools_absent_when_model_does_not_support_them(
        self,
        model_without_web_access: TestModel,
        headless: bool,
    ) -> None:
        agent = build_agent(
            model=model_without_web_access,
            headless=headless,
            enable_web_access=True,
        )
        deps = AgentDependencies(contexts=ResolvedContexts())

        await agent.run("hello", deps=deps)

        native_tool_types = self._get_native_tool_types(model_without_web_access)
        assert WebSearchTool not in native_tool_types
        assert WebFetchTool not in native_tool_types

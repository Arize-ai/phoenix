from __future__ import annotations

import json
from collections.abc import Iterable
from dataclasses import dataclass, field
from typing import Any

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
from pydantic_ai import RunContext
from pydantic_ai.models.anthropic import AnthropicModel, AnthropicModelSettings
from pydantic_ai.models.test import TestModel
from pydantic_ai.providers.anthropic import AnthropicProvider
from pydantic_ai.usage import RunUsage
from typing_extensions import TypeIs, assert_never

from phoenix.server.agents.agent_factory import build_agent
from phoenix.server.agents.context import (
    PlaygroundContext,
    ProjectContext,
    ResolvedContexts,
)
from phoenix.server.agents.prompts import AgentInstructions
from phoenix.server.agents.toolsets.docs_mcp import MintlifyDocsMCPServer
from phoenix.server.agents.toolsets.external import build_external_tools
from phoenix.server.agents.toolsets.external.external_tool_definitions import (
    DynamicExternalToolDefinition,
    StaticExternalToolDefinition,
)
from phoenix.server.agents.types import AgentDependencies

_DEFAULT_INSTRUCTIONS = AgentInstructions()


def _partition_tool_instructions() -> tuple[frozenset[str], frozenset[str]]:
    """Build every external tool with default instructions and partition the
    resulting instruction texts by tool-definition subclass:
    ``StaticExternalToolDefinition`` lands in the cacheable set,
    ``DynamicExternalToolDefinition`` in the per-turn set. Sourcing this from
    the tool definitions themselves keeps the test in sync as tools are added
    or moved between Static and Dynamic."""
    default_ctx: RunContext[AgentDependencies] = RunContext(
        deps=AgentDependencies(
            contexts=ResolvedContexts(),
        ),
        model=TestModel(),
        usage=RunUsage(),
    )
    static_tool_instructions: set[str] = set()
    dynamic_tool_instructions: set[str] = set()
    for tool in build_external_tools(_DEFAULT_INSTRUCTIONS):
        content = tool.get_instruction_part(default_ctx).content
        if isinstance(tool, StaticExternalToolDefinition):
            static_tool_instructions.add(content)
        elif isinstance(tool, DynamicExternalToolDefinition):
            dynamic_tool_instructions.add(content)
        else:
            raise AssertionError(f"unexpected tool definition type: {type(tool).__name__}")
    return frozenset(static_tool_instructions), frozenset(dynamic_tool_instructions)


STATIC_TOOL_INSTRUCTIONS, DYNAMIC_TOOL_INSTRUCTIONS = _partition_tool_instructions()


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
    ``httpx.MockTransport``-backed stub. The settings mirror
    ``model_factory._anthropic_cache_settings`` so the request body carries
    the ``cache_control`` breakpoint the cache-boundary tests rely on."""

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
    settings = AnthropicModelSettings(
        anthropic_cache=True,
        anthropic_cache_instructions=True,
        anthropic_cache_tool_definitions=True,
    )
    return AnthropicModel("claude-haiku-4-5", provider=provider, settings=settings)


class _OfflineDocsMCPToolset(MintlifyDocsMCPServer):
    """``MintlifyDocsMCPServer`` with the MCP transport short-circuited.

    Overrides ``get_tools`` to return an empty tool dict and the async
    context-manager protocol to no-op, so the agent run never opens an
    HTTP/SSE session to the real Mintlify endpoint. ``get_instructions`` is
    inherited and still emits the default docs-tool instruction as a static
    instruction part — which is what the docs-tool tests assert on.
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
        cached_texts = [block["text"] for block in cached_blocks if block.get("type") == "text"]
        assert _DEFAULT_INSTRUCTIONS.base in cached_texts

    async def test_static_tool_instructions_are_inside_cache_boundary(
        self,
        anthropic_model: AnthropicModel,
        captured_request: CapturedRequest,
    ) -> None:
        agent = build_agent(model=anthropic_model)
        deps = AgentDependencies(contexts=ResolvedContexts())

        await agent.run("hello", deps=deps)

        cached_blocks, _ = _partition_system_blocks_by_cache_breakpoint(captured_request.body)
        cached_texts = {block["text"] for block in cached_blocks if block.get("type") == "text"}
        for static_prompt in STATIC_TOOL_INSTRUCTIONS:
            assert static_prompt in cached_texts

    async def test_dynamic_tool_instructions_are_outside_cache_boundary(
        self,
        anthropic_model: AnthropicModel,
        captured_request: CapturedRequest,
    ) -> None:
        agent = build_agent(model=anthropic_model)
        deps = AgentDependencies(
            contexts=ResolvedContexts(
                playground=PlaygroundContext(type="playground", instance_ids=[1]),
                project=ProjectContext(
                    type="project",
                    project_node_id="UHJvamVjdDox",
                    span_filter="",
                ),
            ),
        )

        await agent.run("hello", deps=deps)

        _, uncached_blocks = _partition_system_blocks_by_cache_breakpoint(captured_request.body)
        uncached_texts = {block["text"] for block in uncached_blocks if block.get("type") == "text"}
        for dynamic_prompt in DYNAMIC_TOOL_INSTRUCTIONS:
            assert dynamic_prompt in uncached_texts

    async def test_cache_breakpoint_is_marked_on_the_last_static_system_block(
        self,
        anthropic_model: AnthropicModel,
        captured_request: CapturedRequest,
    ) -> None:
        """The breakpoint must sit on the final static block: every block at
        or before it should be a known static prompt (agent prompt or
        static-tool prompt), and every block after it should be something
        else."""
        agent = build_agent(model=anthropic_model)
        deps = AgentDependencies(
            contexts=ResolvedContexts(
                playground=PlaygroundContext(type="playground", instance_ids=[1]),
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

        static_texts = {_DEFAULT_INSTRUCTIONS.base, *STATIC_TOOL_INSTRUCTIONS}
        for block in cached_blocks:
            assert block.get("type") == "text"
            assert block["text"] in static_texts

        for block in uncached_blocks:
            assert block.get("type") == "text"
            assert block["text"] not in static_texts

    async def test_no_cache_breakpoint_is_marked_on_dynamic_system_blocks(
        self,
        anthropic_model: AnthropicModel,
        captured_request: CapturedRequest,
    ) -> None:
        agent = build_agent(model=anthropic_model)
        deps = AgentDependencies(
            contexts=ResolvedContexts(
                playground=PlaygroundContext(type="playground", instance_ids=[1]),
                project=ProjectContext(
                    type="project",
                    project_node_id="UHJvamVjdDox",
                    span_filter="",
                ),
            ),
        )

        await agent.run("hello", deps=deps)

        cached_blocks, _ = _partition_system_blocks_by_cache_breakpoint(captured_request.body)
        cached_texts = {block["text"] for block in cached_blocks if block.get("type") == "text"}
        for dynamic_prompt in DYNAMIC_TOOL_INSTRUCTIONS:
            assert dynamic_prompt not in cached_texts


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
        cached_texts = {block["text"] for block in cached_blocks if block.get("type") == "text"}
        assert _DEFAULT_INSTRUCTIONS.docs_tool in cached_texts

    async def test_docs_tool_instructions_are_absent_when_docs_mcp_server_is_omitted(
        self,
        anthropic_model: AnthropicModel,
        captured_request: CapturedRequest,
    ) -> None:
        agent = build_agent(model=anthropic_model)
        deps = AgentDependencies(contexts=ResolvedContexts())

        await agent.run("hello", deps=deps)

        assert _DEFAULT_INSTRUCTIONS.docs_tool not in _get_system_texts(captured_request.body)


class TestAgentInstructionsOverride:
    async def test_overridden_base_instruction_appears_inside_cache_boundary(
        self,
        anthropic_model: AnthropicModel,
        captured_request: CapturedRequest,
    ) -> None:
        custom = AgentInstructions(base="CUSTOM_STATIC_SENTINEL")
        agent = build_agent(model=anthropic_model, instructions=custom)
        deps = AgentDependencies(contexts=ResolvedContexts())

        await agent.run("hello", deps=deps)

        cached_blocks, _ = _partition_system_blocks_by_cache_breakpoint(captured_request.body)
        cached_texts = [block["text"] for block in cached_blocks if block.get("type") == "text"]
        assert "CUSTOM_STATIC_SENTINEL" in cached_texts
        assert _DEFAULT_INSTRUCTIONS.base not in cached_texts

    async def test_overridden_tool_instruction_replaces_default_in_system_blocks(
        self,
        anthropic_model: AnthropicModel,
        captured_request: CapturedRequest,
    ) -> None:
        custom = AgentInstructions(bash_tool="CUSTOM_BASH_SENTINEL")
        agent = build_agent(model=anthropic_model, instructions=custom)
        deps = AgentDependencies(contexts=ResolvedContexts())

        await agent.run("hello", deps=deps)

        texts = _get_system_texts(captured_request.body)
        assert "CUSTOM_BASH_SENTINEL" in texts
        assert _DEFAULT_INSTRUCTIONS.bash_tool not in texts

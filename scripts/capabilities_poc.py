"""POC: pydantic-ai capabilities — a single agent that bundles UI tools,
an external toolset, and per-run context capabilities driven by a bespoke
deps object.

Usage:
    OPENAI_API_KEY=... uv run python scripts/capabilities_poc.py

Static vs dynamic — the rule:
  get_instructions() returns a `str`        → InstructionPart(dynamic=False)
      sits INSIDE the Anthropic cache prefix. Use for session-stable
      content captured on the capability's dataclass at build time.
  get_instructions() returns a Callable     → InstructionPart(dynamic=True)
      sits OUTSIDE the cache breakpoint. Required whenever you need
      ctx.deps. Returning None from the callable contributes nothing
      that turn.

To actually place the cache breakpoint, configure the Anthropic provider:
    model_settings=AnthropicModelSettings(anthropic_cache_instructions=True)
or contribute that setting from a capability via get_model_settings().
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any

from pydantic_ai import Agent, RunContext
from pydantic_ai._instructions import AgentInstructions
from pydantic_ai.capabilities import AbstractCapability, AgentDepsT, CombinedCapability
from pydantic_ai.tools import SystemPromptFunc, ToolDefinition
from pydantic_ai.toolsets import AgentToolset, FunctionToolset

OPENAI_MODEL = "openai:gpt-4o-mini"


def print_system_prompt(result: Any) -> None:
    """Print every SystemPromptPart the model actually received."""
    print("\n--- SYSTEM PROMPT ---")
    for msg in result.all_messages():
        for part in getattr(msg, "parts", []):
            if part.__class__.__name__ == "SystemPromptPart":
                print(part.content)


# =====================================================================
# Abstract base classes — split AbstractCapability by instruction style
# =====================================================================
#
# AbstractStaticCapability: instruction is a fixed `str` captured at build
# time → InstructionPart(dynamic=False) → INSIDE the cache prefix.
#
# AbstractDynamicCapability: instruction is a callable returning a `str` per
# run → InstructionPart(dynamic=True) → OUTSIDE the cache prefix. Subclasses
# must implement `include_for_run` so the build_capabilities helper can
# decide whether to include them in the per-run bundle.


@dataclass
class AbstractStaticCapability(AbstractCapability[AgentDepsT], ABC):
    """A capability whose instruction is a fixed string."""

    @abstractmethod
    def get_static_instructions(self) -> str: ...

    def get_instructions(self) -> AgentInstructions[AgentDepsT] | None:
        return self.get_static_instructions()


@dataclass
class AbstractDynamicCapability(AbstractCapability[AgentDepsT], ABC):
    """A capability whose instruction is produced per-run via a callable."""

    @abstractmethod
    def get_dynamic_instructions(self) -> SystemPromptFunc[AgentDepsT]: ...

    @abstractmethod
    def include_for_run(self, ctx: RunContext[AgentDepsT]) -> bool: ...

    def get_instructions(self) -> AgentInstructions[AgentDepsT] | None:
        return self.get_dynamic_instructions()


# =====================================================================
# UI tool capabilities — each bundles ONE tool with its instruction
# =====================================================================

SET_SPANS_FILTER_INSTRUCTIONS = """\
<set_spans_filter>
  Use set_spans_filter to narrow the visible spans. The expression uses
  Phoenix's filter DSL (e.g. status_code == 'OK').
</set_spans_filter>
"""


@dataclass
class SetSpansFilterCapability(AbstractStaticCapability[Any]):
    """Bundles ONE tool definition with its instruction."""

    def get_toolset(self) -> AgentToolset[Any] | None:
        toolset = FunctionToolset[Any]()

        @toolset.tool_plain
        def set_spans_filter(expression: str) -> str:
            """Apply a spans filter expression to the UI."""
            return f"applied filter: {expression!r}"

        return toolset

    def get_static_instructions(self) -> str:
        return SET_SPANS_FILTER_INSTRUCTIONS


@dataclass
class SetTimeRangeCapability(AbstractStaticCapability[Any]):
    """A second tool capability — combines with the first automatically."""

    def get_toolset(self) -> AgentToolset[Any] | None:
        toolset = FunctionToolset[Any]()

        @toolset.tool_plain
        def set_time_range(start_iso: str, end_iso: str) -> str:
            """Set the visible time range in the UI."""
            return f"applied range: {start_iso}..{end_iso}"

        return toolset

    def get_static_instructions(self) -> str:
        return "<set_time_range>Use to constrain the visible time window.</set_time_range>"


# =====================================================================
# External toolset paired with an aggregate instruction (MCP pattern)
# =====================================================================

DOCS_INSTRUCTIONS = """\
<docs_toolset>
  Prefer search_docs over get_page when you don't already know the path.
  Always cite the page path you used in your final answer.
</docs_toolset>
"""


def _build_docs_toolset() -> FunctionToolset[Any]:
    """Stand-in for MintlifyDocsMCPServer — pretend this came off the wire."""
    toolset = FunctionToolset[Any]()

    @toolset.tool_plain
    def search_docs(query: str) -> str:
        """Search the docs index."""
        return f"docs search result for {query!r}"

    @toolset.tool_plain
    def get_page(path: str) -> str:
        """Fetch a doc page by path."""
        return f"page contents for {path!r}"

    return toolset


@dataclass
class ToolsetWithInstructions(AbstractStaticCapability[Any]):
    """Pair an opaque toolset with one aggregate instruction.

    Drop in a real MCPToolset and the pattern is identical.
    """

    toolset: AgentToolset[Any]
    instructions: str

    def get_toolset(self) -> AgentToolset[Any] | None:
        return self.toolset

    def get_static_instructions(self) -> str:
        return self.instructions


# =====================================================================
# Bespoke context + per-run capability factory
# =====================================================================


@dataclass
class PhoenixContext:
    """Stand-in for the PR's GraphQLContext."""

    project_id: str | None = None
    span_id: str | None = None
    graphql_mutations_enabled: bool = False


@dataclass
class GraphQLMutationsCapability(AbstractDynamicCapability[PhoenixContext]):
    """DYNAMIC — instruction content varies by `deps.graphql_mutations_enabled`.

    Always included (the model needs to know whether mutations are available);
    the dynamic callable picks the ENABLED / DISABLED message per-run.
    """

    def get_dynamic_instructions(self):
        def _instructions(ctx: RunContext[PhoenixContext]) -> str:
            if ctx.deps.graphql_mutations_enabled:
                return "<graphql>You may invoke GraphQL mutations.</graphql>"
            return "<graphql>GraphQL mutations are DISABLED this session.</graphql>"

        return _instructions

    def include_for_run(self, ctx: RunContext[PhoenixContext]) -> bool:
        return True


@dataclass
class AskUserCapability(AbstractStaticCapability[PhoenixContext]):
    """STATIC — generic interaction primitive; instruction is fixed."""

    def get_toolset(self) -> AgentToolset[PhoenixContext] | None:
        toolset = FunctionToolset[PhoenixContext]()

        @toolset.tool_plain
        def ask_user(question: str) -> str:
            """Ask the user a clarifying question; return their response."""
            return f"(user response to {question!r})"

        return toolset

    def get_static_instructions(self) -> str:
        return (
            "<ask_user>If you need clarification before acting, call ask_user "
            "with a focused question.</ask_user>"
        )


@dataclass
class ProjectContextCapability(AbstractDynamicCapability[PhoenixContext]):
    """DYNAMIC — instruction reads ctx.deps per run → OUTSIDE the cache."""

    def get_dynamic_instructions(self):
        def _instructions(ctx: RunContext[PhoenixContext]) -> str:
            return f"<active_project>Viewing project {ctx.deps.project_id}.</active_project>"

        return _instructions

    def include_for_run(self, ctx: RunContext[PhoenixContext]) -> bool:
        return ctx.deps.project_id is not None


@dataclass
class SpanContextCapability(AbstractDynamicCapability[PhoenixContext]):
    """DYNAMIC — same pattern as ProjectContextCapability."""

    def get_dynamic_instructions(self):
        def _instructions(ctx: RunContext[PhoenixContext]) -> str:
            return f"<active_span>Inspecting span {ctx.deps.span_id}.</active_span>"

        return _instructions

    def include_for_run(self, ctx: RunContext[PhoenixContext]) -> bool:
        return ctx.deps.span_id is not None


@dataclass
class WhereAmICapability(AbstractDynamicCapability[PhoenixContext]):
    """A tool capability gated per-run by `include_for_run`."""

    def get_toolset(self) -> AgentToolset[PhoenixContext] | None:
        toolset = FunctionToolset[PhoenixContext]()

        @toolset.tool
        def where_am_i(ctx: RunContext[PhoenixContext]) -> dict[str, Any]:
            """Report the user's current UI position."""
            return {
                "project_id": ctx.deps.project_id,
                "span_id": ctx.deps.span_id,
            }

        return toolset

    def get_dynamic_instructions(self):
        def _instructions(ctx: RunContext[PhoenixContext]) -> str:
            return (
                "<where_am_i>Call where_am_i to read the user's current UI position.</where_am_i>"
            )

        return _instructions

    def include_for_run(self, ctx: RunContext[PhoenixContext]) -> bool:
        return ctx.deps.project_id is not None or ctx.deps.span_id is not None


# --- Tool-level dynamic mounting via `prepare` ---------------------------
#
# `ToolPrepareFunc = (ctx, tool_def) -> ToolDefinition | None`
#
# Attached via `@toolset.tool(prepare=...)`. Called once per run, like
# `CapabilityFunc` — return the def to mount the tool, `None` to omit it.
# The capability itself stays mounted; only the tool inside is gated.


def _only_with_project(
    ctx: RunContext[PhoenixContext],
    tool_def: ToolDefinition,
) -> ToolDefinition | None:
    return tool_def if ctx.deps.project_id else None


@dataclass
class ProjectActionsCapability(AbstractDynamicCapability[PhoenixContext]):
    """Dynamic — gated by `include_for_run` (project_id present).

    The tool also carries a `prepare` gate; once the capability self-gates
    via `include_for_run` the prepare check is redundant but kept here to
    illustrate the tool-level mechanism.
    """

    def get_toolset(self) -> AgentToolset[PhoenixContext] | None:
        toolset = FunctionToolset[PhoenixContext]()

        @toolset.tool(prepare=_only_with_project)
        def set_active_project_label(ctx: RunContext[PhoenixContext], label: str) -> str:
            """Set a label on the active project."""
            return f"labeled {ctx.deps.project_id}: {label!r}"

        return toolset

    def get_dynamic_instructions(self):
        def _instructions(ctx: RunContext[PhoenixContext]) -> str:
            return (
                "<set_active_project_label>"
                "Use set_active_project_label to label the active project."
                "</set_active_project_label>"
            )

        return _instructions

    def include_for_run(self, ctx: RunContext[PhoenixContext]) -> bool:
        return ctx.deps.project_id is not None


def build_capabilities(
    ctx: RunContext[PhoenixContext],
) -> AbstractCapability[PhoenixContext]:
    """Build the per-run context bundle from deps.

    Static capabilities are always included; their content may still depend
    on deps (e.g. `GraphQLMutationsCapability` reads `graphql_mutations_enabled`).
    Dynamic capabilities self-gate via `include_for_run`.
    """
    static_capabilities: list[AbstractStaticCapability[PhoenixContext]] = [
        AskUserCapability(),
    ]
    dynamic_capabilities: list[AbstractDynamicCapability[PhoenixContext]] = [
        GraphQLMutationsCapability(),
        ProjectContextCapability(),
        SpanContextCapability(),
        WhereAmICapability(),
        ProjectActionsCapability(),
    ]
    included_dynamic = [cap for cap in dynamic_capabilities if cap.include_for_run(ctx)]
    return CombinedCapability(
        capabilities=[*static_capabilities, *included_dynamic],
    )


# =====================================================================
# Single agent + single run
# =====================================================================


def main() -> None:
    agent = Agent(
        OPENAI_MODEL,
        deps_type=PhoenixContext,
        instructions="You help the user navigate the Phoenix UI.",
        capabilities=[
            SetSpansFilterCapability(),
            SetTimeRangeCapability(),
            ToolsetWithInstructions(
                toolset=_build_docs_toolset(),
                instructions=DOCS_INSTRUCTIONS,
            ),
            build_capabilities,  # CapabilityFunc → CombinedCapability of context caps
        ],
    )

    deps = PhoenixContext(
        project_id="proj-42",
        span_id="span-abc",
        graphql_mutations_enabled=True,
    )
    result = agent.run_sync(
        "Where am I, and apply a filter to show only error spans.",
        deps=deps,
    )
    print(result.output)
    print_system_prompt(result)


if __name__ == "__main__":
    main()

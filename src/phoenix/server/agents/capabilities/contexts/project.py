from __future__ import annotations

from dataclasses import dataclass

from pydantic_ai import RunContext
from pydantic_ai.tools import SystemPromptFunc

from phoenix.server.agents.capabilities.base import AbstractDynamicCapability
from phoenix.server.agents.context import sanitize_untrusted_value
from phoenix.server.agents.types import AgentDependencies

_MAX_CONDITION_CHARS = 512


@dataclass
class ProjectContextCapability(AbstractDynamicCapability[AgentDependencies]):
    instructions: str

    def get_dynamic_instructions(self) -> SystemPromptFunc[AgentDependencies]:
        instructions = self.instructions

        def _instructions(ctx: RunContext[AgentDependencies]) -> str | None:
            project = ctx.deps.contexts.project
            if project is None:
                return None
            sub_lines: list[str] = []
            if project.span_filter is not None:
                if project.span_filter:
                    condition = sanitize_untrusted_value(
                        project.span_filter,
                        enclosing_tag="phoenix_project_context",
                        max_chars=_MAX_CONDITION_CHARS,
                    )
                    sub_lines.append(
                        f'  <span_filter status="applied">'
                        f"<condition>{condition}</condition>"
                        f"</span_filter>"
                    )
                else:
                    sub_lines.append('  <span_filter status="available"/>')
            if project.root_spans_only is True:
                sub_lines.append("  <spans_table_view>root_spans_only</spans_table_view>")
                sub_lines.append(
                    "  <spans_table_guidance>To include non-root spans on the next "
                    "`set_spans_filter` call, set `rootSpansOnly: false`."
                    "</spans_table_guidance>"
                )
            elif project.root_spans_only is False:
                sub_lines.append("  <spans_table_view>all_spans</spans_table_view>")
            optional_fields = "\n" + "\n".join(sub_lines) if sub_lines else ""
            return instructions.format(
                project_node_id=project.project_node_id,
                optional_fields=optional_fields,
            )

        return _instructions

    def include_for_run(self, ctx: RunContext[AgentDependencies]) -> bool:
        return ctx.deps.contexts.project is not None

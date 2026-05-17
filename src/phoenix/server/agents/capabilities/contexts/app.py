from __future__ import annotations

from dataclasses import dataclass

from pydantic_ai import RunContext
from pydantic_ai.tools import SystemPromptFunc

from phoenix.server.agents.capabilities.base import AbstractDynamicCapability
from phoenix.server.agents.context import sanitize_untrusted_value
from phoenix.server.agents.types import AgentDependencies

_MAX_SHORT_FIELD_CHARS = 128


@dataclass
class AppContextCapability(AbstractDynamicCapability[AgentDependencies]):
    instructions: str

    def get_dynamic_instructions(self) -> SystemPromptFunc[AgentDependencies]:
        instructions = self.instructions

        def _instructions(ctx: RunContext[AgentDependencies]) -> str | None:
            app_context = ctx.deps.contexts.app
            if app_context is None:
                return None
            current_browser_datetime = sanitize_untrusted_value(
                app_context.current_date_time,
                enclosing_tag="phoenix_app_context",
                max_chars=_MAX_SHORT_FIELD_CHARS,
            )
            time_zone = sanitize_untrusted_value(
                app_context.time_zone,
                enclosing_tag="phoenix_app_context",
                max_chars=_MAX_SHORT_FIELD_CHARS,
            )
            return instructions.format(
                current_browser_datetime=current_browser_datetime,
                time_zone=time_zone,
            )

        return _instructions

    def include_for_run(self, ctx: RunContext[AgentDependencies]) -> bool:
        return ctx.deps.contexts.app is not None

"""Capabilities the Phoenix agent is assembled from.

Every capability here contributes to the system prompt, and the system prompt is
the front of the prefix the model provider caches. Keep what a capability
contributes — its instructions, tool definitions, and tool descriptions — a
function of process-lifetime state only, never of the current run: deps, the page
the user is on, the message history, or the wall clock. A capability that varies
with per-run state rewrites the prefix, which throws away the cached work for the
whole conversation behind it.

Per-turn data belongs on the turn instead. See
:mod:`phoenix.server.agents.ui_state`, which carries what the user is looking at
as a ``<phoenix_ui_state>`` block on their message rather than as instructions.
"""

from phoenix.server.agents.capabilities.anthropic_prompt_cache import (
    AnthropicPromptCacheCapability,
    build_anthropic_prompt_cache_capability,
)
from phoenix.server.agents.capabilities.contexts import UIContextsCapability
from phoenix.server.agents.capabilities.docs_mcp import (
    MintlifyDocsMCPCapability,
    MintlifyDocsMCPServer,
)
from phoenix.server.agents.capabilities.native_tool_retry import (
    NativeToolRetryCapability,
)
from phoenix.server.agents.capabilities.skills import SkillsCapability
from phoenix.server.agents.capabilities.tools.external import (
    get_external_tool_capability_function,
    get_external_tool_definition,
)

__all__ = [
    "AnthropicPromptCacheCapability",
    "build_anthropic_prompt_cache_capability",
    "MintlifyDocsMCPCapability",
    "MintlifyDocsMCPServer",
    "NativeToolRetryCapability",
    "SkillsCapability",
    "UIContextsCapability",
    "get_external_tool_capability_function",
    "get_external_tool_definition",
]

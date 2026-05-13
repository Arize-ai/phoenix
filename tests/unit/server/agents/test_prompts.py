from phoenix.server.agents.agent_capabilities import AgentCapabilities
from phoenix.server.agents.prompts import (
    AGENT_STATIC_SYSTEM_PROMPT,
    build_agent_dynamic_system_prompt,
)


class TestAgentPrompts:
    def test_static_prompt_contains_server_owned_guidance(self) -> None:
        assert AGENT_STATIC_SYSTEM_PROMPT.startswith("<role>")
        assert '<tool name="bash">' in AGENT_STATIC_SYSTEM_PROMPT
        assert '<tool name="ask_user">' in AGENT_STATIC_SYSTEM_PROMPT
        assert "<link_formatting>" in AGENT_STATIC_SYSTEM_PROMPT

    def test_dynamic_prompt_renders_capability_guidance(self) -> None:
        prompt = build_agent_dynamic_system_prompt(
            capabilities=AgentCapabilities(graphql_mutations=True),
        )

        assert prompt is not None
        assert prompt.startswith("Runtime capability state for this conversation:")
        assert "GraphQL mutations are enabled" in prompt

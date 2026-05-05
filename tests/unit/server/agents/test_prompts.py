from phoenix.server.agents.capabilities import AgentCapabilities
from phoenix.server.agents.prompts import (
    AGENT_STATIC_SYSTEM_PROMPT,
    build_agent_dynamic_system_prompt,
    build_agent_system_prompts,
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

    def test_system_prompts_keep_static_prefix_separate_from_dynamic_prompt(self) -> None:
        prompts = build_agent_system_prompts(
            capabilities=AgentCapabilities(graphql_mutations=False),
        )

        assert len(prompts) == 2
        assert prompts[0] == AGENT_STATIC_SYSTEM_PROMPT
        assert prompts[1].startswith("Runtime capability state for this conversation:")

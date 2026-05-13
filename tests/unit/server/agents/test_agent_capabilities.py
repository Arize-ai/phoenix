from phoenix.server.agents.agent_capabilities import (
    _CAPABILITY_PROMPT_RULES,
    AgentCapabilities,
    build_capability_system_prompt,
)


class TestAgentCapabilities:
    def test_parses_capability_aliases(self) -> None:
        capabilities = AgentCapabilities.model_validate(
            {
                "bash.retainInactiveSessions": True,
                "graphql.mutations": True,
            }
        )

        assert capabilities.bash_retain_inactive_sessions is True
        assert capabilities.graphql_mutations is True

    def test_builds_graphql_mutation_guidance(self) -> None:
        disabled = build_capability_system_prompt(AgentCapabilities(graphql_mutations=False))
        enabled = build_capability_system_prompt(AgentCapabilities(graphql_mutations=True))

        assert "GraphQL mutations are disabled" in disabled
        assert "GraphQL mutations are enabled" in enabled

    def test_prompt_rules_cover_every_capability(self) -> None:
        assert {rule.field_name for rule in _CAPABILITY_PROMPT_RULES} == set(
            AgentCapabilities.model_fields
        )

    def test_bash_retain_inactive_sessions_is_prompt_noop(self) -> None:
        disabled = build_capability_system_prompt(
            AgentCapabilities(bash_retain_inactive_sessions=False)
        )
        enabled = build_capability_system_prompt(
            AgentCapabilities(bash_retain_inactive_sessions=True)
        )

        assert enabled == disabled

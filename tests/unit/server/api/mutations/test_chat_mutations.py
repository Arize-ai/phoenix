from dataclasses import dataclass, field
from typing import Any

import pytest
from pydantic_ai.native_tools import WebSearchTool

from phoenix.server.agents.exceptions import ProviderCredentialsError
from tests.unit.graphql import AsyncGraphQLClient

AGENT_MODEL_CAPABILITIES_MUTATION = """
  mutation AgentModelCapabilities($model: AgentModelSelectionInput!) {
    agentModelCapabilities(model: $model) {
      supportsWebSearch
    }
  }
"""


@dataclass
class _FakeProfile:
    supported_native_tools: frozenset[type] = field(default_factory=frozenset)


@dataclass
class _FakeModel:
    profile: _FakeProfile
    # `build_web_search_capability` inspects these to apply the OpenAI-family
    # denylist. Default to a non-OpenAI provider so the profile alone drives
    # support resolution in these mutation tests.
    system: str = "anthropic"
    model_name: str = "claude-x"


class TestAgentModelCapabilitiesMutation:
    async def test_is_a_mutation_not_a_query(
        self,
        gql_client: AsyncGraphQLClient,
    ) -> None:
        """Security regression: agentModelCapabilities must be a mutation, not a
        query. The resolver decrypts provider secrets, which must not be reachable
        through the unauthenticated Query surface.
        """
        introspection = """
          query SchemaShape {
            queryType: __type(name: "Query") { fields { name } }
            mutationType: __type(name: "Mutation") { fields { name } }
          }
        """
        result = await gql_client.execute(query=introspection)
        assert not result.errors
        assert result.data is not None

        query_field_names = {f["name"] for f in result.data["queryType"]["fields"]}
        mutation_field_names = {f["name"] for f in result.data["mutationType"]["fields"]}

        assert "agentModelCapabilities" not in query_field_names, (
            "agentModelCapabilities must not be exposed as a Query field — it "
            "decrypts provider secrets and would be reachable without authentication."
        )
        assert "agentModelCapabilities" in mutation_field_names

    async def test_reports_web_search_support_when_model_supports_it(
        self,
        gql_client: AsyncGraphQLClient,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        async def _fake_build_model(*_args: Any, **_kwargs: Any) -> _FakeModel:
            return _FakeModel(profile=_FakeProfile(frozenset({WebSearchTool})))

        monkeypatch.setattr(
            "phoenix.server.api.mutations.chat_mutations.build_model",
            _fake_build_model,
        )

        result = await gql_client.execute(
            query=AGENT_MODEL_CAPABILITIES_MUTATION,
            variables={"model": {"builtin": {"provider": "OPENAI", "modelName": "gpt-4o"}}},
            operation_name="AgentModelCapabilities",
        )
        assert not result.errors
        assert result.data is not None
        assert result.data["agentModelCapabilities"]["supportsWebSearch"] is True

    async def test_reports_no_web_search_when_model_lacks_it(
        self,
        gql_client: AsyncGraphQLClient,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        async def _fake_build_model(*_args: Any, **_kwargs: Any) -> _FakeModel:
            return _FakeModel(profile=_FakeProfile(frozenset()))

        monkeypatch.setattr(
            "phoenix.server.api.mutations.chat_mutations.build_model",
            _fake_build_model,
        )

        result = await gql_client.execute(
            query=AGENT_MODEL_CAPABILITIES_MUTATION,
            variables={"model": {"builtin": {"provider": "ANTHROPIC", "modelName": "claude-x"}}},
            operation_name="AgentModelCapabilities",
        )
        assert not result.errors
        assert result.data is not None
        assert result.data["agentModelCapabilities"]["supportsWebSearch"] is False

    async def test_treats_provider_errors_as_unsupported(
        self,
        gql_client: AsyncGraphQLClient,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        async def _raise_credentials_error(*_args: Any, **_kwargs: Any) -> _FakeModel:
            raise ProviderCredentialsError("missing key")

        monkeypatch.setattr(
            "phoenix.server.api.mutations.chat_mutations.build_model",
            _raise_credentials_error,
        )

        result = await gql_client.execute(
            query=AGENT_MODEL_CAPABILITIES_MUTATION,
            variables={"model": {"builtin": {"provider": "OPENAI", "modelName": "gpt-4o"}}},
            operation_name="AgentModelCapabilities",
        )
        assert not result.errors
        assert result.data is not None
        assert result.data["agentModelCapabilities"]["supportsWebSearch"] is False

    async def test_rejects_oneof_with_both_variants(
        self,
        gql_client: AsyncGraphQLClient,
    ) -> None:
        result = await gql_client.execute(
            query=AGENT_MODEL_CAPABILITIES_MUTATION,
            variables={
                "model": {
                    "builtin": {"provider": "OPENAI", "modelName": "gpt-4o"},
                    "custom": {"providerId": "abc", "modelName": "x"},
                }
            },
            operation_name="AgentModelCapabilities",
        )
        assert result.errors

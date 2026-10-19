"""Saving decisions as prompts are saved: versions are immutable, tags move between them."""

from typing import Any

from strawberry.relay import GlobalID

from tests.unit.graphql import AsyncGraphQLClient

DECISION_FIELDS = """
  id
  name
  description
  metadata
  versionCount
  versionTags { name decisionVersionId }
  version {
    id
    description
    schemaVersion
    modelProvider
    modelName
    inputs { name }
    state {
      __typename
      ... on DecisionInputState { input }
    }
    questions {
      __typename
      ... on DecisionPredicateQuestion { name instructions }
      ... on DecisionChoiceQuestion { name choices { value } }
    }
    tags { name }
  }
"""

CREATE = f"""
mutation ($input: CreateDecisionInput!) {{
  createDecision(input: $input) {{ {DECISION_FIELDS} }}
}}
"""

CREATE_VERSION = f"""
mutation ($input: CreateDecisionVersionInput!) {{
  createDecisionVersion(input: $input) {{ {DECISION_FIELDS} }}
}}
"""

PATCH = """
mutation ($input: PatchDecisionInput!) {
  patchDecision(input: $input) { description metadata }
}
"""

DELETE = """
mutation ($input: DeleteDecisionInput!) {
  deleteDecision(input: $input) { query { decisions { edges { node { id } } } } }
}
"""

SET_TAG = """
mutation ($input: SetDecisionVersionTagInput!) {
  setDecisionVersionTag(input: $input) {
    decisionVersionTag { id name decisionVersionId }
    decision { versionTags { name decisionVersionId } }
  }
}
"""

DELETE_TAG = """
mutation ($input: DeleteDecisionVersionTagInput!) {
  deleteDecisionVersionTag(input: $input) {
    decisionVersionTag { id }
    decision { versionTags { name } }
  }
}
"""

VERSION_BY = """
query ($id: ID!, $versionId: ID, $tagName: Identifier) {
  node(id: $id) {
    ... on Decision {
      version(versionId: $versionId, tagName: $tagName) { id modelName }
      versions { edges { node { id } } }
    }
  }
}
"""

DECISIONS = """
query { decisions { edges { node { name } } } }
"""

CREATE_CUSTOM_PROVIDER = """
mutation ($input: CreateGenerativeModelCustomProviderMutationInput!) {
  createGenerativeModelCustomProvider(input: $input) { provider { id } }
}
"""

TYPESAFE_PROVIDER_CONFIG = {
    "typesafe": {
        "typesafeAuthenticationMethod": {"apiKey": "ts-custom-key"},
        "typesafeClientKwargs": {"baseUrl": "https://system-one.example"},
    }
}


def version_input(**overrides: Any) -> dict[str, Any]:
    return {
        "inputs": [{"name": "ticket"}],
        "state": {"input": "ticket"},
        "questions": [
            {"predicate": {"name": "urgent", "instructions": "Is the ticket urgent?"}},
            {
                "choice": {
                    "name": "team",
                    "instructions": "Which team owns it?",
                    "choices": [{"value": "billing"}, {"value": "technical"}],
                }
            },
        ],
        "modelProvider": "TYPESAFE",
        "modelName": "tev1",
        **overrides,
    }


async def create(gql_client: AsyncGraphQLClient, **input: Any) -> dict[str, Any]:
    result = await gql_client.execute(
        CREATE,
        variables={"input": {"name": "triage", "version": version_input(), **input}},
    )
    assert result.data and not result.errors, result.errors
    decision: dict[str, Any] = result.data["createDecision"]
    return decision


async def error_of(gql_client: AsyncGraphQLClient, query: str, input: dict[str, Any]) -> str:
    result = await gql_client.execute(query, variables={"input": input})
    assert result.errors, result.data
    return result.errors[0].message


async def test_a_decision_is_saved_with_its_first_version_and_tags(
    gql_client: AsyncGraphQLClient,
) -> None:
    decision = await create(
        gql_client,
        description="Routes support tickets",
        metadata={"owner": "support"},
        tags=[{"name": "production"}],
    )
    assert decision["name"] == "triage"
    assert decision["metadata"] == {"owner": "support"}
    assert decision["versionCount"] == 1
    version = decision["version"]
    assert version["schemaVersion"] == 1
    assert version["modelProvider"] == "TYPESAFE"
    assert version["modelName"] == "tev1"
    assert version["inputs"] == [{"name": "ticket"}]
    assert version["state"] == {"__typename": "DecisionInputState", "input": "ticket"}
    assert version["questions"] == [
        {
            "__typename": "DecisionPredicateQuestion",
            "name": "urgent",
            "instructions": "Is the ticket urgent?",
        },
        {
            "__typename": "DecisionChoiceQuestion",
            "name": "team",
            "choices": [{"value": "billing"}, {"value": "technical"}],
        },
    ]
    assert version["tags"] == [{"name": "production"}]
    assert decision["versionTags"] == [{"name": "production", "decisionVersionId": version["id"]}]

    result = await gql_client.execute(DECISIONS)
    assert result.data and not result.errors, result.errors
    assert result.data["decisions"]["edges"] == [{"node": {"name": "triage"}}]


async def test_a_new_version_takes_tags_from_the_old_one(gql_client: AsyncGraphQLClient) -> None:
    first = await create(gql_client, tags=[{"name": "production"}, {"name": "staging"}])
    result = await gql_client.execute(
        CREATE_VERSION,
        variables={
            "input": {
                "decisionId": first["id"],
                "version": version_input(modelName="tev2", description="A larger model"),
                "tags": [{"name": "staging"}],
            }
        },
    )
    assert result.data and not result.errors, result.errors
    decision = result.data["createDecisionVersion"]
    second = decision["version"]
    assert second["modelName"] == "tev2" and second["description"] == "A larger model"
    assert decision["versionCount"] == 2
    assert decision["versionTags"] == [
        {"name": "production", "decisionVersionId": first["version"]["id"]},
        {"name": "staging", "decisionVersionId": second["id"]},
    ]

    async def version_by(**variables: Any) -> dict[str, Any]:
        result = await gql_client.execute(VERSION_BY, variables={"id": first["id"], **variables})
        assert result.data and not result.errors, result.errors
        node: dict[str, Any] = result.data["node"]
        return node

    assert (await version_by())["version"]["modelName"] == "tev2"
    assert (await version_by(tagName="production"))["version"]["modelName"] == "tev1"
    assert (await version_by(versionId=first["version"]["id"]))["version"]["modelName"] == "tev1"
    assert [edge["node"]["id"] for edge in (await version_by())["versions"]["edges"]] == [
        second["id"],
        first["version"]["id"],
    ]
    # A missing tag is null, so the rest of the query survives.
    result = await gql_client.execute(
        """query ($id: ID!) { node(id: $id) { ... on Decision {
          production: version(tagName: "production") { modelName }
          canary: version(tagName: "canary") { modelName } } } }""",
        variables={"id": first["id"]},
    )
    assert result.data and not result.errors, result.errors
    assert result.data["node"] == {"production": {"modelName": "tev1"}, "canary": None}


async def test_tags_are_set_moved_and_deleted(gql_client: AsyncGraphQLClient) -> None:
    first = await create(gql_client)
    result = await gql_client.execute(
        CREATE_VERSION,
        variables={"input": {"decisionId": first["id"], "version": version_input()}},
    )
    assert result.data and not result.errors, result.errors
    second_id = result.data["createDecisionVersion"]["version"]["id"]

    async def set_tag(version_id: str) -> dict[str, Any]:
        result = await gql_client.execute(
            SET_TAG,
            variables={"input": {"decisionVersionId": version_id, "name": "production"}},
        )
        assert result.data and not result.errors, result.errors
        payload: dict[str, Any] = result.data["setDecisionVersionTag"]
        return payload

    tagged = await set_tag(first["version"]["id"])
    moved = await set_tag(second_id)
    # Moving a tag keeps the row; only the version it points at changes.
    assert moved["decisionVersionTag"]["id"] == tagged["decisionVersionTag"]["id"]
    assert moved["decision"]["versionTags"] == [
        {"name": "production", "decisionVersionId": second_id}
    ]

    result = await gql_client.execute(
        DELETE_TAG,
        variables={"input": {"decisionVersionTagId": moved["decisionVersionTag"]["id"]}},
    )
    assert result.data and not result.errors, result.errors
    assert result.data["deleteDecisionVersionTag"] == {
        "decisionVersionTag": None,
        "decision": {"versionTags": []},
    }


async def test_a_decision_is_patched_and_deleted(gql_client: AsyncGraphQLClient) -> None:
    decision = await create(gql_client, description="Old", metadata={"a": 1})
    result = await gql_client.execute(
        PATCH, variables={"input": {"decisionId": decision["id"], "description": "New"}}
    )
    assert result.data and not result.errors, result.errors
    # A field left out is left alone.
    assert result.data["patchDecision"] == {"description": "New", "metadata": {"a": 1}}

    result = await gql_client.execute(DELETE, variables={"input": {"decisionId": decision["id"]}})
    assert result.data and not result.errors, result.errors
    assert result.data["deleteDecision"]["query"]["decisions"]["edges"] == []
    message = await error_of(gql_client, DELETE, {"decisionId": decision["id"]})
    assert "Decision not found" in message


async def test_decisions_are_found_by_name(gql_client: AsyncGraphQLClient) -> None:
    await create(gql_client)
    await create(gql_client, name="spam-filter")

    async def names(value: str) -> list[str]:
        result = await gql_client.execute(
            """query ($filter: DecisionFilter) {
              decisions(filter: $filter) { edges { node { name } } } }""",
            variables={"filter": {"col": "name", "value": value}},
        )
        assert result.data and not result.errors, result.errors
        return [edge["node"]["name"] for edge in result.data["decisions"]["edges"]]

    assert await names("triage") == ["triage"]
    assert await names("SPAM") == ["spam-filter"]
    assert await names("missing") == []


async def test_a_name_is_used_once(gql_client: AsyncGraphQLClient) -> None:
    await create(gql_client)
    message = await error_of(gql_client, CREATE, {"name": "triage", "version": version_input()})
    assert "already exists" in message


async def test_a_version_is_checked_before_it_is_saved(gql_client: AsyncGraphQLClient) -> None:
    async def message(**overrides: Any) -> str:
        return await error_of(
            gql_client, CREATE, {"name": "triage", "version": version_input(**overrides)}
        )

    assert "does not offer decision models" in await message(modelProvider="ANTHROPIC")
    assert "model name is required" in await message(modelName=" ")
    assert "undeclared input: missing" in await message(state={"input": "missing"})
    duplicate = {"predicate": {"name": "urgent", "instructions": "Again?"}}
    assert "urgent" in await message(questions=[duplicate, duplicate])


async def test_a_custom_provider_must_speak_the_versions_api(
    gql_client: AsyncGraphQLClient,
) -> None:
    async def provider(name: str, sdk: str, config: dict[str, Any]) -> str:
        result = await gql_client.execute(
            CREATE_CUSTOM_PROVIDER,
            variables={"input": {"name": name, "provider": sdk, "clientConfig": config}},
        )
        assert result.data and not result.errors, result.errors
        return str(result.data["createGenerativeModelCustomProvider"]["provider"]["id"])

    typesafe_id = await provider("System One proxy", "typesafe", TYPESAFE_PROVIDER_CONFIG)
    decision = await create(gql_client, version=version_input(customProviderId=typesafe_id))
    assert decision["versionCount"] == 1

    message = await error_of(
        gql_client,
        CREATE,
        {
            "name": "other",
            "version": version_input(modelProvider="OPENAI", customProviderId=typesafe_id),
        },
    )
    assert "speaks the TYPESAFE API, not OPENAI" in message

    message = await error_of(
        gql_client,
        CREATE,
        {
            "name": "other",
            "version": version_input(
                customProviderId=str(GlobalID("GenerativeModelCustomProvider", "999"))
            ),
        },
    )
    assert "Custom provider not found" in message


async def test_clone_preserves_history_and_provenance(gql_client: AsyncGraphQLClient) -> None:
    source = await create(
        gql_client,
        description="Original",
        metadata={"team": "support"},
        tags=[{"name": "production"}],
    )
    second = await gql_client.execute(
        CREATE_VERSION,
        variables={
            "input": {"decisionId": source["id"], "version": version_input(modelName="tev2")}
        },
    )
    assert second.data and not second.errors, second.errors
    result = await gql_client.execute(
        """
      mutation ($input: CloneDecisionInput!) {
        cloneDecision(input: $input) {
          id description metadata versionCount versionTags { name }
          sourceDecision { id }
          createdBy { id } updatedBy { id }
          versions { edges { node { id sequenceNumber modelName previousVersion { id sequenceNumber } } } }
        }
      }
    """,
        variables={"input": {"decisionId": source["id"], "name": "triage-clone"}},
    )
    assert result.data and not result.errors, result.errors
    clone = result.data["cloneDecision"]
    assert clone["sourceDecision"] == {"id": source["id"]}
    assert clone["description"] == "Original"
    assert clone["metadata"] == {"team": "support"}
    assert clone["versionCount"] == 2
    assert clone["versionTags"] == []
    latest, first = [edge["node"] for edge in clone["versions"]["edges"]]
    assert latest["sequenceNumber"] == 2
    assert latest["modelName"] == "tev2"
    assert latest["previousVersion"] == {"id": first["id"], "sequenceNumber": 1}
    assert first["previousVersion"] is None
    assert first["id"] != source["version"]["id"]
    assert "already exists" in await error_of(
        gql_client,
        """
      mutation ($input: CloneDecisionInput!) { cloneDecision(input: $input) { id } }
    """,
        {"decisionId": source["id"], "name": "triage-clone"},
    )

"""Decision label CRUD, filtering, associations, and deletion cleanup."""

from strawberry.relay import GlobalID

from tests.unit.graphql import AsyncGraphQLClient

from .test_saved_decision_mutations import create

_SET_LABELS = """
  mutation ($input: SetDecisionLabelsInput!) {
    setDecisionLabels(input: $input) { query { decisionCount } }
  }
"""

_UNSET_LABELS = """
  mutation ($input: UnsetDecisionLabelsInput!) {
    unsetDecisionLabels(input: $input) { query { decisionLabels { edges { node { usageCount } } } } }
  }
"""

_PATCH_LABEL = """
  mutation ($input: PatchDecisionLabelInput!) {
    patchDecisionLabel(input: $input) { decisionLabels { name description } }
  }
"""

_DELETE_LABELS = """
  mutation ($input: DeleteDecisionLabelsInput!) {
    deleteDecisionLabels(input: $input) {
      deletedDecisionLabelIds
      query { decisions { edges { node { labels { id } } } } }
    }
  }
"""


async def test_decision_labels(gql_client: AsyncGraphQLClient) -> None:
    decision = await create(gql_client)
    other = await create(gql_client, name="other")
    result = await gql_client.execute("""
      mutation { createDecisionLabel(input: {name: "routing", color: "#123456"}) {
        decisionLabels { id name color usageCount }
      } }
    """)
    assert result.data and not result.errors, result.errors
    label = result.data["createDecisionLabel"]["decisionLabels"][0]
    assert label["usageCount"] == 0
    label_id = label["id"]
    duplicate = await gql_client.execute("""
      mutation { createDecisionLabel(input: {name: "routing", color: "#123456"}) {
        decisionLabels { id }
      } }
    """)
    assert duplicate.errors and "already exists" in duplicate.errors[0].message
    for decision_id in (decision["id"], other["id"]):
        result = await gql_client.execute(
            _SET_LABELS,
            variables={"input": {"decisionId": decision_id, "decisionLabelIds": [label_id]}},
        )
        assert result.data and not result.errors, result.errors
        assert result.data["setDecisionLabels"]["query"]["decisionCount"] == 2
    result = await gql_client.execute(
        """
      query ($labels: [ID!], $id: ID!) {
        decisions(labelIds: $labels) { edges { node { id labels { name } } } }
        node(id: $id) { ... on DecisionLabel { name usageCount } }
        decisionLabels { edges { node { id } } }
      }
    """,
        variables={"labels": [label_id], "id": label_id},
    )
    assert result.data and not result.errors, result.errors
    assert len(result.data["decisions"]["edges"]) == 2
    assert result.data["node"] == {"name": "routing", "usageCount": 2}
    assert result.data["decisionLabels"]["edges"] == [{"node": {"id": label_id}}]
    result = await gql_client.execute(
        _UNSET_LABELS,
        variables={"input": {"decisionId": other["id"], "decisionLabelIds": [label_id]}},
    )
    assert result.data and not result.errors, result.errors
    assert result.data["unsetDecisionLabels"]["query"]["decisionLabels"]["edges"] == [
        {"node": {"usageCount": 1}}
    ]
    result = await gql_client.execute(
        _PATCH_LABEL,
        variables={
            "input": {
                "decisionLabelId": label_id,
                "name": "triage",
                "description": "Routing decisions",
            }
        },
    )
    assert result.data and not result.errors, result.errors
    assert result.data["patchDecisionLabel"]["decisionLabels"] == [
        {"name": "triage", "description": "Routing decisions"}
    ]
    result = await gql_client.execute(
        _DELETE_LABELS,
        variables={"input": {"decisionLabelIds": [label_id]}},
    )
    assert result.data and not result.errors, result.errors
    assert result.data["deleteDecisionLabels"]["deletedDecisionLabelIds"] == [label_id]
    assert all(
        not edge["node"]["labels"]
        for edge in result.data["deleteDecisionLabels"]["query"]["decisions"]["edges"]
    )
    missing_delete = await gql_client.execute(
        _DELETE_LABELS,
        variables={"input": {"decisionLabelIds": [label_id]}},
    )
    assert missing_delete.errors
    assert missing_delete.errors[0].message == f"DecisionLabel with ID {label_id} not found"


async def _label(gql_client: AsyncGraphQLClient, name: str) -> str:
    result = await gql_client.execute(
        """
      mutation ($name: String!) { createDecisionLabel(input: {name: $name, color: "#123456"}) {
        decisionLabels { id }
      } }
    """,
        variables={"name": name},
    )
    assert result.data and not result.errors, result.errors
    return str(result.data["createDecisionLabel"]["decisionLabels"][0]["id"])


async def test_patch_decision_label_errors(gql_client: AsyncGraphQLClient) -> None:
    await _label(gql_client, "routing")
    other_id = await _label(gql_client, "triage")
    result = await gql_client.execute(
        _PATCH_LABEL, variables={"input": {"decisionLabelId": other_id, "name": "routing"}}
    )
    assert result.errors
    assert result.errors[0].message == "Error patching DecisionLabel. Possibly a name conflict?"
    missing_id = str(GlobalID("DecisionLabel", "999"))
    result = await gql_client.execute(
        _PATCH_LABEL, variables={"input": {"decisionLabelId": missing_id, "name": "x"}}
    )
    assert result.errors
    assert result.errors[0].message == f"DecisionLabel with ID {missing_id} not found"


async def test_set_and_unset_decision_label_errors(gql_client: AsyncGraphQLClient) -> None:
    decision = await create(gql_client)
    label_id = await _label(gql_client, "routing")
    variables = {"input": {"decisionId": decision["id"], "decisionLabelIds": [label_id]}}
    result = await gql_client.execute(_UNSET_LABELS, variables=variables)
    assert result.errors
    assert result.errors[0].message.startswith("No association between decision=")
    result = await gql_client.execute(_SET_LABELS, variables=variables)
    assert result.data and not result.errors, result.errors
    result = await gql_client.execute(_SET_LABELS, variables=variables)
    assert result.errors
    assert result.errors[0].message == "Failed to associate DecisionLabel with Decision."

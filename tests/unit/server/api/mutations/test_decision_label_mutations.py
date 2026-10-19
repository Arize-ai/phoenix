"""Decision label CRUD, filtering, associations, and deletion cleanup."""

from strawberry.relay import GlobalID

from tests.unit.graphql import AsyncGraphQLClient

from .test_saved_decision_mutations import create


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
            """
          mutation ($input: SetDecisionLabelsInput!) {
            setDecisionLabels(input: $input) { query { decisionCount } }
          }
        """,
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
        """
      mutation ($input: UnsetDecisionLabelsInput!) {
        unsetDecisionLabels(input: $input) { query { decisionLabels { edges { node { usageCount } } } } }
      }
    """,
        variables={"input": {"decisionId": other["id"], "decisionLabelIds": [label_id]}},
    )
    assert result.data and not result.errors, result.errors
    assert result.data["unsetDecisionLabels"]["query"]["decisionLabels"]["edges"] == [
        {"node": {"usageCount": 1}}
    ]
    result = await gql_client.execute(
        """
      mutation ($input: PatchDecisionLabelInput!) {
        patchDecisionLabel(input: $input) { decisionLabels { name description } }
      }
    """,
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
        """
      mutation ($input: DeleteDecisionLabelsInput!) {
        deleteDecisionLabels(input: $input) {
          deletedDecisionLabelIds
          query { decisions { edges { node { labels { id } } } } }
        }
      }
    """,
        variables={"input": {"decisionLabelIds": [label_id]}},
    )
    assert result.data and not result.errors, result.errors
    assert result.data["deleteDecisionLabels"]["deletedDecisionLabelIds"] == [label_id]
    assert all(
        not edge["node"]["labels"]
        for edge in result.data["deleteDecisionLabels"]["query"]["decisions"]["edges"]
    )


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
    patch = """
      mutation ($input: PatchDecisionLabelInput!) {
        patchDecisionLabel(input: $input) { decisionLabels { id } }
      }
    """
    await _label(gql_client, "routing")
    other_id = await _label(gql_client, "triage")
    result = await gql_client.execute(
        patch, variables={"input": {"decisionLabelId": other_id, "name": "routing"}}
    )
    assert result.errors
    assert result.errors[0].message == "Error patching DecisionLabel. Possibly a name conflict?"
    missing_id = str(GlobalID("DecisionLabel", "999"))
    result = await gql_client.execute(
        patch, variables={"input": {"decisionLabelId": missing_id, "name": "x"}}
    )
    assert result.errors
    assert result.errors[0].message == f"DecisionLabel with ID {missing_id} not found"


async def test_set_and_unset_decision_label_errors(gql_client: AsyncGraphQLClient) -> None:
    decision = await create(gql_client)
    label_id = await _label(gql_client, "routing")
    set_labels = """
      mutation ($input: SetDecisionLabelsInput!) {
        setDecisionLabels(input: $input) { query { decisionCount } }
      }
    """
    unset_labels = """
      mutation ($input: UnsetDecisionLabelsInput!) {
        unsetDecisionLabels(input: $input) { query { decisionCount } }
      }
    """
    variables = {"input": {"decisionId": decision["id"], "decisionLabelIds": [label_id]}}
    result = await gql_client.execute(unset_labels, variables=variables)
    assert result.errors
    assert result.errors[0].message.startswith("No association between decision=")
    result = await gql_client.execute(set_labels, variables=variables)
    assert result.data and not result.errors, result.errors
    result = await gql_client.execute(set_labels, variables=variables)
    assert result.errors
    assert result.errors[0].message == "Failed to associate DecisionLabel with Decision."

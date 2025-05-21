from secrets import token_hex
from typing import Any

import pytest
import sqlalchemy as sa
from strawberry.relay import GlobalID

from phoenix.db import models
from phoenix.db.constants import DEFAULT_PROJECT_TRACE_RETENTION_POLICY_ID
from phoenix.db.types.trace_retention import MaxDaysRule
from phoenix.server.api.types.node import from_global_id_with_expected_type
from phoenix.server.api.types.Project import Project
from phoenix.server.api.types.ProjectTraceRetentionPolicy import ProjectTraceRetentionPolicy
from phoenix.server.types import DbSessionFactory
from tests.unit.graphql import AsyncGraphQLClient


class TestProjectTraceRetentionPolicyMutations:
    CRUD = """
        mutation Create($input: CreateProjectTraceRetentionPolicyInput!) {
            createProjectTraceRetentionPolicy(input: $input) {
                node {
                    ... PolicyFragment
                }
            }
        }
        query Read {
            projectTraceRetentionPolicies {
                edges {
                    node {
                        ... PolicyFragment
                    }
                }
            }
        }
        mutation Update($input: PatchProjectTraceRetentionPolicyInput!) {
            patchProjectTraceRetentionPolicy(input: $input) {
                node {
                    ... PolicyFragment
                }
            }
        }
        mutation Delete($input: DeleteProjectTraceRetentionPolicyInput!) {
            deleteProjectTraceRetentionPolicy(input: $input) {
                node {
                    ... PolicyFragment
                }
            }
        }
        query GetNode($id: ID!) {
            node(id: $id) {
                ... on Project {
                    traceRetentionPolicy {
                        ... PolicyFragment
                    }
                }
                ... on ProjectTraceRetentionPolicy {
                    ... PolicyFragment
                }
            }
        }
        fragment PolicyFragment on ProjectTraceRetentionPolicy {
            id
            name
            cronExpression
            rule {
                ... on TraceRetentionRuleMaxDays {
                    maxDays
                }
                ... on TraceRetentionRuleMaxCount {
                    maxCount
                }
                ... on TraceRetentionRuleMaxDaysOrCount {
                    maxCount
                    maxDays
                }
            }
        }
    """  # noqa: E501

    @pytest.mark.parametrize(
        "initial_rule_input, initial_rule_output, update_rule_input, update_rule_output",
        [
            (
                {"maxDays": {"maxDays": 1.5}},
                {"maxDays": 1.5},
                {"maxCount": {"maxCount": 5}},
                {"maxCount": 5},
            ),
            (
                {"maxCount": {"maxCount": 5}},
                {"maxCount": 5},
                {"maxDays": {"maxDays": 1.5}},
                {"maxDays": 1.5},
            ),
            (
                {"maxDaysOrCount": {"maxDays": 5.1, "maxCount": 1}},
                {"maxDays": 5.1, "maxCount": 1},
                {"maxDays": {"maxDays": 1.5}},
                {"maxDays": 1.5},
            ),
        ],
    )
    async def test_crud(
        self,
        db: DbSessionFactory,
        gql_client: AsyncGraphQLClient,
        initial_rule_input: dict[str, Any],
        initial_rule_output: dict[str, Any],
        update_rule_input: dict[str, Any],
        update_rule_output: dict[str, Any],
    ) -> None:
        """
        Test the complete CRUD lifecycle for ProjectTraceRetentionPolicy.

        This test verifies:
        1. Creating a policy with different rule types
        2. Associating policies with projects
        3. Updating policies (name, cron expression, rule type)
        4. Transferring policies between projects
        5. Deleting policies and verifying fallback to default

        Each test case uses different rule types (maxDays, maxCount, maxDaysOrCount)
        to ensure all rule types work correctly throughout the CRUD operations.
        """
        # Create two test projects with random names
        project1 = models.Project(name=token_hex(8))
        project2 = models.Project(name=token_hex(8))
        async with db() as session:
            session.add(project1)
            session.add(project2)
            await session.flush()

        # Convert project IDs to GlobalIDs for GraphQL operations
        project1_gid = str(GlobalID(Project.__name__, str(project1.id)))
        project2_gid = str(GlobalID(Project.__name__, str(project2.id)))

        # Create a new retention policy
        name1 = token_hex(8)  # Random policy name
        cron_expression1 = "0 1 * * 1"  # Weekly on Monday at 1:00 AM

        # Execute the Create mutation
        resp = await gql_client.execute(
            self.CRUD,
            operation_name="Create",
            variables={
                "input": {
                    "name": name1,
                    "cronExpression": cron_expression1,
                    "rule": initial_rule_input,
                    "addProjects": [project1_gid],
                }
            },
        )

        # Verify the creation was successful
        assert not resp.errors
        assert resp.data
        policy = resp.data["createProjectTraceRetentionPolicy"]["node"]
        assert policy["name"] == name1
        assert policy["cronExpression"] == cron_expression1
        assert policy["rule"] == initial_rule_output

        # Verify policy exists in the database
        id_ = from_global_id_with_expected_type(
            GlobalID.from_id(policy["id"]),
            ProjectTraceRetentionPolicy.__name__,
        )
        async with db() as session:
            stmt = sa.select(models.ProjectTraceRetentionPolicy).filter_by(id=id_)
            assert await session.scalar(stmt)

        # Verify policy can be read
        resp = await gql_client.execute(
            self.CRUD,
            operation_name="Read",
            variables={"id": project1_gid},
        )
        assert not resp.errors
        assert resp.data
        policies = [
            e["node"]
            for e in resp.data["projectTraceRetentionPolicies"]["edges"]
            if e["node"]["id"] == policy["id"]
        ]
        assert len(policies) == 1
        assert policies[0]["name"] == name1
        assert policies[0]["cronExpression"] == cron_expression1
        assert policies[0]["rule"] == initial_rule_output

        # Verify the policy is a Node
        resp = await gql_client.execute(
            self.CRUD,
            operation_name="GetNode",
            variables={"id": policy["id"]},
        )
        assert not resp.errors
        assert resp.data
        policy = resp.data["node"]
        assert policy["name"] == name1
        assert policy["cronExpression"] == cron_expression1
        assert policy["rule"] == initial_rule_output

        # Verify the policy is associated with project1
        resp = await gql_client.execute(
            self.CRUD,
            operation_name="GetNode",
            variables={"id": project1_gid},
        )
        assert not resp.errors
        assert resp.data
        policy = resp.data["node"]["traceRetentionPolicy"]
        assert policy["name"] == name1
        assert policy["cronExpression"] == cron_expression1
        assert policy["rule"] == initial_rule_output

        # Update the policy and transfer from project1 to project2
        name2 = token_hex(8)  # New random policy name
        cron_expression2 = "0 2 * * 2"  # Weekly on Tuesday at 2:00 AM

        # Execute the Update mutation
        resp = await gql_client.execute(
            self.CRUD,
            operation_name="Update",
            variables={
                "input": {
                    "id": policy["id"],
                    "name": name2,
                    "cronExpression": cron_expression2,
                    "rule": update_rule_input,
                    "removeProjects": [project1_gid],  # Remove from project1
                    "addProjects": [project2_gid],  # Add to project2
                }
            },
        )

        # Verify the update was successful
        assert not resp.errors
        assert resp.data
        policy = resp.data["patchProjectTraceRetentionPolicy"]["node"]
        assert policy["name"] == name2
        assert policy["cronExpression"] == cron_expression2
        assert policy["rule"] == update_rule_output

        # Verify project1 now uses the default policy
        resp = await gql_client.execute(
            self.CRUD,
            operation_name="GetNode",
            variables={"id": project1_gid},
        )
        assert not resp.errors
        assert resp.data
        policy = resp.data["node"]["traceRetentionPolicy"]
        assert policy["name"] == "Default"  # Project1 now uses default policy

        # Verify project2 now uses the updated policy
        resp = await gql_client.execute(
            self.CRUD,
            operation_name="GetNode",
            variables={"id": project2_gid},
        )
        assert not resp.errors
        assert resp.data
        policy = resp.data["node"]["traceRetentionPolicy"]
        assert policy["name"] == name2
        assert policy["cronExpression"] == cron_expression2
        assert policy["rule"] == update_rule_output

        # Delete the policy
        resp = await gql_client.execute(
            self.CRUD,
            operation_name="Delete",
            variables={"input": {"id": policy["id"]}},
        )
        assert not resp.errors

        # Verify the policy is deleted from the database
        async with db() as session:
            stmt = sa.select(models.ProjectTraceRetentionPolicy).filter_by(id=id_)
            assert not (await session.scalar(stmt))

        # Verify both projects now use the default policy
        # Check project1
        resp = await gql_client.execute(
            self.CRUD,
            operation_name="GetNode",
            variables={"id": project1_gid},
        )
        assert not resp.errors
        assert resp.data
        policy = resp.data["node"]["traceRetentionPolicy"]
        assert policy["name"] == "Default"

        # Check project2
        resp = await gql_client.execute(
            self.CRUD,
            operation_name="GetNode",
            variables={"id": project2_gid},
        )
        assert not resp.errors
        assert resp.data
        policy = resp.data["node"]["traceRetentionPolicy"]
        assert policy["name"] == "Default"  # Project2 now also uses default policy

    async def test_default_policy_modification_restrictions(
        self,
        db: DbSessionFactory,
        gql_client: AsyncGraphQLClient,
    ) -> None:
        """
        Test the modification restrictions on the default project trace retention policy.

        This test verifies that:
        1. The default policy cannot be deleted
        2. The default policy cannot be renamed
        3. The default policy's cron expression can be modified
        4. The default policy's rule can be modified

        The default policy (with name "Default") is a special policy that must maintain its name
        and cannot be deleted to ensure system stability and provide a fallback for projects.
        However, its cron expression and rule can be modified as needed.
        """  # noqa: E501

        # Create a GlobalID for the default policy to use in GraphQL operations
        default_policy_gid = str(
            GlobalID(
                ProjectTraceRetentionPolicy.__name__,
                str(DEFAULT_PROJECT_TRACE_RETENTION_POLICY_ID),
            )
        )

        # First, get the current state of the default policy
        resp = await gql_client.execute(
            self.CRUD,
            operation_name="GetNode",
            variables={"id": default_policy_gid},
        )
        assert not resp.errors
        assert resp.data
        initial_policy = resp.data["node"]
        assert initial_policy["name"] == "Default"
        initial_cron = initial_policy["cronExpression"]
        initial_rule = initial_policy["rule"]

        # Test 1: Attempt to delete the default policy
        resp = await gql_client.execute(
            self.CRUD,
            operation_name="Delete",
            variables={"input": {"id": default_policy_gid}},
        )

        # Verify the deletion was rejected with the expected error message
        assert resp.errors
        assert len(resp.errors) == 1
        assert "Cannot delete the default project trace retention policy" in resp.errors[0].message

        # Verify the default policy still exists in the database with its original name
        async with db() as session:
            stmt = sa.select(models.ProjectTraceRetentionPolicy).filter_by(
                id=DEFAULT_PROJECT_TRACE_RETENTION_POLICY_ID
            )
            default_policy = await session.scalar(stmt)
            assert default_policy is not None
            assert default_policy.name == "Default"

        # Test 2: Attempt to update the default policy's name
        resp = await gql_client.execute(
            self.CRUD,
            operation_name="Update",
            variables={
                "input": {
                    "id": default_policy_gid,
                    "name": "New Default Name",  # Try to change the name
                }
            },
        )

        # Verify the rename was rejected with the expected error message
        assert resp.errors
        assert len(resp.errors) == 1
        assert (
            "Cannot change the name of the default project trace retention policy"
            in resp.errors[0].message
        )

        # Verify the default policy still exists in the database with its original name
        async with db() as session:
            stmt = sa.select(models.ProjectTraceRetentionPolicy).filter_by(
                id=DEFAULT_PROJECT_TRACE_RETENTION_POLICY_ID
            )
            default_policy = await session.scalar(stmt)
            assert default_policy is not None
            assert default_policy.name == "Default"

        # Test 3: Update the default policy's cron expression
        new_cron = "0 2 * * *"  # Daily at 2:00 AM
        assert new_cron != initial_cron, "New cron expression should be different from initial"

        resp = await gql_client.execute(
            self.CRUD,
            operation_name="Update",
            variables={
                "input": {
                    "id": default_policy_gid,
                    "cronExpression": new_cron,
                }
            },
        )

        # Verify the cron expression update was successful
        assert not resp.errors
        assert resp.data
        updated_policy = resp.data["patchProjectTraceRetentionPolicy"]["node"]
        assert updated_policy["name"] == "Default"  # Name should remain unchanged
        assert updated_policy["cronExpression"] == new_cron  # Cron should be updated
        assert updated_policy["rule"] == initial_rule  # Rule should remain unchanged

        # Test 4: Update the default policy's rule
        new_rule = {"maxDays": {"maxDays": 3.0}}  # New rule with 3 days retention
        assert new_rule != initial_rule, "New rule should be different from initial"

        resp = await gql_client.execute(
            self.CRUD,
            operation_name="Update",
            variables={
                "input": {
                    "id": default_policy_gid,
                    "rule": new_rule,
                }
            },
        )

        # Verify the rule update was successful
        assert not resp.errors
        assert resp.data
        updated_policy = resp.data["patchProjectTraceRetentionPolicy"]["node"]
        assert updated_policy["name"] == "Default"  # Name should remain unchanged
        assert updated_policy["cronExpression"] == new_cron  # Cron should remain updated
        assert updated_policy["rule"] == {"maxDays": 3.0}  # Rule should be updated

        # Verify all changes are persisted in the database
        del default_policy
        async with db() as session:
            stmt = sa.select(models.ProjectTraceRetentionPolicy).filter_by(
                id=DEFAULT_PROJECT_TRACE_RETENTION_POLICY_ID
            )
            default_policy = await session.scalar(stmt)
            assert default_policy is not None
            assert default_policy.name == "Default"
            assert default_policy.cron_expression.root == new_cron
            assert isinstance(default_policy.rule.root, MaxDaysRule)
            assert default_policy.rule.root.max_days == 3.0

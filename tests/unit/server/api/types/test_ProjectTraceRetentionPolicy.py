from dataclasses import dataclass, field
from secrets import token_hex

import pytest
from strawberry.relay import GlobalID

from phoenix.db import models
from phoenix.db.constants import DEFAULT_PROJECT_TRACE_RETENTION_POLICY_ID
from phoenix.db.types.trace_retention import (
    MaxCountRule,
    TraceRetentionCronExpression,
    TraceRetentionRule,
)
from phoenix.server.api.types.Project import Project
from phoenix.server.api.types.ProjectTraceRetentionPolicy import ProjectTraceRetentionPolicy
from phoenix.server.types import DbSessionFactory
from tests.unit.graphql import AsyncGraphQLClient


@dataclass
class _Data:
    """Data class to hold test data for projects and their trace retention policies."""

    projects: list[models.Project] = field(default_factory=list)
    project_trace_retention_policies: list[models.ProjectTraceRetentionPolicy] = field(
        default_factory=list
    )


class TestProjectTraceRetentionPolicy:
    """Test suite for ProjectTraceRetentionPolicy GraphQL type and its relationships."""

    @pytest.fixture
    async def _data(
        self,
        db: DbSessionFactory,
    ) -> _Data:
        """
        Fixture that creates test data including:
        - One project with default trace retention policy
        - One custom trace retention policy
        - Two projects using the custom trace retention policy
        """
        projects: list[models.Project] = []
        project_trace_retention_policies: list[models.ProjectTraceRetentionPolicy] = []
        async with db() as session:
            # Create a project with default trace retention policy
            projects.append(models.Project(name=token_hex(8)))

            # Create a custom trace retention policy
            project_trace_retention_policies.append(
                models.ProjectTraceRetentionPolicy(
                    name=token_hex(8),
                    cron_expression=TraceRetentionCronExpression(
                        root="0 1 * * 1"
                    ),  # Run weekly on Monday at 1 AM
                    rule=TraceRetentionRule(root=MaxCountRule(max_count=1)),  # Keep only 1 trace
                )
            )
            session.add(project_trace_retention_policies[-1])
            await session.flush()

            # Create two projects using the custom trace retention policy
            for _ in range(2):
                projects.append(
                    models.Project(
                        name=token_hex(8),
                        trace_retention_policy_id=project_trace_retention_policies[-1].id,
                    )
                )
            session.add_all(projects)
            await session.flush()
        return _Data(
            projects=projects,
            project_trace_retention_policies=project_trace_retention_policies,
        )

    async def test_projects(
        self,
        _data: _Data,
        gql_client: AsyncGraphQLClient,
    ) -> None:
        """
        Test the GraphQL queries for:
        1. Project -> TraceRetentionPolicy relationship
        2. ProjectTraceRetentionPolicy -> Projects relationship
        """
        # GraphQL query to test both directions of the relationship
        node_query = """query ($id: ID!) {
            node(id: $id) {
                ... on Project {
                    traceRetentionPolicy {
                        id
                    }
                }
                ... on ProjectTraceRetentionPolicy {
                    projects {
                        edges {
                            node {
                                id
                            }
                        }
                    }
                }
            }
        }"""

        # Test: Project with default trace retention policy
        resp = await gql_client.execute(
            node_query,
            variables={
                "id": str(GlobalID(Project.__name__, str(_data.projects[0].id))),
            },
        )
        assert not resp.errors
        assert resp.data
        assert resp.data["node"]["traceRetentionPolicy"]["id"] == str(
            GlobalID(
                ProjectTraceRetentionPolicy.__name__,
                str(DEFAULT_PROJECT_TRACE_RETENTION_POLICY_ID),
            )
        )

        # Test: Projects associated with default trace retention policy
        resp = await gql_client.execute(
            node_query,
            variables={
                "id": str(
                    GlobalID(
                        ProjectTraceRetentionPolicy.__name__,
                        str(DEFAULT_PROJECT_TRACE_RETENTION_POLICY_ID),
                    )
                )
            },
        )
        assert not resp.errors
        assert resp.data
        assert sorted(e["node"]["id"] for e in resp.data["node"]["projects"]["edges"]) == sorted(
            str(GlobalID(Project.__name__, str(p.id))) for p in _data.projects[:1]
        )

        # Test: Project with custom trace retention policy
        resp = await gql_client.execute(
            node_query,
            variables={
                "id": str(GlobalID(Project.__name__, str(_data.projects[1].id))),
            },
        )
        assert not resp.errors
        assert resp.data
        assert resp.data["node"]["traceRetentionPolicy"]["id"] == str(
            GlobalID(
                ProjectTraceRetentionPolicy.__name__,
                str(_data.project_trace_retention_policies[0].id),
            )
        )

        # Test: Projects associated with a trace retention policy
        resp = await gql_client.execute(
            node_query,
            variables={
                "id": str(
                    GlobalID(
                        ProjectTraceRetentionPolicy.__name__,
                        str(_data.project_trace_retention_policies[0].id),
                    )
                )
            },
        )
        assert not resp.errors
        assert resp.data
        assert sorted(e["node"]["id"] for e in resp.data["node"]["projects"]["edges"]) == sorted(
            str(GlobalID(Project.__name__, str(p.id))) for p in _data.projects[1:]
        )

from datetime import datetime, timedelta, timezone
from secrets import token_hex

from sqlalchemy import select
from strawberry.relay import GlobalID

from phoenix.db import models
from phoenix.db.types.identifier import Identifier
from phoenix.server.types import DbSessionFactory

from ...._helpers import _add_live_session_work_unit
from ....graphql import AsyncGraphQLClient

PATCH_PROJECT_MUTATION = """
    mutation($input: PatchProjectInput!) {
        patchProject(input: $input) {
            project {
                id
                name
                description
                gradientStartColor
                gradientEndColor
            }
        }
    }
"""


class TestProjectMutations:
    async def test_clear_project(
        self,
        db: DbSessionFactory,
        gql_client: AsyncGraphQLClient,
    ) -> None:
        """Test the clear_project mutation's selective deletion functionality.

        This test verifies the clear_project mutation's ability to:
        1. Delete traces that start before the specified end_time
        2. Preserve traces that start after the specified end_time
        3. Delete project sessions when all their associated traces are deleted
        4. Handle traces without associated sessions correctly

        Test Setup:
        - Creates a project
        - Creates three traces with different timestamps:
          * Trace 0 (newest): At base_start_time
          * Trace 1: At base_start_time - 1 day
          * Trace 2 (oldest): At base_start_time - 2 days
        - Creates project sessions for Trace 0 and Trace 1
        - Sets end_time to base_start_time - 12 hours to test selective deletion

        Expected Results:
        - Trace 0 and its session should be preserved (after end_time)
        - Trace 1, Trace 2, and their sessions should be deleted (before end_time)
        """
        project_name = token_hex(8)
        traces: list[models.Trace] = []
        project_sessions: list[models.ProjectSession] = []
        async with db() as session:
            # Create a new project
            project = models.Project(name=project_name)
            session.add(project)
            await session.flush()

            # Create three traces with different timestamps
            n = 3  # Number of traces to create
            base_start_time = datetime.now(timezone.utc)
            for i in range(n):
                start_time = base_start_time - timedelta(days=i)
                if i == n - 1:
                    # Last trace has no associated session
                    project_session_id = None
                else:
                    # Create a project session for the first two traces
                    project_session = models.ProjectSession(
                        project_id=project.id,
                        session_id=token_hex(8),
                        start_time=start_time,
                        end_time=start_time + timedelta(hours=1),
                    )
                    project_sessions.append(project_session)
                    session.add(project_session)
                    await session.flush()
                    project_session_id = project_session.id

                # Create a trace
                trace = models.Trace(
                    project_rowid=project.id,
                    trace_id=token_hex(16),
                    start_time=start_time,
                    end_time=start_time + timedelta(hours=1),
                    project_session_rowid=project_session_id,
                )
                traces.append(trace)
                session.add(trace)
                await session.flush()

        # Execute clear_project mutation with end_time between the newest and second newest traces
        # This should delete the two oldest traces and their sessions, but preserve the newest trace
        end_time = base_start_time - timedelta(hours=12)  # 12 hours after the second newest trace
        result = await gql_client.execute(
            query="""
            mutation($input: ClearProjectInput!) {
                clearProject(input: $input) {
                    __typename
                }
            }
            """,
            variables={
                "input": {
                    "id": str(GlobalID("Project", str(project.id))),
                    "endTime": end_time.isoformat(),
                }
            },
        )
        assert not result.errors

        # Verify the results
        async with db() as session:
            # The newest trace should remain since it's after end_time
            newest_trace = await session.get(models.Trace, traces[0].id)
            assert newest_trace is not None, "Newest trace should remain"

            # The newest project session should remain since its trace remains
            newest_session = await session.get(models.ProjectSession, project_sessions[0].id)
            assert newest_session is not None, "Newest project session should remain"

            # The two oldest traces and their sessions should be deleted since they're
            # before end_time
            for i in range(1, n):
                old_trace = await session.get(models.Trace, traces[i].id)
                assert old_trace is None, f"Trace {i} should be deleted"

                if i < n - 1:
                    session_obj = await session.get(models.ProjectSession, project_sessions[i].id)
                    assert session_obj is None, f"Session {i} should be deleted"

    async def test_clear_project_keeps_session_spanning_end_time(
        self,
        db: DbSessionFactory,
        gql_client: AsyncGraphQLClient,
    ) -> None:
        """A session with traces on both sides of end_time must keep its newer traces.

        Trace.project_session_rowid cascades on delete, so deleting the session row would
        take the retained traces with it.
        """
        base_start_time = datetime.now(timezone.utc)
        end_time = base_start_time - timedelta(hours=12)
        async with db() as session:
            project = models.Project(name=token_hex(8))
            session.add(project)
            await session.flush()

            project_session = models.ProjectSession(
                project_id=project.id,
                session_id=token_hex(8),
                start_time=base_start_time - timedelta(days=1),
                end_time=base_start_time,
            )
            session.add(project_session)
            await session.flush()

            old_trace = models.Trace(
                project_rowid=project.id,
                trace_id=token_hex(16),
                start_time=base_start_time - timedelta(days=1),
                end_time=base_start_time - timedelta(days=1) + timedelta(hours=1),
                project_session_rowid=project_session.id,
            )
            new_trace = models.Trace(
                project_rowid=project.id,
                trace_id=token_hex(16),
                start_time=base_start_time,
                end_time=base_start_time + timedelta(hours=1),
                project_session_rowid=project_session.id,
            )
            session.add_all([old_trace, new_trace])
            await session.flush()
            project_id, session_rowid = project.id, project_session.id
            old_trace_id, new_trace_id = old_trace.id, new_trace.id

        result = await gql_client.execute(
            query="""
            mutation($input: ClearProjectInput!) {
                clearProject(input: $input) {
                    __typename
                }
            }
            """,
            variables={
                "input": {
                    "id": str(GlobalID("Project", str(project_id))),
                    "endTime": end_time.isoformat(),
                }
            },
        )
        assert not result.errors

        async with db() as session:
            assert await session.get(models.Trace, old_trace_id) is None
            assert await session.get(models.Trace, new_trace_id) is not None
            assert await session.get(models.ProjectSession, session_rowid) is not None

    async def test_clear_project_leaves_no_live_session_evaluations(
        self,
        db: DbSessionFactory,
        gql_client: AsyncGraphQLClient,
    ) -> None:
        """Clearing a project destroys session content, so no evaluation of that content
        may stay live — whether the session row itself survives the clear or not.
        """
        cutoff = datetime.now(timezone.utc)
        async with db() as session:
            project = models.Project(name=token_hex(8))
            session.add(project)
            await session.flush()
            project_session = models.ProjectSession(
                project_id=project.id,
                session_id=token_hex(8),
                start_time=cutoff - timedelta(hours=2),
                end_time=cutoff + timedelta(hours=2),
            )
            session.add(project_session)
            await session.flush()
            for offset in (timedelta(hours=-1), timedelta(hours=1)):
                session.add(
                    models.Trace(
                        project_rowid=project.id,
                        trace_id=token_hex(16),
                        start_time=cutoff + offset,
                        end_time=cutoff + offset,
                        project_session_rowid=project_session.id,
                    )
                )
            await _add_live_session_work_unit(session, project_session)
            project_id = project.id

        result = await gql_client.execute(
            query="""
            mutation($input: ClearProjectInput!) {
                clearProject(input: $input) {
                    __typename
                }
            }
            """,
            variables={
                "input": {
                    "id": str(GlobalID("Project", str(project_id))),
                    "endTime": cutoff.isoformat(),
                }
            },
        )
        assert not result.errors

        async with db() as session:
            statuses = list(
                await session.scalars(
                    select(models.EvalSessionWorkUnit.status)
                    .join(
                        models.ProjectSession,
                        models.EvalSessionWorkUnit.project_session_rowid
                        == models.ProjectSession.id,
                    )
                    .where(models.ProjectSession.project_id == project_id)
                )
            )
        assert all(status == "CONTENT_LOST" for status in statuses)

    async def test_create_project(
        self,
        db: DbSessionFactory,
        gql_client: AsyncGraphQLClient,
    ) -> None:
        """Test the create_project mutation."""
        project_name = token_hex(8)
        project_description = "Test project description"
        gradient_start_color = "#ff0000"
        gradient_end_color = "#00ff00"

        mutation = """
            mutation CreateProject($input: CreateProjectInput!) {
                createProject(input: $input) {
                    project {
                        id
                        name
                        gradientStartColor
                        gradientEndColor
                    }
                    query {
                        __typename
                    }
                }
            }
        """

        result = await gql_client.execute(
            mutation,
            variables={
                "input": {
                    "name": project_name,
                    "description": project_description,
                    "gradientStartColor": gradient_start_color,
                    "gradientEndColor": gradient_end_color,
                }
            },
        )

        assert not result.errors
        assert result.data
        create_project_data = result.data["createProject"]

        project_data = create_project_data["project"]
        assert project_data["name"] == project_name
        assert project_data["gradientStartColor"] == gradient_start_color
        assert project_data["gradientEndColor"] == gradient_end_color

        # Verify the project was actually created in the database
        project_id = project_data["id"]
        decoded_id = GlobalID.from_id(project_id)

        async with db() as session:
            project = await session.get(models.Project, int(decoded_id.node_id))
            assert project is not None
            assert project.name == project_name
            assert project.description == project_description
            assert project.gradient_start_color == gradient_start_color
            assert project.gradient_end_color == gradient_end_color

    async def test_patch_project_description(
        self,
        db: DbSessionFactory,
        gql_client: AsyncGraphQLClient,
    ) -> None:
        """Test patching only the project description."""
        project_name = token_hex(8)
        async with db() as session:
            project = models.Project(name=project_name)
            session.add(project)
            await session.flush()
            project_id = project.id

        global_id = str(GlobalID("Project", str(project_id)))
        result = await gql_client.execute(
            query=PATCH_PROJECT_MUTATION,
            variables={
                "input": {
                    "id": global_id,
                    "description": "Updated description",
                }
            },
        )
        assert not result.errors
        assert result.data
        project_data = result.data["patchProject"]["project"]
        assert project_data["name"] == project_name
        assert project_data["description"] == "Updated description"
        # Gradient should remain unchanged (defaults)
        assert project_data["gradientStartColor"] == "#5bdbff"
        assert project_data["gradientEndColor"] == "#1c76fc"

        async with db() as session:
            project_obj = await session.get(models.Project, project_id)
            assert project_obj is not None
            assert project_obj.description == "Updated description"

    async def test_patch_project_gradient(
        self,
        db: DbSessionFactory,
        gql_client: AsyncGraphQLClient,
    ) -> None:
        """Test patching only the gradient colors."""
        project_name = token_hex(8)
        async with db() as session:
            project = models.Project(name=project_name, description="Original desc")
            session.add(project)
            await session.flush()
            project_id = project.id

        global_id = str(GlobalID("Project", str(project_id)))
        result = await gql_client.execute(
            query=PATCH_PROJECT_MUTATION,
            variables={
                "input": {
                    "id": global_id,
                    "gradientStartColor": "#ff0000",
                    "gradientEndColor": "#00ff00",
                }
            },
        )
        assert not result.errors
        assert result.data
        project_data = result.data["patchProject"]["project"]
        assert project_data["description"] == "Original desc"
        assert project_data["gradientStartColor"] == "#ff0000"
        assert project_data["gradientEndColor"] == "#00ff00"

    async def test_patch_project_all_fields(
        self,
        db: DbSessionFactory,
        gql_client: AsyncGraphQLClient,
    ) -> None:
        """Test patching description and gradient together."""
        project_name = token_hex(8)
        async with db() as session:
            project = models.Project(name=project_name)
            session.add(project)
            await session.flush()
            project_id = project.id

        global_id = str(GlobalID("Project", str(project_id)))
        result = await gql_client.execute(
            query=PATCH_PROJECT_MUTATION,
            variables={
                "input": {
                    "id": global_id,
                    "description": "New description",
                    "gradientStartColor": "#aabbcc",
                    "gradientEndColor": "#ddeeff",
                }
            },
        )
        assert not result.errors
        assert result.data
        project_data = result.data["patchProject"]["project"]
        assert project_data["description"] == "New description"
        assert project_data["gradientStartColor"] == "#aabbcc"
        assert project_data["gradientEndColor"] == "#ddeeff"

    async def test_patch_project_invalid_color(
        self,
        db: DbSessionFactory,
        gql_client: AsyncGraphQLClient,
    ) -> None:
        """Test that invalid hex colors are rejected."""
        project_name = token_hex(8)
        async with db() as session:
            project = models.Project(name=project_name)
            session.add(project)
            await session.flush()
            project_id = project.id

        global_id = str(GlobalID("Project", str(project_id)))
        result = await gql_client.execute(
            query=PATCH_PROJECT_MUTATION,
            variables={
                "input": {
                    "id": global_id,
                    "gradientStartColor": "not-a-color",
                }
            },
        )
        assert result.errors

    async def test_create_project_with_minimal_input(
        self,
        db: DbSessionFactory,
        gql_client: AsyncGraphQLClient,
    ) -> None:
        """Test the create_project mutation with only required fields."""
        project_name = token_hex(8)

        mutation = """
            mutation CreateProject($input: CreateProjectInput!) {
                createProject(input: $input) {
                    project {
                        id
                        name
                        gradientStartColor
                        gradientEndColor
                    }
                    query {
                        __typename
                    }
                }
            }
        """

        result = await gql_client.execute(
            mutation,
            variables={
                "input": {
                    "name": project_name,
                }
            },
        )

        assert not result.errors
        assert result.data
        create_project_data = result.data["createProject"]

        project_data = create_project_data["project"]
        assert project_data["name"] == project_name
        # Should use default gradient colors from the database
        assert project_data["gradientStartColor"] == "#5bdbff"
        assert project_data["gradientEndColor"] == "#1c76fc"

        # Verify the project was actually created in the database
        project_id = project_data["id"]
        decoded_id = GlobalID.from_id(project_id)

        async with db() as session:
            project = await session.get(models.Project, int(decoded_id.node_id))
            assert project is not None
            assert project.name == project_name
            assert project.description is None
            assert project.gradient_start_color == "#5bdbff"
            assert project.gradient_end_color == "#1c76fc"


async def test_delete_project_also_deletes_its_evaluators_trace_projects(
    gql_client: AsyncGraphQLClient,
    db: DbSessionFactory,
) -> None:
    async with db() as session:
        evaluated_project = models.Project(name=f"project-{token_hex(4)}")
        trace_project = models.Project(name=f"trace-sink-{token_hex(4)}")
        session.add_all([evaluated_project, trace_project])
        await session.flush()
        evaluator = models.BuiltinEvaluator(
            name=Identifier(root=f"evaluator-{token_hex(4)}"),
            kind="BUILTIN",
            key=token_hex(8),
            input_schema={},
            output_configs=[],
        )
        session.add(evaluator)
        await session.flush()
        session.add(
            models.ProjectEvaluator(
                project_id=evaluated_project.id,
                evaluator_id=evaluator.id,
                trace_project=trace_project,
                name=Identifier(root=f"project-evaluator-name-{token_hex(4)}"),
                evaluation_target="SPAN",
                filter_condition="",
                sampling_rate=1.0,
            )
        )
        await session.flush()
        evaluated_project_id = evaluated_project.id
        trace_project_id = trace_project.id

    response = await gql_client.execute(
        """mutation ($id: ID!) {
            deleteProject(id: $id) { __typename }
        }""",
        variables={"id": str(GlobalID("Project", str(evaluated_project_id)))},
    )
    assert not response.errors

    async with db() as session:
        remaining = (
            await session.scalars(
                select(models.Project.id).where(
                    models.Project.id.in_([evaluated_project_id, trace_project_id])
                )
            )
        ).all()
    assert remaining == []


async def test_delete_project_refuses_an_evaluator_trace_project(
    gql_client: AsyncGraphQLClient,
    db: DbSessionFactory,
) -> None:
    async with db() as session:
        evaluated_project = models.Project(name=f"project-{token_hex(4)}")
        trace_project = models.Project(name=f"trace-sink-{token_hex(4)}")
        session.add_all([evaluated_project, trace_project])
        await session.flush()
        evaluator = models.BuiltinEvaluator(
            name=Identifier(root=f"evaluator-{token_hex(4)}"),
            kind="BUILTIN",
            key=token_hex(8),
            input_schema={},
            output_configs=[],
        )
        session.add(evaluator)
        await session.flush()
        session.add(
            models.ProjectEvaluator(
                project_id=evaluated_project.id,
                evaluator_id=evaluator.id,
                trace_project=trace_project,
                name=Identifier(root=f"project-evaluator-name-{token_hex(4)}"),
                evaluation_target="SPAN",
                filter_condition="",
                sampling_rate=1.0,
            )
        )
        await session.flush()
        trace_project_id = trace_project.id

    response = await gql_client.execute(
        """mutation ($id: ID!) {
            deleteProject(id: $id) { __typename }
        }""",
        variables={"id": str(GlobalID("Project", str(trace_project_id)))},
    )
    assert response.errors
    assert "delete the evaluator instead" in response.errors[0].message

    async with db() as session:
        assert await session.get(models.Project, trace_project_id) is not None

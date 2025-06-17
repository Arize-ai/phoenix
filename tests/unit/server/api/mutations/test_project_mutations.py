from datetime import datetime, timedelta, timezone
from secrets import token_hex

from strawberry.relay import GlobalID

from phoenix.db import models
from phoenix.server.types import DbSessionFactory

from ....graphql import AsyncGraphQLClient


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
        """  # noqa: E501
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

            # The two oldest traces and their sessions should be deleted since they're
            # before end_time
            for i in range(1, n):
                old_trace = await session.get(models.Trace, traces[i].id)
                assert old_trace is None, f"Trace {i} should be deleted"

                if i < n - 1:
                    session_obj = await session.get(models.ProjectSession, project_sessions[i].id)
                    assert session_obj is None, f"Session {i} should be deleted"

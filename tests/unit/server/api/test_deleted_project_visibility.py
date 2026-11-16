from __future__ import annotations

from datetime import datetime, timezone
from secrets import token_hex

import httpx2
from sqlalchemy import update
from strawberry.relay import GlobalID

from phoenix.db import models
from phoenix.db.constants import DEFAULT_PROJECT_TRACE_RETENTION_POLICY_ID
from phoenix.server.api.dataloaders.project_ids_by_trace_retention_policy_id import (
    ProjectIdsByTraceRetentionPolicyIdDataLoader,
)
from phoenix.server.types import DbSessionFactory
from tests.unit._helpers import _add_project, _add_project_session, _add_span, _add_trace
from tests.unit.graphql import AsyncGraphQLClient


async def _tombstone(db: DbSessionFactory, project_id: int) -> None:
    async with db() as session:
        await session.execute(
            update(models.Project)
            .where(models.Project.id == project_id)
            .values(deleted_at=datetime.now(timezone.utc))
        )


class TestDeletedProjectVisibility:
    async def test_graphql_nodes_in_deleted_project_are_not_found(
        self, db: DbSessionFactory, gql_client: AsyncGraphQLClient
    ) -> None:
        async with db() as session:
            project = await _add_project(session, name=f"gql-{token_hex(4)}")
            project_session = await _add_project_session(session, project)
            trace = await _add_trace(session, project, project_session)
            span = await _add_span(session, trace=trace)
            ids = {
                "Trace": trace.id,
                "Span": span.id,
                "ProjectSession": project_session.id,
            }
            project_id = project.id

        query = "query($id: ID!) { node(id: $id) { __typename } }"
        for type_name, rowid in ids.items():
            response = await gql_client.execute(
                query, variables={"id": str(GlobalID(type_name, str(rowid)))}
            )
            assert not response.errors and response.data
            assert response.data["node"]["__typename"] == type_name

        await _tombstone(db, project_id)
        for type_name, rowid in ids.items():
            response = await gql_client.execute(
                query, variables={"id": str(GlobalID(type_name, str(rowid)))}
            )
            assert response.errors, type_name

    async def test_rest_session_in_deleted_project_is_not_found(
        self, db: DbSessionFactory, httpx_client: httpx2.AsyncClient
    ) -> None:
        async with db() as session:
            project = await _add_project(session, name=f"rest-{token_hex(4)}")
            project_session = await _add_project_session(session, project)
            session_id, project_id = project_session.session_id, project.id
        assert (await httpx_client.get(f"v1/sessions/{session_id}")).status_code == 200
        await _tombstone(db, project_id)
        assert (await httpx_client.get(f"v1/sessions/{session_id}")).status_code == 404

    async def test_create_spans_by_deleted_project_id_is_not_found(
        self, db: DbSessionFactory, httpx_client: httpx2.AsyncClient
    ) -> None:
        async with db() as session:
            project = await _add_project(session, name=f"spans-{token_hex(4)}")
            project_id = project.id
        await _tombstone(db, project_id)
        response = await httpx_client.post(
            f"v1/projects/{GlobalID('Project', str(project_id))}/spans",
            json={
                "data": [
                    {
                        "name": "s",
                        "context": {"trace_id": token_hex(16), "span_id": token_hex(8)},
                        "span_kind": "LLM",
                        "start_time": "2024-01-01T12:00:00Z",
                        "end_time": "2024-01-01T12:00:01Z",
                        "status_code": "OK",
                    }
                ]
            },
        )
        assert response.status_code == 404

    async def test_retention_policy_dataloader_skips_deleted_projects(
        self, db: DbSessionFactory
    ) -> None:
        async with db() as session:
            live = await _add_project(session, name=f"live-{token_hex(4)}")
            dead = await _add_project(session, name=f"dead-{token_hex(4)}")
            live_id, dead_id = live.id, dead.id
        await _tombstone(db, dead_id)
        loader = ProjectIdsByTraceRetentionPolicyIdDataLoader(db)
        [project_ids] = await loader.load_many([DEFAULT_PROJECT_TRACE_RETENTION_POLICY_ID])
        assert live_id in project_ids and dead_id not in project_ids

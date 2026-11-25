from __future__ import annotations

import re
from collections.abc import AsyncIterator
from datetime import datetime, timedelta, timezone
from secrets import token_hex
from typing import Any, cast
from unittest.mock import MagicMock

import httpx2
from opentelemetry.context import Context as OtelContext
from sqlalchemy import select, update
from strawberry.relay import GlobalID

from phoenix.db import models
from phoenix.db.constants import DEFAULT_PROJECT_TRACE_RETENTION_POLICY_ID
from phoenix.db.insertion.dataset import resolve_span_ids_to_rowids
from phoenix.db.types.annotation_configs import (
    AnnotationType,
    FreeformAnnotationConfig,
)
from phoenix.db.types.identifier import Identifier
from phoenix.db.types.prompts import PromptMessageRole, PromptTemplateFormat
from phoenix.server.api.dataloaders.last_used_times_by_generative_model_id import (
    LastUsedTimesByGenerativeModelIdDataLoader,
)
from phoenix.server.api.dataloaders.project_ids_by_trace_retention_policy_id import (
    ProjectIdsByTraceRetentionPolicyIdDataLoader,
)
from phoenix.server.api.dataloaders.span_cost_detail_summary_entries_by_model_and_scope import (
    CostDetailSummaryScope,
    GenerativeModelCostDetailSummaryKey,
    SpanCostDetailSummaryEntriesByModelAndScopeDataLoader,
)
from phoenix.server.api.dataloaders.span_cost_summary_by_generative_model import (
    SpanCostSummaryByGenerativeModelDataLoader,
)
from phoenix.server.api.dataloaders.trace_by_trace_ids import TraceByTraceIdsDataLoader
from phoenix.server.api.helpers.playground_project import get_or_create_playground_project_id
from phoenix.server.api.input_types.ChatCompletionInput import ChatCompletionInput
from phoenix.server.api.input_types.PromptInvocationParametersInput import (
    PromptInvocationParametersInput,
    PromptOpenAIInvocationParametersInput,
)
from phoenix.server.api.input_types.PromptVersionInput import (
    ChatPromptVersionInput,
    ContentPartInput,
    PromptChatTemplateInput,
    PromptMessageInput,
    TextContentValueInput,
)
from phoenix.server.api.subscriptions import _stream_single_chat_completion
from phoenix.server.api.types.GenerativeProvider import GenerativeProviderKey
from phoenix.server.types import DbSessionFactory
from phoenix.tracers import Tracer
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
    async def test_graphql_nodes_and_otel_root_queries_skip_deleted_projects(
        self, db: DbSessionFactory, gql_client: AsyncGraphQLClient
    ) -> None:
        async with db() as session:
            project = await _add_project(session, name=f"gql-{token_hex(4)}")
            project_session = await _add_project_session(session, project)
            trace = await _add_trace(session, project, project_session)
            span = await _add_span(session, trace=trace)
            annotation_values: dict[str, Any] = dict(
                name="quality",
                label="good",
                score=1.0,
                explanation=None,
                metadata_={},
                annotator_kind="HUMAN",
                identifier="",
                source="APP",
            )
            span_annotation = models.SpanAnnotation(span_rowid=span.id, **annotation_values)
            trace_annotation = models.TraceAnnotation(trace_rowid=trace.id, **annotation_values)
            session.add_all([span_annotation, trace_annotation])
            await session.flush()
            project_id = project.id
            node_ids = {
                "Trace": trace.id,
                "Span": span.id,
                "ProjectSession": project_session.id,
                "SpanAnnotation": span_annotation.id,
                "TraceAnnotation": trace_annotation.id,
            }
            root_variables = {
                "spanId": span.span_id,
                "traceId": trace.trace_id,
                "sessionId": project_session.session_id,
            }

        root_query = """
        query($spanId: String!, $traceId: String!, $sessionId: String!) {
          getSpanByOtelId(spanId: $spanId) { id }
          getTraceByOtelId(traceId: $traceId) { id }
          getProjectSessionById(sessionId: $sessionId) { id }
        }
        """
        node_query = "query($id: ID!) { node(id: $id) { __typename } }"

        before = await gql_client.execute(root_query, variables=root_variables)
        assert not before.errors and before.data
        assert all(root is not None for root in before.data.values())
        for type_name, rowid in node_ids.items():
            response = await gql_client.execute(
                node_query, variables={"id": str(GlobalID(type_name, str(rowid)))}
            )
            assert not response.errors and response.data
            assert response.data["node"]["__typename"] == type_name

        await _tombstone(db, project_id)

        after = await gql_client.execute(root_query, variables=root_variables)
        assert not after.errors and after.data
        assert all(root is None for root in after.data.values())
        for type_name, rowid in node_ids.items():
            response = await gql_client.execute(
                node_query, variables={"id": str(GlobalID(type_name, str(rowid)))}
            )
            assert response.errors, type_name
            expected_global_id = str(GlobalID(type_name, str(rowid)))
            assert response.errors[0].message == f"Unknown {type_name}: {expected_global_id}"

    async def test_trace_in_live_project_hides_session_owned_by_deleted_project(
        self, db: DbSessionFactory, gql_client: AsyncGraphQLClient
    ) -> None:
        async with db() as session:
            owner_project = await _add_project(session, name=f"owner-{token_hex(4)}")
            live_project = await _add_project(session, name=f"live-{token_hex(4)}")
            project_session = await _add_project_session(session, owner_project)
            trace = await _add_trace(session, live_project, project_session)
            owner_project_id, trace_id = owner_project.id, trace.id
        query = """
        query($id: ID!) {
          node(id: $id) { ... on Trace { projectSessionId session { id project { name } } } }
        }
        """
        trace_global_id = str(GlobalID("Trace", str(trace_id)))
        before = await gql_client.execute(query, variables={"id": trace_global_id})
        assert not before.errors and before.data
        assert before.data["node"]["session"] is not None
        assert before.data["node"]["projectSessionId"] is not None

        await _tombstone(db, owner_project_id)

        after = await gql_client.execute(query, variables={"id": trace_global_id})
        assert not after.errors and after.data
        assert after.data["node"]["session"] is None
        assert after.data["node"]["projectSessionId"] is None

    async def test_rest_session_readers_omit_traces_of_deleted_projects(
        self, db: DbSessionFactory, httpx_client: httpx2.AsyncClient
    ) -> None:
        async with db() as session:
            live_project = await _add_project(session, name=f"live-{token_hex(4)}")
            deleted_project = await _add_project(session, name=f"gone-{token_hex(4)}")
            project_session = await _add_project_session(session, live_project)
            live_trace = await _add_trace(session, live_project, project_session)
            deleted_trace = await _add_trace(session, deleted_project, project_session)
            session_id, live_project_name = project_session.session_id, live_project.name
            live_trace_id, deleted_trace_id = live_trace.trace_id, deleted_trace.trace_id
            deleted_project_id = deleted_project.id
        await _tombstone(db, deleted_project_id)

        get_response = await httpx_client.get(f"v1/sessions/{session_id}")
        assert get_response.status_code == 200
        list_response = await httpx_client.get(f"v1/projects/{live_project_name}/sessions")
        assert list_response.status_code == 200
        for session_data in (get_response.json()["data"], list_response.json()["data"][0]):
            trace_ids = [trace["trace_id"] for trace in session_data["traces"]]
            assert trace_ids == [live_trace_id]
            assert deleted_trace_id not in trace_ids

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

        def _span_request_body() -> dict[str, Any]:
            return {
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
            }

        spans_url = f"v1/projects/{GlobalID('Project', str(project_id))}/spans"
        live_response = await httpx_client.post(spans_url, json=_span_request_body())
        assert live_response.status_code == 202

        await _tombstone(db, project_id)
        response = await httpx_client.post(spans_url, json=_span_request_body())
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

    async def test_dataset_example_span_and_add_spans_fenced_against_deleted_project(
        self,
        db: DbSessionFactory,
        gql_client: AsyncGraphQLClient,
        httpx_client: httpx2.AsyncClient,
    ) -> None:
        async with db() as session:
            project = await _add_project(session, name=f"ds-span-{token_hex(4)}")
            trace = await _add_trace(session, project)
            linked_span = await _add_span(session, trace=trace)
            candidate_span = await _add_span(session, trace=trace)
            dataset = models.Dataset(
                name=f"ds-{token_hex(4)}",
                description=None,
                metadata_={},
            )
            session.add(dataset)
            await session.flush()
            version = models.DatasetVersion(
                dataset_id=dataset.id,
                description=None,
                metadata_={},
            )
            example = models.DatasetExample(
                dataset_id=dataset.id,
                span_rowid=linked_span.id,
            )
            session.add_all([version, example])
            await session.flush()
            session.add(
                models.DatasetExampleRevision(
                    dataset_example_id=example.id,
                    dataset_version_id=version.id,
                    input={"q": "hi"},
                    output={"a": "hello"},
                    metadata_={},
                    revision_kind="CREATE",
                )
            )
            await session.flush()
            project_id = project.id
            dataset_gid = str(GlobalID("Dataset", str(dataset.id)))
            example_gid = str(GlobalID("DatasetExample", str(example.id)))
            candidate_span_gid = str(GlobalID("Span", str(candidate_span.id)))
            candidate_otel_span_id = candidate_span.span_id
            linked_otel_span_id = linked_span.span_id

        example_span_query = (
            "query($id: ID!) { node(id: $id) { ... on DatasetExample { span { id } } } }"
        )
        before_gql = await gql_client.execute(example_span_query, variables={"id": example_gid})
        assert not before_gql.errors and before_gql.data
        assert before_gql.data["node"]["span"] is not None

        before_rest = await httpx_client.get(f"v1/datasets/{dataset_gid}/examples")
        assert before_rest.status_code == 200
        before_examples = before_rest.json()["data"]["examples"]
        assert len(before_examples) == 1
        assert before_examples[0]["source"]["span_id"] == linked_otel_span_id

        await _tombstone(db, project_id)

        after_gql = await gql_client.execute(example_span_query, variables={"id": example_gid})
        assert not after_gql.errors and after_gql.data
        assert after_gql.data["node"]["span"] is None

        after_rest = await httpx_client.get(f"v1/datasets/{dataset_gid}/examples")
        assert after_rest.status_code == 200
        after_examples = after_rest.json()["data"]["examples"]
        assert len(after_examples) == 1
        assert after_examples[0]["source"] is None

        add_spans_resp = await gql_client.execute(
            """
            mutation($datasetId: ID!, $spanIds: [ID!]!) {
              addSpansToDataset(input: { datasetId: $datasetId, spanIds: $spanIds }) {
                dataset { id }
              }
            }
            """,
            variables={"datasetId": dataset_gid, "spanIds": [candidate_span_gid]},
        )
        assert [error.message for error in add_spans_resp.errors] == [
            "Some spans could not be found"
        ]

        add_examples_resp = await gql_client.execute(
            """
            mutation($datasetId: ID!, $spanId: ID!) {
              addExamplesToDataset(
                input: {
                  datasetId: $datasetId
                  examples: [{ input: { q: "x" }, output: { a: "y" }, metadata: {}, spanId: $spanId }]
                }
              ) {
                dataset { id }
              }
            }
            """,
            variables={"datasetId": dataset_gid, "spanId": candidate_span_gid},
        )
        assert [error.message for error in add_examples_resp.errors] == [
            "Some spans could not be found"
        ]

        async with db() as session:
            resolved = await resolve_span_ids_to_rowids(session, [candidate_otel_span_id])
            assert resolved == {}

    async def test_generative_model_and_trace_dataloaders_skip_deleted_projects(
        self, db: DbSessionFactory
    ) -> None:
        t_live = datetime(2025, 1, 1, 12, 0, tzinfo=timezone.utc)
        t_dead = t_live + timedelta(hours=1)
        async with db() as session:
            model = models.GenerativeModel(
                name=f"model-{token_hex(4)}",
                provider="openai",
                name_pattern=re.compile(f"^model-{token_hex(4)}$"),
                is_built_in=False,
            )
            live_project = await _add_project(session, name=f"cost-live-{token_hex(4)}")
            dead_project = await _add_project(session, name=f"cost-dead-{token_hex(4)}")
            live_trace = await _add_trace(session, live_project, start_time=t_live)
            dead_trace = await _add_trace(session, dead_project, start_time=t_dead)
            live_span = await _add_span(session, trace=live_trace, start_time=t_live)
            dead_span = await _add_span(session, trace=dead_trace, start_time=t_dead)
            session.add(model)
            await session.flush()

            live_cost = models.SpanCost(
                span_rowid=live_span.id,
                trace_rowid=live_trace.id,
                span_start_time=t_live,
                model_id=model.id,
            )
            live_cost.append_detail(
                models.SpanCostDetail(token_type="input", is_prompt=True, cost=1.0, tokens=10.0)
            )
            dead_cost = models.SpanCost(
                span_rowid=dead_span.id,
                trace_rowid=dead_trace.id,
                span_start_time=t_dead,
                model_id=model.id,
            )
            dead_cost.append_detail(
                models.SpanCostDetail(token_type="input", is_prompt=True, cost=5.0, tokens=50.0)
            )
            session.add_all([live_cost, dead_cost])
            await session.flush()
            model_id = model.id
            dead_project_id = dead_project.id
            live_trace_id = live_trace.trace_id
            dead_trace_id = dead_trace.trace_id

        await _tombstone(db, dead_project_id)

        trace_loader = TraceByTraceIdsDataLoader(db)
        loaded_live_trace, loaded_dead_trace = await trace_loader.load_many(
            [live_trace_id, dead_trace_id]
        )
        assert loaded_live_trace is not None
        assert loaded_dead_trace is None

        cost_loader = SpanCostSummaryByGenerativeModelDataLoader(db)
        [summary] = await cost_loader.load_many([model_id])
        assert summary.total.cost == 1.0
        assert summary.total.tokens == 10.0

        detail_loader = SpanCostDetailSummaryEntriesByModelAndScopeDataLoader(db)
        unscoped_entries, dead_scoped_entries = await detail_loader.load_many(
            [
                GenerativeModelCostDetailSummaryKey(model_id=model_id),
                GenerativeModelCostDetailSummaryKey(
                    model_id=model_id,
                    scope=CostDetailSummaryScope(project_id=dead_project_id),
                ),
            ]
        )
        assert len(unscoped_entries) == 1
        assert unscoped_entries[0].value.cost == 1.0
        assert dead_scoped_entries == []

        last_used_loader = LastUsedTimesByGenerativeModelIdDataLoader(db)
        [last_used] = await last_used_loader.load_many([model_id])
        assert last_used == t_live

    async def test_remove_annotation_config_from_deleted_project_is_not_found(
        self, db: DbSessionFactory, gql_client: AsyncGraphQLClient
    ) -> None:
        async with db() as session:
            project = await _add_project(session, name=f"anno-cfg-{token_hex(4)}")
            config = models.AnnotationConfig(
                name=f"cfg-{token_hex(4)}",
                config=FreeformAnnotationConfig(
                    type=AnnotationType.FREEFORM.value, description="desc"
                ),
            )
            session.add(config)
            await session.flush()
            assoc = models.ProjectAnnotationConfig(
                project_id=project.id,
                annotation_config_id=config.id,
            )
            session.add(assoc)
            await session.flush()
            project_id = project.id
            assoc_id = assoc.id
            project_gid = str(GlobalID("Project", str(project.id)))
            config_gid = str(GlobalID("FreeformAnnotationConfig", str(config.id)))

        await _tombstone(db, project_id)
        resp = await gql_client.execute(
            """
            mutation($input: [RemoveAnnotationConfigFromProjectInput!]!) {
              removeAnnotationConfigFromProject(input: $input) {
                project { id }
              }
            }
            """,
            variables={"input": [{"projectId": project_gid, "annotationConfigId": config_gid}]},
        )
        assert resp.errors
        async with db() as session:
            assert await session.get(models.ProjectAnnotationConfig, assoc_id) is not None

    async def test_direct_delete_endpoints_return_not_found_on_tombstoned_project(
        self,
        db: DbSessionFactory,
        httpx_client: httpx2.AsyncClient,
        gql_client: AsyncGraphQLClient,
    ) -> None:
        async with db() as session:
            project = await _add_project(session, name=f"del-{token_hex(4)}")
            project_session = await _add_project_session(session, project)
            trace = await _add_trace(session, project, project_session)
            span = await _add_span(session, trace=trace)
            project_id = project.id
            session_rowid = project_session.id
            session_id = project_session.session_id
            trace_rowid = trace.id
            otel_trace_id = trace.trace_id
            span_rowid = span.id
            otel_span_id = span.span_id

        await _tombstone(db, project_id)

        assert (await httpx_client.delete(f"v1/sessions/{session_id}")).status_code == 404
        assert (
            await httpx_client.post(
                "v1/sessions/delete", json={"session_identifiers": [session_id]}
            )
        ).status_code == 204
        assert (await httpx_client.delete(f"v1/traces/{otel_trace_id}")).status_code == 404
        assert (await httpx_client.delete(f"v1/spans/{otel_span_id}")).status_code == 404

        gql_delete = await gql_client.execute(
            "mutation($traceIds: [ID!]!) { deleteTraces(traceIds: $traceIds) { __typename } }",
            variables={"traceIds": [str(GlobalID("Trace", str(trace_rowid)))]},
        )
        assert gql_delete.errors

        async with db() as session:
            assert await session.get(models.ProjectSession, session_rowid) is not None
            assert await session.get(models.Trace, trace_rowid) is not None
            assert await session.get(models.Span, span_rowid) is not None

    async def test_space_reclaiming_mutations_succeed_when_storage_locked_out(
        self, db: DbSessionFactory, gql_client: AsyncGraphQLClient
    ) -> None:
        async with db() as session:
            project = await _add_project(session, name=f"locked-{token_hex(4)}")
            project_session = await _add_project_session(session, project)
            trace = await _add_trace(session, project, project_session)
            span = await _add_span(session, trace=trace)
            span_note = models.SpanAnnotation(
                span_rowid=span.id,
                name="note",
                label=None,
                score=None,
                explanation="span note",
                metadata_={},
                annotator_kind="HUMAN",
                identifier="px-span-note:1",
                source="APP",
            )
            trace_note = models.TraceAnnotation(
                trace_rowid=trace.id,
                name="note",
                label=None,
                score=None,
                explanation="trace note",
                metadata_={},
                annotator_kind="HUMAN",
                identifier="px-trace-note:1",
                source="APP",
            )
            session_note = models.ProjectSessionAnnotation(
                project_session_id=project_session.id,
                name="note",
                label=None,
                score=None,
                explanation="session note",
                metadata_={},
                annotator_kind="HUMAN",
                identifier="px-session-note:1",
                source="APP",
            )
            evaluator = models.BuiltinEvaluator(
                name=Identifier(root=f"eval-{token_hex(4)}"),
                kind="BUILTIN",
                key=token_hex(8),
                input_schema={},
                output_configs=[],
            )
            session.add_all([span_note, trace_note, session_note, evaluator])
            await session.flush()
            project_evaluator = models.ProjectEvaluator(
                trace_project=models.Project(name=f"eval-traces-{token_hex(8)}"),
                project_id=project.id,
                evaluator_id=evaluator.id,
                name=Identifier(root=f"pe-{token_hex(4)}"),
                filter_condition="",
                sampling_rate=1.0,
                evaluation_target="SPAN",
            )
            session.add(project_evaluator)
            await session.flush()
            session.add(
                models.EvalWorkUnit(
                    span_rowid=span.id,
                    project_evaluator_id=project_evaluator.id,
                    status="PENDING",
                )
            )
            await session.flush()
            project_gid = str(GlobalID("Project", str(project.id)))
            span_note_gid = str(GlobalID("SpanAnnotation", str(span_note.id)))
            trace_note_gid = str(GlobalID("TraceAnnotation", str(trace_note.id)))
            session_note_gid = str(GlobalID("ProjectSessionAnnotation", str(session_note.id)))

        db.should_not_insert_or_update = True
        try:
            del_span_note = await gql_client.execute(
                """
                mutation($input: DeleteAnnotationsInput!) {
                  deleteSpanNotes(input: $input) { spanAnnotations { id } }
                }
                """,
                variables={"input": {"annotationIds": [span_note_gid]}},
            )
            assert not del_span_note.errors and del_span_note.data

            del_trace_note = await gql_client.execute(
                """
                mutation($input: DeleteAnnotationsInput!) {
                  deleteTraceNotes(input: $input) { traceAnnotations { id } }
                }
                """,
                variables={"input": {"annotationIds": [trace_note_gid]}},
            )
            assert not del_trace_note.errors and del_trace_note.data

            del_session_note = await gql_client.execute(
                """
                mutation($input: DeleteAnnotationsInput!) {
                  deleteProjectSessionNotes(input: $input) { projectSessionAnnotations { id } }
                }
                """,
                variables={"input": {"annotationIds": [session_note_gid]}},
            )
            assert not del_session_note.errors and del_session_note.data

            clear_queued = await gql_client.execute(
                """
                mutation($input: ClearProjectQueuedEvaluationsInput!) {
                  clearProjectQueuedEvaluations(input: $input) { clearedCount }
                }
                """,
                variables={"input": {"projectId": project_gid}},
            )
            assert not clear_queued.errors and clear_queued.data
            assert clear_queued.data["clearProjectQueuedEvaluations"]["clearedCount"] == 1
        finally:
            db.should_not_insert_or_update = False

    async def test_playground_stream_recreates_project_if_tombstoned_mid_stream(
        self, db: DbSessionFactory
    ) -> None:
        async with db() as session:
            initial_project_id = await get_or_create_playground_project_id(session)

        class _MidStreamDeleteClient:
            async def chat_completion_create(
                self, *, tracer: Tracer, otel_context: OtelContext, **_: Any
            ) -> AsyncIterator[Any]:
                with tracer.start_as_current_span("ChatCompletion", context=otel_context):
                    pass
                await _tombstone(db, initial_project_id)
                if False:
                    yield

        inserted_project_ids: list[int] = []
        stream = _stream_single_chat_completion(
            input=ChatCompletionInput(
                prompt_version=ChatPromptVersionInput(
                    template_format=PromptTemplateFormat.NONE,
                    template=PromptChatTemplateInput(
                        messages=[
                            PromptMessageInput(
                                role=PromptMessageRole.USER,
                                content=[ContentPartInput(text=TextContentValueInput(text="hi"))],
                            )
                        ]
                    ),
                    invocation_parameters=PromptInvocationParametersInput(
                        openai=PromptOpenAIInvocationParametersInput()
                    ),
                    model_provider=GenerativeProviderKey.OPENAI,
                    model_name="gpt-4o-mini",
                    tools=None,
                ),
                repetitions=1,
            ),
            llm_client=cast(Any, _MidStreamDeleteClient()),
            repetition_number=1,
            db=db,
            on_span_insertion=inserted_project_ids.append,
            span_cost_calculator=cast(Any, MagicMock()),
            otel_context=OtelContext(),
        )
        payloads = [payload async for payload in stream]
        assert len(payloads) == 1
        assert len(inserted_project_ids) == 1
        new_project_id = inserted_project_ids[0]
        assert new_project_id != initial_project_id
        async with db() as session:
            new_project = await session.get(models.Project, new_project_id)
            assert new_project is not None and new_project.deleted_at is None
            trace_project_ids = (
                await session.scalars(
                    select(models.Trace.project_rowid).where(
                        models.Trace.project_rowid.in_([initial_project_id, new_project_id])
                    )
                )
            ).all()
            assert list(trace_project_ids) == [new_project_id]

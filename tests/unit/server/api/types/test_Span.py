import json
from collections import defaultdict
from datetime import datetime, timezone
from random import choice, randint, random
from secrets import token_hex
from typing import Any, Mapping, Optional

import pytest
from faker import Faker
from openinference.semconv.trace import OpenInferenceMimeTypeValues, OpenInferenceSpanKindValues
from sqlalchemy import insert
from strawberry.relay import GlobalID
from typing_extensions import TypeAlias

from phoenix.db import models
from phoenix.server.api.types.node import from_global_id_with_expected_type
from phoenix.server.api.types.Project import Project
from phoenix.server.api.types.Span import Span
from phoenix.server.api.types.Trace import Trace
from phoenix.server.types import DbSessionFactory
from phoenix.trace.attributes import get_attribute_value
from tests.unit.graphql import AsyncGraphQLClient

_TraceRowId: TypeAlias = int
_SpanRowId: TypeAlias = int
_SpanId: TypeAlias = str

fake = Faker()


async def test_project_resolver_returns_correct_project(
    gql_client: AsyncGraphQLClient,
    project_with_a_single_trace_and_span: None,
) -> None:
    query = """
      query ($spanId: ID!) {
        span: node(id: $spanId) {
          ... on Span {
            project {
              id
              name
            }
          }
        }
      }
    """
    span_id = str(GlobalID(Span.__name__, str(1)))
    response = await gql_client.execute(
        query=query,
        variables={"spanId": span_id},
    )
    assert not response.errors
    assert response.data == {
        "span": {
            "project": {
                "id": str(GlobalID(Project.__name__, str(1))),
                "name": "project-name",
            }
        }
    }


async def test_querying_spans_contained_in_datasets(
    gql_client: AsyncGraphQLClient,
    project_with_a_single_trace_and_span: None,
    simple_dataset: None,
) -> None:
    query = """
      query ($spanId: ID!) {
        span: node(id: $spanId) {
          ... on Span {
            containedInDataset
          }
        }
      }
    """
    span_id = str(GlobalID(Span.__name__, str(1)))
    response = await gql_client.execute(
        query=query,
        variables={
            "spanId": span_id,
        },
    )
    assert not response.errors
    assert (data := response.data) is not None
    actual_contained_in_dataset = data["span"]["containedInDataset"]
    assert actual_contained_in_dataset is True


async def test_querying_spans_not_contained_in_datasets(
    gql_client: AsyncGraphQLClient, project_with_a_single_trace_and_span: None
) -> None:
    query = """
      query ($spanId: ID!) {
        span: node(id: $spanId) {
          ... on Span {
            containedInDataset
          }
        }
      }
    """
    span_id = str(GlobalID(Span.__name__, str(1)))
    response = await gql_client.execute(
        query=query,
        variables={
            "spanId": span_id,
        },
    )
    assert not response.errors
    assert (data := response.data) is not None
    actual_contained_in_dataset = data["span"]["containedInDataset"]
    assert actual_contained_in_dataset is False


async def test_span_fields(
    gql_client: AsyncGraphQLClient,
    _span_data: tuple[models.Project, Mapping[int, models.Trace], Mapping[int, models.Span]],
) -> None:
    query = """
      query SpanBySpanNodeId($id: ID!) {
        node(id: $id) {
          ... on Span {
            ...SpanFragment
          }
        }
      }
      query SpansByTraceNodeId($traceId: ID!) {
        node(id: $traceId) {
          ... on Trace {
            spans(first: 1000) {
              edges {
                node {
                  ...SpanFragment
                }
              }
            }
          }
        }
      }
      query SpansByProjectNodeId($projectId: ID!) {
        node(id: $projectId) {
          ... on Project {
            spans(first: 1000) {
              edges {
                node {
                  ...SpanFragment
                }
              }
            }
          }
        }
      }
      fragment SpanFragment on Span {
        id
        name
        statusCode
        statusMessage
        startTime
        endTime
        latencyMs
        parentId
        spanKind
        context {
          spanId
          traceId
        }
        trace {
          id
          numSpans
        }
        attributes
        tokenCountTotal
        tokenCountPrompt
        tokenCountCompletion
        cumulativeTokenCountTotal
        cumulativeTokenCountPrompt
        cumulativeTokenCountCompletion
        propagatedStatusCode
        input {
          mimeType
          value
        }
        output {
          mimeType
          value
        }
        events {
          name
          message
          timestamp
        }
        metadata
        numDocuments
        numChildSpans
        descendants(maxDepth: 3) {
          edges {
            node {
              id
            }
          }
        }
      }
    """
    db_project, db_traces, db_spans = _span_data
    db_num_spans_per_trace = _get_num_spans_per_trace(db_spans)
    db_descendent_rowids = _get_descendant_rowids(db_spans, 3)
    db_num_child_spans = _get_num_child_spans(db_spans)
    project_id = str(GlobalID(Project.__name__, str(db_project.id)))
    response = await gql_client.execute(
        query=query,
        variables={"projectId": project_id},
        operation_name="SpansByProjectNodeId",
    )
    assert not response.errors
    assert (data := response.data) is not None
    spans = [e["node"] for e in data["node"]["spans"]["edges"]]
    assert len(spans) == len(db_spans)
    for db_trace in db_traces.values():
        trace_gid = str(GlobalID(Trace.__name__, str(db_trace.id)))
        response = await gql_client.execute(
            query=query,
            variables={"traceId": trace_gid},
            operation_name="SpansByTraceNodeId",
        )
        assert not response.errors
        assert (data := response.data) is not None
        spans.extend(e["node"] for e in data["node"]["spans"]["edges"])
    assert len(spans) == len(db_spans) * 2
    for db_span in db_spans.values():
        id_ = str(GlobalID(Span.__name__, str(db_span.id)))
        response = await gql_client.execute(
            query=query,
            variables={"id": id_},
            operation_name="SpanBySpanNodeId",
        )
        assert not response.errors
        assert (data := response.data) is not None
        spans.append(data["node"])
    assert len(spans) == len(db_spans) * 3
    for span in spans:
        span_rowid = from_global_id_with_expected_type(GlobalID.from_id(span["id"]), Span.__name__)
        db_span = db_spans[span_rowid]
        assert span["id"] == str(GlobalID(Span.__name__, str(db_span.id)))
        assert span["name"] == db_span.name
        assert span["statusCode"] == db_span.status_code
        assert span["statusMessage"] == db_span.status_message
        assert span["startTime"] == db_span.start_time.isoformat()
        assert span["endTime"] == db_span.end_time.isoformat()
        assert span["parentId"] == db_span.parent_id
        assert span["spanKind"] == db_span.span_kind.lower()
        assert span["context"]["spanId"] == db_span.span_id
        assert span["context"]["traceId"] == db_traces[db_span.trace_rowid].trace_id
        assert isinstance(span["attributes"], str) and span["attributes"]
        assert json.loads(span["attributes"]) == db_span.attributes
        assert span["tokenCountPrompt"] == db_span.llm_token_count_prompt
        assert span["tokenCountCompletion"] == db_span.llm_token_count_completion
        assert span["tokenCountTotal"] == (db_span.llm_token_count_completion or 0) + (
            db_span.llm_token_count_prompt or 0
        )
        assert span["cumulativeTokenCountPrompt"] == (
            db_span.cumulative_llm_token_count_prompt or 0
        )
        assert span["cumulativeTokenCountCompletion"] == (
            db_span.cumulative_llm_token_count_completion or 0
        )
        assert span["cumulativeTokenCountTotal"] == (
            db_span.cumulative_llm_token_count_completion or 0
        ) + (db_span.cumulative_llm_token_count_prompt or 0)
        assert span["propagatedStatusCode"] == "ERROR" if db_span.cumulative_error_count else "OK"
        if db_span.input_value:
            assert span["input"]["value"] == db_span.input_value
            if db_span.input_mime_type:
                assert span["input"]["mimeType"] in db_span.input_mime_type
            else:
                assert span["input"]["mimeType"] == "text"
        else:
            assert not span["input"]
        if db_span.output_value:
            assert span["output"]["value"] == db_span.output_value
            if db_span.output_mime_type:
                assert span["output"]["mimeType"] in db_span.output_mime_type
            else:
                assert span["output"]["mimeType"] == "text"
        else:
            assert not span["output"]
        if db_span.events:
            for event, db_event in zip(span["events"], db_span.events):
                assert event["name"] == db_event["name"]
                assert event["timestamp"] == db_event["timestamp"].isoformat()
        else:
            assert not span["events"]
        if db_span.metadata_:
            assert isinstance(span["metadata"], str) and span["metadata"]
            assert json.loads(span["metadata"]) == db_span.metadata_
        else:
            assert not span["metadata"]
        assert span["numDocuments"] == db_span.num_documents
        if num_child_spans := db_num_child_spans.get(span_rowid):
            assert span["numChildSpans"] == num_child_spans
        else:
            assert not span["numChildSpans"]
        if descendants := db_descendent_rowids.get(db_span.id):
            assert {e["node"]["id"] for e in span["descendants"]["edges"]} == {
                str(GlobalID(Span.__name__, str(id_))) for id_ in descendants
            }
        else:
            assert not span["descendants"]["edges"]
        assert span["trace"]["id"] == str(GlobalID(Trace.__name__, str(db_span.trace_rowid)))
        assert span["trace"]["numSpans"] == db_num_spans_per_trace[db_span.trace_rowid]


def _get_num_child_spans(
    spans: Mapping[_SpanRowId, models.Span],
) -> dict[_SpanRowId, int]:
    span_id_to_rowids: Mapping[_SpanId, _SpanRowId] = {
        span.span_id: span_rowid for span_rowid, span in spans.items()
    }
    ans: defaultdict[_SpanRowId, int] = defaultdict(int)
    for span in spans.values():
        if not (parent_id := span.parent_id):
            continue
        if (parent_rowid := span_id_to_rowids.get(parent_id)) is not None:
            ans[parent_rowid] += 1
    return ans


def _get_descendant_rowids(
    spans: Mapping[_SpanRowId, models.Span],
    max_depth: Optional[int] = None,
) -> dict[_SpanRowId, set[_SpanRowId]]:
    span_id_to_rowids: Mapping[_SpanId, _SpanRowId] = {
        span.span_id: span_rowid for span_rowid, span in spans.items()
    }
    descendant_rowids: defaultdict[_SpanRowId, set[_SpanRowId]] = defaultdict(set)
    for span in spans.values():
        child_span = span
        level = max_depth or -1
        while level and (parent_id := child_span.parent_id):
            parent_span_rowid = span_id_to_rowids[parent_id]
            descendant_rowids[parent_span_rowid].add(span.id)
            child_span = spans[parent_span_rowid]
            level -= 1
    return descendant_rowids


def _get_num_spans_per_trace(
    spans: Mapping[_SpanRowId, models.Span],
) -> dict[_TraceRowId, int]:
    ans: defaultdict[_TraceRowId, int] = defaultdict(int)
    for span in spans.values():
        ans[span.trace_rowid] += 1
    return ans


@pytest.fixture
async def _span_data(
    db: DbSessionFactory,
) -> tuple[models.Project, dict[_TraceRowId, models.Trace], dict[_SpanRowId, models.Span]]:
    traces: dict[_TraceRowId, models.Trace] = {}
    spans: dict[_SpanRowId, models.Span] = {}
    async with db() as session:
        project = models.Project(name=token_hex(8))
        session.add(project)
        await session.flush()
        for _ in range(5):
            trace = models.Trace(
                trace_id=token_hex(16),
                project_rowid=project.id,
                start_time=fake.past_datetime(tzinfo=timezone.utc),
                end_time=fake.future_datetime(tzinfo=timezone.utc),
            )
            session.add(trace)
            await session.flush()
            traces[trace.id] = trace
            trace_spans: list[models.Span] = []
            for _ in range(25):
                attributes: dict[str, Any] = fake.pydict(allowed_types=(str, int, float, bool))
                if random() < 0.5:
                    attributes["llm"] = {
                        "token_count": {
                            "prompt": randint(1, 1000),
                            "completion": randint(1, 1000),
                        }
                    }
                if random() < 0.5:
                    attributes["input"] = {
                        "value": json.dumps(fake.pydict(allowed_types=(str, int, float, bool))),
                    }
                    if random() < 0.5:
                        attributes["input"]["mime_type"] = choice(
                            list(OpenInferenceMimeTypeValues)
                        ).value
                if random() < 0.5:
                    attributes["output"] = {
                        "value": json.dumps(fake.pydict(allowed_types=(str, int, float, bool))),
                    }
                    if random() < 0.5:
                        attributes["output"]["mime_type"] = choice(
                            list(OpenInferenceMimeTypeValues)
                        ).value
                if random() < 0.5:
                    attributes["metadata"] = fake.pydict(allowed_types=(str, int, float, bool))
                if random() < 0.5:
                    attributes["retrieval"] = {"documents": []}
                    for _ in range(randint(1, 10)):
                        attributes["retrieval"]["documents"].append(
                            {
                                "document": {
                                    "id": token_hex(8),
                                    "score": random(),
                                    "content": token_hex(8),
                                }
                            }
                        )
                events = []
                if random() < 0.5:
                    for _ in range(randint(1, 10)):
                        event = {
                            "name": token_hex(8),
                            "timestamp": fake.past_datetime(tzinfo=timezone.utc),
                            "attributes": fake.pydict(allowed_types=(str, int, float, bool)),
                        }
                        events.append(event)
                cumulative_llm_token_count_prompt = randint(1, 1000)
                cumulative_llm_token_count_completion = randint(1, 1000)
                cumulative_error_count = randint(0, 1)
                start_time = fake.past_datetime(tzinfo=timezone.utc)
                end_time = fake.future_datetime(tzinfo=timezone.utc)
                parent_id: Optional[str] = None
                if trace_spans and random() < 0.5:
                    parent_id = choice(trace_spans[len(trace_spans) // 2 :]).span_id
                span = models.Span(
                    trace_rowid=trace.id,
                    span_id=token_hex(8),
                    parent_id=parent_id,
                    name=token_hex(8),
                    span_kind=choice(list(OpenInferenceSpanKindValues)).value,
                    start_time=start_time,
                    end_time=end_time,
                    attributes=attributes,
                    events=events,
                    status_code=choice(["OK", "ERROR", "UNSET"]),
                    status_message=token_hex(8),
                    cumulative_error_count=cumulative_error_count,
                    cumulative_llm_token_count_prompt=cumulative_llm_token_count_prompt,
                    cumulative_llm_token_count_completion=cumulative_llm_token_count_completion,
                    llm_token_count_prompt=get_attribute_value(
                        attributes, "llm.token_count.prompt"
                    ),
                    llm_token_count_completion=get_attribute_value(
                        attributes, "llm.token_count.completion"
                    ),
                )
                session.add(span)
                trace_spans.append(span)
            await session.flush()
            for span in trace_spans:
                spans[span.id] = span
    return project, traces, spans


@pytest.fixture
async def project_with_a_single_trace_and_span(
    db: DbSessionFactory,
) -> None:
    """
    Contains a project with a single trace and a single span.
    """
    async with db() as session:
        project_row_id = await session.scalar(
            insert(models.Project).values(name="project-name").returning(models.Project.id)
        )
        trace_id = await session.scalar(
            insert(models.Trace)
            .values(
                trace_id="1",
                project_rowid=project_row_id,
                start_time=datetime.fromisoformat("2021-01-01T00:00:00.000+00:00"),
                end_time=datetime.fromisoformat("2021-01-01T00:01:00.000+00:00"),
            )
            .returning(models.Trace.id)
        )
        await session.execute(
            insert(models.Span)
            .values(
                trace_rowid=trace_id,
                span_id="1",
                parent_id=None,
                name="chain span",
                span_kind="CHAIN",
                start_time=datetime.fromisoformat("2021-01-01T00:00:00.000+00:00"),
                end_time=datetime.fromisoformat("2021-01-01T00:00:30.000+00:00"),
                attributes={
                    "input": {"value": "chain-span-input-value", "mime_type": "text/plain"},
                    "output": {"value": "chain-span-output-value", "mime_type": "text/plain"},
                },
                events=[],
                status_code="OK",
                status_message="okay",
                cumulative_error_count=0,
                cumulative_llm_token_count_prompt=0,
                cumulative_llm_token_count_completion=0,
            )
            .returning(models.Span.id)
        )


@pytest.fixture
async def simple_dataset(
    db: DbSessionFactory,
) -> None:
    """
    A dataset with one example added in one version
    """
    async with db() as session:
        dataset = models.Dataset(
            id=0,
            name="simple dataset",
            description=None,
            metadata_={"info": "a test dataset"},
        )
        session.add(dataset)
        await session.flush()

        dataset_version_0 = models.DatasetVersion(
            id=0,
            dataset_id=0,
            description="the first version",
            metadata_={"info": "gotta get some test data somewhere"},
        )
        session.add(dataset_version_0)
        await session.flush()

        example_0 = models.DatasetExample(
            id=0,
            dataset_id=0,
            span_rowid=1,
        )
        session.add(example_0)
        await session.flush()

        example_0_revision_0 = models.DatasetExampleRevision(
            id=0,
            dataset_example_id=0,
            dataset_version_id=0,
            input={"in": "foo"},
            output={"out": "bar"},
            metadata_={"info": "the first reivision"},
            revision_kind="CREATE",
        )
        session.add(example_0_revision_0)
        await session.flush()

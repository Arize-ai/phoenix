from pathlib import Path

import pytest
from openinference.semconv.resource import ResourceAttributes
from opentelemetry.proto.collector.trace.v1.trace_service_pb2 import ExportTraceServiceRequest
from opentelemetry.proto.common.v1.common_pb2 import AnyValue, KeyValue
from opentelemetry.proto.resource.v1.resource_pb2 import Resource
from opentelemetry.proto.trace.v1.trace_pb2 import ResourceSpans, ScopeSpans, Span
from phoenix.experimental.spanstore.file import FileSpanStoreImpl, _get_project_name
from pyfakefs.fake_filesystem import FakeFilesystem
from pyfakefs.fake_pathlib import FakePath


def test_save_and_load(root: Path, req: ExportTraceServiceRequest):
    FileSpanStoreImpl(root).save(req)
    requests = list(FileSpanStoreImpl(root).load())
    assert {
        _get_project_name(resource_spans.resource.attributes): {
            span.name for scope_spans in resource_spans.scope_spans for span in scope_spans.spans
        }
        for req in requests
        for resource_spans in req.resource_spans
    } == {"default": {"0", "1"}, "xyz": {"2", "3"}}


@pytest.fixture(scope="function")
def root(fs: FakeFilesystem) -> Path:
    fp = FakePath("/test")
    fp.mkdir()
    return fp


@pytest.fixture
def req() -> ExportTraceServiceRequest:
    return ExportTraceServiceRequest(
        resource_spans=[
            ResourceSpans(scope_spans=[ScopeSpans(spans=[Span(name="0"), Span(name="1")])]),
            ResourceSpans(
                resource=Resource(
                    attributes=[
                        KeyValue(
                            key=ResourceAttributes.PROJECT_NAME,
                            value=AnyValue(string_value="xyz"),
                        )
                    ],
                ),
                scope_spans=[
                    ScopeSpans(spans=[Span(name="2")]),
                    ScopeSpans(spans=[Span(name="3")]),
                ],
            ),
        ],
    )

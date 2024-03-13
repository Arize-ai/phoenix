from pathlib import Path
from typing import List

import pytest
from openinference.semconv.resource import ResourceAttributes
from opentelemetry.proto.common.v1.common_pb2 import AnyValue, KeyValue
from opentelemetry.proto.resource.v1.resource_pb2 import Resource
from opentelemetry.proto.trace.v1.trace_pb2 import ResourceSpans, ScopeSpans, Span, TracesData
from phoenix.storage.spanstore.text_file import TextFileSpanStoreImpl
from phoenix.utilities.project import get_project_name
from pyfakefs.fake_filesystem import FakeFilesystem
from pyfakefs.fake_pathlib import FakePath


def test_save_and_load(root: Path, traces_data: TracesData):
    TextFileSpanStoreImpl(root).save(traces_data)
    loaded_data: List[TracesData] = list(TextFileSpanStoreImpl(root).load())
    assert {
        get_project_name(resource_spans.resource.attributes): {
            span.name for scope_spans in resource_spans.scope_spans for span in scope_spans.spans
        }
        for data in loaded_data
        for resource_spans in data.resource_spans
    } == {"default": {"0", "1"}, "xyz": {"2", "3"}}


@pytest.fixture(scope="function")
def root(fs: FakeFilesystem) -> Path:
    return FakePath("/test")


@pytest.fixture
def traces_data() -> TracesData:
    return TracesData(
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

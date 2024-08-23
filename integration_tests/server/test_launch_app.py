from time import sleep
from typing import Any, Callable, ContextManager, Dict, List, Optional, Set

from faker import Faker
from opentelemetry.sdk.trace.export import SpanExporter
from opentelemetry.trace import Span
from typing_extensions import TypeAlias

ProjectName: TypeAlias = str
SpanName: TypeAlias = str
Headers: TypeAlias = Dict[str, Any]


def test_launch_app(
    server: Callable[[], ContextManager[None]],
    start_span: Callable[[ProjectName, SpanName, SpanExporter], Span],
    http_span_exporter: Callable[[Optional[Headers]], SpanExporter],
    grpc_span_exporter: Callable[[Optional[Headers]], SpanExporter],
    get_gql_spans: Callable[[str], Dict[str, List[Dict[str, Any]]]],
    fake: Faker,
) -> None:
    project_name = fake.pystr()
    span_names: Set[str] = set()
    for i in range(2):
        with server():
            for j, span_exporter in enumerate([http_span_exporter, grpc_span_exporter]):
                span_name = f"{i}_{j}_{fake.unique.pystr()}"
                span_names.add(span_name)
                start_span(project_name, span_name, span_exporter(None)).end()
            sleep(2)
            gql_span_names = set(span["name"] for span in get_gql_spans("name")[project_name])
            assert gql_span_names == span_names

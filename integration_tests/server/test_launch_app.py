from time import sleep
from typing import Any, Callable, ContextManager, Dict, List, Optional, Protocol, Set

from faker import Faker
from opentelemetry.sdk.trace.export import SpanExporter
from opentelemetry.trace import Span, Tracer
from typing_extensions import TypeAlias

_ProjectName: TypeAlias = str
_SpanName: TypeAlias = str
_Headers: TypeAlias = Dict[str, Any]


class _GetGqlSpans(Protocol):
    def __call__(self, *keys: str) -> Dict[_ProjectName, List[Dict[str, Any]]]: ...


class _SpanExporterFactory(Protocol):
    def __call__(
        self,
        *,
        headers: Optional[_Headers] = None,
    ) -> SpanExporter: ...


class _GetTracer(Protocol):
    def __call__(
        self,
        *,
        project_name: _ProjectName,
        exporter: SpanExporter,
    ) -> Tracer: ...


class _StartSpan(Protocol):
    def __call__(
        self,
        *,
        project_name: _ProjectName,
        span_name: _SpanName,
        exporter: SpanExporter,
    ) -> Span: ...


class TestLaunchApp:
    def test_send_spans(
        self,
        server: Callable[[], ContextManager[None]],
        start_span: _StartSpan,
        http_span_exporter: _SpanExporterFactory,
        grpc_span_exporter: _SpanExporterFactory,
        get_gql_spans: _GetGqlSpans,
        fake: Faker,
    ) -> None:
        project_name = fake.unique.pystr()
        span_names: Set[str] = set()
        for i in range(2):
            with server():
                for j, span_exporter in enumerate([http_span_exporter, grpc_span_exporter]):
                    span_name = f"{i}_{j}_{fake.unique.pystr()}"
                    span_names.add(span_name)
                    start_span(
                        project_name=project_name,
                        span_name=span_name,
                        exporter=span_exporter(headers=None),
                    ).end()
                sleep(2)
                gql_span_names = set(span["name"] for span in get_gql_spans("name")[project_name])
                assert gql_span_names == span_names

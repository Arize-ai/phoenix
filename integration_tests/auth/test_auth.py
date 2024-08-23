from datetime import datetime, timezone
from time import sleep
from typing import Any, Callable, Dict, Optional

from faker import Faker
from opentelemetry.sdk.trace.export import SpanExporter
from opentelemetry.trace import Span
from phoenix.auth import AUTH_HEADER
from typing_extensions import TypeAlias

ProjectName: TypeAlias = str
SpanName: TypeAlias = str
Headers: TypeAlias = Dict[str, Any]
Name: TypeAlias = str
ApiKey: TypeAlias = str


class TestSpanExporters:
    def test_authorized(
        self,
        span_exporter: Callable[[Optional[Headers]], SpanExporter],
        start_span: Callable[[ProjectName, SpanName, SpanExporter], Span],
        get_gql_spans: Callable[[str], Dict[str, Any]],
        create_system_api_key: Callable[[Name, datetime], ApiKey],
        fake: Faker,
    ) -> None:
        system_api_key = create_system_api_key(
            fake.unique.pystr(),
            fake.date_time_between(start_date="+1d", end_date="+2d", tzinfo=timezone.utc),
        )
        headers = {AUTH_HEADER: system_api_key}
        project_name, span_name = fake.unique.pystr(), fake.unique.pystr()
        sleep(1)
        start_span(project_name, span_name, span_exporter(headers)).end()
        sleep(2)
        assert (spans := get_gql_spans("name").get(project_name))
        gql_span_names = set(span["name"] for span in spans)
        assert span_name in gql_span_names

    def test_unauthorized_no_header(
        self,
        span_exporter: Callable[[Optional[Dict[str, Any]]], SpanExporter],
        start_span: Callable[[str, str, SpanExporter], Span],
        get_gql_spans: Callable[[str], Dict[str, Any]],
        fake: Faker,
    ) -> None:
        project_name, span_name = fake.unique.pystr(), fake.unique.pystr()
        start_span(project_name, span_name, span_exporter(None)).end()
        sleep(2)
        assert not get_gql_spans("name").get(project_name)

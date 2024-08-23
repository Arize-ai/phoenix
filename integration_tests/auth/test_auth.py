from datetime import datetime, timezone
from time import sleep
from typing import Any, Callable, Dict, Optional

from faker import Faker
from opentelemetry.sdk.trace.export import SpanExporter, SpanExportResult
from opentelemetry.sdk.trace.export.in_memory_span_exporter import InMemorySpanExporter
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
        create_system_api_key: Callable[[Name, datetime], ApiKey],
        fake: Faker,
    ) -> None:
        system_api_key = create_system_api_key(
            fake.unique.pystr(),
            fake.date_time_between(start_date="+1d", end_date="+2d", tzinfo=timezone.utc),
        )
        sleep(1)
        headers = {AUTH_HEADER: system_api_key}
        project_name, span_name = fake.unique.pystr(), fake.unique.pystr()
        in_memory_span_exporter = InMemorySpanExporter()
        start_span(project_name, span_name, in_memory_span_exporter).end()
        result = span_exporter(headers).export(in_memory_span_exporter.get_finished_spans())
        assert result is SpanExportResult.SUCCESS

    def test_unauthorized_no_header(
        self,
        span_exporter: Callable[[Optional[Dict[str, Any]]], SpanExporter],
        start_span: Callable[[str, str, SpanExporter], Span],
        fake: Faker,
    ) -> None:
        project_name, span_name = fake.unique.pystr(), fake.unique.pystr()
        in_memory_span_exporter = InMemorySpanExporter()
        start_span(project_name, span_name, in_memory_span_exporter).end()
        result = span_exporter(None).export(in_memory_span_exporter.get_finished_spans())
        assert result is SpanExportResult.FAILURE

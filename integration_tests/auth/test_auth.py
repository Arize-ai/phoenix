from datetime import datetime, timedelta, timezone
from time import sleep
from typing import Any, Callable, Dict, Optional

import pytest
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

NOW = datetime.now(timezone.utc)


class TestSpanExporters:
    @pytest.mark.parametrize(
        "with_headers,expires_at,expected",
        [
            (True, NOW + timedelta(days=1), SpanExportResult.SUCCESS),
            (True, None, SpanExportResult.SUCCESS),
            (True, NOW, SpanExportResult.FAILURE),
            (False, None, SpanExportResult.FAILURE),
        ],
    )
    def test_headers(
        self,
        with_headers: bool,
        expires_at: Optional[datetime],
        expected: SpanExportResult,
        span_exporter: Callable[[Optional[Headers]], SpanExporter],
        start_span: Callable[[ProjectName, SpanName, SpanExporter], Span],
        create_system_api_key: Callable[[Name, Optional[datetime]], ApiKey],
        fake: Faker,
    ) -> None:
        if with_headers:
            system_api_key = create_system_api_key(fake.unique.pystr(), expires_at)
            headers = {AUTH_HEADER: system_api_key}
            sleep(1)
        else:
            headers = None
        project_name, span_name = fake.unique.pystr(), fake.unique.pystr()
        in_memory_span_exporter = InMemorySpanExporter()
        start_span(project_name, span_name, in_memory_span_exporter).end()
        actual = span_exporter(headers).export(in_memory_span_exporter.get_finished_spans())
        assert actual is expected

import logging

import httpx2
import pytest
from opentelemetry.proto.collector.trace.v1.trace_service_pb2 import (
    ExportTraceServiceRequest,
)

from phoenix.experimental.datagen import OTLPHTTPExporter


def test_exporter_posts_with_headers_and_continues_after_failure(
    monkeypatch: pytest.MonkeyPatch,
    caplog: pytest.LogCaptureFixture,
) -> None:
    request = ExportTraceServiceRequest()
    attempts = 0

    def handle(posted_request: httpx2.Request) -> httpx2.Response:
        nonlocal attempts
        attempts += 1
        assert str(posted_request.url) == "https://collector.example/prefix/v1/traces"
        assert posted_request.headers["content-type"] == "application/x-protobuf"
        assert posted_request.headers["authorization"] == "Bearer test-key"
        assert posted_request.headers["x-tenant"] == "tenant-one"
        assert posted_request.content == request.SerializeToString()
        return httpx2.Response(503 if attempts == 1 else 200, request=posted_request)

    transport = httpx2.MockTransport(handle)
    client_type = httpx2.Client
    monkeypatch.setattr(
        "phoenix.experimental.datagen.exporter.httpx2.Client",
        lambda **kwargs: client_type(transport=transport, **kwargs),
    )

    with caplog.at_level(logging.WARNING, logger="phoenix.experimental.datagen.exporter"):
        with OTLPHTTPExporter(
            "https://collector.example/prefix",
            api_key="test-key",
            headers={"x-tenant": "tenant-one"},
        ) as exporter:
            assert not exporter.export(request)
            assert exporter.export(request)

    assert attempts == 2
    assert len(caplog.records) == 1
    assert "503 Service Unavailable" in caplog.records[0].message

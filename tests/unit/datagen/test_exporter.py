import logging

import httpx
import pytest
from opentelemetry.proto.collector.trace.v1.trace_service_pb2 import (
    ExportTraceServiceRequest,
)

from phoenix.datagen import OTLPHTTPExporter


def test_exporter_posts_otlp_protobuf_with_auth_and_custom_headers(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    request = ExportTraceServiceRequest()

    def handle(posted_request: httpx.Request) -> httpx.Response:
        assert str(posted_request.url) == "https://collector.example/prefix/v1/traces"
        assert posted_request.headers["content-type"] == "application/x-protobuf"
        assert posted_request.headers["authorization"] == "Bearer test-key"
        assert posted_request.headers["x-tenant"] == "tenant-one"
        assert posted_request.content == request.SerializeToString()
        return httpx.Response(200)

    transport = httpx.MockTransport(handle)
    client_type = httpx.Client
    monkeypatch.setattr(
        "phoenix.datagen.exporter.httpx.Client",
        lambda **kwargs: client_type(transport=transport, **kwargs),
    )

    with OTLPHTTPExporter(
        "https://collector.example/prefix",
        api_key="test-key",
        headers={"x-tenant": "tenant-one"},
    ) as exporter:
        assert exporter.export(request)


def test_exporter_retries_a_failed_transport_then_continues(
    monkeypatch: pytest.MonkeyPatch,
    caplog: pytest.LogCaptureFixture,
) -> None:
    attempts = 0

    def handle(posted_request: httpx.Request) -> httpx.Response:
        nonlocal attempts
        attempts += 1
        if attempts < 3:
            return httpx.Response(503, request=posted_request)
        return httpx.Response(200, request=posted_request)

    transport = httpx.MockTransport(handle)
    client_type = httpx.Client
    monkeypatch.setattr(
        "phoenix.datagen.exporter.httpx.Client",
        lambda **kwargs: client_type(transport=transport, **kwargs),
    )
    sleeps: list[float] = []
    monkeypatch.setattr("phoenix.datagen.exporter.time.sleep", sleeps.append)
    monkeypatch.setattr(
        "phoenix.datagen.exporter.random.uniform",
        lambda _minimum, maximum: maximum,
    )

    with caplog.at_level(logging.WARNING, logger="phoenix.datagen.exporter"):
        with OTLPHTTPExporter("https://collector.example") as exporter:
            assert exporter.export(ExportTraceServiceRequest())

    assert attempts == 3
    assert sleeps == [1.0, 2.0]
    assert len(caplog.records) == 2
    assert "attempt 1/5" in caplog.records[0].message
    assert "retrying in 1.0s" in caplog.records[0].message
    assert "attempt 2/5" in caplog.records[1].message
    assert "retrying in 2.0s" in caplog.records[1].message

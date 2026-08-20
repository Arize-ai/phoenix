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
        exporter.export(request)

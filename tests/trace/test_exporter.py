import pytest
from phoenix.config import PORT
from phoenix.trace.exporter import HttpExporter


def test_exporter(monkeypatch: pytest.MonkeyPatch):
    # Test that it defaults to local
    monkeypatch.delenv("PHOENIX_COLLECTOR_ENDPOINT", False)
    exporter = HttpExporter()
    assert exporter._base_url == f"http://127.0.0.1:{PORT}"

    # Test that you can configure host and port
    host, port = "abcd", 1234
    exporter = HttpExporter(host=host, port=port)
    assert exporter._base_url == f"http://{host}:{port}"

    # Test that you can configure an endpoint
    endpoint = "https://my-phoenix-server.com/"
    exporter = HttpExporter(endpoint=endpoint)
    assert exporter._base_url == endpoint

    # Test that it supports environment variables
    monkeypatch.setenv("PHOENIX_COLLECTOR_ENDPOINT", endpoint)
    exporter = HttpExporter()
    assert exporter._base_url == endpoint

import pytest
from phoenix.trace.exporter import HttpExporter


def test_exporter(monkeypatch: pytest.MonkeyPatch):
    # Test that it defaults to local
    exporter = HttpExporter()
    assert exporter._base_url == "http://0.0.0.0:6006"

    # Test that you can configure an endpoint
    exporter = HttpExporter(endpoint="https://my-phoenix-server.com/")
    assert exporter._base_url == "https://my-phoenix-server.com"

    # Test that it supports environment variables
    monkeypatch.setenv("PHOENIX_COLLECTOR_ENDPOINT", "https://my-phoenix-server.com/")
    exporter = HttpExporter()
    assert exporter._base_url == "https://my-phoenix-server.com"

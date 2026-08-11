from __future__ import annotations

import pytest

from phoenix_harbor import PhoenixConfig, TraceMode


def test_defaults(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("PHOENIX_COLLECTOR_ENDPOINT", raising=False)
    monkeypatch.delenv("PHOENIX_API_KEY", raising=False)

    config = PhoenixConfig.from_sources()

    assert config.trace_mode is TraceMode.ATIF
    assert config.endpoint is None
    assert config.api_key is None
    assert config.experiment_name_template == "{job_name} · {agent} · {model}"


def test_reads_environment(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("PHOENIX_COLLECTOR_ENDPOINT", "https://example.test")
    monkeypatch.setenv("PHOENIX_API_KEY", "secret")

    config = PhoenixConfig.from_sources()

    assert config.endpoint == "https://example.test"
    assert config.api_key == "secret"
    assert "secret" not in repr(config)


def test_explicit_values_override_environment(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("PHOENIX_COLLECTOR_ENDPOINT", "https://environment.test")
    monkeypatch.setenv("PHOENIX_API_KEY", "environment-secret")

    config = PhoenixConfig.from_sources(
        endpoint="https://explicit.test", api_key="explicit-secret", trace_mode="none"
    )

    assert config.endpoint == "https://explicit.test"
    assert config.api_key == "explicit-secret"
    assert config.trace_mode is TraceMode.NONE


def test_rejects_unknown_trace_mode() -> None:
    with pytest.raises(ValueError, match="trace_mode must be one of atif, otlp, none"):
        PhoenixConfig.from_sources(trace_mode="automatic")

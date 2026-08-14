from __future__ import annotations

from importlib.metadata import entry_points

import pytest

from phoenix.client.harbor import PhoenixJobPlugin


def test_harbor_entry_point_resolves_plugin() -> None:
    (entry_point,) = entry_points(group="harbor.plugins", name="phoenix")

    assert entry_point.load() is PhoenixJobPlugin


def test_plugin_resolves_phoenix_environment(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("PHOENIX_ENDPOINT", "https://environment.test")
    monkeypatch.setenv("PHOENIX_API_KEY", "environment-secret")
    monkeypatch.setenv("PHOENIX_PROJECT", "environment-project")

    plugin = PhoenixJobPlugin(dataset="dataset", trace_mode="otlp")

    assert plugin.dataset == "dataset"
    assert plugin.endpoint == "https://environment.test"
    assert plugin._api_key == "environment-secret"
    assert plugin.project == "environment-project"
    assert plugin.trace_mode == "otlp"


def test_plugin_explicit_configuration_overrides_environment(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("PHOENIX_ENDPOINT", "https://environment.test")
    monkeypatch.setenv("PHOENIX_API_KEY", "environment-secret")
    monkeypatch.setenv("PHOENIX_PROJECT", "environment-project")

    plugin = PhoenixJobPlugin(
        endpoint="https://explicit.test",
        api_key="explicit-secret",
        project="explicit-project",
        trace_mode="none",
    )

    assert plugin.endpoint == "https://explicit.test"
    assert plugin._api_key == "explicit-secret"
    assert plugin.project == "explicit-project"
    assert plugin.trace_mode == "none"


def test_plugin_rejects_unknown_trace_mode() -> None:
    with pytest.raises(ValueError, match="unsupported trace_mode"):
        PhoenixJobPlugin(trace_mode="unknown")  # type: ignore[arg-type]

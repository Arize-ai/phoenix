from __future__ import annotations

import pytest

from phoenix_harbor._config import PhoenixConfig, TraceMode


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


@pytest.mark.parametrize("name", ["dataset", "endpoint", "api_key", "project"])
def test_rejects_non_string_optional_values(name: str) -> None:
    with pytest.raises(TypeError, match=rf"{name} must be a string or None; got int"):
        PhoenixConfig.from_sources(**{name: 123})  # type: ignore[arg-type]


def test_rejects_non_string_trace_mode() -> None:
    with pytest.raises(TypeError, match="trace_mode must be a string; got int"):
        PhoenixConfig.from_sources(trace_mode=123)  # type: ignore[arg-type]


def test_strips_optional_values() -> None:
    config = PhoenixConfig.from_sources(dataset=" dataset ", project=" project ")

    assert config.dataset == "dataset"
    assert config.project == "project"


def test_accepts_supported_experiment_name_fields_and_format_specs() -> None:
    config = PhoenixConfig.from_sources(
        experiment_name_template=" {job_name}-{job_id:.8} · {agent} · {model} "
    )

    assert config.experiment_name_template == "{job_name}-{job_id:.8} · {agent} · {model}"


@pytest.mark.parametrize(
    ("template", "message"),
    [
        (" ", "experiment_name_template must not be empty"),
        ("{dataset}", "unsupported experiment_name_template fields: 'dataset'"),
        ("{job_name", "invalid experiment_name_template"),
        ("{job_id:invalid}", "invalid experiment_name_template"),
    ],
)
def test_rejects_invalid_experiment_name_template(template: str, message: str) -> None:
    with pytest.raises(ValueError, match=message):
        PhoenixConfig.from_sources(experiment_name_template=template)


def test_rejects_non_string_experiment_name_template() -> None:
    with pytest.raises(TypeError, match="experiment_name_template must be a string; got int"):
        PhoenixConfig.from_sources(experiment_name_template=123)  # type: ignore[arg-type]

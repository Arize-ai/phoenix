"""Tests that openinference helpers, decorators, and semantic conventions are
re-exported from phoenix.otel, so users do not need a separate dependency."""

import pytest

import phoenix.otel as phoenix_otel


@pytest.mark.parametrize(
    "name,source_module,source_attr",
    [
        ("suppress_tracing", "openinference.instrumentation", "suppress_tracing"),
        ("using_attributes", "openinference.instrumentation", "using_attributes"),
        ("using_metadata", "openinference.instrumentation", "using_metadata"),
        ("using_prompt_template", "openinference.instrumentation", "using_prompt_template"),
        ("using_session", "openinference.instrumentation", "using_session"),
        ("using_tags", "openinference.instrumentation", "using_tags"),
        ("using_user", "openinference.instrumentation", "using_user"),
        ("SpanAttributes", "openinference.semconv.trace", "SpanAttributes"),
        ("OpenInferenceSpanKindValues", "openinference.semconv.trace", "OpenInferenceSpanKindValues"),
        ("OpenInferenceMimeTypeValues", "openinference.semconv.trace", "OpenInferenceMimeTypeValues"),
    ],
)
def test_re_export_identity(name: str, source_module: str, source_attr: str) -> None:
    """Each re-exported name must be the same object as its upstream source."""
    import importlib

    upstream = getattr(importlib.import_module(source_module), source_attr)
    assert getattr(phoenix_otel, name) is upstream


@pytest.mark.parametrize(
    "name",
    [
        "suppress_tracing",
        "using_attributes",
        "using_metadata",
        "using_prompt_template",
        "using_session",
        "using_tags",
        "using_user",
        "SpanAttributes",
        "OpenInferenceSpanKindValues",
        "OpenInferenceMimeTypeValues",
    ],
)
def test_name_in_dunder_all(name: str) -> None:
    """Every re-exported name must appear in phoenix.otel.__all__."""
    assert name in phoenix_otel.__all__

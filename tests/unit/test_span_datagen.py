from __future__ import annotations

import importlib
import json
import random
import sys
from datetime import date, datetime, timezone
from pathlib import Path
from types import SimpleNamespace
from zoneinfo import ZoneInfo

import pytest
from opentelemetry.sdk.trace import ReadableSpan
from opentelemetry.sdk.trace.export.in_memory_span_exporter import InMemorySpanExporter
from opentelemetry.trace import Status, StatusCode

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

shared = importlib.import_module("scripts.generate_spans._shared")
costs = importlib.import_module("scripts.generate_spans.generate_spans_for_cost_calculations")
events = importlib.import_module("scripts.generate_spans.generate_spans_with_event_attributes")
experiment_data = importlib.import_module("scripts.experiments._shared")
psql = importlib.import_module("scripts.generate_data_via_plpgsql._psql")
time_series = importlib.import_module("scripts.generate_spans.generate_spans_for_time_series")
MODELS = shared.MODELS
Generator = shared.Generator
poisson = shared.poisson
token_usage = shared.token_usage
trace_endpoint = shared.trace_endpoint
DEFAULT_MANIFEST = costs.DEFAULT_MANIFEST
load_models = costs.load_models


@pytest.mark.parametrize(
    ("value", "expected"),
    (
        ("http://localhost:6006", "http://localhost:6006/v1/traces"),
        ("http://localhost:6006/", "http://localhost:6006/v1/traces"),
        ("http://collector:4318/v1/traces", "http://collector:4318/v1/traces"),
    ),
)
def test_trace_endpoint(value: str, expected: str) -> None:
    assert trace_endpoint(value) == expected


def test_token_usage_is_seeded_and_internally_consistent() -> None:
    first = token_usage(random.Random(7), MODELS[0])
    second = token_usage(random.Random(7), MODELS[0])

    assert first == second
    assert first.prompt > 0
    assert first.completion > 0
    assert first.total == first.prompt + first.completion
    assert first.completion <= first.prompt * 2


def test_poisson_is_seeded_and_rejects_negative_rates() -> None:
    first = [poisson(random.Random(seed), 3.5) for seed in range(10)]
    second = [poisson(random.Random(seed), 3.5) for seed in range(10)]

    assert first == second
    assert all(value >= 0 for value in first)
    with pytest.raises(ValueError, match="non-negative"):
        poisson(random.Random(1), -0.1)


def test_cost_models_come_from_the_checked_in_manifest() -> None:
    models = load_models(Path(DEFAULT_MANIFEST))

    assert len(models) > 10
    assert any(model.provider == "openai" for model in models)
    assert any(model.provider == "anthropic" for model in models)
    assert {"cerebras", "groq", "together"}.issubset({model.provider for model in models})
    assert len({model.name for model in models}) == len(models)


def test_cost_models_prefer_declared_provider_and_infer_missing_provider(tmp_path: Path) -> None:
    manifest = tmp_path / "model_cost_manifest.json"
    manifest.write_text(
        json.dumps(
            {
                "models": [
                    {"name": "groq/llama-3.3-70b", "provider": "groq", "token_prices": []},
                    {"name": "gpt-4.1", "token_prices": []},
                ]
            }
        )
    )

    models = load_models(manifest)

    assert [(model.name, model.provider) for model in models] == [
        ("groq/llama-3.3-70b", "groq"),
        ("gpt-4.1", "openai"),
    ]

    args = costs.build_parser().parse_args(
        ["--manifest", str(manifest), "--provider", "groq", "--dry-run"]
    )
    generator, model_count = costs.generate(args)
    generator.close()

    assert model_count == 1
    assert generator.trace_count == 1
    assert generator.span_count == 2


@pytest.mark.parametrize(
    ("end_time", "transition_date", "transition_hour", "expected_occurrences"),
    (
        (datetime(2024, 3, 11, 7, tzinfo=timezone.utc), date(2024, 3, 10), 2, 0),
        (datetime(2024, 11, 4, 6, tzinfo=timezone.utc), date(2024, 11, 3), 1, 2),
    ),
)
def test_time_series_uses_24_unique_utc_buckets_across_dst(
    monkeypatch: pytest.MonkeyPatch,
    end_time: datetime,
    transition_date: date,
    transition_hour: int,
    expected_occurrences: int,
) -> None:
    class HourStartRandom:
        @staticmethod
        def uniform(start: float, end: float) -> float:
            return start

    monkeypatch.setattr(time_series, "poisson", lambda rng, rate: 1)
    args = SimpleNamespace(
        timezone="America/Denver",
        days=1,
        business_rate=1,
        evening_rate=1,
        night_rate=1,
        weekend_rate=1,
        max_traces=100,
    )

    timestamps = list(
        time_series.generate_timestamps(
            SimpleNamespace(rng=HourStartRandom()),
            args,
            end_time=end_time,
        )
    )

    assert len(timestamps) == 24
    assert len(set(timestamps)) == 24
    assert all(
        (current - previous).total_seconds() == 3_600
        for previous, current in zip(timestamps, timestamps[1:])
    )
    local_timestamps = [timestamp.astimezone(ZoneInfo(args.timezone)) for timestamp in timestamps]
    assert (
        sum(
            timestamp.date() == transition_date and timestamp.hour == transition_hour
            for timestamp in local_timestamps
        )
        == expected_occurrences
    )


def test_dry_run_generator_counts_roots_without_exporting() -> None:
    generator = Generator(
        endpoint="http://localhost:6006",
        project_name="test",
        seed=3,
        dry_run=True,
    )
    with generator.span("root", "CHAIN", root=True):
        with generator.span("child", "LLM"):
            pass
    generator.close()

    assert generator.trace_count == 1
    assert generator.span_count == 2


def test_generator_applies_status_fallback_without_overwriting_body_status(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    exporter = InMemorySpanExporter()
    monkeypatch.setattr(shared, "OTLPSpanExporter", lambda endpoint, headers=None: exporter)
    generator = Generator(
        endpoint="http://localhost:6006",
        project_name="test",
        seed=3,
        dry_run=False,
    )
    with generator.span("default-fallback", "CHAIN"):
        pass
    with generator.span("error-fallback", "CHAIN", status=StatusCode.ERROR):
        pass
    with generator.span("body-error", "CHAIN") as span:
        span.set_status(Status(StatusCode.ERROR, "downstream timeout"))
    with generator.span("body-ok", "CHAIN", status=StatusCode.ERROR) as span:
        span.set_status(Status(StatusCode.OK))
    generator.close()

    statuses = {span.name: span.status for span in exporter.get_finished_spans()}
    assert statuses["default-fallback"].status_code is StatusCode.OK
    assert statuses["error-fallback"].status_code is StatusCode.ERROR
    assert statuses["body-error"].status_code is StatusCode.ERROR
    assert statuses["body-error"].description == "downstream timeout"
    assert statuses["body-ok"].status_code is StatusCode.OK


def test_generator_uses_phoenix_api_key(monkeypatch: pytest.MonkeyPatch) -> None:
    exporter = InMemorySpanExporter()
    exporter_options: dict[str, object] = {}

    def make_exporter(*, endpoint: str, headers: object) -> InMemorySpanExporter:
        exporter_options.update(endpoint=endpoint, headers=headers)
        return exporter

    monkeypatch.setenv("PHOENIX_API_KEY", "secret-key")
    monkeypatch.setattr(shared, "OTLPSpanExporter", make_exporter)
    generator = Generator(
        endpoint="https://app.phoenix.arize.com",
        project_name="test",
        seed=3,
        dry_run=False,
    )
    generator.close()

    assert exporter_options == {
        "endpoint": "https://app.phoenix.arize.com/v1/traces",
        "headers": {"Authorization": "Bearer secret-key"},
    }


def test_event_fixtures_report_trace_local_child_counts_and_error_descriptions(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    exporter = InMemorySpanExporter()
    monkeypatch.setattr(shared, "OTLPSpanExporter", lambda endpoint, headers=None: exporter)
    args = events.build_parser().parse_args(
        ["--traces", "2", "--exceptions-per-trace", "1", "--seed", "7"]
    )
    generator = events.generate(args)
    generator.close()
    spans = exporter.get_finished_spans()
    spans_by_trace: dict[int, list[ReadableSpan]] = {}
    for span in spans:
        spans_by_trace.setdefault(span.context.trace_id, []).append(span)

    roots = [span for span in spans if span.name.startswith("support-request-")]
    assert len(roots) == 2
    for root in roots:
        completed_event = next(event for event in root.events if event.name == "trace.completed")
        assert completed_event.attributes is not None
        assert (
            completed_event.attributes["child_spans"]
            == len(spans_by_trace[root.context.trace_id]) - 1
        )

    exceptions = [span for span in spans if span.name.startswith("failed-operation-")]
    assert len(exceptions) == 2
    assert all(span.status.status_code is StatusCode.ERROR for span in exceptions)
    assert all(span.status.description for span in exceptions)


def test_experiment_examples_are_seeded_and_domain_realistic() -> None:
    first = experiment_data.examples(7, random.Random(5))
    second = experiment_data.examples(7, random.Random(5))

    assert first == second
    assert {row["metadata"]["difficulty"] for row in first} == {"easy", "medium", "hard"}
    assert all(row["question"] and row["answer"] for row in first)


def test_postgres_trace_count_is_passed_as_a_psql_variable(tmp_path: Path) -> None:
    command = psql.command(
        psql.DatabaseConfig(
            name="postgres",
            user="postgres",
            host="localhost",
            port=5432,
            password="phoenix",
        ),
        tmp_path / "generate.sql",
        variables={"num_traces": 17},
    )
    variable_index = command.index("num_traces=17")
    assert ("--set", "num_traces=17") == tuple(command[variable_index - 1 : variable_index + 1])
    assert "ON_ERROR_STOP=1" in command

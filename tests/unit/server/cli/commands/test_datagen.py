import time
from argparse import ArgumentParser
from pathlib import Path
from types import SimpleNamespace
from typing import Any

import pytest

from phoenix.server.cli.commands import datagen


def test_datagen_cli_flags_override_environment() -> None:
    parser = ArgumentParser()
    subparsers = parser.add_subparsers(dest="command", required=True)
    datagen.register(subparsers)
    args = parser.parse_args(
        [
            "datagen",
            "--endpoint",
            "https://collector.example",
            "--api-key",
            "cli-key",
            "--scenario",
            "chat",
            "--project",
            "cli-project",
            "--rate",
            "30",
            "--burstiness",
            "0.8",
            "--epsilon",
            "0.1",
            "--seed",
            "42",
            "--anomaly-manifest",
            "anomalies.jsonl",
            "--rate-schedule",
            "business-hours",
            "--timezone",
            "America/New_York",
            "--backfill",
            "48h",
            "--error-rate",
            "0.25",
        ]
    )

    config = datagen._resolve_config(
        args,
        {
            "PHOENIX_COLLECTOR_ENDPOINT": "https://env.example",
            "PHOENIX_API_KEY": "env-key",
            "PHOENIX_CLIENT_HEADERS": "x-tenant=tenant%20one,x-route=blue",
            "PHOENIX_PROJECT_NAME": "env-project",
            "PHOENIX_DATAGEN_SCENARIO": "env-scenario",
            "PHOENIX_DATAGEN_RATE": "1",
        },
    )

    assert config.endpoint == "https://collector.example"
    assert config.api_key == "cli-key"
    assert config.headers == {"x-tenant": "tenant one", "x-route": "blue"}
    assert config.scenario == "chat"
    assert config.project == "cli-project"
    assert config.rate == 30
    assert config.burstiness == 0.8
    assert config.epsilon == 0.1
    assert config.seed == 42
    assert config.anomaly_manifest == "anomalies.jsonl"
    assert config.rate_schedule == "business-hours"
    assert config.timezone == "America/New_York"
    assert config.backfill_seconds == 48 * 60 * 60
    assert config.error_rate == 0.25
    assert args.func is datagen.run


def test_datagen_replay_options_have_no_environment_aliases() -> None:
    parser = ArgumentParser()
    subparsers = parser.add_subparsers(dest="command", required=True)
    datagen.register(subparsers)

    config = datagen._resolve_config(
        parser.parse_args(["datagen"]),
        {
            "PHOENIX_DATAGEN_SCENARIO": "openai_chat_sessions",
            "PHOENIX_DATAGEN_RATE": "99",
            "PHOENIX_DATAGEN_BURSTINESS": "9",
            "PHOENIX_DATAGEN_EPSILON": "1",
            "PHOENIX_DATAGEN_SEED": "99",
            "PHOENIX_DATAGEN_ANOMALY_MANIFEST": "anomalies.jsonl",
        },
    )

    assert config.scenario is None
    assert config.rate == 12.0
    assert config.burstiness == 0.5
    assert config.epsilon == 0.02
    assert config.seed == 0
    assert config.anomaly_manifest is None


def test_datagen_rejects_removed_session_shape_flags() -> None:
    parser = ArgumentParser()
    subparsers = parser.add_subparsers(dest="command", required=True)
    datagen.register(subparsers)

    with pytest.raises(SystemExit):
        parser.parse_args(["datagen", "--session-fragments-median", "3"])


@pytest.mark.parametrize("value", ["48", "0h", "-1h", "1w"])
def test_datagen_rejects_invalid_backfill_durations(value: str) -> None:
    parser = ArgumentParser()
    subparsers = parser.add_subparsers(dest="command", required=True)
    datagen.register(subparsers)

    with pytest.raises(ValueError, match="compact positive duration"):
        datagen._resolve_config(parser.parse_args(["datagen", f"--backfill={value}"]), {})


def test_datagen_rejects_invalid_iana_timezone() -> None:
    parser = ArgumentParser()
    subparsers = parser.add_subparsers(dest="command", required=True)
    datagen.register(subparsers)

    with pytest.raises(ValueError, match="Invalid IANA timezone"):
        datagen._resolve_config(
            parser.parse_args(["datagen", "--timezone", "Mars/Olympus_Mons"]),
            {},
        )


def test_datagen_default_run_loop_preserves_operation_order(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    events: list[object] = []
    replayer_kwargs: dict[str, object] = {}

    class FakeReplayer:
        def __init__(self, _scenario: object, **kwargs: object) -> None:
            replayer_kwargs.update(kwargs)

        def emit(self, **kwargs: object) -> SimpleNamespace:
            events.append(("emit", kwargs))
            return SimpleNamespace(request="request", anomalies=("anomaly",))

        def interarrival_seconds(self, **kwargs: object) -> float:
            events.append(("interarrival", kwargs))
            return 2.0

    class FakeExporter:
        def __init__(self, *_args: object, **_kwargs: object) -> None:
            pass

        def __enter__(self) -> "FakeExporter":
            return self

        def __exit__(self, *_args: object) -> None:
            pass

        def export(self, request: object) -> bool:
            events.append(("export", request))
            return True

    class FakeManifest:
        def write(self, anomalies: object, *, emitted_at_ns: int) -> None:
            events.append(("manifest", anomalies, emitted_at_ns))

    def time_ns() -> int:
        events.append("time_ns")
        return 123

    def sleep(seconds: float) -> None:
        events.append(("sleep", seconds))
        raise KeyboardInterrupt

    monkeypatch.setattr("phoenix.datagen.load_scenario", lambda _scenario: object())
    monkeypatch.setattr("phoenix.datagen.Replayer", FakeReplayer)
    monkeypatch.setattr("phoenix.datagen.OTLPHTTPExporter", FakeExporter)
    monkeypatch.setattr("phoenix.datagen.AnomalyManifest", lambda _path: FakeManifest())
    monkeypatch.setattr(time, "time_ns", time_ns)
    monkeypatch.setattr(time, "sleep", sleep)

    parser = ArgumentParser()
    subparsers = parser.add_subparsers(dest="command", required=True)
    datagen.register(subparsers)
    datagen.run(parser.parse_args(["datagen", "--anomaly-manifest", "anomalies.jsonl"]))

    assert replayer_kwargs["error_rate"] == 0
    assert events == [
        ("emit", {}),
        ("export", "request"),
        "time_ns",
        ("manifest", ("anomaly",), 123),
        ("interarrival", {"rate": 12.0, "burstiness": 0.5}),
        ("sleep", 2.0),
    ]


def test_datagen_backfill_catches_up_then_sleeps_and_records_only_deliveries(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    wall_start_ns = 200_000_000_000_000
    boundary_ns = wall_start_ns - 48 * 60 * 60 * 1_000_000_000
    emitted_at_ns = wall_start_ns + 123
    time_values = iter((wall_start_ns, wall_start_ns, emitted_at_ns, wall_start_ns))
    deliveries = iter((False, True))
    intervals = iter((48 * 60 * 60.0, 1.0))
    scheduled_starts: list[int] = []
    interval_calls: list[dict[str, Any]] = []
    manifest_writes: list[tuple[object, int]] = []
    sleeps: list[float] = []
    replayer_kwargs: dict[str, object] = {}

    class FakeReplayer:
        def __init__(self, _scenario: object, **kwargs: object) -> None:
            replayer_kwargs.update(kwargs)

        def emit(self, *, scheduled_start_ns: int) -> SimpleNamespace:
            scheduled_starts.append(scheduled_start_ns)
            return SimpleNamespace(request=scheduled_start_ns, anomalies=(scheduled_start_ns,))

        def interarrival_seconds(self, **kwargs: Any) -> float:
            interval_calls.append(kwargs)
            return next(intervals)

    class FakeExporter:
        def __init__(self, *_args: object, **_kwargs: object) -> None:
            pass

        def __enter__(self) -> "FakeExporter":
            return self

        def __exit__(self, *_args: object) -> None:
            pass

        def export(self, _request: object) -> bool:
            return next(deliveries)

    class FakeManifest:
        def write(self, anomalies: object, *, emitted_at_ns: int) -> None:
            manifest_writes.append((anomalies, emitted_at_ns))

    def sleep(seconds: float) -> None:
        sleeps.append(seconds)
        raise KeyboardInterrupt

    monkeypatch.setattr("phoenix.datagen.load_scenario", lambda _scenario: object())
    monkeypatch.setattr("phoenix.datagen.Replayer", FakeReplayer)
    monkeypatch.setattr("phoenix.datagen.OTLPHTTPExporter", FakeExporter)
    monkeypatch.setattr("phoenix.datagen.AnomalyManifest", lambda _path: FakeManifest())
    monkeypatch.setattr(time, "time_ns", lambda: next(time_values))
    monkeypatch.setattr(time, "sleep", sleep)

    parser = ArgumentParser()
    subparsers = parser.add_subparsers(dest="command", required=True)
    datagen.register(subparsers)
    datagen.run(
        parser.parse_args(
            [
                "datagen",
                "--rate-schedule",
                "business-hours",
                "--timezone",
                "America/New_York",
                "--backfill",
                "48h",
                "--error-rate",
                "0.25",
                "--anomaly-manifest",
                "anomalies.jsonl",
            ]
        )
    )

    assert replayer_kwargs["error_rate"] == 0.25
    assert scheduled_starts == [boundary_ns, wall_start_ns]
    assert interval_calls == [
        {
            "rate": 12.0,
            "burstiness": 0.5,
            "rate_schedule": "business-hours",
            "timezone": "America/New_York",
            "now_ns": boundary_ns,
        },
        {
            "rate": 12.0,
            "burstiness": 0.5,
            "rate_schedule": "business-hours",
            "timezone": "America/New_York",
            "now_ns": wall_start_ns,
        },
    ]
    assert manifest_writes == [((wall_start_ns,), emitted_at_ns)]
    assert sleeps == [1.0]


def test_datagen_pull_prints_the_cached_bank_path(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    parser = ArgumentParser()
    subparsers = parser.add_subparsers(dest="command", required=True)
    datagen.register(subparsers)
    cached_path = Path("/tmp/phoenix/datagen/remote-bank/digest")
    monkeypatch.setattr("phoenix.datagen.fetcher.fetch_scenario", lambda _scenario: cached_path)

    args = parser.parse_args(["datagen", "pull", "remote-bank"])
    args.func(args)

    assert capsys.readouterr().out == f"{cached_path}\n"

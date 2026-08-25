import time
from argparse import ArgumentParser
from pathlib import Path
from types import SimpleNamespace

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
        },
    )

    assert config.scenario is None
    assert config.rate == 12.0
    assert config.burstiness == 0.5
    assert config.epsilon == 0.02
    assert config.seed == 0


def test_datagen_rejects_removed_session_shape_flags() -> None:
    parser = ArgumentParser()
    subparsers = parser.add_subparsers(dest="command", required=True)
    datagen.register(subparsers)

    with pytest.raises(SystemExit):
        parser.parse_args(["datagen", "--session-fragments-median", "3"])


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

    def sleep(seconds: float) -> None:
        events.append(("sleep", seconds))
        raise KeyboardInterrupt

    monkeypatch.setattr("phoenix.datagen.load_scenario", lambda _scenario: object())
    monkeypatch.setattr("phoenix.datagen.Replayer", FakeReplayer)
    monkeypatch.setattr("phoenix.datagen.OTLPHTTPExporter", FakeExporter)
    monkeypatch.setattr(time, "sleep", sleep)

    parser = ArgumentParser()
    subparsers = parser.add_subparsers(dest="command", required=True)
    datagen.register(subparsers)
    datagen.run(parser.parse_args(["datagen"]))

    assert replayer_kwargs["error_rate"] == 0
    assert events == [
        ("emit", {}),
        ("export", "request"),
        ("interarrival", {"rate": 12.0, "burstiness": 0.5}),
        ("sleep", 2.0),
    ]


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

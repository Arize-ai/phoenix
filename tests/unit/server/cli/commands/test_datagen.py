import time
from argparse import ArgumentParser
from pathlib import Path

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
            "--corpus",
            "/tmp/recorded-traces",
            "--project",
            "cli-project",
            "--rate",
            "30",
            "--burstiness",
            "0.8",
        ]
    )

    config = datagen._resolve_config(
        args,
        {
            "PHOENIX_COLLECTOR_ENDPOINT": "https://env.example",
            "PHOENIX_API_KEY": "env-key",
            "PHOENIX_CLIENT_HEADERS": "x-tenant=tenant%20one,x-route=blue",
            "PHOENIX_PROJECT_NAME": "env-project",
            "PHOENIX_DATAGEN_RATE": "1",
        },
    )

    assert config.endpoint == "https://collector.example"
    assert config.api_key == "cli-key"
    assert config.headers == {"x-tenant": "tenant one", "x-route": "blue"}
    assert config.corpus == "/tmp/recorded-traces"
    assert config.project == "cli-project"
    assert config.rate == 30
    assert config.burstiness == 0.8
    assert args.func is datagen.run


def test_datagen_default_run_loop_preserves_operation_order(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    events: list[object] = []
    replayer_kwargs: dict[str, object] = {}

    class FakeReplayer:
        def __init__(self, _corpus: object, **kwargs: object) -> None:
            replayer_kwargs.update(kwargs)

        def emit(self, **kwargs: object) -> str:
            events.append(("emit", kwargs))
            return "request"

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

    monkeypatch.setattr("phoenix.datagen.load_corpus", lambda _corpus: object())
    monkeypatch.setattr("phoenix.datagen.Replayer", FakeReplayer)
    monkeypatch.setattr("phoenix.datagen.OTLPHTTPExporter", FakeExporter)
    monkeypatch.setattr(time, "sleep", sleep)

    parser = ArgumentParser()
    subparsers = parser.add_subparsers(dest="command", required=True)
    datagen.register(subparsers)
    datagen.run(parser.parse_args(["datagen"]))

    assert replayer_kwargs == {"project_name": None}
    assert events == [
        ("emit", {}),
        ("export", "request"),
        ("interarrival", {"rate": 12.0, "burstiness": 0.5}),
        ("sleep", 2.0),
    ]


def test_datagen_pull_prints_the_cached_corpus_path(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    parser = ArgumentParser()
    subparsers = parser.add_subparsers(dest="command", required=True)
    datagen.register(subparsers)
    cached_path = Path("/tmp/phoenix/datagen/corpus/digest")
    monkeypatch.setattr("phoenix.datagen.fetcher.fetch_corpus", lambda: cached_path)

    args = parser.parse_args(["datagen", "pull"])
    args.func(args)

    assert capsys.readouterr().out == f"{cached_path}\n"

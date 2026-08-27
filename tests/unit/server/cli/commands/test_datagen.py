import time
from argparse import ArgumentParser
from pathlib import Path

import pytest

from phoenix.server.cli.commands import datagen


def test_datagen_run_loop_applies_cli_flags_over_environment(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    events: list[object] = []
    replayer_arguments: dict[str, object] = {}
    exporter_arguments: dict[str, object] = {}

    class FakeReplayer:
        def __init__(self, corpus: object, **kwargs: object) -> None:
            replayer_arguments.update({"corpus": corpus, **kwargs})

        def emit(self, **kwargs: object) -> str:
            events.append(("emit", kwargs))
            return "request"

        def interarrival_seconds(self, **kwargs: object) -> float:
            events.append(("interarrival", kwargs))
            return 2.0

    class FakeExporter:
        def __init__(self, endpoint: str, **kwargs: object) -> None:
            exporter_arguments.update({"endpoint": endpoint, **kwargs})

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

    monkeypatch.setattr("phoenix.datagen.load_corpus", lambda corpus: corpus)
    monkeypatch.setattr("phoenix.datagen.Replayer", FakeReplayer)
    monkeypatch.setattr("phoenix.datagen.OTLPHTTPExporter", FakeExporter)
    monkeypatch.setattr(time, "sleep", sleep)
    monkeypatch.setenv("PHOENIX_COLLECTOR_ENDPOINT", "https://env.example")
    monkeypatch.setenv("PHOENIX_API_KEY", "env-key")
    monkeypatch.setenv("PHOENIX_CLIENT_HEADERS", "x-tenant=tenant%20one,x-route=blue")
    monkeypatch.setenv("PHOENIX_PROJECT_NAME", "env-project")

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
    args.func(args)

    assert replayer_arguments == {
        "corpus": "/tmp/recorded-traces",
        "project_name": "cli-project",
    }
    assert exporter_arguments == {
        "endpoint": "https://collector.example",
        "api_key": "cli-key",
        "headers": {"x-tenant": "tenant one", "x-route": "blue"},
    }
    assert events == [
        ("emit", {}),
        ("export", "request"),
        ("interarrival", {"rate": 30.0, "burstiness": 0.8}),
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

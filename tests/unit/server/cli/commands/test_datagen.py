import time
from argparse import ArgumentParser
from pathlib import Path
from unittest.mock import MagicMock

import httpx
import pytest

from phoenix.server.cli.commands import datagen


@pytest.mark.parametrize("skip_datasets", [False, True])
def test_datagen_run_loop_applies_cli_flags_over_environment(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str], skip_datasets: bool
) -> None:
    events: list[object] = []
    replayer_arguments: dict[str, object] = {}
    exporter_arguments: dict[str, object] = {}

    class FakeReplayer:
        project_names = ("cli-project",)

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

    monkeypatch.setattr("phoenix.experimental.datagen.load_corpus", lambda corpus: corpus)
    monkeypatch.setattr("phoenix.experimental.datagen.Replayer", FakeReplayer)
    monkeypatch.setattr("phoenix.experimental.datagen.OTLPHTTPExporter", FakeExporter)
    monkeypatch.setattr(time, "sleep", sleep)
    monkeypatch.setattr(datagen, "_seed_when_ready", lambda config: events.append("seed"))
    monkeypatch.setenv("PHOENIX_COLLECTOR_ENDPOINT", "https://env.example")
    monkeypatch.setenv("PHOENIX_API_KEY", "env-key")
    monkeypatch.setenv("PHOENIX_CLIENT_HEADERS", "x-tenant=tenant%20one,x-route=blue")

    parser = ArgumentParser()
    subparsers = parser.add_subparsers(dest="command", required=True)
    datagen.register(subparsers)
    args = parser.parse_args(
        [
            "datagen",
            *(["--no-datasets"] if skip_datasets else []),
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
    assert events == ([] if skip_datasets else ["seed"]) + [
        ("emit", {}),
        ("export", "request"),
        ("interarrival", {"rate": 30.0, "burstiness": 0.8}),
        ("sleep", 2.0),
    ]
    assert capsys.readouterr().err == "Replaying into projects: cli-project\n"


def test_datagen_ignores_project_name_environment() -> None:
    parser = ArgumentParser()
    subparsers = parser.add_subparsers(dest="command", required=True)
    datagen.register(subparsers)

    config = datagen._resolve_config(
        parser.parse_args(["datagen"]),
        {"PHOENIX_PROJECT_NAME": "env-project"},
    )

    assert config.project is None


def test_datagen_pull_prints_the_cached_corpus_path(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    parser = ArgumentParser()
    subparsers = parser.add_subparsers(dest="command", required=True)
    datagen.register(subparsers)
    cached_path = Path("/tmp/phoenix/datagen/corpus/digest")
    monkeypatch.setattr("phoenix.experimental.datagen.fetcher.fetch_corpus", lambda: cached_path)

    args = parser.parse_args(["datagen", "pull"])
    args.func(args)

    assert capsys.readouterr().out == f"{cached_path}\n"


def test_seed_command_selects_one_source_and_accepts_connection_flags(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from phoenix.experimental.datagen.datasets import DATASET_SOURCES

    parser = ArgumentParser()
    datagen.register(parser.add_subparsers())
    args = parser.parse_args(
        [
            "datagen",
            "seed",
            "--source",
            "typed-decisions",
            "--endpoint",
            "http://local",
            "--api-key",
            "key",
        ]
    )
    transport = MagicMock()
    transport.__enter__.return_value = transport
    http = MagicMock(return_value=transport)
    monkeypatch.setattr(httpx, "Client", http)
    client = MagicMock()
    monkeypatch.setattr("phoenix.client.Client", MagicMock(return_value=client))
    seed = MagicMock(return_value=[])
    monkeypatch.setattr("phoenix.experimental.datagen.datasets.seed_datasets", seed)
    args.func(args)
    seed.assert_called_once_with(client, sources=[DATASET_SOURCES["typed-decisions"]])
    assert http.call_args.kwargs["base_url"] == "http://local/"
    assert http.call_args.kwargs["headers"]["authorization"] == "Bearer key"


def test_startup_seeding_retries_until_server_is_ready(monkeypatch: pytest.MonkeyPatch) -> None:
    from phoenix.client.resources.datasets import DatasetUploadError

    parser = ArgumentParser()
    datagen.register(parser.add_subparsers())
    args = parser.parse_args(["datagen"])
    unavailable = DatasetUploadError("not ready")
    unavailable.__cause__ = httpx.HTTPStatusError(
        "not ready",
        request=httpx.Request("POST", "http://local/v1/datasets/upload"),
        response=httpx.Response(503),
    )
    seed = MagicMock(side_effect=[httpx.ConnectError("starting"), unavailable, []])
    monkeypatch.setattr("phoenix.experimental.datagen.datasets.seed_datasets", seed)
    sleep = MagicMock()
    monkeypatch.setattr(time, "sleep", sleep)
    datagen._seed_when_ready(datagen._resolve_config(args, {}))
    assert seed.call_count == 3
    assert sleep.call_count == 2


@pytest.mark.parametrize("wrapped", [False, True])
def test_startup_seeding_does_not_retry_permission_errors(
    monkeypatch: pytest.MonkeyPatch, wrapped: bool
) -> None:
    from phoenix.client.resources.datasets import DatasetUploadError

    parser = ArgumentParser()
    datagen.register(parser.add_subparsers())
    args = parser.parse_args(["datagen"])
    error = httpx.HTTPStatusError(
        "denied",
        request=httpx.Request("POST", "http://local/v1/datasets/upload"),
        response=httpx.Response(403),
    )
    upload_error = DatasetUploadError("denied")
    upload_error.__cause__ = error
    seed = MagicMock(side_effect=upload_error if wrapped else error)
    monkeypatch.setattr("phoenix.experimental.datagen.datasets.seed_datasets", seed)
    with pytest.raises(DatasetUploadError if wrapped else httpx.HTTPStatusError):
        datagen._seed_when_ready(datagen._resolve_config(args, {}))
    seed.assert_called_once()

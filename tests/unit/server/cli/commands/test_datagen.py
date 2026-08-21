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
            "--session-fragments-median",
            "3",
            "--session-fragments-sigma",
            "0.4",
            "--session-fragments-max",
            "12",
            "--archetype-mix",
            "plain_chat=2,rag=1",
            "--fragment-gap-median-seconds",
            "90",
            "--fragment-gap-sigma",
            "0.6",
            "--fragment-gap-max-seconds",
            "900",
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
    assert config.session_fragments_median == 3
    assert config.session_fragments_sigma == 0.4
    assert config.session_fragments_max == 12
    assert config.archetype_mix == {"plain_chat": 2, "rag": 1}
    assert config.fragment_gap_median_seconds == 90
    assert config.fragment_gap_sigma == 0.6
    assert config.fragment_gap_max_seconds == 900
    assert args.func is datagen.run


def test_datagen_scenario_environment_fallback() -> None:
    parser = ArgumentParser()
    subparsers = parser.add_subparsers(dest="command", required=True)
    datagen.register(subparsers)

    config = datagen._resolve_config(
        parser.parse_args(["datagen"]),
        {"PHOENIX_DATAGEN_SCENARIO": "openai_chat_sessions"},
    )

    assert config.scenario == "openai_chat_sessions"


def test_datagen_composer_options_have_no_environment_aliases() -> None:
    parser = ArgumentParser()
    subparsers = parser.add_subparsers(dest="command", required=True)
    datagen.register(subparsers)

    config = datagen._resolve_config(
        parser.parse_args(["datagen"]),
        {
            "PHOENIX_DATAGEN_SESSION_FRAGMENTS_MEDIAN": "99",
            "PHOENIX_DATAGEN_ARCHETYPE_MIX": "rag=1",
            "PHOENIX_DATAGEN_FRAGMENT_GAP_MEDIAN_SECONDS": "99",
        },
    )

    assert config.session_fragments_median is None
    assert config.session_fragments_sigma is None
    assert config.session_fragments_max is None
    assert config.archetype_mix is None
    assert config.fragment_gap_median_seconds is None
    assert config.fragment_gap_sigma is None
    assert config.fragment_gap_max_seconds is None


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

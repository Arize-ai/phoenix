from argparse import ArgumentParser

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

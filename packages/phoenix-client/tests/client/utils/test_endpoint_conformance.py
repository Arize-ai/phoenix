"""Endpoint resolution conformance table.

One table, asserted here and in the TypeScript packages, pinning what every
combination of the endpoint variables resolves to. The two implementations
share no code, so the table is deliberately duplicated in each language: it is
the only thing keeping them from drifting apart.

Column asserted here: the **API base URL** — what ``phoenix.client.Client``
sends requests to. Trace export is the other column of the same table; in
Python it belongs to ``arize-phoenix-otel`` and is asserted there.

Abbreviations used in the row comments: ``ENDPOINT`` = ``PHOENIX_ENDPOINT``,
``COLLECTOR`` = ``PHOENIX_COLLECTOR_ENDPOINT``, ``OTLP`` =
``OTEL_EXPORTER_OTLP_ENDPOINT``, ``OTLP_TRACES`` =
``OTEL_EXPORTER_OTLP_TRACES_ENDPOINT``, ``BASE_URL`` = ``PHOENIX_BASE_URL``,
``HOST``/``PORT`` = ``PHOENIX_HOST``/``PHOENIX_PORT``.
"""

import os
from pathlib import Path
from typing import Optional
from unittest.mock import patch

import pytest

import phoenix.client.utils.config as config_module
from phoenix.client.utils.config import get_base_url

# The shared table writes "(unset)" when no variable resolves and the consumer
# applies its own default. For this client that default is PHOENIX_HOST's
# 0.0.0.0 (rewritten to the loopback address, since a bind address is not a
# reachable one) on PHOENIX_PORT.
DEFAULT = "http://127.0.0.1:6006"


@pytest.fixture(autouse=True)
def _reset_config_caches() -> None:
    """Drop cached file discovery and one-time warning latches between rows."""
    config_module.clear_env_file_cache()


PROCESS_ENV_ROWS: list[tuple[str, dict[str, str], str]] = [
    ("1", {}, DEFAULT),
    ("2", {"PHOENIX_ENDPOINT": "http://api"}, "http://api"),
    ("3", {"PHOENIX_COLLECTOR_ENDPOINT": "http://col"}, "http://col"),
    # The headline of the whole scheme: the canonical API variable outranks the
    # trace-export variable, which is only ever an inferred fallback.
    (
        "4",
        {"PHOENIX_ENDPOINT": "http://api", "PHOENIX_COLLECTOR_ENDPOINT": "http://col"},
        "http://api",
    ),
    ("5", {"PHOENIX_BASE_URL": "http://base"}, "http://base"),
    # PHOENIX_BASE_URL was documented for years but never read, so a config
    # carrying both keeps resolving to the variable that already worked.
    (
        "6",
        {"PHOENIX_BASE_URL": "http://base", "PHOENIX_COLLECTOR_ENDPOINT": "http://col"},
        "http://col",
    ),
    ("7", {"PHOENIX_BASE_URL": "http://base", "PHOENIX_ENDPOINT": "http://api"}, "http://api"),
    ("8", {"PHOENIX_COLLECTOR_ENDPOINT": "http://col/v1/traces"}, "http://col"),
    # OTEL_EXPORTER_OTLP_ENDPOINT is a base URL per the OTel spec, and ranks
    # directly below the Phoenix collector variable.
    ("9", {"OTEL_EXPORTER_OTLP_ENDPOINT": "http://otlp"}, "http://otlp"),
    (
        "10",
        {
            "PHOENIX_COLLECTOR_ENDPOINT": "http://col",
            "OTEL_EXPORTER_OTLP_ENDPOINT": "http://otlp",
        },
        "http://col",
    ),
    (
        "11",
        {"PHOENIX_ENDPOINT": "http://api", "OTEL_EXPORTER_OTLP_ENDPOINT": "http://otlp"},
        "http://api",
    ),
    (
        "12",
        {"OTEL_EXPORTER_OTLP_ENDPOINT": "http://otlp", "PHOENIX_BASE_URL": "http://base"},
        "http://otlp",
    ),
    ("13", {"OTEL_EXPORTER_OTLP_ENDPOINT": "http://otlp/v1/traces"}, "http://otlp"),
    # Rows 14-17: OTEL_EXPORTER_OTLP_TRACES_ENDPOINT is fully-qualified per the
    # OTel spec and is NOT read by this client — it names a trace-ingest URL,
    # never an API base URL. Each row therefore resolves from the next rung
    # down, which is what the shared table's API column says for these rows
    # too; the divergence between the languages is confined to that variable's
    # own (trace-export) column.
    ("14", {"OTEL_EXPORTER_OTLP_TRACES_ENDPOINT": "http://otlp/custom/traces"}, DEFAULT),
    (
        "15",
        {
            "PHOENIX_COLLECTOR_ENDPOINT": "http://col",
            "OTEL_EXPORTER_OTLP_TRACES_ENDPOINT": "http://otlp/custom/traces",
        },
        "http://col",
    ),
    (
        "16",
        {
            "PHOENIX_ENDPOINT": "http://api",
            "OTEL_EXPORTER_OTLP_TRACES_ENDPOINT": "http://otlp/custom/traces",
        },
        "http://api",
    ),
    (
        "17",
        {
            "OTEL_EXPORTER_OTLP_TRACES_ENDPOINT": "http://otlp/custom/traces",
            "OTEL_EXPORTER_OTLP_ENDPOINT": "http://otlp",
        },
        "http://otlp",
    ),
    # Rows 18-21: a value that is empty after trimming counts as unset, so it
    # neither resolves nor blocks the variables below it.
    ("18", {"PHOENIX_ENDPOINT": ""}, DEFAULT),
    ("19", {"PHOENIX_ENDPOINT": "", "PHOENIX_COLLECTOR_ENDPOINT": "http://col"}, "http://col"),
    ("20", {"PHOENIX_COLLECTOR_ENDPOINT": "", "PHOENIX_ENDPOINT": "http://api"}, "http://api"),
    ("21", {"PHOENIX_ENDPOINT": "   ", "PHOENIX_HOST": "http://legacy"}, "http://legacy"),
    # Rows 22-24: PHOENIX_HOST is the server's bind host, read last as a legacy
    # fallback. A bind address of 0.0.0.0 is not reachable, so it resolves to
    # the loopback address.
    ("22", {"PHOENIX_HOST": "0.0.0.0", "PHOENIX_PORT": "7007"}, "http://127.0.0.1:7007"),
    ("23", {"PHOENIX_HOST": "phoenix.internal"}, "http://phoenix.internal:6006"),
    (
        "24",
        {"PHOENIX_HOST": "http://legacy", "PHOENIX_COLLECTOR_ENDPOINT": "http://col"},
        "http://col",
    ),
    # Rows 25-31: the OTLP path is stripped only where it is really the OTLP
    # path — end of the path, any number of leading slashes, lower case — and
    # nothing else about the value is rewritten.
    ("25", {"PHOENIX_COLLECTOR_ENDPOINT": "http://col/v1/traces/"}, "http://col"),
    ("26", {"PHOENIX_COLLECTOR_ENDPOINT": "http://col//v1/traces"}, "http://col"),
    ("27", {"PHOENIX_COLLECTOR_ENDPOINT": "http://col/v1/traces?tenant=a"}, "http://col?tenant=a"),
    # URL paths are case-sensitive and /V1/traces is not a Phoenix route, so it
    # is honored as written rather than silently rewritten.
    ("28", {"PHOENIX_COLLECTOR_ENDPOINT": "http://col/V1/traces"}, "http://col/V1/traces"),
    ("29", {"PHOENIX_COLLECTOR_ENDPOINT": "http://col/api/v1/traces"}, "http://col/api"),
    # Nothing is stripped from or added to PHOENIX_ENDPOINT: it is used as given.
    ("30", {"PHOENIX_ENDPOINT": "http://api/"}, "http://api/"),
    ("31", {"PHOENIX_ENDPOINT": "http://api/v1/traces"}, "http://api/v1/traces"),
]


@pytest.mark.parametrize(
    "row,env,expected",
    PROCESS_ENV_ROWS,
    ids=[f"row-{row}" for row, _, _ in PROCESS_ENV_ROWS],
)
def test_api_base_url_conformance(row: str, env: dict[str, str], expected: str) -> None:
    with patch.dict(os.environ, env, clear=True):
        assert str(get_base_url()) == expected


CROSS_TIER_ROWS: list[tuple[str, dict[str, str], str, str]] = [
    # A process value merely *inferred* for API access yields to the canonical
    # PHOENIX_ENDPOINT declared in a discovered .env.phoenix...
    (
        "C1",
        {"PHOENIX_COLLECTOR_ENDPOINT": "http://from-process"},
        "PHOENIX_ENDPOINT=http://from-file\n",
        "http://from-file",
    ),
    # ...but the canonical variable in the process environment still wins.
    (
        "C2",
        {"PHOENIX_ENDPOINT": "http://from-process"},
        "PHOENIX_ENDPOINT=http://from-file\n",
        "http://from-process",
    ),
    # C3-C5: PHOENIX_BASE_URL does not claim a tier. It is a compatibility
    # fallback for a variable no code ever read, so it must not suppress a file
    # that does name the server — but with no such file it still resolves.
    (
        "C3",
        {"PHOENIX_BASE_URL": "http://from-process"},
        "PHOENIX_ENDPOINT=http://from-file\n",
        "http://from-file",
    ),
    (
        "C4",
        {"PHOENIX_BASE_URL": "http://from-process"},
        "PHOENIX_COLLECTOR_ENDPOINT=http://from-file\n",
        "http://from-file",
    ),
    (
        "C5",
        {"PHOENIX_BASE_URL": "http://from-process"},
        "PHOENIX_API_KEY=file-key\n",
        "http://from-process",
    ),
    (
        "C6",
        {"PHOENIX_ENDPOINT": "http://from-process"},
        "PHOENIX_COLLECTOR_ENDPOINT=http://from-file\n",
        "http://from-process",
    ),
    (
        "C7",
        {"PHOENIX_COLLECTOR_ENDPOINT": "http://from-process"},
        "PHOENIX_COLLECTOR_ENDPOINT=http://from-file\n",
        "http://from-process",
    ),
    # An empty process value is unset, so the file tier is consulted.
    (
        "C8",
        {"PHOENIX_ENDPOINT": ""},
        "PHOENIX_ENDPOINT=http://from-file\n",
        "http://from-file",
    ),
]


@pytest.mark.parametrize(
    "row,env,env_file,expected",
    CROSS_TIER_ROWS,
    ids=[f"row-{row}" for row, _, _, _ in CROSS_TIER_ROWS],
)
def test_api_base_url_cross_tier_conformance(
    row: str, env: dict[str, str], env_file: str, expected: str, tmp_path: Path
) -> None:
    (tmp_path / ".env.phoenix").write_text(env_file)
    with patch.dict(os.environ, env, clear=True):
        assert str(get_base_url()) == expected


HOST_SHAPE_ROWS: list[tuple[dict[str, str], str]] = [
    # A PHOENIX_HOST that already is a URL is used as one, whatever port or
    # scheme it carries; only a bare host gets a scheme and PHOENIX_PORT.
    ({"PHOENIX_HOST": "http://myhost:1234"}, "http://myhost:1234"),
    ({"PHOENIX_HOST": "https://myhost"}, "https://myhost"),
    ({"PHOENIX_HOST": "myhost:1234"}, "http://myhost:1234"),
    ({"PHOENIX_HOST": "myhost", "PHOENIX_PORT": "1234"}, "http://myhost:1234"),
]


@pytest.mark.parametrize("env,expected", HOST_SHAPE_ROWS)
def test_host_url_shapes_are_accepted(env: dict[str, str], expected: str) -> None:
    """PHOENIX_HOST values carrying a scheme or a port resolve to that URL.

    Both shapes appear in the wild because the same variable is the Phoenix
    server's bind setting. They previously produced a mangled URL
    (``http://http//myhost:1234:6006``) or raised ``httpx.InvalidURL``.
    """
    with patch.dict(os.environ, env, clear=True):
        assert str(get_base_url()) == expected


@pytest.mark.parametrize(
    "env,expected,invalid_key",
    [
        # A malformed higher-ranked variable must not strand resolution at the
        # default when a lower-ranked one names a reachable server.
        (
            {
                "PHOENIX_ENDPOINT": "http://api:not-a-port",
                "PHOENIX_COLLECTOR_ENDPOINT": "http://col",
            },
            "http://col",
            "PHOENIX_ENDPOINT",
        ),
        (
            {
                "PHOENIX_COLLECTOR_ENDPOINT": "http://col:not-a-port",
                "PHOENIX_BASE_URL": "http://base",
            },
            "http://base",
            "PHOENIX_COLLECTOR_ENDPOINT",
        ),
        ({"PHOENIX_ENDPOINT": "http://api:not-a-port"}, DEFAULT, "PHOENIX_ENDPOINT"),
    ],
)
def test_invalid_candidate_falls_through_to_the_next_variable(
    env: dict[str, str],
    expected: str,
    invalid_key: str,
    caplog: pytest.LogCaptureFixture,
) -> None:
    with patch.dict(os.environ, env, clear=True):
        with caplog.at_level("WARNING"):
            assert str(get_base_url()) == expected
    warnings = [record.message for record in caplog.records if record.levelname == "WARNING"]
    assert any(invalid_key in message for message in warnings), warnings


@pytest.mark.parametrize(
    "env_file,expected_variable",
    [
        # The warning names the variable that actually supplied the base URL,
        # so the reader can find the line that redirected their credentials.
        ("PHOENIX_ENDPOINT=http://from-file\n", "PHOENIX_ENDPOINT"),
        ("PHOENIX_COLLECTOR_ENDPOINT=http://from-file\n", "PHOENIX_COLLECTOR_ENDPOINT"),
        ("PHOENIX_BASE_URL=http://from-file\n", "PHOENIX_BASE_URL"),
        ("PHOENIX_HOST=from-file\n", "PHOENIX_HOST"),
    ],
)
def test_credential_warning_names_the_resolved_variable(
    env_file: str,
    expected_variable: str,
    tmp_path: Path,
    caplog: pytest.LogCaptureFixture,
) -> None:
    env_path = tmp_path / ".env.phoenix"
    env_path.write_text(env_file)
    env_path.chmod(0o600)
    with patch.dict(os.environ, {"PHOENIX_API_KEY": "secret-process-key"}, clear=True):
        with caplog.at_level("WARNING"):
            get_base_url()
    warnings = [record.message for record in caplog.records if record.levelname == "WARNING"]
    assert warnings == [
        f"Credentials from the process environment will be sent to {expected_variable} "
        f"set by {env_path}."
    ]


@pytest.mark.parametrize(
    "value,expected",
    [
        ("  http://api  ", "http://api"),
        ("\thttp://api\n", "http://api"),
    ],
)
def test_surrounding_whitespace_is_trimmed(value: str, expected: str) -> None:
    with patch.dict(os.environ, {"PHOENIX_ENDPOINT": value}, clear=True):
        assert str(get_base_url()) == expected


@pytest.mark.parametrize("value", ["", "   "])
def test_empty_process_value_falls_back_to_the_file_tier_for_single_keys(
    value: str, tmp_path: Path
) -> None:
    """Rule E holds at the single-key reader too, not only in the tier group."""
    (tmp_path / ".env.phoenix").write_text("PHOENIX_API_KEY=file-key\n")
    with patch.dict(os.environ, {"PHOENIX_API_KEY": value}, clear=True):
        assert config_module.get_env_phoenix_api_key() == "file-key"
        assert config_module.getenv("PHOENIX_API_KEY") == "file-key"


@pytest.mark.parametrize(
    "env,expected_port",
    [
        ({"PHOENIX_PORT": ""}, 6006),
        ({"PHOENIX_PORT": " 7007 "}, 7007),
    ],
)
def test_empty_port_counts_as_unset(env: dict[str, str], expected_port: int) -> None:
    with patch.dict(os.environ, env, clear=True):
        assert config_module.get_env_port() == expected_port


def test_base_url_still_resolves_when_only_a_credential_is_set(tmp_path: Path) -> None:
    """A file that names no endpoint leaves the process tier's PHOENIX_BASE_URL alone."""
    (tmp_path / ".env.phoenix").write_text("PHOENIX_API_KEY=file-key\n")
    with patch.dict(os.environ, {"PHOENIX_BASE_URL": "http://base"}, clear=True):
        assert str(get_base_url()) == "http://base"


@pytest.mark.parametrize(
    "env,env_file,expected",
    [
        # PHOENIX_BASE_URL is read from the tier the group claimed, never mixed
        # across tiers: a file that names the server owns the whole group.
        (
            {"PHOENIX_BASE_URL": "http://from-process"},
            "PHOENIX_ENDPOINT=http://from-file\nPHOENIX_BASE_URL=http://base-from-file\n",
            "http://from-file",
        ),
        (
            {"PHOENIX_BASE_URL": "http://from-process", "PHOENIX_HOST": "process-host"},
            "PHOENIX_BASE_URL=http://base-from-file\n",
            "http://from-process",
        ),
    ],
)
def test_base_url_is_read_from_the_claimed_tier(
    env: dict[str, str], env_file: str, expected: str, tmp_path: Path
) -> None:
    (tmp_path / ".env.phoenix").write_text(env_file)
    with patch.dict(os.environ, env, clear=True):
        assert str(get_base_url()) == expected


def test_collector_endpoint_is_unaffected_by_api_only_variables() -> None:
    """Trace export reads only the collector variables; API variables never infer one."""
    env: dict[str, str] = {"PHOENIX_ENDPOINT": "http://api", "PHOENIX_BASE_URL": "http://base"}
    with patch.dict(os.environ, env, clear=True):
        assert config_module.get_env_collector_endpoint() is None


def _resolved_variable(env: dict[str, str]) -> Optional[str]:
    with patch.dict(os.environ, env, clear=True):
        values, _ = config_module._resolve_server_location_values()  # pyright: ignore[reportPrivateUsage]
    return next((key for key in config_module._API_BASE_URL_ENV_KEYS if key in values), None)  # pyright: ignore[reportPrivateUsage]


def test_precedence_order_is_the_documented_one() -> None:
    """The chain, stated once as an order rather than row by row."""
    chain = [
        "PHOENIX_ENDPOINT",
        "PHOENIX_COLLECTOR_ENDPOINT",
        "OTEL_EXPORTER_OTLP_ENDPOINT",
        "PHOENIX_BASE_URL",
        "PHOENIX_HOST",
    ]
    env = {key: f"http://{key.lower()}" for key in chain}
    for expected in chain:
        assert _resolved_variable(env) == expected
        del env[expected]
    assert _resolved_variable(env) is None

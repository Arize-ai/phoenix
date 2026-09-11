from __future__ import annotations

import os
import time
from argparse import SUPPRESS, Namespace
from dataclasses import dataclass
from typing import TYPE_CHECKING, Callable, Mapping, TypeVar

if TYPE_CHECKING:
    from argparse import ArgumentParser, _SubParsersAction

_DEFAULT_ENDPOINT = "http://localhost:6006"
_DEFAULT_RATE = 12.0
_DEFAULT_BURSTINESS = 0.5

_Value = TypeVar("_Value")


@dataclass(frozen=True)
class _Config:
    endpoint: str
    api_key: str | None
    headers: Mapping[str, str]
    corpus: str | None
    project: str | None
    rate: float
    burstiness: float


def register(subparsers: _SubParsersAction[ArgumentParser]) -> None:
    parser = subparsers.add_parser(
        "datagen",
        help=SUPPRESS,
        description=(
            "Internal Phoenix development tool. Not a supported feature: "
            "these flags, the default project name, and the corpus format "
            "may change or be removed in any release, and such changes are "
            "not recorded in MIGRATION.md."
        ),
    )
    parser.set_defaults(func=run)
    commands = parser.add_subparsers(dest="datagen_command")
    pull_parser = commands.add_parser("pull", help="Download and cache the published corpus.")
    pull_parser.set_defaults(func=pull)
    parser.add_argument(
        "--endpoint",
        help="Phoenix collector base URL (env: PHOENIX_COLLECTOR_ENDPOINT).",
    )
    parser.add_argument("--api-key", help="Phoenix API key (env: PHOENIX_API_KEY).")
    parser.add_argument(
        "--corpus",
        help="Local corpus archive (default: the published corpus).",
    )
    parser.add_argument(
        "--project",
        help=("Destination project; defaults to phoenix-datagen (env: PHOENIX_PROJECT_NAME)."),
    )
    parser.add_argument(
        "--rate",
        type=_positive_float,
        help="Mean traces per minute (default: 12).",
    )
    parser.add_argument(
        "--burstiness",
        type=_nonnegative_float,
        help="Interarrival variability; 0 is uniform (default: 0.5).",
    )


def pull(args: Namespace) -> None:
    from phoenix.experimental.datagen.fetcher import fetch_corpus

    print(fetch_corpus())


def run(args: Namespace) -> None:
    from phoenix.experimental.datagen import OTLPHTTPExporter, Replayer, load_corpus

    config = _resolve_config(args, os.environ)
    corpus = load_corpus(config.corpus)
    replayer = Replayer(
        corpus,
        project_name=config.project,
    )

    try:
        with OTLPHTTPExporter(
            config.endpoint,
            api_key=config.api_key,
            headers=config.headers,
        ) as exporter:
            while True:
                exporter.export(replayer.emit())
                time.sleep(
                    replayer.interarrival_seconds(
                        rate=config.rate,
                        burstiness=config.burstiness,
                    )
                )
    except KeyboardInterrupt:
        return


def _parse_env_headers(value: str | None) -> dict[str, str]:
    """Parse W3C Baggage-style ``k=v,k2=v2`` headers with URL-encoded parts.

    Same format as ``PHOENIX_CLIENT_HEADERS`` elsewhere in the Phoenix
    ecosystem; entries that do not parse are skipped.
    """
    from urllib.parse import unquote

    headers: dict[str, str] = {}
    for entry in (value or "").split(","):
        name, separator, encoded = entry.strip().partition("=")
        if not separator or not name.strip():
            continue
        headers[unquote(name).strip().lower()] = unquote(encoded).strip()
    return headers


def _resolve_config(args: Namespace, environ: Mapping[str, str]) -> _Config:
    return _Config(
        endpoint=_setting(
            args.endpoint,
            environ,
            "PHOENIX_COLLECTOR_ENDPOINT",
            _DEFAULT_ENDPOINT,
            str,
        ),
        api_key=args.api_key or environ.get("PHOENIX_API_KEY"),
        headers=_parse_env_headers(environ.get("PHOENIX_CLIENT_HEADERS")),
        corpus=args.corpus,
        project=args.project or environ.get("PHOENIX_PROJECT_NAME"),
        rate=args.rate if args.rate is not None else _DEFAULT_RATE,
        burstiness=args.burstiness if args.burstiness is not None else _DEFAULT_BURSTINESS,
    )


def _setting(
    cli_value: _Value | None,
    environ: Mapping[str, str],
    name: str,
    default: _Value,
    convert: Callable[[str], _Value],
) -> _Value:
    if cli_value is not None:
        return cli_value
    if (env_value := environ.get(name)) is not None:
        try:
            return convert(env_value)
        except (TypeError, ValueError) as error:
            raise ValueError(
                f"Invalid value for environment variable {name}: {env_value}"
            ) from error
    return default


def _positive_float(value: str) -> float:
    parsed = float(value)
    if parsed <= 0:
        raise ValueError("must be greater than zero")
    return parsed


def _nonnegative_float(value: str) -> float:
    parsed = float(value)
    if parsed < 0:
        raise ValueError("must not be negative")
    return parsed

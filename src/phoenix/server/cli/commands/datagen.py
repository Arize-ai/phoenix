from __future__ import annotations

import os
import time
from argparse import Namespace
from dataclasses import dataclass
from typing import TYPE_CHECKING, Callable, Mapping, TypeVar

if TYPE_CHECKING:
    from argparse import ArgumentParser, _SubParsersAction

_DEFAULT_ENDPOINT = "http://localhost:6006"
_DEFAULT_RATE = 12.0
_DEFAULT_BURSTINESS = 0.5
_DEFAULT_EPSILON = 0.02
_DEFAULT_SEED = 0
_DEFAULT_ERROR_RATE = 0.0

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
    epsilon: float
    seed: int
    error_rate: float


def register(subparsers: _SubParsersAction[ArgumentParser]) -> None:
    parser = subparsers.add_parser(
        "datagen",
        help="Continuously replay recorded OpenInference traces.",
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
        help=(
            "Local directory of recorded traces to replay "
            "(default: the bundled or published corpus)."
        ),
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
    parser.add_argument(
        "--epsilon",
        type=_probability,
        help="Per-span contamination probability (default: 0.02).",
    )
    parser.add_argument(
        "--seed",
        type=int,
        help="Random seed (default: 0).",
    )
    parser.add_argument(
        "--error-rate",
        type=_probability,
        help="Per-operation synthetic error probability (default: 0).",
    )


def pull(args: Namespace) -> None:
    from phoenix.datagen.fetcher import fetch_corpus

    print(fetch_corpus())


def run(args: Namespace) -> None:
    from phoenix.datagen import OTLPHTTPExporter, Replayer, load_corpus

    config = _resolve_config(args, os.environ)
    corpus = load_corpus(config.corpus)
    replayer = Replayer(
        corpus,
        epsilon=config.epsilon,
        seed=config.seed,
        project_name=config.project,
        error_rate=config.error_rate,
    )

    try:
        with OTLPHTTPExporter(
            config.endpoint,
            api_key=config.api_key,
            headers=config.headers,
        ) as exporter:
            while True:
                exporter.export(replayer.emit().request)
                time.sleep(
                    replayer.interarrival_seconds(
                        rate=config.rate,
                        burstiness=config.burstiness,
                    )
                )
    except KeyboardInterrupt:
        return


def _resolve_config(args: Namespace, environ: Mapping[str, str]) -> _Config:
    from phoenix.utilities.re import parse_env_headers

    return _Config(
        endpoint=_setting(
            args.endpoint,
            environ,
            "PHOENIX_COLLECTOR_ENDPOINT",
            _DEFAULT_ENDPOINT,
            str,
        ),
        api_key=args.api_key or environ.get("PHOENIX_API_KEY"),
        headers=parse_env_headers(environ.get("PHOENIX_CLIENT_HEADERS")),
        corpus=args.corpus,
        project=args.project or environ.get("PHOENIX_PROJECT_NAME"),
        rate=args.rate if args.rate is not None else _DEFAULT_RATE,
        burstiness=args.burstiness if args.burstiness is not None else _DEFAULT_BURSTINESS,
        epsilon=args.epsilon if args.epsilon is not None else _DEFAULT_EPSILON,
        seed=args.seed if args.seed is not None else _DEFAULT_SEED,
        error_rate=args.error_rate if args.error_rate is not None else _DEFAULT_ERROR_RATE,
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


def _probability(value: str) -> float:
    parsed = float(value)
    if not 0 <= parsed <= 1:
        raise ValueError("must be between zero and one")
    return parsed

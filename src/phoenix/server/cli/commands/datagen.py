from __future__ import annotations

import os
import time
from argparse import Namespace
from dataclasses import dataclass
from typing import TYPE_CHECKING, Callable, Mapping, TypeVar

if TYPE_CHECKING:
    from argparse import ArgumentParser, _SubParsersAction

_DEFAULT_ENDPOINT = "http://localhost:6006"
_DEFAULT_CORPUS = "default"
_DEFAULT_RATE = 12.0
_DEFAULT_BURSTINESS = 0.5
_DEFAULT_EPSILON = 0.02
_DEFAULT_SEED = 0

_Value = TypeVar("_Value")


@dataclass(frozen=True)
class _Config:
    endpoint: str
    api_key: str | None
    corpus: str
    rate: float
    burstiness: float
    epsilon: float
    seed: int
    anomaly_manifest: str | None


def register(subparsers: _SubParsersAction[ArgumentParser]) -> None:
    parser = subparsers.add_parser(
        "datagen",
        help="Continuously replay recorded OpenInference traces.",
    )
    parser.set_defaults(func=run)
    parser.add_argument(
        "--endpoint",
        help="Phoenix collector base URL (env: PHOENIX_COLLECTOR_ENDPOINT).",
    )
    parser.add_argument("--api-key", help="Phoenix API key (env: PHOENIX_API_KEY).")
    parser.add_argument(
        "--corpus",
        help=(
            "Bundled corpus name, local directory, or HTTP(S) directory "
            "(env: PHOENIX_DATAGEN_CORPUS)."
        ),
    )
    parser.add_argument(
        "--rate",
        type=_positive_float,
        help="Mean traces per minute (env: PHOENIX_DATAGEN_RATE).",
    )
    parser.add_argument(
        "--burstiness",
        type=_nonnegative_float,
        help="Interarrival variability; 0 is uniform (env: PHOENIX_DATAGEN_BURSTINESS).",
    )
    parser.add_argument(
        "--epsilon",
        type=_probability,
        help="Per-span contamination probability (env: PHOENIX_DATAGEN_EPSILON).",
    )
    parser.add_argument(
        "--seed",
        type=int,
        help="Random seed (env: PHOENIX_DATAGEN_SEED).",
    )
    parser.add_argument(
        "--anomaly-manifest",
        help="Append emitted anomaly ground truth as JSONL.",
    )


def run(args: Namespace) -> None:
    from phoenix.datagen import AnomalyManifest, OTLPHTTPExporter, Replayer, load_corpus

    config = _resolve_config(args, os.environ)
    replayer = Replayer(
        load_corpus(config.corpus),
        epsilon=config.epsilon,
        seed=config.seed,
    )
    anomaly_manifest = AnomalyManifest(config.anomaly_manifest) if config.anomaly_manifest else None

    try:
        with OTLPHTTPExporter(config.endpoint, api_key=config.api_key) as exporter:
            while True:
                emitted_trace = replayer.emit()
                exporter.export(emitted_trace.request)
                if anomaly_manifest is not None:
                    anomaly_manifest.write(emitted_trace.anomalies)
                time.sleep(
                    replayer.interarrival_seconds(
                        rate=config.rate,
                        burstiness=config.burstiness,
                    )
                )
    except KeyboardInterrupt:
        return


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
        corpus=_setting(
            args.corpus,
            environ,
            "PHOENIX_DATAGEN_CORPUS",
            _DEFAULT_CORPUS,
            str,
        ),
        rate=_setting(
            args.rate,
            environ,
            "PHOENIX_DATAGEN_RATE",
            _DEFAULT_RATE,
            _positive_float,
        ),
        burstiness=_setting(
            args.burstiness,
            environ,
            "PHOENIX_DATAGEN_BURSTINESS",
            _DEFAULT_BURSTINESS,
            _nonnegative_float,
        ),
        epsilon=_setting(
            args.epsilon,
            environ,
            "PHOENIX_DATAGEN_EPSILON",
            _DEFAULT_EPSILON,
            _probability,
        ),
        seed=_setting(
            args.seed,
            environ,
            "PHOENIX_DATAGEN_SEED",
            _DEFAULT_SEED,
            int,
        ),
        anomaly_manifest=args.anomaly_manifest or environ.get("PHOENIX_DATAGEN_ANOMALY_MANIFEST"),
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

from __future__ import annotations

import os
import re
import time
from argparse import Namespace
from dataclasses import dataclass
from typing import TYPE_CHECKING, Callable, Mapping, TypeVar, cast
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

if TYPE_CHECKING:
    from argparse import ArgumentParser, _SubParsersAction

    from phoenix.datagen.schema import Archetype

_DEFAULT_ENDPOINT = "http://localhost:6006"
_DEFAULT_SCENARIO = "default"
_DEFAULT_RATE = 12.0
_DEFAULT_BURSTINESS = 0.5
_DEFAULT_EPSILON = 0.02
_DEFAULT_SEED = 0
_DEFAULT_RATE_SCHEDULE = "flat"
_DEFAULT_TIMEZONE = "UTC"
_DEFAULT_ERROR_RATE = 0.0

_DURATION_SECONDS = {
    "s": 1,
    "m": 60,
    "h": 60 * 60,
    "d": 24 * 60 * 60,
}

_Value = TypeVar("_Value")


@dataclass(frozen=True)
class _Config:
    endpoint: str
    api_key: str | None
    headers: Mapping[str, str]
    scenario: str
    project: str | None
    rate: float
    burstiness: float
    epsilon: float
    seed: int
    anomaly_manifest: str | None
    session_fragments_median: float | None
    session_fragments_sigma: float | None
    session_fragments_max: int | None
    archetype_mix: Mapping[Archetype, float] | None
    fragment_gap_median_seconds: float | None
    fragment_gap_sigma: float | None
    fragment_gap_max_seconds: float | None
    rate_schedule: str
    timezone: str
    backfill_seconds: float | None
    error_rate: float


def register(subparsers: _SubParsersAction[ArgumentParser]) -> None:
    parser = subparsers.add_parser(
        "datagen",
        help="Continuously replay recorded OpenInference traces.",
    )
    parser.set_defaults(func=run)
    commands = parser.add_subparsers(dest="datagen_command")
    pull_parser = commands.add_parser("pull", help="Download and cache a scenario bank.")
    pull_parser.set_defaults(func=pull)
    pull_parser.add_argument("scenario", help="Scenario name from the published scenario index.")
    parser.add_argument(
        "--endpoint",
        help="Phoenix collector base URL (env: PHOENIX_COLLECTOR_ENDPOINT).",
    )
    parser.add_argument("--api-key", help="Phoenix API key (env: PHOENIX_API_KEY).")
    parser.add_argument(
        "--scenario",
        help="Published scenario name or local directory (env: PHOENIX_DATAGEN_SCENARIO).",
    )
    parser.add_argument(
        "--project",
        help=("Destination project; defaults to phoenix-datagen (env: PHOENIX_PROJECT_NAME)."),
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
    parser.add_argument(
        "--session-fragments-median",
        type=_positive_float,
        help="Median fragments per virtual session (default: 2).",
    )
    parser.add_argument(
        "--session-fragments-sigma",
        type=_nonnegative_float,
        help="Lognormal variability for fragments per session (default: 1.0).",
    )
    parser.add_argument(
        "--session-fragments-max",
        type=_positive_int,
        help="Maximum fragments per virtual session (default: 24).",
    )
    parser.add_argument(
        "--archetype-mix",
        type=_archetype_mix,
        help="Comma-separated archetype weights such as plain_chat=2,rag=1.",
    )
    parser.add_argument(
        "--fragment-gap-median-seconds",
        type=_nonnegative_float,
        help="Median virtual gap between fragments (default: 180).",
    )
    parser.add_argument(
        "--fragment-gap-sigma",
        type=_nonnegative_float,
        help="Lognormal variability for virtual fragment gaps (default: 0.9).",
    )
    parser.add_argument(
        "--fragment-gap-max-seconds",
        type=_nonnegative_float,
        help="Maximum virtual gap between fragments (default: 3600).",
    )
    parser.add_argument(
        "--rate-schedule",
        choices=("flat", "business-hours"),
        help="Replay rate profile (default: flat).",
    )
    parser.add_argument(
        "--timezone",
        help="IANA timezone used by the rate schedule (default: UTC).",
    )
    parser.add_argument(
        "--backfill",
        help="Replay recent history using a compact duration such as 48h.",
    )
    parser.add_argument(
        "--error-rate",
        type=_probability,
        help="Per-operation synthetic error probability (default: 0).",
    )


def pull(args: Namespace) -> None:
    from phoenix.datagen.fetcher import fetch_scenario

    print(fetch_scenario(args.scenario))


def run(args: Namespace) -> None:
    from phoenix.datagen import AnomalyManifest, OTLPHTTPExporter, Replayer, load_scenario

    config = _resolve_config(args, os.environ)
    scenario = load_scenario(config.scenario)
    replayer = Replayer(
        scenario,
        epsilon=config.epsilon,
        seed=config.seed,
        project_name=config.project,
        session_fragments_median=config.session_fragments_median,
        session_fragments_sigma=config.session_fragments_sigma,
        session_fragments_max=config.session_fragments_max,
        archetype_mix=config.archetype_mix,
        fragment_gap_median_seconds=config.fragment_gap_median_seconds,
        fragment_gap_sigma=config.fragment_gap_sigma,
        fragment_gap_max_seconds=config.fragment_gap_max_seconds,
        error_rate=config.error_rate,
    )
    anomaly_manifest = AnomalyManifest(config.anomaly_manifest) if config.anomaly_manifest else None

    try:
        with OTLPHTTPExporter(
            config.endpoint,
            api_key=config.api_key,
            headers=config.headers,
        ) as exporter:
            if (
                config.rate_schedule == "flat"
                and config.backfill_seconds is None
                and config.error_rate == 0
            ):
                while True:
                    emitted_trace = replayer.emit()
                    delivered = exporter.export(emitted_trace.request)
                    if delivered and anomaly_manifest is not None:
                        anomaly_manifest.write(
                            emitted_trace.anomalies,
                            emitted_at_ns=time.time_ns(),
                        )
                    time.sleep(
                        replayer.interarrival_seconds(
                            rate=config.rate,
                            burstiness=config.burstiness,
                        )
                    )
            wall_start_ns = time.time_ns()
            virtual_cursor_ns = wall_start_ns - round(
                (config.backfill_seconds or 0) * 1_000_000_000
            )
            while True:
                emitted_trace = replayer.emit(scheduled_start_ns=virtual_cursor_ns)
                delivered = exporter.export(emitted_trace.request)
                if delivered and anomaly_manifest is not None:
                    anomaly_manifest.write(
                        emitted_trace.anomalies,
                        emitted_at_ns=time.time_ns(),
                    )
                interarrival_seconds = replayer.interarrival_seconds(
                    rate=config.rate,
                    burstiness=config.burstiness,
                    rate_schedule=config.rate_schedule,
                    timezone=config.timezone,
                    now_ns=virtual_cursor_ns,
                )
                virtual_cursor_ns += max(1, round(interarrival_seconds * 1_000_000_000))
                sleep_seconds = (virtual_cursor_ns - time.time_ns()) / 1_000_000_000
                if sleep_seconds > 0:
                    time.sleep(sleep_seconds)
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
        scenario=_setting(
            args.scenario,
            environ,
            "PHOENIX_DATAGEN_SCENARIO",
            _DEFAULT_SCENARIO,
            str,
        ),
        project=args.project or environ.get("PHOENIX_PROJECT_NAME"),
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
        session_fragments_median=args.session_fragments_median,
        session_fragments_sigma=args.session_fragments_sigma,
        session_fragments_max=args.session_fragments_max,
        archetype_mix=args.archetype_mix,
        fragment_gap_median_seconds=args.fragment_gap_median_seconds,
        fragment_gap_sigma=args.fragment_gap_sigma,
        fragment_gap_max_seconds=args.fragment_gap_max_seconds,
        rate_schedule=args.rate_schedule or _DEFAULT_RATE_SCHEDULE,
        timezone=_iana_timezone(args.timezone or _DEFAULT_TIMEZONE),
        backfill_seconds=(
            _compact_duration_seconds(args.backfill) if args.backfill is not None else None
        ),
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


def _positive_int(value: str) -> int:
    parsed = int(value)
    if parsed <= 0:
        raise ValueError("must be greater than zero")
    return parsed


def _archetype_mix(value: str) -> Mapping[Archetype, float]:
    supported = {
        "plain_chat",
        "rag",
        "tool_agent",
        "graph_multi_agent",
        "guardrailed",
        "structured_extraction",
    }
    weights: dict[str, float] = {}
    for item in value.split(","):
        name, separator, raw_weight = item.partition("=")
        if not separator or not name or not raw_weight:
            raise ValueError("must use comma-separated name=weight entries")
        if name not in supported:
            raise ValueError(f"unsupported archetype: {name}")
        if name in weights:
            raise ValueError(f"duplicate archetype: {name}")
        weight = _positive_float(raw_weight)
        weights[name] = weight
    if not weights:
        raise ValueError("must contain at least one archetype weight")
    return cast("Mapping[Archetype, float]", weights)


def _probability(value: str) -> float:
    parsed = float(value)
    if not 0 <= parsed <= 1:
        raise ValueError("must be between zero and one")
    return parsed


def _compact_duration_seconds(value: str) -> float:
    match = re.fullmatch(r"(\d+(?:\.\d+)?)([smhd])", value)
    if match is None:
        raise ValueError("must be a compact positive duration using s, m, h, or d")
    duration = float(match.group(1)) * _DURATION_SECONDS[match.group(2)]
    if duration <= 0:
        raise ValueError("must be a compact positive duration using s, m, h, or d")
    return duration


def _iana_timezone(value: str) -> str:
    try:
        ZoneInfo(value)
    except (ValueError, ZoneInfoNotFoundError) as error:
        raise ValueError(f"Invalid IANA timezone: {value}") from error
    return value

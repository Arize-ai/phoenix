from __future__ import annotations

import os
import sys
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
            "these flags, the project names, and the corpus format "
            "may change or be removed in any release, and such changes are "
            "not recorded in MIGRATION.md."
        ),
    )
    parser.set_defaults(func=run)
    commands = parser.add_subparsers(dest="datagen_command")
    pull_parser = commands.add_parser("pull", help="Download and cache the published corpus.")
    pull_parser.set_defaults(func=pull)
    seed_parser = commands.add_parser(
        "seed", help="Seed development datasets, prompts, and decisions, then exit."
    )
    seed_parser.set_defaults(func=seed)
    sources = seed_parser.add_mutually_exclusive_group()
    sources.add_argument(
        "--source",
        choices=("all", "jevbench-hard", "typed-decisions", "boolq"),
        default="typed-decisions",
        help="Pinned source to seed (default: typed-decisions).",
    )
    sources.add_argument("--file", help="Local file of canonical Phoenix examples.")
    seed_parser.add_argument("--name", help="Dataset name (required with --file).")
    seed_parser.add_argument("--format", choices=("jsonl", "parquet"), default="jsonl")
    seed_parser.add_argument("--endpoint", default=SUPPRESS)
    seed_parser.add_argument("--api-key", default=SUPPRESS)
    parser.add_argument(
        "--no-datasets",
        action="store_true",
        help="Skip dataset, prompt, and decision seeding before trace replay.",
    )
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
        help=(
            "Send every application to this one project "
            "(default: one project per recorded application)."
        ),
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


def seed(args: Namespace) -> None:
    from pathlib import Path

    import httpx

    from phoenix.client import Client
    from phoenix.experimental.datagen.datasets import DATASET_SOURCES, load_dataset, seed_datasets
    from phoenix.experimental.datagen.decisions import seed_workflow_decisions
    from phoenix.experimental.datagen.prompts import seed_workflow_prompts

    if bool(args.file) != bool(args.name):
        raise ValueError("--file and --name must be provided together")
    config = _resolve_config(args, os.environ)
    with httpx.Client(base_url=config.endpoint.rstrip("/") + "/", headers=_headers(config)) as http:
        client = Client(http_client=http)
        if args.file:
            dataset = client.datasets.create_dataset(
                name=args.name,
                examples=load_dataset(Path(args.file).expanduser(), format=args.format),
                timeout=120,
            )
            datasets = [dataset]
        else:
            sources = (
                list(DATASET_SOURCES.values())
                if args.source == "all"
                else [DATASET_SOURCES[args.source]]
            )
            datasets = seed_datasets(client, sources=sources)
            for name, version in seed_workflow_prompts(client, datasets):
                print(f"Seeded prompt {name} (version {version.id})")
            for name, version_id in seed_workflow_decisions(http, datasets):
                print(f"Seeded decision {name} (version {version_id})")
        for dataset in datasets:
            print(f"Seeded {dataset.name}: {len(dataset)} examples (version {dataset.version_id})")


def _headers(config: _Config) -> dict[str, str]:
    headers = dict(config.headers)
    if config.api_key:
        headers["authorization"] = f"Bearer {config.api_key}"
    return headers


def _seed_when_ready(config: _Config) -> None:
    import httpx

    from phoenix.client import Client
    from phoenix.client.resources.datasets import DatasetUploadError
    from phoenix.experimental.datagen.datasets import seed_datasets
    from phoenix.experimental.datagen.decisions import seed_workflow_decisions
    from phoenix.experimental.datagen.prompts import seed_workflow_prompts

    with httpx.Client(base_url=config.endpoint.rstrip("/") + "/", headers=_headers(config)) as http:
        client = Client(http_client=http)
        while True:
            try:
                datasets = seed_datasets(client)
                for name, version in seed_workflow_prompts(client, datasets):
                    print(f"Seeded prompt {name} (version {version.id})", file=sys.stderr)
                for name, version_id in seed_workflow_decisions(http, datasets):
                    print(f"Seeded decision {name} (version {version_id})", file=sys.stderr)
                for dataset in datasets:
                    print(f"Seeded {dataset.name}: {len(dataset)} examples", file=sys.stderr)
                return
            except (httpx.HTTPStatusError, DatasetUploadError) as error:
                cause = error if isinstance(error, httpx.HTTPStatusError) else error.__cause__
                if not isinstance(
                    cause, httpx.HTTPStatusError
                ) or cause.response.status_code not in {429, 502, 503, 504}:
                    raise
            except httpx.TransportError:
                pass
            print("Waiting for Phoenix to seed development datasets...", file=sys.stderr)
            time.sleep(2)


def run(args: Namespace) -> None:
    from phoenix.experimental.datagen import OTLPHTTPExporter, Replayer, load_corpus

    config = _resolve_config(args, os.environ)
    corpus = load_corpus(config.corpus)
    replayer = Replayer(
        corpus,
        project_name=config.project,
    )
    print(
        f"Replaying into projects: {', '.join(replayer.project_names)}",
        file=sys.stderr,
    )

    try:
        if not args.no_datasets:
            _seed_when_ready(config)
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
        # Not PHOENIX_PROJECT_NAME: other Phoenix tooling exports it, and pnpm dev sources .env.
        project=args.project,
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

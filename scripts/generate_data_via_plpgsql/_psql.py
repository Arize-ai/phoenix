from __future__ import annotations

import argparse
import os
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Mapping


@dataclass(frozen=True)
class DatabaseConfig:
    name: str
    user: str
    host: str
    port: int
    password: str

    @classmethod
    def from_args(cls, args: argparse.Namespace) -> DatabaseConfig:
        return cls(
            name=args.db_name,
            user=args.db_user,
            host=args.db_host,
            port=args.db_port,
            password=args.db_password,
        )


class PsqlError(RuntimeError):
    pass


def positive_int(value: str) -> int:
    parsed = int(value)
    if parsed < 1:
        raise argparse.ArgumentTypeError("must be at least 1")
    return parsed


def probability(value: str) -> float:
    parsed = float(value)
    if not 0 <= parsed <= 1:
        raise argparse.ArgumentTypeError("must be between 0 and 1")
    return parsed


def add_database_arguments(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("--db-name", default="postgres")
    parser.add_argument("--db-user", default="postgres")
    parser.add_argument("--db-host", default="localhost")
    parser.add_argument("--db-port", type=positive_int, default=5432)
    parser.add_argument(
        "--db-password",
        default=os.environ.get("PGPASSWORD", "phoenix"),
        help="Database password (default: PGPASSWORD or phoenix).",
    )


def command(
    config: DatabaseConfig,
    script: Path,
    *,
    variables: Mapping[str, str | int | float] | None = None,
) -> list[str]:
    args = [
        "psql",
        "--no-psqlrc",
        "--set",
        "ON_ERROR_STOP=1",
        "--host",
        config.host,
        "--port",
        str(config.port),
        "--dbname",
        config.name,
        "--username",
        config.user,
    ]
    for name, value in (variables or {}).items():
        args.extend(("--set", f"{name}={value}"))
    args.extend(("--file", str(script)))
    return args


def run_sql(
    config: DatabaseConfig,
    script: Path,
    *,
    variables: Mapping[str, str | int | float] | None = None,
) -> str:
    environment = os.environ.copy()
    environment["PGPASSWORD"] = config.password
    result = subprocess.run(
        command(config, script, variables=variables),
        capture_output=True,
        check=False,
        env=environment,
        text=True,
    )
    if result.returncode:
        detail = result.stderr.strip() or result.stdout.strip() or "psql failed without output"
        raise PsqlError(detail)
    return _clean_output(result.stdout)


def _clean_output(output: str) -> str:
    ignored_prefixes = ("Output format is", "Tuples only is")
    return "\n".join(
        line
        for line in output.splitlines()
        if line.strip() and not line.startswith(ignored_prefixes)
    )

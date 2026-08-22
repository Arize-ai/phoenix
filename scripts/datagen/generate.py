#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = [
#   "openai==3.2.0",
# ]
# ///
"""Create and operate a resumable offline datagen pass."""

from __future__ import annotations

import argparse
import json
import sys
from decimal import Decimal
from pathlib import Path
from typing import TYPE_CHECKING, Any, Mapping, Sequence, TextIO

if TYPE_CHECKING or __package__:
    from scripts.datagen.generation import (
        DEFAULT_BUDGET_USD,
        DEFAULT_LANE_TARGETS,
        GenerationError,
        GenerationRun,
        Lane,
        PriceCatalog,
        RunConfig,
        expand_seed_matrix,
        matrix_sha256,
    )
    from scripts.datagen.model_backend import ModelBackend
    from scripts.datagen.profile import ProfileValidationError, load_profile_set
else:
    from profile import (  # type: ignore[import-not-found,no-redef]
        ProfileValidationError,
        load_profile_set,
    )

    from generation import (  # type: ignore[import-not-found,no-redef]
        DEFAULT_BUDGET_USD,
        DEFAULT_LANE_TARGETS,
        GenerationError,
        GenerationRun,
        Lane,
        PriceCatalog,
        RunConfig,
        expand_seed_matrix,
        matrix_sha256,
    )
    from model_backend import ModelBackend  # type: ignore[import-not-found,no-redef]

DEFAULT_PRICING_PATH = Path(__file__).with_name("pricing.json")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    subparsers = parser.add_subparsers(dest="command", required=True)

    initialize = subparsers.add_parser("init", help="create or verify an immutable run directory")
    initialize.add_argument("run_dir", type=Path)
    initialize.add_argument("--profile-set", type=Path)
    initialize.add_argument("--matrix-factors", type=Path, help=argparse.SUPPRESS)
    initialize.add_argument("--run-id", required=True)
    initialize.add_argument("--seed", type=int, required=True)
    initialize.add_argument("--luna-model", default="gpt-5.6-luna")
    initialize.add_argument("--frontier-model", required=True)
    initialize.add_argument(
        "--luna-provider", choices=("openai_api", "codex_exec"), default="openai_api"
    )
    initialize.add_argument(
        "--frontier-provider", choices=("openai_api", "codex_exec"), default="openai_api"
    )
    initialize.add_argument("--pricing", type=Path, default=DEFAULT_PRICING_PATH)
    initialize.add_argument("--budget-usd", type=Decimal, default=DEFAULT_BUDGET_USD)
    initialize.add_argument(
        "--self-play-target", type=int, default=DEFAULT_LANE_TARGETS["self_play"]
    )
    initialize.add_argument("--scripted-target", type=int, default=DEFAULT_LANE_TARGETS["scripted"])

    status = subparsers.add_parser("status", help="report accepted targets, spend, and exhaustion")
    status.add_argument("run_dir", type=Path)

    admit = subparsers.add_parser("admit", help="reserve cost and start or resume a cell attempt")
    admit.add_argument("run_dir", type=Path)
    admit.add_argument("cell_id")
    admit.add_argument("--purpose", default="generation")
    admit.add_argument("--model")
    admit.add_argument("--mode", choices=("direct", "batch"), required=True)
    admit.add_argument("--max-input-tokens", type=int, required=True)
    admit.add_argument("--max-output-tokens", type=int, required=True)
    admit.add_argument("--pricing", type=Path, default=DEFAULT_PRICING_PATH)

    checkpoint = subparsers.add_parser(
        "checkpoint", help="append a complete conversation checkpoint"
    )
    checkpoint.add_argument("run_dir", type=Path)
    checkpoint.add_argument("attempt_id")
    checkpoint.add_argument("checkpoint_json", type=Path)

    complete = subparsers.add_parser(
        "complete", help="reconcile provider usage and finish an attempt"
    )
    complete.add_argument("run_dir", type=Path)
    complete.add_argument("attempt_id")
    complete.add_argument("--input-tokens", type=int, required=True)
    complete.add_argument("--cached-input-tokens", type=int, default=0)
    complete.add_argument("--output-tokens", type=int, required=True)
    complete.add_argument("--pricing", type=Path, default=DEFAULT_PRICING_PATH)

    fail = subparsers.add_parser("fail", help="release a reservation and reject an attempt")
    fail.add_argument("run_dir", type=Path)
    fail.add_argument("attempt_id")
    fail.add_argument("--reason", required=True)

    accept = subparsers.add_parser("accept", help="append an immutable accepted fragment record")
    accept.add_argument("run_dir", type=Path)
    accept.add_argument("cell_id")
    accept.add_argument("attempt_id")
    accept.add_argument("fragment_json", type=Path)
    judging_input = subparsers.add_parser(
        "record-judging-input", help="append one immutable accepted-fragment judging input"
    )
    judging_input.add_argument("run_dir", type=Path)
    judging_input.add_argument("input_json", type=Path)

    judge = subparsers.add_parser(
        "judge", help="run or resume judged-outcome classification for accepted fragments"
    )
    judge.add_argument("run_dir", type=Path)
    judge.add_argument("--pricing", type=Path, default=DEFAULT_PRICING_PATH)
    judge.add_argument("--max-input-tokens", type=int, default=16_000)
    return parser


def command(
    argv: Sequence[str] | None = None,
    *,
    stdout: TextIO = sys.stdout,
    stderr: TextIO = sys.stderr,
    backend: ModelBackend | None = None,
) -> int:
    args = build_parser().parse_args(argv)
    try:
        result = _dispatch(args, backend=backend)
    except (GenerationError, ProfileValidationError, ValueError) as error:
        print(json.dumps({"error": type(error).__name__, "message": str(error)}), file=stderr)
        return 2
    print(json.dumps(result, sort_keys=True), file=stdout)
    return 0


def _dispatch(args: argparse.Namespace, *, backend: ModelBackend | None = None) -> Any:
    if args.command == "init":
        return _initialize(args)
    run = GenerationRun.resume(args.run_dir)
    if args.command == "status":
        return run.status()
    if args.command == "admit":
        prices = PriceCatalog.load(args.pricing)
        cell = next((cell for cell in run.cells if cell.cell_id == args.cell_id), None)
        if cell is None:
            raise GenerationError(f"unknown matrix cell {args.cell_id}")
        attempt = run.admitted_attempt(
            args.cell_id,
            purpose=args.purpose,
            model=args.model or cell.assistant_model,
            mode=args.mode,
            max_input_tokens=args.max_input_tokens,
            max_output_tokens=args.max_output_tokens,
            prices=prices,
        )
        return {"attempt": attempt.__dict__, "status": run.status()}
    if args.command == "checkpoint":
        run.checkpoint(args.attempt_id, _read_object(args.checkpoint_json))
        return {"attempt_id": args.attempt_id, "checkpointed": True}
    if args.command == "complete":
        actual = run.complete_attempt(
            args.attempt_id,
            prices=PriceCatalog.load(args.pricing),
            input_tokens=args.input_tokens,
            cached_input_tokens=args.cached_input_tokens,
            output_tokens=args.output_tokens,
        )
        return {"attempt_id": args.attempt_id, "actual_usd": str(actual)}
    if args.command == "fail":
        run.fail_attempt(args.attempt_id, args.reason)
        return {"attempt_id": args.attempt_id, "failed": True}
    if args.command == "accept":
        run.accept_cell(args.cell_id, args.attempt_id, _read_object(args.fragment_json))
        return {"cell_id": args.cell_id, "accepted": True, "status": run.status()}
    if args.command == "record-judging-input":
        run.record_judging_input(_read_object(args.input_json))
        return {"recorded": True, "judging_input_count": len(run.judging_inputs)}
    if args.command == "judge":
        from scripts.datagen.judgments import execute_judging

        selected_backend = backend or _frontier_backend(run.config.frontier_provider)
        prices = (
            PriceCatalog.load(args.pricing)
            if run.config.frontier_provider == "openai_api"
            else None
        )
        records = execute_judging(
            run,
            selected_backend,
            prices=prices,
            max_input_tokens=args.max_input_tokens,
        )
        return {
            "judgments": len(records),
            "outcomes": {
                outcome: sum(record.outcome == outcome for record in records)
                for outcome in ("survived", "degraded", "failed")
            },
            "unjudged": sum(record.outcome is None for record in records),
        }
    raise AssertionError(args.command)


def _frontier_backend(provider: str) -> ModelBackend:
    if provider == "codex_exec":
        from scripts.datagen.codex_exec import CodexExecBackend

        return CodexExecBackend()
    if provider == "openai_api":
        from openai import OpenAI

        from scripts.datagen.model_backend import OpenAIResponsesBackend

        return OpenAIResponsesBackend(OpenAI().responses.create)
    raise GenerationError(f"unsupported frontier provider {provider!r}")


def _initialize(args: argparse.Namespace) -> Mapping[str, Any]:
    if args.matrix_factors is not None:
        raise GenerationError(
            "--matrix-factors is no longer supported; create a profile set and initialize a new run"
        )
    if args.profile_set is None:
        raise GenerationError("init requires --profile-set")
    prices = PriceCatalog.load(args.pricing)
    if args.luna_provider == "openai_api":
        prices.require(args.luna_model)
    if args.frontier_provider == "openai_api":
        prices.require(args.frontier_model)
    profiles = load_profile_set(args.profile_set)
    targets: dict[Lane, int] = {
        "self_play": args.self_play_target,
        "scripted": args.scripted_target,
    }
    cells = expand_seed_matrix(
        profiles,
        seed=args.seed,
        luna_model=args.luna_model,
        frontier_model=args.frontier_model,
        lane_targets=targets,
    )
    config = RunConfig(
        run_id=args.run_id,
        matrix_seed=args.seed,
        matrix_sha256=matrix_sha256(cells, args.seed, profiles.profile_set_sha256),
        luna_model=args.luna_model,
        frontier_model=args.frontier_model,
        pricing_version=prices.version,
        pricing_sha256=prices.sha256,
        profile_set_sha256=profiles.profile_set_sha256,
        luna_provider=args.luna_provider,
        frontier_provider=args.frontier_provider,
        budget_usd=str(args.budget_usd),
        self_play_target=args.self_play_target,
        scripted_target=args.scripted_target,
    )
    run = GenerationRun.create_or_resume(
        args.run_dir, config=config, cells=cells, profiles=profiles
    )
    return {
        "run_id": config.run_id,
        "matrix_sha256": config.matrix_sha256,
        "cell_count": len(cells),
        "status": run.status(),
    }


def _read_object(path: Path) -> dict[str, Any]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise GenerationError(f"Unable to read JSON object {path}: {error}") from error
    if not isinstance(value, dict):
        raise GenerationError(f"Expected JSON object in {path}")
    return value


def main() -> None:
    raise SystemExit(command())


if __name__ == "__main__":
    main()

"""Run the paired benchmark, or its unpaid CLI oracle, through one Harbor lifecycle."""

from __future__ import annotations

import argparse
import asyncio
import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from harbor.cli.job_plugins import attach_job_plugin
from harbor.job import Job
from harbor.models.trial.config import AgentConfig

from environment import ACTIVE_TARGETS, PROVIDER_SECRETS
from fixture import validate_seed
from isolation import InvalidEvidence, read_regular
from matrix import MATRIX, render_job
from measurements import final_answer, sql_measurements, trajectory_measurements
from preflight import check_runtime
from stage_task import TASKS, stage

HERE = Path(__file__).resolve().parent


def host_environment(source: dict[str, str]) -> dict[str, str]:
    """Keep host runtime/results settings; deny inherited agent auth and config."""
    keep = {
        "PATH",
        "HOME",
        "LANG",
        "LC_ALL",
        "TZ",
        "TMPDIR",
        "PYTHONPATH",
        "DOCKER_HOST",
        "DOCKER_CONTEXT",
        "DOCKER_CONFIG",
        "PHOENIX_API_KEY",
    }
    return {k: v for k, v in source.items() if k in keep} | {
        "OPENAI_API_KEY": "gateway-placeholder",
        "ANTHROPIC_API_KEY": "gateway-placeholder",
    }


def events(path: Path, offset: int = 0) -> list[dict[str, Any]]:
    if not path.exists():
        return []
    with path.open() as stream:
        stream.seek(offset)
        return [json.loads(line) for line in stream if line.strip()]


def require_completed_results(result: Any) -> None:
    if any(trial.exception_info for trial in result.trial_results):
        raise RuntimeError("Benchmark infrastructure failed; inspect the saved trial errors")
    if any(
        not trial.verifier_result or trial.verifier_result.rewards.get("reward") not in (0, 1)
        for trial in result.trial_results
    ):
        raise RuntimeError("Verification is missing a behavioral reward")


async def run_condition(
    condition: str,
    root: Path,
    tasks: list[Path],
    images: dict,
    *,
    seed: Path,
    results: str,
    repetitions: int,
    oracle: bool,
) -> Any:
    run_dir = root / condition
    trusted_root = run_dir / "trusted"
    trusted_root.mkdir(parents=True)
    provider = "anthropic" if condition.startswith("claude") else "openai"
    key_name = "ANTHROPIC_API_KEY" if provider == "anthropic" else "OPENAI_API_KEY"
    settings = {
        "TRUSTED": str(trusted_root),
        "PROVIDER": provider,
        "INTERFACE": condition.rsplit("-", 1)[1],
        "SEED": str(seed),
        "TARGET_IMAGE": images["target"]["id"],
        "GATEWAY_IMAGE": images["gateway"]["id"],
        "CLI_IMAGE": images["cli-broker"]["id"],
    }
    os.environ.update({"MCP_BENCH_" + k: v for k, v in settings.items()})
    os.environ["MCP_BENCH_ACCEPTANCE"] = str(oracle).lower()
    config, plugin_config = render_job(
        condition,
        tasks=tasks[0].parent,
        target_endpoint="http://mcp-gateway:8080",
        results_endpoint=results,
        job_name=root.name + "-" + condition,
    )
    config.jobs_dir = run_dir / "jobs"
    config.n_attempts = repetitions
    config.datasets[0].task_names = [task.name for task in tasks]
    config.environment.import_path = "environment:BenchmarkEnvironment"
    config.environment.kwargs = {
        "agent_image": images[condition]["id"],
        "verifier_image": images["verifier"]["id"],
    }
    agent = config.agents[0]
    if oracle:
        config.agents = [AgentConfig(name="oracle", extra_allowed_hosts=["mcp-gateway"])]
        plugin_config["experiment_name"] = "CLI oracle · acceptance"
        plugin_config["dataset"] += "-acceptance"
    else:
        agent.env |= {
            key_name: "gateway-placeholder",
            "ANTHROPIC_BASE_URL"
            if provider == "anthropic"
            else "OPENAI_BASE_URL": "http://mcp-gateway:8080/provider"
            + ("/v1" if provider == "openai" else ""),
        }
        agent.kwargs["benchmark_image_id"] = images[condition]["id"]
        agent.kwargs["benchmark_target_image_id"] = images["target"]["id"]
        if condition.endswith("-cli"):
            agent.kwargs["benchmark_cli_image_id"] = images["cli-broker"]["id"]
        if provider == "openai":
            agent.kwargs["config"] |= {
                "model_provider": "benchmark",
                "model_providers": {
                    "benchmark": {
                        "name": "Benchmark inference gateway",
                        "base_url": "http://mcp-gateway:8080/provider/v1",
                        "wire_api": "responses",
                        "env_key": "OPENAI_API_KEY",
                        "supports_websockets": False,
                    }
                },
            }
    (run_dir / "config.json").write_text(config.model_dump_json(indent=2))
    job = await Job.create(config)

    async def prepare_verifier(event: Any) -> None:
        trusted = trusted_root / event.trial_name
        if json.loads((trusted / "shutdown.json").read_text())["confirmed"] is not True:
            raise RuntimeError("Agent shutdown was not verified")
        if not all(json.loads((trusted / "isolation.json").read_text()).values()):
            raise RuntimeError("Missing isolation proof")
        task = Path(event.config.task.path).name
        references = json.loads((trusted / "target-evidence/reference.json").read_text())
        (trusted / "reference.json").write_text(json.dumps(references[task]))
        trial_dir = job.job_dir / event.trial_name
        trajectory = None
        try:
            trajectory = json.loads(
                read_regular(trial_dir / "agent", "trajectory.json", limit=32_000_000)
            )
        except (OSError, InvalidEvidence, ValueError):
            pass
        answer = final_answer(trajectory)
        if answer is None:
            try:
                answer = read_regular(trial_dir / "artifacts", "answer.txt").decode()
            except (OSError, InvalidEvidence, UnicodeError):
                pass
        (trusted / "submission.json").write_text(json.dumps({"task": task, "answer": answer}))
        measurements: dict[str, int | None] = {}
        if not oracle:
            measurements.update(trajectory_measurements(trajectory))
        if task not in {"noop-surface-cost", "count-traces", "pagedown-root-cause"}:
            offset = json.loads((trusted / "audit-offsets.json").read_text())[0]
            measurements |= sql_measurements(
                events(trusted / "target-evidence/operations.jsonl", offset)
            )
        (trusted / "measurements.json").write_text(json.dumps(measurements))

    async def close_trial_target(event: Any) -> None:
        for target in list(ACTIVE_TARGETS):
            if target.trusted.name == event.trial_name:
                await target.close_target()
                ACTIVE_TARGETS.remove(target)

    job.on_trial_ended(close_trial_target)
    job.on_trial_cancelled(close_trial_target)
    job.on_verification_started(prepare_verifier)
    plugin = await attach_job_plugin(job, "arize-phoenix", kwargs=plugin_config)
    try:
        result = await job.run()
        await plugin.on_job_end(result)
        (run_dir / "result.json").write_text(result.model_dump_json(indent=2))
        require_completed_results(result)
        return result
    finally:
        while ACTIVE_TARGETS:
            await ACTIVE_TARGETS.pop().close_target()


async def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--condition", choices=MATRIX["conditions"], action="append")
    parser.add_argument("--task", choices=TASKS, action="append")
    parser.add_argument("--seed", required=True, type=Path)
    parser.add_argument("--results", default="http://localhost:6006")
    parser.add_argument("--repetitions", type=int, default=1)
    parser.add_argument("--oracle", action="store_true")
    args = parser.parse_args()
    if args.repetitions < 1:
        parser.error("repetitions must be positive")
    if failures := check_runtime():
        raise RuntimeError("; ".join(failures))
    conditions = args.condition or (["codex-cli"] if args.oracle else MATRIX["conditions"])
    if args.oracle and any(not c.endswith("-cli") for c in conditions):
        parser.error("The reference oracle uses px; select a CLI condition")
    required = {
        "ANTHROPIC_API_KEY" if c.startswith("claude") else "OPENAI_API_KEY" for c in conditions
    }
    if not args.oracle:
        PROVIDER_SECRETS.update({name: os.environ[name] for name in required})
    clean_environment = host_environment(dict(os.environ))
    os.environ.clear()
    os.environ.update(clean_environment)
    os.umask(0o077)
    root = HERE / ".private" / ("run-" + datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ"))
    root.mkdir(parents=True)
    seed = args.seed.resolve()
    manifest = json.loads((seed / "manifest.json").read_text())
    validate_seed(
        json.loads((seed / "payload.json").read_text()),
        manifest,
        json.loads((seed / "truth.json").read_text()),
    )
    images = json.loads((HERE / ".runtime/images/images.json").read_text())
    tasks = stage(
        manifest,
        root / "tasks",
        image="node@sha256:83f487e0a63425e5b4d146fb5e5be574bcbe1b7b843d3ebafdd95eaf7767a7e5",
    )
    selected = set(args.task or [t for t in TASKS if t != "noop-surface-cost"])
    tasks = [t for t in tasks if t.name in selected]
    (root / "planned.json").write_text(
        json.dumps(
            {
                "conditions": conditions,
                "tasks": sorted(selected),
                "repetitions": args.repetitions,
                "oracle": args.oracle,
                "fixture_hash": manifest["fixture_hash"],
                "images": images,
            }
        )
    )
    print(f"Artifacts: {root}", flush=True)
    for condition in conditions:
        print(f"Starting {condition}", flush=True)
        await run_condition(
            condition,
            root,
            tasks,
            images,
            seed=seed,
            results=args.results,
            repetitions=args.repetitions,
            oracle=args.oracle,
        )


if __name__ == "__main__":
    asyncio.run(main())

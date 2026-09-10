"""Run one count task per agent/interface condition, without retries or repetition."""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import shutil
import subprocess
from datetime import datetime, timezone
from pathlib import Path

from harbor.cli.job_plugins import attach_job_plugin
from harbor.job import Job
from phoenix.evals import LLM

from isolation import read_regular
from judge import evaluate_completeness
from matrix import MATRIX, render_job
from preflight import check_runtime
from smoke_state import snapshot, snapshot_review, validate_annotations
from smoke_tasks import stage_review
from stage_task import stage
from trajectory import render_trajectory

HERE = Path(__file__).resolve().parent
PRIVATE = HERE / ".private"
DATABASE = Path.home() / ".phoenix/phoenix.db"
BASE = "node@sha256:83f487e0a63425e5b4d146fb5e5be574bcbe1b7b843d3ebafdd95eaf7767a7e5"


def events(path: Path, offset: int = 0) -> list[dict]:
    if not path.exists():
        return []
    with path.open() as stream:
        stream.seek(offset)
        return [json.loads(line) for line in stream if line.strip()]


def check_fixture(truth: dict, payload: dict) -> dict:
    state = snapshot(DATABASE, truth["project"])
    validate_annotations(DATABASE, state["project_id"], payload)
    expected = {
        "projects": 1,
        "traces": truth["trace_count"],
        "spans": len(truth["span_ids"]),
        # The reusable loader upserts by identifier. Source records with the
        # same identifier are one stored annotation, not multiple rows.
        "span_annotations": len({a["identifier"] for a in payload["span_annotations"]}),
        "trace_annotations": len({a["identifier"] for a in payload["trace_annotations"]}),
    }
    if (
        state["counts"] != expected
        or state["trace_ids"] != truth["trace_ids"]
        or state["span_ids"] != truth["span_ids"]
    ):
        raise RuntimeError("Stored fixture does not match source identities and annotation counts")
    review_path = PRIVATE / "review-fixture.json"
    if review_path.exists():
        state["review_sha256"] = snapshot_review(DATABASE, json.loads(review_path.read_text()))
    return state


async def run_condition(condition: str, root: Path, tasks: list[Path], images: dict, keys: dict):
    run_dir = root / condition
    trusted_root = run_dir / "trusted"
    trusted_root.mkdir(parents=True)
    audit_dir = run_dir / "gateway-audit"
    audit_dir.mkdir()
    truth = json.loads((PRIVATE / "trail/truth.json").read_text())
    payload = json.loads((PRIVATE / "trail/payload.json").read_text())
    before = check_fixture(truth, payload)
    target_audit = PRIVATE / "target-audit.jsonl"
    gateway = "mcp-smoke-gateway-" + root.name + "-" + condition
    provider = "anthropic" if condition.startswith("claude") else "openai"
    key_name = "ANTHROPIC_API_KEY" if provider == "anthropic" else "OPENAI_API_KEY"
    gateway_env = {"PATH": os.environ["PATH"], key_name: keys[key_name]}
    subprocess.run(
        [
            "docker",
            "run",
            "-d",
            "--name",
            gateway,
            "--cap-drop=ALL",
            "--security-opt=no-new-privileges:true",
            "--read-only",
            "-e",
            key_name,
            "-e",
            "PROVIDER=" + provider,
            "-e",
            "INTERFACE=" + condition.rsplit("-", 1)[1],
            "-e",
            "TARGET_URL=http://host.docker.internal:6007",
            "-v",
            str(audit_dir) + ":/audit",
            images["gateway"]["id"],
        ],
        check=True,
        env=gateway_env,
        stdout=subprocess.DEVNULL,
    )
    os.environ["MCP_SMOKE_GATEWAY"] = gateway
    os.environ["MCP_SMOKE_TRUSTED"] = str(trusted_root)
    os.environ["MCP_SMOKE_PROVIDER"] = provider
    os.environ["MCP_SMOKE_TARGET_AUDIT"] = str(target_audit)
    os.environ["MCP_SMOKE_CLI_IMAGE"] = images["cli-broker"]["id"]
    job_config, plugin_config = render_job(
        condition,
        tasks=tasks[0].parent,
        target_endpoint="http://mcp-gateway:8080",
        results_endpoint="http://localhost:6006",
        job_name=root.name + "-" + condition,
    )
    job_config.jobs_dir = run_dir / "jobs"
    job_config.datasets[0].task_names = [task.name for task in tasks]
    job_config.environment.import_path = "smoke_environment:SmokeEnvironment"
    job_config.environment.kwargs = {
        "agent_image": images[condition]["id"],
        "verifier_image": images["verifier"]["id"],
    }
    agent = job_config.agents[0]
    agent.extra_allowed_hosts = ["mcp-gateway"]
    agent.env |= {
        key_name: "smoke-gateway-placeholder",
        "ANTHROPIC_BASE_URL"
        if provider == "anthropic"
        else "OPENAI_BASE_URL": "http://mcp-gateway:8080/provider"
        + ("/v1" if provider == "openai" else ""),
    }
    # Explicitly include image identity in the effective agent configuration
    # that Phoenix uses to distinguish experiments.
    agent.kwargs["smoke_image_id"] = images[condition]["id"]
    if provider == "openai":
        agent.kwargs["config"] |= {
            "model_provider": "smoke",
            "model_providers": {
                "smoke": {
                    "name": "Smoke inference gateway",
                    "base_url": "http://mcp-gateway:8080/provider/v1",
                    "wire_api": "responses",
                    "env_key": "OPENAI_API_KEY",
                    "supports_websockets": False,
                }
            },
        }
    (run_dir / "config.json").write_text(job_config.model_dump_json(indent=2))
    try:
        job = await Job.create(job_config)

        async def prepare_verifier(event):
            trusted = trusted_root / event.trial_name
            task = Path(event.config.task.path)
            shutil.copy(PRIVATE / "trail/truth.json", trusted)
            shutdown = json.loads((trusted / "shutdown.json").read_text())
            if shutdown["confirmed"] is not True:
                raise RuntimeError("Agent shutdown was not verified")
            after = check_fixture(truth, payload)
            offsets = json.loads((trusted / "audit-offsets.json").read_text())
            isolation = json.loads((trusted / "isolation.json").read_text())
            if not all(isolation.values()):
                raise RuntimeError("Missing isolation proof")
            audit = events(target_audit, offsets[0]) + events(
                audit_dir / "gateway.jsonl", offsets[1]
            )
            denied = [item for item in audit if item["kind"] == "denied"]
            evidence = {
                "shutdown_confirmed": True,
                "audit_complete": bool(audit),
                "target_state_complete": True,
                "state_unchanged": before == after,
                "forbidden_attempts": denied,
            }
            (trusted / "evidence.json").write_text(json.dumps(evidence))
            (trusted / "audit.json").write_text(json.dumps(audit))
            (trusted / "state.json").write_text(json.dumps({"before": before, "after": after}))
            trial_dir = job.job_dir / event.trial_name
            answer = json.loads(read_regular(trial_dir / "artifacts", "answer.json"))
            trajectory = json.loads(read_regular(trial_dir / "agent", "trajectory.json"))
            reference = {"project": truth["project"], "trace_count": truth["trace_count"]}
            if task.name != "trace-count":
                reference = json.loads((PRIVATE / "review-fixture.json").read_text())["references"][
                    task.name
                ]
                (trusted / "reference.json").write_text(json.dumps(reference))
            rendered = render_trajectory(
                task.joinpath("instruction.md").read_text(),
                trajectory,
                answer=answer,
                reference=reference,
                target_evidence=audit,
            )
            (trusted / "judge-input.txt").write_text(rendered.text)
            llm = LLM(provider="openai", model="gpt-5.6", api_key=keys["OPENAI_API_KEY"])
            judged = await asyncio.to_thread(evaluate_completeness, rendered, llm)
            (trusted / "judge.json").write_text(json.dumps(judged, default=str))

        job.on_verification_started(prepare_verifier)
        plugin = await attach_job_plugin(job, "arize-phoenix", kwargs=plugin_config)
        result = await job.run()
        await plugin.on_job_end(result)
        (run_dir / "result.json").write_text(result.model_dump_json(indent=2))
        if any(trial.exception_info for trial in result.trial_results):
            raise RuntimeError("Smoke infrastructure failed; fix it before advancing the matrix")
        if any(
            not trial.verifier_result or trial.verifier_result.rewards.get("reward") != 1
            for trial in result.trial_results
        ):
            raise RuntimeError("Smoke verification failed; inspect it before advancing the matrix")
        return result
    finally:
        subprocess.run(["docker", "stop", gateway], check=True, stdout=subprocess.DEVNULL)
        subprocess.run(["docker", "rm", gateway], check=True, stdout=subprocess.DEVNULL)


async def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--condition", choices=MATRIX["conditions"], action="append")
    parser.add_argument("--suite", choices=("count", "review"), default="count")
    parser.add_argument(
        "--task",
        choices=("trace-count", "trace-review", "annotation-review", "experiment-review"),
        action="append",
    )
    args = parser.parse_args()
    if failures := check_runtime():
        raise RuntimeError("; ".join(failures))
    conditions = args.condition or MATRIX["conditions"]
    required_keys = {"OPENAI_API_KEY"}
    if any(condition.startswith("claude-") for condition in conditions):
        required_keys.add("ANTHROPIC_API_KEY")
    keys = {name: os.environ[name] for name in required_keys}
    # Adapters get only placeholders, even if they fall back to process env.
    for name in ("OPENAI_API_KEY", "ANTHROPIC_API_KEY"):
        os.environ[name] = "smoke-gateway-placeholder"
    os.umask(0o077)
    root = PRIVATE / ("sample-" + datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ"))
    root.mkdir()
    images = json.loads((HERE / ".runtime/smoke-images/images.json").read_text())
    manifest = json.loads((PRIVATE / "trail/manifest.json").read_text())
    if args.suite == "review":
        fixture = json.loads((PRIVATE / "review-fixture.json").read_text())
        tasks = stage_review(manifest, fixture, root / "review", image=BASE)
    else:
        tasks = [stage(manifest, root / "tasks", agent_image=BASE, verifier_image=BASE)]
    if args.task:
        tasks = [task for task in tasks if task.name in args.task]
        if {task.name for task in tasks} != set(args.task):
            raise ValueError("Selected task does not belong to this suite")
    (root / "planned.json").write_text(
        json.dumps(
            {
                "conditions": conditions,
                "tasks": [t.name for t in tasks],
                "attempts": 1,
                "retries": 0,
            }
        )
    )
    print(f"Sample artifacts: {root}", flush=True)
    for condition in conditions:
        print(f"Starting {condition}: one attempt per task", flush=True)
        await run_condition(condition, root, tasks, images, keys)


if __name__ == "__main__":
    asyncio.run(main())

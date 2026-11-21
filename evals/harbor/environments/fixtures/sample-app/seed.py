"""Create the sample-app Phoenix fixture.

The script starts a scratch Phoenix server and the fake LLM gateway, runs the instrumented
support bot `ROUNDS` times, and uploads the datasets in `datasets.json`. It then records
one judge experiment on the labeled dataset and moves the checkpointed database to
`--output`. A `summary.json` beside the database lists the counts that tasks rely on.

Run it with `uv run` from the repository root so that it uses Phoenix from this checkout.
No model provider is called: the bot talks only to the fake gateway.
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
import socket
import sqlite3
import subprocess
import sys
import tempfile
import time
import urllib.request
import uuid
from pathlib import Path
from typing import Any, Callable

HERE = Path(__file__).resolve().parent
WORKDIR = HERE / "workdir"
PROJECT = "support-bot"
ROUNDS = 4
JUDGE_EXPERIMENT = "groundedness-judge-v1"


def free_port() -> int:
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return int(sock.getsockname()[1])


def healthy(url: str) -> bool:
    try:
        with urllib.request.urlopen(url, timeout=3) as response:
            return bool(response.status == 200)
    except Exception:
        return False


def wait_for(predicate: Callable[[], bool], *, timeout: float, what: str) -> None:
    deadline = time.monotonic() + timeout
    while not predicate():
        if time.monotonic() >= deadline:
            raise TimeoutError(what)
        time.sleep(1)


def run_bot(base: str, gateway_port: int) -> dict[str, int]:
    """Runs every conversation `ROUNDS` times and returns the expected trace counts."""
    os.environ["ACME_LLM_GATEWAY_URL"] = f"http://127.0.0.1:{gateway_port}/v1"
    sys.path[:0] = [str(WORKDIR), str(HERE / "reference")]
    import support_bot
    from instrument import instrument

    provider = instrument(support_bot, PROJECT, f"{base}/v1/traces")
    bot = support_bot.SupportBot()
    for _ in range(ROUNDS):
        for questions in support_bot.CONVERSATIONS:
            bot.chat(str(uuid.uuid4()), questions)
    provider.force_flush()
    questions = [q for conversation in support_bot.CONVERSATIONS for q in conversation]
    return {
        "traces": ROUNDS * len(questions),
        "sessions": ROUNDS * len(support_bot.CONVERSATIONS),
        "rate_limited_traces": ROUNDS * sum("every store policy" in q for q in questions),
        "bad_column_traces": ROUNDS * sum("emails" in q for q in questions),
    }


def upload_datasets(base: str) -> dict[str, Any]:
    """Uploads the datasets and records the judge experiment on the labeled one."""
    from phoenix.client import Client

    client = Client(base_url=base)
    specs = json.loads((HERE / "datasets.json").read_text())
    datasets = {}
    for name, spec in specs.items():
        datasets[name] = client.datasets.create_dataset(
            name=name,
            inputs=[example["input"] for example in spec["examples"]],
            outputs=[example["output"] for example in spec["examples"]],
            dataset_description=spec["description"],
        )
    verdicts = {
        example["input"]["answer"]: example["judge"]
        for example in specs["support-answers-labeled"]["examples"]
    }

    def groundedness(output: Any) -> dict[str, Any]:
        label = verdicts[output]
        return {"label": label, "score": float(label == "grounded")}

    client.experiments.run_experiment(
        dataset=datasets["support-answers-labeled"],
        task=lambda input: input["answer"],
        evaluators={"groundedness": groundedness},
        experiment_name=JUDGE_EXPERIMENT,
        print_summary=False,
    )
    return {name: len(spec["examples"]) for name, spec in specs.items()}


def trace_count(base: str) -> int:
    query = "{ projects(first: 20) { edges { node { name traceCount } } } }"
    request = urllib.request.Request(
        base + "/graphql",
        data=json.dumps({"query": query}).encode(),
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(request, timeout=10) as response:
        edges = json.load(response)["data"]["projects"]["edges"]
    return next((e["node"]["traceCount"] for e in edges if e["node"]["name"] == PROJECT), 0)


def seed(output: Path) -> dict[str, Any]:
    port, grpc_port, gateway_port = free_port(), free_port(), free_port()
    base = f"http://127.0.0.1:{port}"
    with tempfile.TemporaryDirectory(prefix="phoenix-sample-app-seed-") as scratch:
        database = Path(scratch) / "phoenix.db"
        env = {
            **os.environ,
            "PHOENIX_WORKING_DIR": scratch,
            "PHOENIX_SQL_DATABASE_URL": f"sqlite:///{database}",
            "PHOENIX_PORT": str(port),
            "PHOENIX_GRPC_PORT": str(grpc_port),
            "PHOENIX_TELEMETRY_ENABLED": "false",
            "PHOENIX_DISABLE_AGENT_ASSISTANT": "true",
        }
        log_path = Path(scratch) / "phoenix.log"
        with open(log_path, "w") as log:
            server = subprocess.Popen(
                ["phoenix", "serve", "--no-ui"], env=env, stdout=log, stderr=subprocess.STDOUT
            )
            gateway = subprocess.Popen(
                [
                    sys.executable,
                    str(WORKDIR / "dev" / "fake_gateway.py"),
                    "--port",
                    str(gateway_port),
                ]
            )
            try:
                wait_for(
                    lambda: healthy(base + "/healthz"), timeout=120, what="Phoenix did not start"
                )
                wait_for(
                    lambda: healthy(f"http://127.0.0.1:{gateway_port}/healthz"),
                    timeout=30,
                    what="The fake gateway did not start",
                )
                summary: dict[str, Any] = {"project": PROJECT, **run_bot(base, gateway_port)}
                wait_for(
                    lambda: trace_count(base) == summary["traces"],
                    timeout=120,
                    what="Seeded traces did not appear",
                )
                summary["datasets"] = upload_datasets(base)
                summary["judge_experiment"] = JUDGE_EXPERIMENT
            except BaseException:
                print(log_path.read_text()[-4000:], file=sys.stderr)
                raise
            finally:
                gateway.terminate()
                server.terminate()
                try:
                    server.wait(timeout=60)
                except subprocess.TimeoutExpired:
                    server.kill()
        with sqlite3.connect(database) as connection:
            connection.execute("PRAGMA wal_checkpoint(TRUNCATE)")
        for sidecar in (database.with_suffix(".db-wal"), database.with_suffix(".db-shm")):
            sidecar.unlink(missing_ok=True)
        output.parent.mkdir(parents=True, exist_ok=True)
        shutil.move(str(database), output)
    return summary


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, required=True, help="where to write phoenix.db")
    args = parser.parse_args()
    summary = seed(args.output)
    args.output.with_name("summary.json").write_text(json.dumps(summary, indent=2) + "\n")
    print(json.dumps(summary))


if __name__ == "__main__":
    main()

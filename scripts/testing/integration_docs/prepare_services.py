#!/usr/bin/env python3
"""Start and warm local services required by the selected integration shard."""

from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[3]
CONFIG_PATH = Path(__file__).with_name("integrations.json")


def ollama_is_ready() -> bool:
    try:
        with urllib.request.urlopen("http://127.0.0.1:11434/api/tags", timeout=2) as response:
            return response.status == 200
    except (OSError, urllib.error.URLError):
        return False


def install_ollama() -> None:
    if shutil.which("ollama"):
        return
    if not sys.platform.startswith("linux"):
        raise RuntimeError("Ollama is required but is not installed; install it from https://ollama.com/download")
    print("Installing Ollama with the official Linux installer")
    with urllib.request.urlopen("https://ollama.com/install.sh", timeout=30) as response:
        installer = response.read().decode("utf-8")
    subprocess.run(["sh"], input=installer, text=True, check=True, timeout=600)


def ensure_ollama(model: str) -> None:
    install_ollama()
    env = os.environ.copy()
    env.setdefault("OLLAMA_HOST", "127.0.0.1:11434")
    process: subprocess.Popen[bytes] | None = None
    log_path = Path(os.environ.get("RUNNER_TEMP", "/tmp")) / "ollama-serve.log"
    log_file = log_path.open("ab")
    try:
        if not ollama_is_ready():
            print("Starting local Ollama server")
            process = subprocess.Popen(
                ["ollama", "serve"],
                env=env,
                stdout=log_file,
                stderr=subprocess.STDOUT,
                start_new_session=True,
            )
        deadline = time.monotonic() + 120
        while time.monotonic() < deadline and not ollama_is_ready():
            if process and process.poll() is not None and not ollama_is_ready():
                raise RuntimeError(f"Ollama server exited early; see {log_path}")
            time.sleep(2)
        if not ollama_is_ready():
            raise RuntimeError(f"Ollama server did not become ready; see {log_path}")

        result = subprocess.run(
            ["ollama", "list"], capture_output=True, text=True, check=True, env=env, timeout=30
        )
        installed_models = {line.split()[0] for line in result.stdout.splitlines()[1:] if line.split()}
        if model not in installed_models:
            print(f"Pulling Ollama model {model}")
            subprocess.run(
                ["ollama", "pull", model], check=True, env=env, timeout=1800
            )
        else:
            print(f"Ollama model {model} is already available")
        print(f"Ollama is ready with model {model}")
    finally:
        log_file.close()
        # Keep a server started here alive for the next workflow step.
        # The runner cleans up the VM after the job ends.


def selected_services(docs: list[str], shard_index: int, shard_total: int) -> list[dict[str, Any]]:
    config = json.loads(CONFIG_PATH.read_text())
    specs = {item["document"]: item for item in config["integrations"]}
    assigned = [doc for index, doc in enumerate(docs) if index % shard_total == shard_index - 1]
    services = []
    seen = set()
    for doc in assigned:
        for service in specs.get(doc, {}).get("services", []):
            identity = (service.get("kind"), service.get("model"))
            if identity not in seen:
                services.append(service)
                seen.add(identity)
    return services


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--docs-file", type=Path, required=True)
    parser.add_argument("--shard", required=True, help="Shard index/total, 1-based")
    args = parser.parse_args()
    try:
        docs = json.loads(args.docs_file.read_text())
        if not isinstance(docs, list) or not all(isinstance(doc, str) for doc in docs):
            raise ValueError("Docs file must contain an array of paths")
        index_text, total_text = args.shard.split("/", maxsplit=1)
        shard_index, shard_total = int(index_text), int(total_text)
        if shard_total < 1 or not 1 <= shard_index <= shard_total:
            raise ValueError("Shard index must be between 1 and the positive shard total")
        services = selected_services(docs, shard_index, shard_total)
        if not services:
            print(f"Shard {args.shard} requires no local services")
            return 0
        for service in services:
            if service.get("kind") != "ollama" or not service.get("model"):
                raise ValueError(f"Unsupported or incomplete service declaration: {service!r}")
            ensure_ollama(str(service["model"]))
        return 0
    except (OSError, json.JSONDecodeError, ValueError, KeyError, RuntimeError, subprocess.SubprocessError) as exc:
        print(f"integration-docs services: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())

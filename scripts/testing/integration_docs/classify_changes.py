#!/usr/bin/env python3
"""Classify a GitHub event into full, changed-doc, or no-op integration runs.

The enabled integration inventory is integrations.json. CI uses this classifier
to avoid spending API calls on unrelated changes and to fan selected docs out
across deterministic shards.
"""

from __future__ import annotations

import json
import os
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
CONFIG = ROOT / "scripts/testing/integration_docs/integrations.json"
INVENTORY = ".agents/skills/test-integration/INTEGRATION_CHECKS.md"
SKIP_CONFIG = ".agents/skills/test-integration/scripts/skip_config.json"
SHARD_LIMIT = 12
SHARED_DOC_SCOPES = {
    "docs/snippets/register-tracer-python.mdx": {
        "docs/phoenix/integrations/llm-providers/openai/openai-tracing.mdx"
    }
}
FULL_RUN_FILES = {
    "Makefile",
    "scripts/testing/integration_docs/run.py",
    "scripts/testing/integration_docs/classify_changes.py",
    "scripts/testing/integration_docs/aggregate.py",
    "scripts/testing/integration_docs/integrations.json",
    ".github/workflows/integration-docs.yml",
}


def enabled_docs() -> list[str]:
    config = json.loads(CONFIG.read_text())
    return [item["document"] for item in config["integrations"]]


def changed_files() -> list[str]:
    event_path = os.environ.get("GITHUB_EVENT_PATH")
    if event_path and Path(event_path).is_file():
        event = json.loads(Path(event_path).read_text())
        pull_request = event.get("pull_request", {})
        base = pull_request.get("base", {}).get("sha")
        head = pull_request.get("head", {}).get("sha")
        if base and head:
            result = subprocess.run(
                ["git", "diff", "--name-only", "--diff-filter=ACMRT", f"{base}..{head}"],
                cwd=ROOT,
                capture_output=True,
                text=True,
                check=True,
            )
            return [line for line in result.stdout.splitlines() if line]
    return []


def skip_routing(config: dict) -> dict[str, tuple]:
    allowed = {"_comment_", "always_skip", "lint_only", "skip_if_missing_env"}
    if set(config) - allowed:
        raise ValueError("skip_config.json has unknown top-level keys")
    routing = {}
    for category in ("always_skip", "lint_only", "skip_if_missing_env"):
        entries = config.get(category, [])
        if not isinstance(entries, list):
            raise ValueError(f"skip_config.json {category} must be a list")
        for entry in entries:
            if not isinstance(entry, dict) or not isinstance(entry.get("doc"), str):
                raise ValueError(f"Invalid {category} entry in skip_config.json")
            routing[entry["doc"]] = (
                category,
                entry.get("kind") if category == "always_skip" else None,
                tuple(sorted(entry.get("env_vars", [])))
                if category == "skip_if_missing_env"
                else None,
            )
    return routing


def changed_skip_routes() -> set[str] | None:
    event_path = os.environ.get("GITHUB_EVENT_PATH")
    try:
        event = json.loads(Path(event_path).read_text()) if event_path else {}
        base = event.get("pull_request", {}).get("base", {}).get("sha")
        if not base:
            return None
        previous = subprocess.run(
            ["git", "show", f"{base}:{SKIP_CONFIG}"],
            cwd=ROOT,
            capture_output=True,
            text=True,
            check=True,
        )
        before = skip_routing(json.loads(previous.stdout))
        after = skip_routing(json.loads((ROOT / SKIP_CONFIG).read_text()))
        return {doc for doc in set(before) | set(after) if before.get(doc) != after.get(doc)}
    except (
        OSError,
        ValueError,
        TypeError,
        KeyError,
        json.JSONDecodeError,
        subprocess.CalledProcessError,
    ):
        return None


def classify() -> tuple[str, list[str], str]:
    event = os.environ.get("GITHUB_EVENT_NAME", "")
    docs = enabled_docs()
    if event in {"schedule", "workflow_dispatch"}:
        requested = os.environ.get("INPUT_DOCS", "").strip()
        if requested:
            selected = requested.split()
            unknown = sorted(set(selected) - set(docs))
            if unknown:
                raise ValueError(f"Requested docs are not enabled in integrations.json: {unknown}")
            return "changed", [doc for doc in docs if doc in selected], "manual dispatch selected docs"
        return "all", docs, f"event={event} runs all enabled integration docs"
    if event != "pull_request":
        return "all", docs, f"unknown event {event!r}; running all enabled docs"

    changed = changed_files()
    generic_harness_paths = (
        "scripts/testing/integration_docs/",
        ".agents/skills/test-integration/",
        ".github/workflows/integration-docs.yml",
    )
    if any(
        path in FULL_RUN_FILES
        or (
            path.startswith(generic_harness_paths)
            and path != INVENTORY
            and path != SKIP_CONFIG
            and not path.endswith(".pyc")
        )
        for path in changed
    ):
        return "all", docs, "integration harness, configuration, workflow, or Makefile changed"
    if SKIP_CONFIG in changed:
        routes = changed_skip_routes()
        if routes is None:
            return "all", docs, "skip routing configuration could not be safely classified"
        scoped = [doc for doc in docs if doc in routes]
        if scoped:
            return "changed", scoped, f"skip routing changed for {len(scoped)} enabled document(s)"
    selected = {path for path in changed if path in docs}
    for path in changed:
        selected.update(SHARED_DOC_SCOPES.get(path, set()))
    if selected:
        ordered = [doc for doc in docs if doc in selected]
        return "changed", ordered, f"{len(ordered)} enabled integration document(s) changed"
    return "none", [], "no enabled integration docs or harness files changed"


def main() -> int:
    mode, docs, reason = classify()
    # Full runs are split to the smallest number of shards that can distribute
    # the enabled inventory; changed-doc runs use one shard per selected doc.
    total = max(1, min(SHARD_LIMIT, len(docs)))
    outputs = {
        "run_mode": mode,
        "runnable_docs": json.dumps(docs),
        "shard_list": json.dumps(list(range(1, total + 1))),
        "shard_total": str(total),
        "reason": reason,
    }
    for key, value in outputs.items():
        print(f"{key}={value}")
    output = os.environ.get("GITHUB_OUTPUT")
    if output:
        with open(output, "a") as handle:
            for key, value in outputs.items():
                handle.write(f"{key}={value}\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

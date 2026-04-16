# /// script
# dependencies = []
# ///
"""Run each span-filter prompt through one or more agent backends
(Claude Code, Codex CLI) and capture raw JSONL transcripts.

Contract per run:

- Fresh, context-free agent session (``--no-session-persistence`` /
  ``--ephemeral``, dedicated temp cwd, no settings sources, no resume).
- Agent receives exactly three inputs: the OpenAPI schema, one prompt,
  and the Phoenix base URL.
- Agent chooses how to call the HTTP API (curl via Bash / shell).

Transcripts land at ``<out-dir>/<agent>/<prompt>.jsonl``. They are meant
to be reviewed by a human; this script does no extraction or scoring.
"""

from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
import tempfile
import time
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
OPENAPI_SCHEMA_PATH = REPO_ROOT / "schemas" / "openapi.json"
DEFAULT_BASE_URL = "http://localhost:6006"
DEFAULT_OUT_DIR = Path(__file__).with_name("trial-runs")

_PROJECT = "agent-trial-attribute-filter"
_SUFFIX = "Return the URL you would call and the row count returned."
PROMPTS: dict[str, str] = {
    "P1": f"Find all spans in the `{_PROJECT}` project where the user id is `user-42`. {_SUFFIX}",
    "P2": f"Find all spans in the `{_PROJECT}` project where the user id is `12345`. {_SUFFIX}",
    "P3": (
        f"Find all spans in the `{_PROJECT}` project belonging to session `sess:abc:123`. {_SUFFIX}"
    ),
    "P4": f"Find all spans in the `{_PROJECT}` project whose metadata tier is `premium`. {_SUFFIX}",
    "P5": (
        f"Find all spans in the `{_PROJECT}` project tagged with `prod`. "
        f"The project uses standard OpenInference `tag.tags` attributes. {_SUFFIX}"
    ),
    "P6": (
        f"Find all spans in the `{_PROJECT}` project where "
        f"`metadata.start_time` is `2026-04-16T10:30:00Z`. {_SUFFIX}"
    ),
    "P7": (
        f"Find all spans in the `{_PROJECT}` project for user `user-42` in "
        f"session `sess:abc:123` where the metadata tier is `premium`. {_SUFFIX}"
    ),
}

USER_TEMPLATE = """You are evaluating a local Phoenix HTTP API.

Phoenix base URL: {base_url}

TASK: {prompt}

Rules:
- Use the OpenAPI schema below (and nothing else) to figure out the correct
  request shape.
- You may call the API yourself (curl or equivalent) to verify.
- End your response with a single line in this exact shape:
    FINAL: <method> <url> rows=<n>

---BEGIN openapi.json---
{openapi_json}
---END openapi.json---
"""


def run_agent(
    backend: str, model: str | None, user_message: str, log_path: Path, timeout_s: float
) -> int:
    """Spawn the agent, stream stdout to ``log_path``, return exit code."""
    if backend == "claude":
        cmd = [
            "claude",
            "-p",
            "--model",
            model or "sonnet",
            "--no-session-persistence",
            "--setting-sources",
            "",
            "--output-format",
            "stream-json",
            "--verbose",
            "--disallowedTools",
            "Write,Edit,NotebookEdit,Task,Skill",
            "--permission-mode",
            "bypassPermissions",
        ]
        stdin = user_message
        args = []
    elif backend == "codex":
        cmd = [
            "codex",
            "exec",
            "--json",
            "--ephemeral",
            "--skip-git-repo-check",
            "--dangerously-bypass-approvals-and-sandbox",
            "--color",
            "never",
        ]
        if model:
            cmd += ["--model", model]
        stdin = None
        args = [user_message]
    else:
        raise SystemExit(f"unknown backend: {backend!r}")

    with tempfile.TemporaryDirectory(prefix=f"agent-trial-{backend}-") as tmp_cwd:
        with log_path.open("w") as out:
            proc = subprocess.Popen(
                cmd + args,
                cwd=tmp_cwd,
                stdin=subprocess.PIPE if stdin else None,
                stdout=out,
                stderr=subprocess.DEVNULL,
                text=True,
            )
            if stdin:
                assert proc.stdin is not None
                proc.stdin.write(stdin)
                proc.stdin.close()
            try:
                return proc.wait(timeout=timeout_s)
            except subprocess.TimeoutExpired:
                proc.kill()
                proc.wait()
                return -1


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--agents",
        default="claude:claude-opus-4-7,claude:claude-sonnet-4-6,claude:claude-haiku-4-5-20251001,codex",
        help="Comma-separated list of <backend>[:<model>] specs.",
    )
    parser.add_argument(
        "--prompts", default=",".join(PROMPTS.keys()), help="Comma-separated prompt IDs."
    )
    parser.add_argument("--base-url", default=os.environ.get("PHOENIX_BASE_URL", DEFAULT_BASE_URL))
    parser.add_argument(
        "--timeout-s", type=float, default=180.0, help="Per-trial timeout in seconds."
    )
    parser.add_argument(
        "--out-dir", default=str(DEFAULT_OUT_DIR), help="Directory for per-trial JSONL logs."
    )
    args = parser.parse_args()

    if not OPENAPI_SCHEMA_PATH.exists():
        print(f"error: openapi schema not found at {OPENAPI_SCHEMA_PATH}", file=sys.stderr)
        return 2
    openapi_json = OPENAPI_SCHEMA_PATH.read_text()

    out_root = Path(args.out_dir)
    out_root.mkdir(parents=True, exist_ok=True)

    agent_specs = [a.strip() for a in args.agents.split(",") if a.strip()]
    prompt_ids = [p.strip() for p in args.prompts.split(",") if p.strip()]

    for pid in prompt_ids:
        if pid not in PROMPTS:
            raise SystemExit(f"unknown prompt id: {pid!r}")

    if not shutil.which("claude") and any(a.startswith("claude") for a in agent_specs):
        print("warning: `claude` CLI not on PATH", file=sys.stderr)
    if not shutil.which("codex") and any(a.startswith("codex") for a in agent_specs):
        print("warning: `codex` CLI not on PATH", file=sys.stderr)

    for agent in agent_specs:
        backend, _, model = agent.partition(":")
        agent_id = f"{backend}-{model or 'default'}"
        agent_dir = out_root / agent_id
        agent_dir.mkdir(parents=True, exist_ok=True)
        for pid in prompt_ids:
            log_path = agent_dir / f"{pid}.jsonl"
            user_message = USER_TEMPLATE.format(
                base_url=args.base_url.rstrip("/"),
                prompt=PROMPTS[pid],
                openapi_json=openapi_json,
            )
            t0 = time.monotonic()
            exit_code = run_agent(backend, model or None, user_message, log_path, args.timeout_s)
            wall = time.monotonic() - t0
            print(
                f"[trial] {agent_id}/{pid} wall={wall:.1f}s exit={exit_code} → {log_path}",
                file=sys.stderr,
            )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

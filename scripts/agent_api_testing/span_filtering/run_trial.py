# /// script
# dependencies = [
#   "httpx",
# ]
# ///
"""Automated Phase 2 trial harness — runs each prompt through multiple
agent backends (Claude Code at varying model sizes, Codex CLI) and records
structured JSONL transcripts.

Plan: _work/agent-usability-testing-attribute-filter-param/plan.md (task
#10 automation). The harness preserves the Plan D4 constraints:

- Each agent invocation starts a fresh, context-free session
  (`--no-session-persistence` / `--ephemeral`, dedicated cwd per run, no
  settings sources, no resume).
- Each agent receives EXACTLY three inputs: the OpenAPI schema, one prompt,
  and the Phoenix base URL. No hints, no rubric, no plan excerpts.
- The agent decides whether and how to call the HTTP API (Bash/curl for
  Claude, shell for Codex).

Transcripts land under ``<work_dir>/trial-runs/<agent>/<prompt>.jsonl`` and
are consumed by ``score_trial.py`` (task #11) to emit ``trial-results.md``.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable

REPO_ROOT = Path(__file__).resolve().parents[3]
OPENAPI_SCHEMA_PATH = REPO_ROOT / "schemas" / "openapi.json"
PROMPTS_MD = Path(__file__).with_name("prompts.md")

DEFAULT_BASE_URL = "http://localhost:6006"
DEFAULT_PROJECT = "agent-trial-attribute-filter"

# Agent-facing prompts, mirroring prompts.md verbatim. IDs match the plan.
PROMPTS: dict[str, str] = {
    "P1": (
        "Find all spans in the `agent-trial-attribute-filter` project where "
        "the user id is `user-42`. Return the URL you would call and the row "
        "count returned."
    ),
    "P2": (
        "Find all spans in the `agent-trial-attribute-filter` project where "
        "the user id is `12345`. Return the URL you would call and the row "
        "count returned."
    ),
    "P3": (
        "Find all spans in the `agent-trial-attribute-filter` project "
        "belonging to session `sess:abc:123`. Return the URL you would call "
        "and the row count returned."
    ),
    "P4": (
        "Find all spans in the `agent-trial-attribute-filter` project whose "
        "metadata tier is `premium`. Return the URL you would call and the "
        "row count returned."
    ),
    "P5": (
        "Find all spans in the `agent-trial-attribute-filter` project tagged "
        "with `prod`. The project uses standard OpenInference `tag.tags` "
        "attributes. Return the URL you would call and the row count "
        "returned."
    ),
    "P6": (
        "Find all spans in the `agent-trial-attribute-filter` project where "
        "`metadata.start_time` is `2026-04-16T10:30:00Z`. Return the URL you "
        "would call and the row count returned."
    ),
    "P7": (
        "Find all spans in the `agent-trial-attribute-filter` project for "
        "user `user-42` in session `sess:abc:123` where the metadata tier is "
        "`premium`. Return the URL you would call and the row count returned."
    ),
}


USER_TEMPLATE = """You are evaluating a local Phoenix HTTP API.

Phoenix base URL: {base_url}

TASK: {prompt}

Rules:
- Use the OpenAPI schema below (and nothing else) to figure out the correct
  request shape.
- You may call the API yourself (e.g. with curl or a built-in HTTP tool) to
  verify. The server and network are reachable.
- When you are done, output a short final answer in this exact shape on the
  last line:
    FINAL: <method> <url> rows=<n>
  where <url> is the full URL you believe answers the task and <n> is the
  number of rows returned by that URL. If you conclude the answer is that
  zero rows match, still report the URL you called and rows=0.

---BEGIN openapi.json---
{openapi_json}
---END openapi.json---
"""


@dataclass(frozen=True)
class TrialSpec:
    agent_id: str  # e.g. "claude-opus-4-7" or "codex"
    backend: str  # "claude" or "codex"
    model: str | None  # model name for the backend (None = backend default)
    prompt_id: str
    prompt_text: str


def build_user_message(prompt_text: str, base_url: str, openapi_json: str) -> str:
    return USER_TEMPLATE.format(
        base_url=base_url.rstrip("/"),
        prompt=prompt_text,
        openapi_json=openapi_json,
    )


# ---------------------------------------------------------------------------
# Claude Code invocation
# ---------------------------------------------------------------------------


def run_claude(
    spec: TrialSpec,
    user_message: str,
    log_path: Path,
    timeout_s: float,
) -> dict[str, Any]:
    """Invoke ``claude -p`` in stream-json mode and record every event to
    ``log_path`` as JSONL.

    Returns a summary dict with parsed URL attempts and the final answer.
    """
    with tempfile.TemporaryDirectory(prefix="agent-trial-claude-") as tmp_cwd:
        cmd = [
            "claude",
            "-p",
            "--model",
            spec.model or "sonnet",
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
        t0 = time.monotonic()
        events: list[dict[str, Any]] = []
        final_text = ""
        exit_code: int | None = None
        try:
            proc = subprocess.Popen(
                cmd,
                cwd=tmp_cwd,
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
            )
            assert proc.stdin is not None and proc.stdout is not None
            proc.stdin.write(user_message)
            proc.stdin.close()
            try:
                for line in proc.stdout:
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        evt = json.loads(line)
                    except json.JSONDecodeError:
                        continue
                    events.append(evt)
                    if evt.get("type") == "result" and "result" in evt:
                        final_text = evt.get("result", "") or final_text
                exit_code = proc.wait(timeout=timeout_s)
            except subprocess.TimeoutExpired:
                proc.kill()
                proc.wait()
                exit_code = -1
        finally:
            pass
        wall_s = time.monotonic() - t0

    url_attempts = _extract_url_attempts_from_claude(events)
    with log_path.open("w") as f:
        for evt in events:
            f.write(json.dumps(evt) + "\n")
    return {
        "backend": "claude",
        "agent_id": spec.agent_id,
        "model": spec.model,
        "prompt_id": spec.prompt_id,
        "wall_s": round(wall_s, 2),
        "exit_code": exit_code,
        "final_text": final_text,
        "url_attempts": url_attempts,
        "events_count": len(events),
    }


def _extract_url_attempts_from_claude(events: Iterable[dict[str, Any]]) -> list[dict[str, Any]]:
    """Walk through stream-json events and extract every HTTP request the
    agent tried to make, via Bash(curl ...), WebFetch, or Bash(... with URL).

    Each attempt: {"url": str, "tool": str, "tool_input": dict, "result_text": str}.
    """
    attempts: list[dict[str, Any]] = []
    pending_by_id: dict[str, dict[str, Any]] = {}

    for evt in events:
        if evt.get("type") != "assistant":
            # Tool results come back inside "user" events
            if evt.get("type") == "user":
                msg = evt.get("message", {})
                for block in msg.get("content") or []:
                    if block.get("type") == "tool_result":
                        tuid = block.get("tool_use_id")
                        if tuid and tuid in pending_by_id:
                            pending = pending_by_id[tuid]
                            result = block.get("content")
                            if isinstance(result, list):
                                pending["result_text"] = "\n".join(
                                    r.get("text", "") for r in result if isinstance(r, dict)
                                )
                            elif isinstance(result, str):
                                pending["result_text"] = result
                            attempts.append(pending)
                            pending_by_id.pop(tuid, None)
            continue
        msg = evt.get("message", {})
        for block in msg.get("content") or []:
            if block.get("type") != "tool_use":
                continue
            name = block.get("name", "")
            tool_input = block.get("input", {}) or {}
            tool_use_id = block.get("id")
            url = _detect_url(name, tool_input)
            if url is None:
                continue
            pending_by_id[tool_use_id] = {
                "tool": name,
                "tool_input": tool_input,
                "url": url,
                "result_text": "",
            }

    # Any attempts whose tool_result didn't come back are still recorded
    for pending in pending_by_id.values():
        attempts.append(pending)
    return attempts


_URL_RE = re.compile(r"https?://[^\s'\"`<>|)\\]+")


def _detect_url(tool_name: str, tool_input: dict[str, Any]) -> str | None:
    if tool_name == "WebFetch":
        url = tool_input.get("url")
        if isinstance(url, str) and url.startswith("http"):
            return url
    if tool_name == "Bash":
        command = tool_input.get("command", "") or ""
        # curl and similar — pull out the first URL we see
        match = _URL_RE.search(command)
        if match:
            return match.group(0)
    return None


# ---------------------------------------------------------------------------
# Codex CLI invocation
# ---------------------------------------------------------------------------


def run_codex(
    spec: TrialSpec,
    user_message: str,
    log_path: Path,
    timeout_s: float,
) -> dict[str, Any]:
    with tempfile.TemporaryDirectory(prefix="agent-trial-codex-") as tmp_cwd:
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
        if spec.model:
            cmd += ["--model", spec.model]
        t0 = time.monotonic()
        events: list[dict[str, Any]] = []
        exit_code: int | None = None
        try:
            proc = subprocess.Popen(
                cmd + [user_message],
                cwd=tmp_cwd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
            )
            assert proc.stdout is not None
            try:
                for line in proc.stdout:
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        evt = json.loads(line)
                    except json.JSONDecodeError:
                        continue
                    events.append(evt)
                exit_code = proc.wait(timeout=timeout_s)
            except subprocess.TimeoutExpired:
                proc.kill()
                proc.wait()
                exit_code = -1
        finally:
            pass
        wall_s = time.monotonic() - t0

    final_text = _extract_codex_final_text(events)
    url_attempts = _extract_url_attempts_from_codex(events)
    with log_path.open("w") as f:
        for evt in events:
            f.write(json.dumps(evt) + "\n")
    return {
        "backend": "codex",
        "agent_id": spec.agent_id,
        "model": spec.model,
        "prompt_id": spec.prompt_id,
        "wall_s": round(wall_s, 2),
        "exit_code": exit_code,
        "final_text": final_text,
        "url_attempts": url_attempts,
        "events_count": len(events),
    }


def _extract_codex_final_text(events: Iterable[dict[str, Any]]) -> str:
    last_text = ""
    for evt in events:
        if evt.get("type") != "item.completed":
            continue
        item = evt.get("item", {})
        if item.get("type") == "agent_message":
            text = item.get("text", "")
            if text:
                last_text = text
    return last_text


def _extract_url_attempts_from_codex(events: Iterable[dict[str, Any]]) -> list[dict[str, Any]]:
    attempts: list[dict[str, Any]] = []
    for evt in events:
        if evt.get("type") != "item.completed":
            continue
        item = evt.get("item", {})
        if item.get("type") != "command_execution":
            continue
        command = item.get("command", "") or ""
        match = _URL_RE.search(command)
        if not match:
            continue
        attempts.append(
            {
                "tool": "shell",
                "tool_input": {"command": command},
                "url": match.group(0),
                "result_text": item.get("aggregated_output", ""),
                "exit_code": item.get("exit_code"),
            }
        )
    return attempts


# ---------------------------------------------------------------------------
# Driver
# ---------------------------------------------------------------------------


def resolve_work_dir() -> Path:
    result = subprocess.run(
        ["lore", "resolve"],
        check=True,
        capture_output=True,
        text=True,
    )
    base = Path(result.stdout.strip())
    return base / "_work" / "agent-usability-testing-attribute-filter-param"


def iter_trial_specs(agent_specs: list[str], prompt_ids: list[str]) -> Iterable[TrialSpec]:
    for agent in agent_specs:
        backend, _, model = agent.partition(":")
        if backend == "claude":
            agent_id = f"claude-{model or 'default'}"
        elif backend == "codex":
            agent_id = f"codex-{model}" if model else "codex-default"
        else:
            raise SystemExit(
                f"unknown agent backend: {backend!r} (use claude:<model> or codex[:<model>])"
            )
        for pid in prompt_ids:
            if pid not in PROMPTS:
                raise SystemExit(f"unknown prompt id: {pid!r}")
            yield TrialSpec(
                agent_id=agent_id,
                backend=backend,
                model=model or None,
                prompt_id=pid,
                prompt_text=PROMPTS[pid],
            )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--agents",
        default=(
            "claude:claude-opus-4-7,claude:claude-sonnet-4-6,claude:claude-haiku-4-5-20251001,codex"
        ),
        help="Comma-separated list of <backend>[:<model>] specs.",
    )
    parser.add_argument(
        "--prompts",
        default=",".join(PROMPTS.keys()),
        help="Comma-separated prompt IDs (default: all P1-P7).",
    )
    parser.add_argument(
        "--base-url",
        default=os.environ.get("PHOENIX_BASE_URL", DEFAULT_BASE_URL),
    )
    parser.add_argument(
        "--timeout-s",
        type=float,
        default=180.0,
        help="Per-trial timeout in seconds.",
    )
    parser.add_argument(
        "--out-dir",
        default=None,
        help=(
            "Override output dir (default: <lore resolve>/_work/"
            "agent-usability-testing-attribute-filter-param/trial-runs)."
        ),
    )
    parser.add_argument(
        "--summary-json",
        default=None,
        help="Path to write the aggregate summary JSON (default: <out-dir>/summary.json).",
    )
    args = parser.parse_args()

    if not OPENAPI_SCHEMA_PATH.exists():
        print(f"error: openapi schema not found at {OPENAPI_SCHEMA_PATH}", file=sys.stderr)
        return 2
    openapi_json = OPENAPI_SCHEMA_PATH.read_text()

    out_root = Path(args.out_dir) if args.out_dir else resolve_work_dir() / "trial-runs"
    out_root.mkdir(parents=True, exist_ok=True)
    summary_path = Path(args.summary_json) if args.summary_json else out_root / "summary.json"

    agent_specs = [a.strip() for a in args.agents.split(",") if a.strip()]
    prompt_ids = [p.strip() for p in args.prompts.split(",") if p.strip()]

    if not shutil.which("claude"):
        print("warning: `claude` CLI not on PATH — claude backends will fail", file=sys.stderr)
    if not shutil.which("codex") and any(spec.startswith("codex") for spec in agent_specs):
        print("warning: `codex` CLI not on PATH — codex backends will fail", file=sys.stderr)

    summary: list[dict[str, Any]] = []
    for spec in iter_trial_specs(agent_specs, prompt_ids):
        agent_dir = out_root / spec.agent_id
        agent_dir.mkdir(parents=True, exist_ok=True)
        log_path = agent_dir / f"{spec.prompt_id}.jsonl"
        print(f"[trial] {spec.agent_id} / {spec.prompt_id} → {log_path}", file=sys.stderr)
        user_message = build_user_message(spec.prompt_text, args.base_url, openapi_json)
        if spec.backend == "claude":
            result = run_claude(spec, user_message, log_path, args.timeout_s)
        elif spec.backend == "codex":
            result = run_codex(spec, user_message, log_path, args.timeout_s)
        else:
            continue
        result["prompt_text"] = spec.prompt_text
        summary.append(result)
        print(
            f"   wall={result['wall_s']}s urls={len(result['url_attempts'])} "
            f"exit={result['exit_code']}",
            file=sys.stderr,
        )
        # Incremental write so a crash doesn't lose prior work
        summary_path.write_text(json.dumps(summary, indent=2) + "\n")

    print(f"[trial] wrote summary to {summary_path}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

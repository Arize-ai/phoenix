"""Checks that must pass before the matrix is worth spending.

Both failure modes this guards against are silent. A headless run against an
OAuth-only server connects with zero tools and still answers, and the tracing
plugin posts spans with ``curl -sf``, so a 403 or a wrong project looks exactly
like success. Each would produce a complete-looking suite built on nothing.
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import time
import urllib.error
import urllib.request
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional
from urllib.parse import urlsplit

from .config import BenchConfig, Task
from .invocation import build_argv, build_env, scratch_cwd, write_mcp_config
from .metrics import check_expectation, parse_transcript

_CANARY_NAME = "mcpbench-preflight-canary"


@dataclass
class Check:
    name: str
    ok: bool
    detail: str

    def render(self) -> str:
        return f"{'PASS' if self.ok else 'FAIL'}  {self.name}\n      {self.detail}"


def check_cli() -> Check:
    if not (path := shutil.which("claude")):
        return Check("claude CLI", False, "Not on PATH.")
    try:
        version = subprocess.run(
            ["claude", "--version"], capture_output=True, text=True, timeout=30
        ).stdout.strip()
    except (OSError, subprocess.SubprocessError) as exc:
        return Check("claude CLI", False, f"Could not run `claude --version`: {exc}")
    return Check("claude CLI", True, f"{version} at {path}")


def check_target(config: BenchConfig, workdir: Path) -> Check:
    """Confirm the target connects and advertises the tools it should.

    Uses the same argv builder as the suite, so a passing check cannot describe a
    different command than the one that will be measured.
    """
    name = f"target {config.resolved_label()}"
    if not config.uses_mcp:
        return Check(name, True, "No MCP server for this run; nothing to connect.")

    try:
        # Scratch, not workdir: this file carries the target's bearer token.
        mcp_config_path = write_mcp_config(config, scratch_cwd())
    except Exception as exc:
        return Check(name, False, str(exc))

    argv = build_argv(config, "reply with exactly: ok", mcp_config_path=mcp_config_path)
    try:
        proc = subprocess.run(
            argv,
            env=build_env(config),
            capture_output=True,
            text=True,
            timeout=config.timeout_s,
            cwd=str(scratch_cwd()),
        )
    except subprocess.SubprocessError as exc:
        return Check(name, False, f"Probe failed to run: {exc}")

    transcript_path = workdir / "preflight.jsonl"
    transcript_path.write_text(proc.stdout)
    transcript = parse_transcript(transcript_path)

    if (status := transcript.mcp_status) != "connected":
        hint = {
            "needs-auth": (
                "The server wants OAuth, which a headless run cannot perform. Set "
                "$BENCH_TARGET_API_KEY to a Phoenix API key -- API keys carry no RFC 8707 "
                "audience and are accepted at /mcp."
            ),
            "failed": "Server rejected the connection; check the URL and that the key is valid.",
        }.get(status or "", "Server did not connect.")
        return Check(name, False, f"status={status or 'absent'}. {hint}")

    tools = [t.split("__")[-1] for t in transcript.mcp_tools]
    if missing := [t for t in config.expect_tools if t not in tools]:
        return Check(
            name,
            False,
            f"Connected with {len(tools)} tools but missing {missing}. Found: {sorted(tools)}",
        )
    return Check(name, True, f"Connected with {len(tools)} tools: {sorted(tools)}")


def check_sink_distinct(config: BenchConfig) -> Optional[Check]:
    """Refuse to trace into an instance under test.

    Spans ingested by one trial are visible to the next, so the instance would
    stop being the same database from trial to trial.
    """
    if not config.tracing.enabled:
        return None
    try:
        sink_host = urlsplit(config.tracing.sink_endpoint()).netloc
    except Exception as exc:
        return Check("trace sink distinct", False, str(exc))

    if config.uses_mcp:
        target_host = urlsplit(config.target).netloc
        if target_host and target_host == sink_host:
            return Check(
                "trace sink distinct",
                False,
                f"The target and the trace sink are both {sink_host}. Point "
                "$PHOENIX_ENDPOINT at a separate instance.",
            )
    return Check("trace sink distinct", True, f"Sink {sink_host} is not the target.")


def _sink_request(url: str, *, data: Optional[bytes] = None) -> tuple[int, bytes]:
    request = urllib.request.Request(url, data=data, method="POST" if data else "GET")
    request.add_header("Content-Type", "application/json")
    if key := os.environ.get("PHOENIX_API_KEY", "").strip():
        request.add_header("Authorization", f"Bearer {key}")
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            return response.status, response.read()
    except urllib.error.HTTPError as exc:
        return exc.code, exc.read()


def check_canary_span(config: BenchConfig) -> Optional[Check]:
    """Post one span to the sink and read it back.

    The plugin swallows every delivery error, so a viewer-role key, a locked
    instance, and an unreachable host are all indistinguishable at run time. This
    is where that distinction gets made.
    """
    if not config.tracing.enabled:
        return None
    try:
        config.tracing.resolved_plugin_dir()
        endpoint = config.tracing.sink_endpoint()
    except Exception as exc:
        return Check("trace sink canary", False, str(exc))

    project = config.tracing.project_for("preflight")
    now = datetime.now(timezone.utc)
    payload = {
        "data": [
            {
                "name": _CANARY_NAME,
                "context": {
                    "trace_id": uuid.uuid4().hex,
                    "span_id": uuid.uuid4().hex[:16],
                },
                "span_kind": "CHAIN",
                "start_time": now.isoformat(),
                "end_time": (now + timedelta(milliseconds=1)).isoformat(),
                "status_code": "OK",
                "status_message": "",
                "attributes": {"mcpbench.preflight": "true"},
                "events": [],
            }
        ]
    }

    url = f"{endpoint}/v1/projects/{project}/spans"
    status, body = _sink_request(url, data=json.dumps(payload).encode())
    if status != 202:
        hint = {
            401: "Sink rejected the token; check $PHOENIX_API_KEY.",
            403: "Span ingest is viewer-restricted -- the sink key needs member or admin.",
            404: "Project identifier not found; use a plain project name, not an ID.",
        }.get(status, body[:200].decode(errors="replace"))
        return Check("trace sink canary", False, f"POST {url} -> HTTP {status}. {hint}".strip())

    # Ingest is queued, so the span appears shortly after the 202 rather than with it.
    deadline = time.monotonic() + 15
    while time.monotonic() < deadline:
        read_status, read_body = _sink_request(f"{endpoint}/v1/projects/{project}/spans?limit=50")
        if read_status == 200:
            try:
                spans = json.loads(read_body).get("data") or []
            except json.JSONDecodeError:
                spans = []
            if any(s.get("name") == _CANARY_NAME for s in spans):
                return Check("trace sink canary", True, f"Span landed in project {project!r}.")
        time.sleep(1.5)

    return Check(
        "trace sink canary",
        False,
        f"Accepted (202) but no span appeared in {project!r} within 15s. Check sink ingest.",
    )


def check_grading(tasks: list[Task]) -> Check:
    """Every task's expectation agrees with the wordings it declares.

    Cheap and first: a matrix graded by a pattern that is already known to be
    wrong produces numbers that look like a result. Each mis-grade found so far
    was a right answer phrased differently from the one the pattern was written
    against, and each one flattered whichever model the pattern was tuned on.
    """
    problems = {t.name: p for t in tasks if (p := check_expectation(t.expect, t.accept, t.reject))}
    untested = [t.name for t in tasks if not t.accept and not t.reject]
    if problems:
        first = next(iter(problems.items()))
        return Check(
            "grading",
            False,
            f"{len(problems)} task(s) grade their own examples wrongly. {first[0]}: {first[1][0]}",
        )
    checked = len(tasks) - len(untested)
    detail = f"{checked}/{len(tasks)} tasks agree with their accept/reject wordings"
    if untested:
        detail += f"; no cases declared for {', '.join(untested)}"
    return Check("grading", True, detail)


def run_preflight(
    config: BenchConfig, workdir: Path, tasks: Optional[list[Task]] = None
) -> list[Check]:
    workdir.mkdir(parents=True, exist_ok=True)
    checks = [check_cli(), check_target(config, workdir)]
    if tasks is not None:
        checks.insert(0, check_grading(tasks))
    checks += [c for c in (check_sink_distinct(config), check_canary_span(config)) if c]
    return checks

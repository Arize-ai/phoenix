"""Construction of one ``claude -p`` invocation: its MCP config, argv, and env.

Shared by the runner and preflight so a check can never validate a different
command than the one the suite goes on to measure.
"""

from __future__ import annotations

import json
import os
import tempfile
from pathlib import Path
from typing import Any, Optional

from .config import MCP_SERVER_NAME, MCP_TOOL_GRANT, BenchConfig, Task

_scratch: Optional[Path] = None


def scratch_cwd() -> Path:
    """A working directory with no repository above it.

    CLAUDE.md is discovered by walking up from the working directory and is not
    suppressed by ``--setting-sources ""``. A directory with no repository above
    it is the only way to keep it out of the measured context.
    """
    global _scratch
    if _scratch is None:
        _scratch = Path(tempfile.mkdtemp(prefix="mcpbench-cwd-"))
    return _scratch


def mcp_config_document(config: BenchConfig) -> dict[str, Any]:
    """The MCP config generated for this run's target.

    Written fresh rather than read from ``~/.claude.json``: an interactively
    OAuth-authorized server cannot authenticate headlessly (it resolves with zero
    tools), and a developer's other servers would add tool definitions to every
    measurement.
    """
    server: dict[str, Any] = {"type": "http", "url": config.target_url()}
    if api_key := os.environ.get("BENCH_TARGET_API_KEY", "").strip():
        server["headers"] = {"Authorization": f"Bearer {api_key}"}
    return {"mcpServers": {MCP_SERVER_NAME: server}}


def write_mcp_config(config: BenchConfig, directory: Path) -> Path:
    path = directory / "mcp-target.json"
    path.write_text(json.dumps(mcp_config_document(config), indent=2))
    return path


def build_argv(
    config: BenchConfig,
    prompt: str,
    *,
    mcp_config_path: Optional[Path],
    json_schema: Optional[dict[str, Any]] = None,
) -> list[str]:
    """Assemble argv for one run.

    ``--setting-sources ""`` and ``--disable-slash-commands`` exclude the
    caller's own skills, plugins and memory, which would otherwise outweigh the
    MCP surface under measurement. ``--bare`` excludes the same context but reads
    credentials only from ``ANTHROPIC_API_KEY``, so it is unusable under OAuth.
    """
    argv = [
        "claude",
        "-p",
        prompt,
        "--system-prompt",
        "",
        "--tools",
        "",
        "--strict-mcp-config",
        "--setting-sources",
        "",
        "--disable-slash-commands",
        "--no-session-persistence",
        "--output-format",
        "stream-json",
        "--verbose",
        "--model",
        config.model,
        "--effort",
        config.effort,
        "--max-budget-usd",
        str(config.max_budget_usd),
    ]
    if mcp_config_path is not None:
        argv += ["--mcp-config", str(mcp_config_path)]
        argv += ["--allowedTools", MCP_TOOL_GRANT]
        if config.bypass_permissions:
            # Headless permission prompts resolve to deny without surfacing,
            # which would record a session of refusals as a measurement.
            argv += ["--permission-mode", "bypassPermissions"]
    if config.tracing.enabled:
        argv += ["--plugin-dir", str(config.tracing.resolved_plugin_dir())]
    if json_schema is not None:
        argv += ["--json-schema", json.dumps(json_schema)]
    return argv


def build_env(config: BenchConfig) -> dict[str, str]:
    """Environment for one run.

    The tracing plugin selects its backend from ``PHOENIX_ENDPOINT``, so that
    variable is set explicitly (or removed) rather than inherited -- an inherited
    value pointing at the instance under test would have each trial ingest spans
    that later trials can then observe.
    """
    env = dict(os.environ)
    env.pop("PHOENIX_ENDPOINT", None)
    env.pop("PHOENIX_API_KEY", None)

    if not config.tracing.enabled:
        env["ARIZE_TRACE_ENABLED"] = "false"
        return env

    env["PHOENIX_ENDPOINT"] = config.tracing.sink_endpoint()
    if sink_key := os.environ.get("PHOENIX_API_KEY", "").strip():
        env["PHOENIX_API_KEY"] = sink_key
    env["ARIZE_PROJECT_NAME"] = config.tracing.project_for(config.resolved_label())
    env["ARIZE_TRACE_ENABLED"] = "true"
    return env


def safe_label(label: str) -> str:
    """Filesystem-safe form of a label, used in transcript filenames."""
    return "".join(c if c.isalnum() or c in "-_" else "-" for c in label)


def cell_id(label: str, task: Task, trial: int) -> str:
    return f"{safe_label(label)}__{task.name}__{trial:02d}"

"""Sends one routing query to Claude Code and reports which skills it loaded.

The adapter runs ``claude -p --output-format stream-json`` with the ``arize-phoenix``
plugin loaded from the checkout and no user configuration: no user, project, or local
settings, no MCP servers, no auto-memory, and a scrubbed environment. A ``PreToolUse`` hook
on the ``Skill`` tool ends the session at the first skill load, and ``--max-turns`` ends it
after 3 turns otherwise, so each run costs a few cents.

Two ways to authenticate:

- ``subscription`` keeps your ``HOME`` so Claude Code can read its login from the macOS
  Keychain. It never passes ``ANTHROPIC_API_KEY`` to the agent.
- ``api-key`` gives the agent a temporary ``HOME`` and passes ``ANTHROPIC_API_KEY``. CI uses
  this mode.
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import tempfile
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Literal, Optional

from evals.skills.runner.cases import REPO_ROOT
from harbor_verifiers.skills import loaded_skills

PLUGIN_DIR = REPO_ROOT / "plugins" / "claude" / "arize-phoenix"
PLUGIN_NAME = "arize-phoenix"
MAX_TURNS = 3
TIMEOUT_SECONDS = 240
# Read and search tools let contextual cases look at their files. Bash is listed because
# agents reach for it, but the default permission mode denies it in print mode.
TOOLS = "Skill,Read,Glob,Grep,Bash"

Auth = Literal["subscription", "api-key"]

_PASSTHROUGH_ENV = ("PATH", "USER", "LOGNAME", "LANG", "LC_ALL", "TMPDIR", "SHELL", "TERM")
_STOP_HOOK = """#!/bin/sh
cat > /dev/null
echo '{"continue": false, "stopReason": "skill loaded"}'
"""


@dataclass
class RunResult:
    """One agent run of one query."""

    loaded: list[str] = field(default_factory=list)
    cost_usd: float = 0.0
    turns: int = 0
    terminal_reason: str = ""
    error: Optional[str] = None
    agent_version: str = ""
    model: str = ""


def _trajectory(events: list[dict[str, Any]]) -> dict[str, Any]:
    """Converts stream-json events into the ATIF steps that ``loaded_skills`` reads."""
    steps = []
    for event in events:
        if event.get("type") != "assistant":
            continue
        content = (event.get("message") or {}).get("content") or []
        tool_calls = [
            {"function_name": block.get("name"), "arguments": block.get("input")}
            for block in content
            if isinstance(block, dict) and block.get("type") == "tool_use"
        ]
        if tool_calls:
            steps.append({"source": "agent", "tool_calls": tool_calls})
    return {"steps": steps}


def parse_stream(lines: list[str]) -> RunResult:
    """Reads a ``stream-json`` transcript into a :class:`RunResult`."""
    events = []
    for line in lines:
        line = line.strip()
        if line.startswith("{"):
            try:
                events.append(json.loads(line))
            except json.JSONDecodeError:
                continue
    result = RunResult(loaded=loaded_skills(_trajectory(events)))
    for event in events:
        if event.get("type") == "system" and event.get("subtype") == "init":
            result.agent_version = str(event.get("claude_code_version") or "")
            result.model = str(event.get("model") or "")
            plugins = [p.get("name") for p in event.get("plugins") or [] if isinstance(p, dict)]
            if PLUGIN_NAME not in plugins:
                result.error = f"the {PLUGIN_NAME} plugin didn't load"
        elif event.get("type") == "result":
            result.cost_usd = float(event.get("total_cost_usd") or 0.0)
            result.turns = int(event.get("num_turns") or 0)
            result.terminal_reason = str(event.get("terminal_reason") or event.get("subtype"))
            if event.get("is_error") and result.terminal_reason != "max_turns":
                result.error = result.error or str(event.get("result") or result.terminal_reason)
    if not result.terminal_reason and result.error is None:
        result.error = "the agent ended without a result event"
    return result


class ClaudeCodeAdapter:
    """Runs routing queries in Claude Code, one isolated session per run."""

    channel = "claude-code"

    def __init__(self, *, model: str, auth: Auth, claude: str = "claude") -> None:
        self.model = model
        self.auth = auth
        self.claude = shutil.which(claude) or claude
        if auth == "api-key" and not os.environ.get("ANTHROPIC_API_KEY"):
            raise RuntimeError("--auth api-key needs ANTHROPIC_API_KEY in the environment")
        self._scratch = Path(tempfile.mkdtemp(prefix="skill-routing-"))
        hook = self._scratch / "stop_at_skill_load.sh"
        hook.write_text(_STOP_HOOK)
        hook.chmod(0o755)
        self._settings = self._scratch / "settings.json"
        self._settings.write_text(
            json.dumps(
                {
                    "hooks": {
                        "PreToolUse": [
                            {
                                "matcher": "Skill",
                                "hooks": [{"type": "command", "command": str(hook)}],
                            }
                        ]
                    }
                }
            )
        )

    def close(self) -> None:
        shutil.rmtree(self._scratch, ignore_errors=True)

    def _env(self, home: Path) -> dict[str, str]:
        env = {name: os.environ[name] for name in _PASSTHROUGH_ENV if name in os.environ}
        env.update(
            HOME=str(home),
            CLAUDE_CODE_DISABLE_AUTO_MEMORY="1",
            CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC="1",
            DISABLE_AUTOUPDATER="1",
        )
        if self.auth == "api-key":
            env["ANTHROPIC_API_KEY"] = os.environ["ANTHROPIC_API_KEY"]
        return env

    def version(self) -> str:
        completed = subprocess.run(
            [self.claude, "--version"], capture_output=True, text=True, check=False
        )
        return completed.stdout.split(" ", 1)[0].strip()

    def run(self, query: str, files: list[Path]) -> RunResult:
        with tempfile.TemporaryDirectory(dir=self._scratch) as workdir:
            work = Path(workdir) / "work"
            work.mkdir()
            for file in files:
                if file.is_dir():
                    shutil.copytree(file, work / file.name)
                else:
                    shutil.copy2(file, work / file.name)
            if self.auth == "api-key":
                home = Path(workdir) / "home"
                home.mkdir()
            else:
                home = Path.home()
            command = [
                self.claude,
                "-p",
                query,
                "--output-format",
                "stream-json",
                "--verbose",
                "--model",
                self.model,
                "--max-turns",
                str(MAX_TURNS),
                "--setting-sources",
                "",
                "--settings",
                str(self._settings),
                "--strict-mcp-config",
                "--plugin-dir",
                str(PLUGIN_DIR),
                "--tools",
                TOOLS,
                "--no-session-persistence",
            ]
            try:
                completed = subprocess.run(
                    command,
                    cwd=work,
                    env=self._env(home),
                    stdin=subprocess.DEVNULL,
                    capture_output=True,
                    text=True,
                    timeout=TIMEOUT_SECONDS,
                    check=False,
                )
            except subprocess.TimeoutExpired:
                return RunResult(error=f"timed out after {TIMEOUT_SECONDS} s")
        result = parse_stream(completed.stdout.splitlines())
        if result.error and completed.returncode != 0 and completed.stderr.strip():
            result.error = f"{result.error}: {completed.stderr.strip()[-500:]}"
        return result

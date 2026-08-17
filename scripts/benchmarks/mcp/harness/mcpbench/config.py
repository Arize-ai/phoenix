"""Benchmark configuration: the suite defaults and the task files.

A run targets one MCP server and carries a ``label`` you choose. Comparison is
between labels, so what a run *means* is annotation rather than a taxonomy baked
into the harness.

Precedence for any overridable value is CLI > task file > ``bench.yaml`` > the
defaults here.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field, replace
from pathlib import Path
from typing import Any, Optional

import yaml

#: Server key inside the generated MCP config. A harness constant, deliberately
#: unrelated to whatever a developer calls the server in their own client, so
#: the permission flag below is identical for everyone.
MCP_SERVER_NAME = "phoenix"

#: Tool-permission grant matching MCP_SERVER_NAME. Headless runs auto-deny
#: otherwise, which would benchmark a session of refusals.
MCP_TOOL_GRANT = f"mcp__{MCP_SERVER_NAME}"

#: Target value meaning "no MCP server at all" -- the control whose cost is the
#: floor every other run is measured against.
NO_MCP = "none"


class ConfigError(Exception):
    """Raised for a malformed or incomplete benchmark configuration."""


@dataclass(frozen=True)
class Task:
    """One prompt, plus how to tell whether the answer was right.

    ``task_class`` is the axis the suite is built around -- a surface should lose
    on ``trivial`` and win on ``large-result`` -- so it is carried into the
    results as a grouping column.
    """

    name: str
    prompt: str
    task_class: str = "unclassified"
    trials: Optional[int] = None
    json_schema: Optional[dict[str, Any]] = None
    expect: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class Tracing:
    """Where the Arize Claude Code plugin sends its spans.

    Deliberately separate from the target: tracing into the instance under test
    would let each trial observe the previous trial's spans.
    """

    enabled: bool = False
    plugin_dir: Optional[str] = None
    project_prefix: str = "mcp-bench"

    def resolved_plugin_dir(self) -> Path:
        if not self.plugin_dir:
            raise ConfigError(
                "tracing.enabled is true but tracing.plugin_dir is unset. Point it at a "
                "checkout of github.com/Arize-ai/arize-claude-code-plugin (its "
                "claude-code-tracing directory)."
            )
        path = Path(os.path.expanduser(self.plugin_dir))
        if not (path / ".claude-plugin" / "plugin.json").is_file():
            raise ConfigError(f"No plugin.json under {path}; is this the plugin directory?")
        return path

    def sink_endpoint(self) -> str:
        endpoint = os.environ.get("PHOENIX_ENDPOINT", "").strip()
        if not endpoint:
            raise ConfigError(
                "tracing.enabled is true but $PHOENIX_ENDPOINT is unset. The plugin selects "
                "its backend from that variable."
            )
        return endpoint.rstrip("/")

    def project_for(self, label: str) -> str:
        safe = "".join(c if c.isalnum() or c in "-_" else "-" for c in label)
        return f"{self.project_prefix}-{safe}"


@dataclass(frozen=True)
class BenchConfig:
    model: str = "claude-sonnet-5"
    effort: str = "medium"
    trials: int = 3
    concurrency: int = 1
    timeout_s: int = 600
    retries: int = 2
    max_budget_usd: float = 0.50
    max_total_usd: float = 25.00
    bypass_permissions: bool = True
    #: The MCP endpoint under test, or NO_MCP for the control. From --target, or
    #: $BENCH_TARGET_URL.
    target: str = ""
    #: What this run is, in your words. The comparison axis.
    label: str = ""
    #: Tool names preflight insists the server advertises. Empty means "any".
    expect_tools: tuple[str, ...] = ()
    tasks_dir: str = "tasks"
    tracing: Tracing = field(default_factory=Tracing)
    root: Path = Path(".")

    @property
    def uses_mcp(self) -> bool:
        return bool(self.target) and self.target != NO_MCP

    def target_url(self) -> str:
        """The MCP endpoint for this run."""
        if not self.uses_mcp:
            raise ConfigError("This run targets no MCP server.")
        return self.target

    def resolved_label(self) -> str:
        """The run's label, falling back to something legible."""
        if self.label:
            return self.label
        if not self.uses_mcp:
            return NO_MCP
        from urllib.parse import urlsplit

        return urlsplit(self.target).netloc or "target"

    def trials_for(self, task: Task) -> int:
        return task.trials if task.trials is not None else self.trials


def load_config(path: Path) -> BenchConfig:
    """Read ``bench.yaml``. Paths inside it resolve relative to the file."""
    if not path.is_file():
        raise ConfigError(f"No benchmark config at {path}.")
    raw = yaml.safe_load(path.read_text()) or {}
    if not isinstance(raw, dict):
        raise ConfigError(f"{path} must contain a YAML mapping.")

    tracing_raw = raw.get("tracing") or {}
    defaults = BenchConfig()
    return BenchConfig(
        model=raw.get("model", defaults.model),
        effort=raw.get("effort", defaults.effort),
        trials=int(raw.get("trials", defaults.trials)),
        concurrency=int(raw.get("concurrency", defaults.concurrency)),
        timeout_s=int(raw.get("timeout_s", defaults.timeout_s)),
        retries=int(raw.get("retries", defaults.retries)),
        max_budget_usd=float(raw.get("max_budget_usd", defaults.max_budget_usd)),
        max_total_usd=float(raw.get("max_total_usd", defaults.max_total_usd)),
        bypass_permissions=bool(raw.get("bypass_permissions", defaults.bypass_permissions)),
        target=str(raw.get("target") or os.environ.get("BENCH_TARGET_URL", "")).strip(),
        label=str(raw.get("label") or "").strip(),
        expect_tools=tuple(raw.get("expect_tools") or ()),
        tasks_dir=raw.get("tasks_dir", defaults.tasks_dir),
        tracing=Tracing(
            enabled=bool(tracing_raw.get("enabled", False)),
            plugin_dir=tracing_raw.get("plugin_dir"),
            project_prefix=tracing_raw.get("project_prefix", "mcp-bench"),
        ),
        root=path.parent.resolve(),
    )


def apply_overrides(config: BenchConfig, **overrides: Any) -> BenchConfig:
    """Apply non-None CLI overrides, so unset flags leave the file's values alone."""
    return replace(config, **{k: v for k, v in overrides.items() if v is not None})


def load_tasks(config: BenchConfig, only: Optional[list[str]] = None) -> list[Task]:
    """Load every task YAML, optionally filtered to ``only`` names."""
    tasks_dir = (config.root / config.tasks_dir).resolve()
    if not tasks_dir.is_dir():
        raise ConfigError(f"No tasks directory at {tasks_dir}.")

    tasks: list[Task] = []
    for path in sorted(tasks_dir.glob("*.yaml")):
        raw = yaml.safe_load(path.read_text()) or {}
        if not raw.get("prompt"):
            raise ConfigError(f"{path} has no 'prompt'.")
        tasks.append(
            Task(
                name=raw.get("name") or path.stem,
                prompt=raw["prompt"],
                task_class=raw.get("task_class", "unclassified"),
                trials=raw.get("trials"),
                json_schema=raw.get("json_schema"),
                expect=raw.get("expect") or {},
            )
        )
    if not tasks:
        raise ConfigError(f"No task YAML files in {tasks_dir}.")

    if only:
        wanted = set(only)
        tasks = [t for t in tasks if t.name in wanted]
        if missing := wanted - {t.name for t in tasks}:
            raise ConfigError(f"Unknown task(s): {', '.join(sorted(missing))}.")
    return tasks

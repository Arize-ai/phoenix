"""Environment resolution for a benchmark session.

Everything a session needs is read from the environment (with a ``.env``
fallback at the repo root) rather than CLI flags, because the entrypoint is
pytest: ``pytest -c evals/mcp/pytest.ini`` leaves no room for a bespoke
argument parser, and env vars compose with the phoenix-client plugin's own
``PHOENIX_*`` configuration.

The one required choice is ``MCP_BENCHMARK_ARM`` — which agent this session
puts under test. It is deliberately required rather than defaulted: a
comparison built from sessions that silently ran the same default arm twice
would look complete and be meaningless.
"""

from __future__ import annotations

import os
import re
from dataclasses import dataclass
from pathlib import Path

from evals.mcp.harness.arms import ARM_NAMES

DEFAULT_MODEL = "anthropic:claude-sonnet-5"
DEFAULT_BASE_URL = "http://localhost:6006"
DEFAULT_TOOL_GROUPS_URL = "http://localhost:6007"
DEFAULT_TRACE_PROJECT = "mcp-benchmark"

ARM_ENV = "MCP_BENCHMARK_ARM"

REPO_ROOT = Path(__file__).resolve().parents[3]

_TRUTHY = frozenset({"1", "true", "yes", "on"})

#: Matches ``KEY=value``, with an optional ``export`` and optional quoting.
_ENV_LINE = re.compile(r"^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$")


def load_dotenv(path: Path | None = None) -> None:
    """Populate missing env vars from a ``.env`` file (repo root by default).

    Hand-rolled rather than pulling in python-dotenv, which is only present
    transitively. Real environment variables always win, so an explicit export
    can override the file.
    """
    path = REPO_ROOT / ".env" if path is None else path
    if not path.is_file():
        return
    for line in path.read_text().splitlines():
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        match = _ENV_LINE.match(line)
        if not match:
            continue
        name, raw = match.group(1), match.group(2).strip()
        if len(raw) >= 2 and raw[0] == raw[-1] and raw[0] in "\"'":
            raw = raw[1:-1]
        os.environ.setdefault(name, raw)


class BenchmarkEnvError(RuntimeError):
    """Raised when the environment cannot support a benchmark session."""


def resolve_api_key() -> str:
    key = os.getenv("PHOENIX_API_KEY")
    if not key:
        raise BenchmarkEnvError(
            "PHOENIX_API_KEY is not set. Create a system key in Phoenix "
            "(Settings > API Keys), then either export it or add it to a .env "
            "file at the repo root: PHOENIX_API_KEY=<key>"
        )
    return key


@dataclass(frozen=True)
class BenchmarkConfig:
    """Resolved configuration for one benchmark session (one arm under test)."""

    arm_name: str
    model: str
    judge_model: str
    base_url: str
    tool_groups_url: str
    api_key: str
    trace: bool
    trace_project: str

    @classmethod
    def from_env(cls) -> "BenchmarkConfig":
        load_dotenv()
        arm_name = os.getenv(ARM_ENV, "").strip()
        if arm_name not in ARM_NAMES:
            raise BenchmarkEnvError(
                f"{ARM_ENV} must name the agent under test — one of "
                f"{', '.join(ARM_NAMES)} — got {arm_name!r}. One pytest session "
                "benchmarks one agent; run a session per arm in succession to compare."
            )
        model = os.getenv("MCP_BENCHMARK_MODEL", "").strip() or DEFAULT_MODEL
        return cls(
            arm_name=arm_name,
            model=model,
            judge_model=os.getenv("MCP_BENCHMARK_JUDGE_MODEL", "").strip() or model,
            base_url=os.getenv("PHOENIX_BASE_URL", "").strip() or DEFAULT_BASE_URL,
            tool_groups_url=os.getenv("PHOENIX_TOOL_GROUPS_URL", "").strip()
            or DEFAULT_TOOL_GROUPS_URL,
            api_key=resolve_api_key(),
            trace=os.getenv("MCP_BENCHMARK_TRACE", "").strip().lower() in _TRUTHY,
            trace_project=os.getenv("MCP_BENCHMARK_TRACE_PROJECT", "").strip()
            or DEFAULT_TRACE_PROJECT,
        )

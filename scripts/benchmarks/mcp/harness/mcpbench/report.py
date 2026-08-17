"""Self-contained HTML report.

One file with the data inlined, so it opens from disk with no server, no install
and no build step, and can be mailed or dropped in Slack. Served from
``mcpbench serve`` the same file polls for updates and grows run controls;
opened from disk it stays a read-only snapshot.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Optional

TEMPLATE = Path(__file__).resolve().parent / "templates" / "report.html"
_MARKER = "/*__REPORT_DATA__*/ null"

#: Columns the page reads. Explicit so the payload stays small and a new metric
#: in `runs` doesn't silently bloat every report.
_RUN_KEYS = (
    "label",
    "task",
    "task_class",
    "trial",
    "total_context_tokens",
    "peak_context_tokens",
    "input_tokens",
    "output_tokens",
    "thinking_tokens",
    "num_turns",
    "n_tool_calls",
    "sql_tools",
    "tool_sequence",
    "tool_time_ms",
    "max_tool_time_ms",
    "n_discovery_calls",
    "n_execute_calls",
    "n_sandbox_errors",
    "tool_result_bytes",
    "max_tool_result_bytes",
    "code_bytes",
    "duration_api_ms",
    "total_cost_usd",
    "passed",
    "graded",
    "invalid",
    "invalid_reason",
    "answer",
)


def _pick(rows: list[dict[str, Any]], keys: tuple[str, ...]) -> list[dict[str, Any]]:
    return [{k: row.get(k) for k in keys} for row in rows]


def payload(
    runs: list[dict[str, Any]],
    turns: list[dict[str, Any]],
    *,
    tasks: Optional[list[dict[str, Any]]] = None,
    tool_calls: Optional[list[dict[str, Any]]] = None,
    meta: Optional[dict[str, Any]] = None,
) -> dict[str, Any]:
    """The JSON the page renders from — also what ``serve`` returns when polling."""
    for row in runs:
        # SQLite has no bool; the page treats these as tri-state.
        for key in ("passed", "graded", "invalid"):
            if row.get(key) is not None:
                row[key] = bool(row[key])

    return {
        "meta": meta or {},
        "runs": _pick(runs, _RUN_KEYS),
        # The prompts themselves, so a reader can see what was asked without
        # opening the repo.
        "tasks": [
            {
                "name": t["name"],
                "task_class": t.get("task_class"),
                "prompt": t.get("prompt"),
                "expect": json.loads(t.get("expect_json") or "{}"),
                "structured": bool(t.get("structured")),
            }
            for t in (tasks or [])
        ],
        "labels": sorted({r["label"] for r in runs}),
    }


def render(data: dict[str, Any]) -> str:
    """Inline ``data`` into the template."""
    # `</` is escaped so a tool answer containing a closing script tag cannot end
    # the inline script block early.
    encoded = json.dumps(data, separators=(",", ":"), default=str).replace("</", "<\\/")
    return TEMPLATE.read_text().replace(_MARKER, encoded)


def build_report(
    runs: list[dict[str, Any]],
    turns: list[dict[str, Any]],
    out_dir: Path,
    *,
    tasks: Optional[list[dict[str, Any]]] = None,
    tool_calls: Optional[list[dict[str, Any]]] = None,
    meta: Optional[dict[str, Any]] = None,
) -> Path:
    """Write ``report.html`` into ``out_dir`` and return its path.

    Written via a temporary file and renamed, because this is rewritten after
    every cell while a run is in progress: a reader refreshing the page must
    never catch a half-written file.
    """
    if not runs:
        raise ValueError("No runs to report on.")
    path = out_dir / "report.html"
    tmp = path.with_suffix(".html.tmp")
    tmp.write_text(render(payload(runs, turns, tasks=tasks, tool_calls=tool_calls, meta=meta)))
    tmp.replace(path)
    return path

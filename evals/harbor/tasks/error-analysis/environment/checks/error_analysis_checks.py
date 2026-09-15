"""Shared verifier logic for the error-analysis Harbor task.

Both step verifiers import this module. Paths default to the Harbor container
layout and can be overridden through environment variables so the checks also
run against a local Phoenix server and a local logs directory.
"""

from __future__ import annotations

import base64
import json
import os
import re
import sqlite3
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Literal

DATA_DIR = Path(os.environ.get("PHOENIX_EVAL_DATA_DIR", "/data"))
AGENT_LOGS_DIR = Path(os.environ.get("PHOENIX_EVAL_AGENT_LOGS_DIR", "/logs/agent"))
REWARD_PATH = Path(os.environ.get("PHOENIX_EVAL_REWARD_PATH", "/logs/verifier/reward.json"))
JUDGE_MODEL = os.environ.get("PHOENIX_EVAL_JUDGE_MODEL", "claude-sonnet-5")
WORKSPACE_ROOT = "/home/user/workspace"
SIDECAR_DIR = f"{WORKSPACE_ROOT}/.px/coding"
NOTE_NAME = "note"

EntityKind = Literal["span", "trace", "session"]


def load_truth() -> dict[str, Any]:
    truth: dict[str, Any] = json.loads((DATA_DIR / "ground_truth.json").read_text())
    return truth


def connect() -> sqlite3.Connection:
    connection = sqlite3.connect(f"file:{DATA_DIR / 'phoenix.db'}?mode=ro", uri=True)
    connection.row_factory = sqlite3.Row
    return connection


def global_id(type_name: str, rowid: int) -> str:
    return base64.b64encode(f"{type_name}:{rowid}".encode()).decode()


def step_dir(step: int) -> Path:
    return AGENT_LOGS_DIR / "steps" / str(step)


def answer_text(step: int) -> str:
    path = step_dir(step) / "answer.md"
    return path.read_text() if path.exists() else ""


def agent_session_rowid(step: int) -> int | None:
    path = step_dir(step) / "session_id"
    if not path.exists():
        return None
    raw = path.read_text().strip()
    try:
        type_name, _, rowid = base64.b64decode(raw).decode().partition(":")
        if type_name == "AgentSession" and rowid.isdigit():
            return int(rowid)
    except Exception:
        pass
    return None


@dataclass
class Annotation:
    kind: EntityKind
    name: str
    label: str | None
    explanation: str | None
    identifier: str
    otel_id: str
    node_id: str
    trace_ids: set[str] = field(default_factory=set)

    @property
    def accepted_ids(self) -> set[str]:
        return {self.otel_id, self.node_id}


def fetch_annotations(connection: sqlite3.Connection) -> list[Annotation]:
    rows: list[Annotation] = []
    for r in connection.execute(
        "SELECT a.name, a.label, a.explanation, a.identifier, s.id AS rowid, s.span_id, t.trace_id"
        " FROM span_annotations a JOIN spans s ON a.span_rowid = s.id"
        " JOIN traces t ON s.trace_rowid = t.id"
    ):
        rows.append(
            Annotation(
                "span",
                r["name"],
                r["label"],
                r["explanation"],
                r["identifier"],
                r["span_id"],
                global_id("Span", r["rowid"]),
                {r["trace_id"]},
            )
        )
    for r in connection.execute(
        "SELECT a.name, a.label, a.explanation, a.identifier, t.id AS rowid, t.trace_id"
        " FROM trace_annotations a JOIN traces t ON a.trace_rowid = t.id"
    ):
        rows.append(
            Annotation(
                "trace",
                r["name"],
                r["label"],
                r["explanation"],
                r["identifier"],
                r["trace_id"],
                global_id("Trace", r["rowid"]),
                {r["trace_id"]},
            )
        )
    for r in connection.execute(
        "SELECT a.name, a.label, a.explanation, a.identifier, ps.id AS rowid, ps.session_id,"
        " group_concat(t.trace_id) AS trace_ids"
        " FROM project_session_annotations a"
        " JOIN project_sessions ps ON a.project_session_id = ps.id"
        " JOIN traces t ON t.project_session_rowid = ps.id"
        " GROUP BY a.id"
    ):
        rows.append(
            Annotation(
                "session",
                r["name"],
                r["label"],
                r["explanation"],
                r["identifier"],
                r["session_id"],
                global_id("ProjectSession", r["rowid"]),
                set((r["trace_ids"] or "").split(",")) - {""},
            )
        )
    return rows


def notes(annotations: list[Annotation]) -> list[Annotation]:
    return [a for a in annotations if a.name == NOTE_NAME]


def axial(annotations: list[Annotation]) -> list[Annotation]:
    return [a for a in annotations if a.name != NOTE_NAME]


def covered_trace_ids(annotations: list[Annotation]) -> set[str]:
    return set().union(*(a.trace_ids for a in annotations)) if annotations else set()


def false_positives(annotations: list[Annotation], planted: set[str], clean: set[str]) -> list[str]:
    """Entities noted without cause: clean traces for span/trace notes, and sessions
    holding no planted trace for session notes (a session note on a session with a
    planted turn legitimately covers its clean sibling turns)."""
    flagged: set[str] = set()
    for a in annotations:
        if a.kind == "session":
            if not (a.trace_ids & planted):
                flagged.add(f"session:{a.otel_id}")
        else:
            flagged.update(a.trace_ids & clean)
    return sorted(flagged)


def shared_identifier(annotations: list[Annotation]) -> str | None:
    identifiers = {a.identifier for a in annotations}
    return identifiers.pop() if len(identifiers) == 1 and "" not in identifiers else None


@dataclass
class AnnotationConfig:
    name: str
    config: dict[str, Any]
    project_linked: bool

    @property
    def values(self) -> list[str]:
        return [str(v.get("label")) for v in self.config.get("values") or []]

    @property
    def is_categorical(self) -> bool:
        return str(self.config.get("type", "")).upper() == "CATEGORICAL"


# Phoenix's startup facilitator creates this config on every fresh database
# (``_ensure_user_feedback_annotation_config``); the agent did not make it.
SEEDED_CONFIG_NAMES = frozenset({"user_feedback"})


def fetch_annotation_configs(
    connection: sqlite3.Connection, project_name: str
) -> list[AnnotationConfig]:
    configs: list[AnnotationConfig] = []
    for r in connection.execute(
        "SELECT c.id, c.name, c.config,"
        " EXISTS(SELECT 1 FROM project_annotation_configs pc JOIN projects p ON pc.project_id = p.id"
        "        WHERE pc.annotation_config_id = c.id AND p.name = ?) AS linked"
        " FROM annotation_configs c",
        (project_name,),
    ):
        config = r["config"]
        if isinstance(config, (bytes, str)):
            config = json.loads(config)
        if r["name"] in SEEDED_CONFIG_NAMES:
            continue
        configs.append(AnnotationConfig(r["name"], config or {}, bool(r["linked"])))
    return configs


_GENERIC_FRAGMENTS = (
    "failure_mode",
    "failure_type",
    "failure_category",
    "issue_type",
    "error_type",
)


def is_generic_name(name: str, blocklist: list[str]) -> bool:
    normalized = re.sub(r"[^a-z0-9]+", "_", name.lower()).strip("_")
    return normalized in blocklist or any(fragment in normalized for fragment in _GENERIC_FRAGMENTS)


# --- sidecars -------------------------------------------------------------------


def load_sidecars(
    connection: sqlite3.Connection, session_rowid: int | None
) -> dict[str, list[dict[str, Any]]]:
    """``{filename: rows}`` for every JSONL file under ``.px/coding`` in the agent's virtual shell.

    The PXI bash tool is an in-process virtual shell whose filesystem is
    snapshotted into ``agent_session_snapshots``; nothing lands on the container disk.
    """
    query = "SELECT bashkit_snapshot FROM agent_session_snapshots"
    params: tuple[Any, ...] = ()
    if session_rowid is not None:
        query += " WHERE agent_session_id = ?"
        params = (session_rowid,)
    query += " ORDER BY updated_at DESC LIMIT 1"
    row = connection.execute(query, params).fetchone()
    if row is None or row[0] is None:
        return {}
    from bashkit import Bash, BuiltinContext, BuiltinResult

    async def phoenix_gql_stub(_ctx: BuiltinContext) -> BuiltinResult:
        """The snapshot records this builtin, so restoring it needs a stand-in."""
        return BuiltinResult(
            stdout="", stderr="phoenix-gql is unavailable in the verifier", exit_code=1
        )

    shell = Bash.from_snapshot(
        bytes(row[0]), python=False, network=None, custom_builtins={"phoenix-gql": phoenix_gql_stub}
    )
    listing = shell.execute_sync(f"ls -1 {SIDECAR_DIR} 2>/dev/null")
    stdout = listing.stdout if hasattr(listing, "stdout") else str(listing)
    sidecars: dict[str, list[dict[str, Any]]] = {}
    for filename in stdout.split():
        if not filename.endswith(".jsonl"):
            continue
        content = shell.read_file(f"{SIDECAR_DIR}/{filename}")
        text = content.decode("utf-8") if isinstance(content, (bytes, bytearray)) else str(content)
        rows = []
        for line in text.splitlines():
            line = line.strip()
            if not line:
                continue
            try:
                parsed = json.loads(line)
            except json.JSONDecodeError:
                continue
            if isinstance(parsed, dict):
                rows.append(parsed)
        sidecars[filename] = rows
    return sidecars


def sidecar_rows(
    sidecars: dict[str, list[dict[str, Any]]], *, axial_file: bool
) -> list[dict[str, Any]]:
    return [
        row
        for name, rows in sidecars.items()
        if name.endswith("-axial.jsonl") == axial_file
        for row in rows
    ]


def entities_mirrored(
    annotations: list[Annotation], rows: list[dict[str, Any]]
) -> tuple[bool, dict[str, Any]]:
    """Every DB annotation's entity appears in the sidecar rows and vice versa."""
    sidecar_ids = {str(r.get("entity_id", "")) for r in rows} - {""}
    accepted = set().union(*(a.accepted_ids for a in annotations)) if annotations else set()
    missing_from_sidecar = [a.otel_id for a in annotations if not (a.accepted_ids & sidecar_ids)]
    extra_in_sidecar = sorted(sidecar_ids - accepted)
    ok = bool(annotations) and bool(rows) and not missing_from_sidecar and not extra_in_sidecar
    return ok, {
        "sidecar_rows": len(rows),
        "missing_from_sidecar": missing_from_sidecar,
        "extra_in_sidecar": extra_in_sidecar,
    }


# --- LLM judge --------------------------------------------------------------------

_JUDGE_ATTEMPTS = 3
_JUDGE_MAX_TOKENS = 8000  # the judge model may think before it answers


def judge(system: str, user: str) -> dict[str, Any] | None:
    """Ask the judge model for a JSON verdict; ``None`` when no judge is available."""
    if not os.environ.get("ANTHROPIC_API_KEY"):
        return None
    import anthropic

    client = anthropic.Anthropic()
    text = ""
    for _attempt in range(_JUDGE_ATTEMPTS):
        response = client.messages.create(
            model=JUDGE_MODEL,
            max_tokens=_JUDGE_MAX_TOKENS,
            system=system + "\n\nRespond with a single JSON object and nothing else.",
            messages=[{"role": "user", "content": user}],
        )
        text = "".join(
            block.text for block in response.content if isinstance(block, anthropic.types.TextBlock)
        )
        match = re.search(r"\{.*\}", text, re.DOTALL)
        if match:
            try:
                verdict: dict[str, Any] = json.loads(match.group(0))
                return verdict
            except json.JSONDecodeError:
                continue
    return {
        "error": f"judge returned no usable JSON after {_JUDGE_ATTEMPTS} attempts",
        "raw": text[:500],
    }


def as_fraction(value: Any) -> float:
    """A judge's 0-1 score, tolerating strings such as ``"0.6"``, ``"60%"``, or ``"none"``."""
    if isinstance(value, bool):
        return float(value)
    if isinstance(value, (int, float)):
        return float(value)
    text = str(value).strip().lower().rstrip("%")
    try:
        number = float(text)
    except ValueError:
        return 0.0
    return number / 100 if "%" in str(value) or number > 1 else number


def write_reward(reward: float, details: dict[str, Any] | None = None, **components: Any) -> None:
    """Harbor's reward file accepts numbers only, and it averages every key into its
    summary, so only 0-to-1 scores go there; counts and diagnostics go to ``details.json``."""
    REWARD_PATH.parent.mkdir(parents=True, exist_ok=True)
    rewards: dict[str, float] = {"reward": float(reward)}
    details = dict(details or {})
    for key, value in components.items():
        if isinstance(value, bool):
            rewards[key] = float(value)
        elif isinstance(value, (int, float)):
            rewards[key] = float(value)
        else:
            details[key] = value
    REWARD_PATH.write_text(json.dumps(rewards, indent=2) + "\n")
    REWARD_PATH.with_name("details.json").write_text(
        json.dumps(details, indent=2, default=str) + "\n"
    )
    print(json.dumps({**rewards, **details}, indent=2, default=str))

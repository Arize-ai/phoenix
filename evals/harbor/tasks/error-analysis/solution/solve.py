#!/usr/bin/env python3
"""Oracle for the error-analysis task.

Writes what a correct PXI run would leave behind: open-coding notes on the planted
spans plus a mirrored sidecar in a bashkit snapshot for step 1, and per-dimension
annotation configs, labels, and the axial sidecar for step 2. Writes straight to
the fixture database, so it does not need the Phoenix server. Carries its own copy
of the planted defects: the verifier's ground truth lives in ``/tests``, which
Harbor uploads only after the agent phase.
"""

import base64
import json
import os
import sqlite3
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from bashkit import Bash

DATA_DIR = Path(os.environ.get("PHOENIX_EVAL_DATA_DIR", "/data"))
AGENT_LOGS_DIR = Path(os.environ.get("PHOENIX_EVAL_AGENT_LOGS_DIR", "/logs/agent"))
STATE_DIR = Path(os.environ.get("PHOENIX_EVAL_STATE_DIR", "/var/lib/phoenix-eval"))
PROJECT_NAME = "mobile-review-queue"
IDENTIFIER = "coding-run:mobile-review-queue-oracle"
SLUG = IDENTIFIER.replace(":", "-")
WORKSPACE = "/home/user/workspace"
NOTES_SIDECAR = f"{WORKSPACE}/.px/coding/{SLUG}.jsonl"
AXIAL_SIDECAR = f"{WORKSPACE}/.px/coding/{SLUG}-axial.jsonl"


@dataclass(frozen=True)
class Planted:
    root_span_id: str
    defect: str
    dimensions: tuple[str, ...]


PLANTED = (
    Planted(
        root_span_id="c6bb315b72f5901b",
        defect=(
            "Precise dollar breakdown ($29 subscription + $28.40 overage = $57.40) with no invoice, usage record, or tool span anywhere in the trace, and the arithmetic is wrong: 14,200 tokens at $0.002 per 1k tokens is $0.028, not $28.40. Either observation identifies this defect."
        ),
        dimensions=("answer_grounding",),
    ),
    Planted(
        root_span_id="e48658f76d82752c",
        defect=(
            "Asserts '30-day window', 'damage photos attached', and a $84.99 refund amount that appear nowhere in the input, and claims 'Initiating refund' although the trace has no TOOL or API span, so no action was executed."
        ),
        dimensions=("answer_grounding", "action_execution"),
    ),
    Planted(
        root_span_id="197df13dae636230",
        defect=(
            "Answers 'Q2 revenue grew 18% QoQ' plus three named drivers from an 'uploaded board deck' while the trace contains no retriever span, document context, or citation; the LLM input is just the user sentence."
        ),
        dimensions=("answer_grounding", "retrieval_instrumentation"),
    ),
    Planted(
        root_span_id="055f0b2012a73f08",
        defect=(
            "Invents deal-level evidence ('two of the five largest deals renew in Q3', 'both flagged budget reviews') with no retrieval or tool span, compounding the unverified claims of the prior turn."
        ),
        dimensions=("answer_grounding", "retrieval_instrumentation"),
    ),
    Planted(
        root_span_id="328b89964b1a9bd4",
        defect=(
            "Both spans carry status ERROR with message 'model timeout' yet a complete French haiku was returned as output, so the error status and the produced output contradict each other."
        ),
        dimensions=("runtime_health",),
    ),
)

DIMENSIONS = {
    "answer_grounding": {
        "description": "Are the answer's factual claims supported by input, retrieved context, or tool output visible in the trace?",
        "values": ["grounded", "invented_fact", "unsupported_number"],
    },
    "action_execution": {
        "description": "When the answer claims an action was taken, does a tool span show it executed?",
        "values": ["executed", "claimed_without_execution", "no_action_claimed"],
    },
    "retrieval_instrumentation": {
        "description": "When the answer relies on a document or external source, is a retriever or tool span present?",
        "values": ["retrieval_present", "retrieval_missing", "not_applicable"],
    },
    "runtime_health": {
        "description": "Is the span's status consistent with what it produced?",
        "values": ["ok", "error_with_output", "timeout"],
    },
}
LABEL_FOR = {
    "answer_grounding": "invented_fact",
    "action_execution": "claimed_without_execution",
    "retrieval_instrumentation": "retrieval_missing",
    "runtime_health": "error_with_output",
}

STEP1_ANSWER = """I reviewed all 11 traces in mobile-review-queue at the trace level and recorded a note on each of the five that have a problem (identifier `{identifier}`).

What I found:
- support-billing-0142, turn 2: a precise dollar breakdown ($29 + $28.40 = $57.40) with no invoice, usage record, or tool span behind it. The numbers come from the model alone.
- agent-refund-flow-9: asserts a 30-day window and attached damage photos that are not in the input, invents a $84.99 amount, and says it is "initiating" a refund although there is no tool or API span, so nothing was executed.
- rag-quarterly-report-3, turn 1: reports "Q2 revenue grew 18% QoQ" and three named drivers from an uploaded board deck, but the trace has no retriever span or document context. The LLM input is only the user sentence.
- rag-quarterly-report-3, turn 2: invents deal-level renewal details, compounding the unsupported claims of turn 1, again with no retrieval.
- chaotic-eval-run-51, turn 2: both spans are status ERROR with "model timeout", yet a complete French haiku was returned, so the status and the output contradict each other.

The onboarding session, the first billing turn, the English haiku, and the weather-status reply looked fine.

The dominant pattern is answers asserting specifics that nothing in the trace supports, plus one claimed action that never ran and one status/output mismatch. Would you like me to continue with axial coding: group these notes into a few narrow annotation configs (one per failure dimension) and apply them to the annotated traces?
"""

STEP2_ANSWER = """Axial coding is done under identifier `{identifier}`. The notes grouped into four dimensions, each registered as a categorical annotation config on the project and applied to the noted spans:

- answer_grounding (created): grounded / invented_fact / unsupported_number. 4 labelled.
- action_execution (created): executed / claimed_without_execution / no_action_claimed. 1 labelled.
- retrieval_instrumentation (created): retrieval_present / retrieval_missing / not_applicable. 2 labelled.
- runtime_health (created): ok / error_with_output / timeout. 1 labelled.

Grounding is the priority: four of five noted traces assert facts nothing in the trace supports, so an answer_grounding eval is the first thing worth building.
"""


def global_id(type_name: str, rowid: int) -> str:
    return base64.b64encode(f"{type_name}:{rowid}".encode()).decode()


def now() -> str:
    return datetime.now(timezone.utc).isoformat()


def bump_step() -> int:
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    counter = STATE_DIR / "step_counter"
    step = int(counter.read_text() if counter.exists() else "0") + 1
    counter.write_text(str(step))
    return step


def load_shell(connection: sqlite3.Connection, session_rowid: int) -> Bash:
    row = connection.execute(
        "SELECT bashkit_snapshot FROM agent_session_snapshots WHERE agent_session_id = ?",
        (session_rowid,),
    ).fetchone()
    if row and row[0]:
        return Bash.from_snapshot(bytes(row[0]), python=False, network=None)
    shell = Bash(python=False, network=None)
    shell.execute_sync_or_throw(f"mkdir -p {WORKSPACE}/.px/coding /tmp && cd {WORKSPACE}")
    return shell


def save_shell(connection: sqlite3.Connection, session_rowid: int, shell: Bash) -> None:
    connection.execute(
        "INSERT INTO agent_session_snapshots(agent_session_id, bashkit_snapshot) VALUES (?, ?)"
        " ON CONFLICT(agent_session_id) DO UPDATE SET bashkit_snapshot = excluded.bashkit_snapshot,"
        " updated_at = CURRENT_TIMESTAMP",
        (session_rowid, shell.snapshot()),
    )


def append_line(shell: Bash, path: str, row: dict[str, Any]) -> None:
    shell.execute_sync_or_throw(f"mkdir -p {os.path.dirname(path)}")
    existing = shell.read_file(path) if shell.exists(path) else ""
    if isinstance(existing, (bytes, bytearray)):
        existing = existing.decode("utf-8")
    shell.write_file(path, existing + json.dumps(row) + "\n")


def ensure_agent_session(connection: sqlite3.Connection) -> int:
    row = connection.execute("SELECT id FROM agent_sessions ORDER BY id DESC LIMIT 1").fetchone()
    if row:
        return int(row[0])
    cursor = connection.execute(
        "INSERT INTO agent_sessions(project_name, title, model_provider, model_name, is_ephemeral)"
        " VALUES (?, 'oracle', 'ANTHROPIC', 'oracle', 0)",
        (PROJECT_NAME,),
    )
    assert cursor.lastrowid is not None
    return int(cursor.lastrowid)


def span_rowid(connection: sqlite3.Connection, span_id: str) -> int:
    return int(
        connection.execute("SELECT id FROM spans WHERE span_id = ?", (span_id,)).fetchone()[0]
    )


def upsert_span_annotation(
    connection: sqlite3.Connection, rowid: int, name: str, label: str | None, explanation: str
) -> None:
    connection.execute(
        "INSERT INTO span_annotations(span_rowid, name, label, score, explanation, metadata,"
        " annotator_kind, identifier, source) VALUES (?, ?, ?, NULL, ?, '{}', 'LLM', ?, 'API')"
        " ON CONFLICT(name, span_rowid, identifier) DO UPDATE SET label = excluded.label,"
        " explanation = excluded.explanation, updated_at = CURRENT_TIMESTAMP",
        (rowid, name, label, explanation, IDENTIFIER),
    )


def step_1(connection: sqlite3.Connection) -> str:
    session_rowid = ensure_agent_session(connection)
    shell = load_shell(connection, session_rowid)
    for planted in PLANTED:
        rowid = span_rowid(connection, planted.root_span_id)
        upsert_span_annotation(connection, rowid, "note", None, planted.defect)
        append_line(
            shell,
            NOTES_SIDECAR,
            {
                "entity_kind": "span",
                "entity_id": planted.root_span_id,
                "note": planted.defect,
                "identifier": IDENTIFIER,
                "ts": now(),
            },
        )
    save_shell(connection, session_rowid, shell)
    return global_id("AgentSession", session_rowid)


def step_2(connection: sqlite3.Connection) -> str:
    session_rowid = ensure_agent_session(connection)
    shell = load_shell(connection, session_rowid)
    project_id = connection.execute(
        "SELECT id FROM projects WHERE name = ?", (PROJECT_NAME,)
    ).fetchone()[0]
    for name, spec in DIMENSIONS.items():
        config = {
            "name": None,
            "description": spec["description"],
            "type": "CATEGORICAL",
            "optimization_direction": "NONE",
            "values": [{"label": value, "score": None} for value in spec["values"]],
        }
        connection.execute(
            "INSERT INTO annotation_configs(name, config) VALUES (?, ?)"
            " ON CONFLICT(name) DO UPDATE SET config = excluded.config",
            (name, json.dumps(config)),
        )
        config_id = connection.execute(
            "SELECT id FROM annotation_configs WHERE name = ?", (name,)
        ).fetchone()[0]
        connection.execute(
            "INSERT OR IGNORE INTO project_annotation_configs(project_id, annotation_config_id)"
            " VALUES (?, ?)",
            (project_id, config_id),
        )
    for planted in PLANTED:
        rowid = span_rowid(connection, planted.root_span_id)
        for dimension in planted.dimensions:
            label = LABEL_FOR[dimension]
            upsert_span_annotation(connection, rowid, dimension, label, planted.defect)
            append_line(
                shell,
                AXIAL_SIDECAR,
                {
                    "entity_kind": "span",
                    "entity_id": planted.root_span_id,
                    "annotation_name": dimension,
                    "axial_label": label,
                    "explanation": planted.defect,
                    "identifier": IDENTIFIER,
                    "ts": now(),
                },
            )
    save_shell(connection, session_rowid, shell)
    return global_id("AgentSession", session_rowid)


def main() -> None:
    step = bump_step()
    connection = sqlite3.connect(DATA_DIR / "phoenix.db")
    with connection:
        session_id = (step_1 if step == 1 else step_2)(connection)
    connection.close()
    answer = (STEP1_ANSWER if step == 1 else STEP2_ANSWER).format(identifier=IDENTIFIER)
    out = AGENT_LOGS_DIR / "steps" / str(step)
    out.mkdir(parents=True, exist_ok=True)
    out.joinpath("session_id").write_text(session_id + "\n")
    out.joinpath("answer.md").write_text(answer)
    out.joinpath("answer.json").write_text("{}")
    out.joinpath("messages.json").write_text("[]")
    out.joinpath("new_messages.json").write_text("[]")
    out.joinpath("usage.json").write_text("{}")
    out.joinpath("metrics.json").write_text('{"tool_calls": 0}')
    latest = AGENT_LOGS_DIR / "latest"
    if latest.is_symlink() or latest.exists():
        latest.unlink()
    latest.symlink_to(out)


if __name__ == "__main__":
    main()

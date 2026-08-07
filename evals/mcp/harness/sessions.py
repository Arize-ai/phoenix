"""Session artifacts: one JSON file per benchmark session.

A session is one pytest run — one arm, the whole question grid — and its
artifact is self-describing: the meta block carries the arm, model, catalog
probe, no-tools baseline, and the ground-truth bundle the judge used, so the
offline tools (``report``, ``analyze``, ``rejudge``) never have to guess what a
set of runs was measured against.

Files from before the pytest refactor were bare ``runs-*.jsonl`` row dumps with
no meta block; ``load_session`` still reads those so old grids stay analyzable.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Iterable, Mapping, Optional, Sequence

SESSION_SCHEMA_VERSION = 1


@dataclass
class Session:
    """One loaded session artifact."""

    path: Path
    #: ``None`` for legacy pre-pytest ``.jsonl`` files, which carried no meta.
    meta: Optional[dict[str, Any]]
    runs: list[dict[str, Any]] = field(default_factory=list)


def write_session(
    path: Path, *, meta: Mapping[str, Any], runs: Sequence[Mapping[str, Any]]
) -> None:
    payload = {
        "schema_version": SESSION_SCHEMA_VERSION,
        "meta": dict(meta),
        "runs": list(runs),
    }
    path.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n")


def load_session(path: Path) -> Session:
    if path.suffix == ".jsonl":
        runs = [json.loads(line) for line in path.read_text().splitlines() if line.strip()]
        return Session(path=path, meta=None, runs=runs)
    payload = json.loads(path.read_text())
    return Session(path=path, meta=payload.get("meta") or {}, runs=payload.get("runs") or [])


def load_sessions(paths: Iterable[Path]) -> list[Session]:
    return [load_session(path) for path in paths]

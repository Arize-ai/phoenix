"""Cached loaders for Stage 1 artifacts.

Stage 2 analyses iterate quickly over the same parquets dozens of times. We
cache the loaded frames by path so the notebook can re-import or re-run a
cell without re-reading 600 MB of spans every time.

DuckDB is the escape hatch for analyses that don't fit in memory or that
are nicer to express in SQL — `duckdb_connection()` registers the parquets
as virtual views so a query like::

    duckdb_connection().sql("SELECT kind, COUNT(*) FROM spans GROUP BY 1")

works without materializing the full table in pandas.
"""

from __future__ import annotations

import json
from collections.abc import Iterator
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any, cast

import pandas as pd

from pipeline.config import (
    CLEAN_DIR,
    RAW_DIR,
    TRAJECTORIES_DIR,
)

# -- Default artifact paths ----------------------------------------------------

QUERIES_PATH = CLEAN_DIR / "user-queries.parquet"
QUERIES_EXTRACTED_PATH = CLEAN_DIR / "user-queries-extracted.parquet"
SPANS_PATH = TRAJECTORIES_DIR / "spans.parquet"
SESSIONS_PATH = TRAJECTORIES_DIR / "sessions.parquet"


@dataclass(frozen=True)
class CorpusPaths:
    """Resolved on-disk locations for the layered artifacts."""

    raw_dir: Path = RAW_DIR
    queries: Path = QUERIES_PATH
    queries_extracted: Path = QUERIES_EXTRACTED_PATH
    spans: Path = SPANS_PATH
    sessions: Path = SESSIONS_PATH

    def latest_raw_window(self) -> Path:
        """Return the largest ``copilot-prod-spans-*`` window directory.

        We typically have multiple windows on disk (the 2-day probe plus
        the 90-day run). Pick the one whose chunks total the most rows
        per the manifest — that's the "real run." Falls back to mtime if
        a manifest is missing.
        """

        def total_rows(p: Path) -> int:
            mf = p / "_manifest.json"
            if not mf.exists():
                return 0
            try:
                data = json.loads(mf.read_text())
            except (json.JSONDecodeError, OSError):
                return 0
            chunks = data.get("chunks", [])
            return sum(int(c.get("rows", 0)) for c in chunks)

        candidates = [p for p in self.raw_dir.iterdir() if p.is_dir()]
        if not candidates:
            raise FileNotFoundError(
                f"No raw export windows under {self.raw_dir}. Did Stage 1 run? See run_pipeline.py."
            )
        candidates.sort(key=lambda p: (total_rows(p), p.stat().st_mtime), reverse=True)
        return candidates[0]


# -- Cached loaders ------------------------------------------------------------


@lru_cache(maxsize=4)
def load_queries(path: str | None = None) -> pd.DataFrame:
    """Load the canonical Layer 1 (`user-queries.parquet`) flagged frame."""
    return pd.read_parquet(path or QUERIES_PATH)


@lru_cache(maxsize=4)
def load_queries_extracted(path: str | None = None) -> pd.DataFrame:
    """Load Layer 1a (`user-queries-extracted.parquet`).

    Equivalent to Layer 1 minus the flag columns; rarely needed except to
    inspect what the `is_empty` filter dropped.
    """
    return pd.read_parquet(path or QUERIES_EXTRACTED_PATH)


@lru_cache(maxsize=4)
def load_sessions(path: str | None = None) -> pd.DataFrame:
    """Load Layer 2b (`sessions.parquet`) — one row per session."""
    return pd.read_parquet(path or SESSIONS_PATH)


@lru_cache(maxsize=2)
def load_spans(
    path: str | None = None,
    columns: tuple[str, ...] | None = None,
) -> pd.DataFrame:
    """Load Layer 2a (`spans.parquet`).

    `spans.parquet` is ~600 MB on the 90d corpus, so prefer projecting to
    the columns you need with the ``columns=`` argument. The lru_cache key
    incorporates ``columns`` so two calls with different projections don't
    fight each other.
    """
    return pd.read_parquet(
        path or SPANS_PATH,
        columns=list(columns) if columns is not None else None,
    )


def load_raw_manifest(window_dir: Path | None = None) -> dict[str, object]:
    """Load the chunk manifest JSON for a Layer 0 export window."""
    paths = CorpusPaths()
    window = window_dir or paths.latest_raw_window()
    manifest = window / "_manifest.json"
    if not manifest.exists():
        raise FileNotFoundError(f"Missing manifest at {manifest}")
    return cast(dict[str, object], json.loads(manifest.read_text()))


def iter_raw_chunks(
    window_dir: Path | None = None,
    columns: list[str] | None = None,
) -> Iterator[tuple[Path, pd.DataFrame]]:
    """Yield each Layer 0 chunk as a DataFrame.

    Use this for span-level analyses that don't fit through the trajectory
    layer (e.g. inspecting `attributes.metadata` keys not lifted into
    Layer 2). Streams chunks one at a time — never holds the corpus in
    memory.
    """
    paths = CorpusPaths()
    window = window_dir or paths.latest_raw_window()
    chunks = sorted(window.glob("chunk_*.parquet"))
    if not chunks:
        raise FileNotFoundError(f"No chunk_*.parquet under {window}")
    for chunk_path in chunks:
        yield chunk_path, pd.read_parquet(chunk_path, columns=columns)


# -- Helpful derived frames ----------------------------------------------------


def alyx_only_spans(spans: pd.DataFrame) -> pd.DataFrame:
    """Drop the non-Alyx noise (GQL spans, `persist_message_internal`).

    Mirrors the recommended filter from `docs/data-schema.md`: keep only
    spans that belong to a real Alyx interaction. Also drops the
    GraphQL-query spans that ride under the same OTel context — they
    sometimes carry a session_id and slip past the simple session_id
    filter, but their `name` always starts with ``GQL query ``.
    """
    if "name" in spans.columns:
        is_gql = spans["name"].fillna("").str.startswith("GQL query ")
    else:
        is_gql = pd.Series(False, index=spans.index)
    mask = spans["session_id"].notna() & (spans["kind"].fillna("") != "") & ~is_gql
    return spans.loc[mask].copy()


def derive_tool_name(spans: pd.DataFrame) -> pd.Series[Any]:
    """Return a Series of tool names for Alyx tool spans.

    Stage 1 wrote ``attributes.tool.name`` into ``tool_name`` faithfully,
    but Alyx instrumentation leaves that attribute empty and puts the
    actual tool name in the span's top-level ``name`` field instead.
    This helper does the right join so analyses don't have to reach into
    the schema gotcha.

    Returns ``name`` for spans where ``kind == "TOOL"``, the row's name
    isn't a GQL-query span, and the name is non-empty. Otherwise
    returns ``None``.
    """
    is_tool = spans["kind"].fillna("") == "TOOL"
    nm = spans["name"].fillna("")
    is_gql = nm.str.startswith("GQL query ")
    valid = is_tool & ~is_gql & (nm != "")
    # Mask out the invalid rows. ``mask`` writes NaN where the condition
    # holds, so we mask the *complement* of ``valid``. The output Series
    # carries NaN for non-tool / GQL / empty-named rows.
    out: pd.Series[Any] = nm.astype(object).mask(~valid)
    return out


def attach_query_flags(
    sessions: pd.DataFrame,
    queries: pd.DataFrame,
) -> pd.DataFrame:
    """Roll Layer 1 flag aggregates up to the session level.

    Returns a copy of ``sessions`` with extra columns:
    ``query_count``, ``trivial_count``, ``naked_id_count``,
    ``seed_button_count``. Useful for "is this session mostly canned
    suggestions?" filtering.
    """
    grp = (
        queries.groupby("session_id")
        .agg(
            query_count=("query_text", "size"),
            trivial_count=("is_trivial", "sum"),
            naked_id_count=("is_naked_identifier", "sum"),
            seed_button_count=("is_seed_button_match", "sum"),
        )
        .astype("Int64")
    )
    return sessions.merge(grp, on="session_id", how="left")


# -- DuckDB ---------------------------------------------------------------------


def duckdb_connection() -> Any:
    """Return a DuckDB connection with the Layer 1/2 parquets registered.

    Tables exposed: ``queries``, ``sessions``, ``spans``. Layer 0 chunks
    are *not* registered (they're large + per-window); query the parquet
    file directly with ``read_parquet('data/raw/<window>/chunk_*.parquet')``
    if needed.

    Return type is ``Any`` because duckdb has no first-party stubs in this
    project's mypy resolution path and the connection's API is loose.
    """
    import duckdb

    con = duckdb.connect(":memory:")
    paths = CorpusPaths()
    if paths.queries.exists():
        con.sql(f"CREATE VIEW queries AS SELECT * FROM '{paths.queries}'")
    if paths.sessions.exists():
        con.sql(f"CREATE VIEW sessions AS SELECT * FROM '{paths.sessions}'")
    if paths.spans.exists():
        con.sql(f"CREATE VIEW spans AS SELECT * FROM '{paths.spans}'")
    return con

"""Layer 1a -- Extract user-query rows from the raw span export.

Based on the 2026-04-21 probe by the predecessor pipeline, the copilot-prod
span table has this shape:

  * Every root span is an AGENT span (parent_id null) with
    ``name == "ROUTER-<CATEGORY>"`` where CATEGORY is one of HOME_PAGE,
    PROMPT_OPTIMIZATION, CHAT, SEARCH, TRACE_AGENT, CUSTOM_EVAL,
    EXPERIMENT_SUMMARY, TASK_PAGE, AQL.
  * ``attributes.input.value`` is a JSON string:
    ``{"type":"user_input","question":"<text>","input_context":{...}}``
    The actual user query is the ``.question`` field.
  * ``attributes.metadata`` is a dict carrying the useful per-query context:
        arize_user_email, arize_org_id, arize_org_name, arize_account_name,
        copilot_router_type, current_page_url, ...
  * ``attributes.session.id`` and ``attributes.user.id`` are top-level columns.

Input can be either a single parquet file or a directory of chunk parquets (the
Layer 0 output shape for multi-chunk exports). In the directory case we read
chunks one at a time and extract the tiny root-agent subset from each, so we
never hold the full raw export in memory.

Output contract (one row per user query, written to
``data/clean/user-queries-extracted.parquet``):

    query_text        str
    router_type       str
    router_name       str   (top-level span ``name``; ROUTER-CATEGORY)
    trace_id          str
    session_id        str | None
    user_id           str | None
    user_email        str | None
    org_id            str | None
    org_name          str | None
    account_name      str | None
    current_page_url  str | None
    turn_index        int    (0-indexed within session, global across chunks)
    timestamp         datetime64[ns, UTC]
    raw_input_value   str
    source_span_id    str
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any

import pandas as pd

from .config import PipelineConfig

log = logging.getLogger(__name__)

USER_QUERIES_EXTRACTED = "user-queries-extracted.parquet"

# Required columns. Matches what Arize SDK v8 emits as of 2026-04-21.
REQUIRED_COLUMNS: tuple[str, ...] = (
    "context.trace_id",
    "parent_id",
    "attributes.input.value",
    "attributes.openinference.span.kind",
    "attributes.metadata",
    "name",
    "start_time",
)


def _is_root_span(parent_value: Any) -> bool:
    if parent_value is None:
        return True
    if isinstance(parent_value, float) and pd.isna(parent_value):
        return True
    if isinstance(parent_value, str) and parent_value.strip() == "":
        return True
    return False


def _parse_input_value(raw: Any) -> tuple[str | None, str]:
    """Return (question, raw_as_str). ``question`` is None if parse fails or no .question key."""
    if raw is None or (isinstance(raw, float) and pd.isna(raw)):
        return None, ""
    if not isinstance(raw, str):
        try:
            raw = json.dumps(raw)
        except (TypeError, ValueError):
            raw = str(raw)
    try:
        data = json.loads(raw)
    except (json.JSONDecodeError, TypeError):
        return None, raw
    if isinstance(data, dict):
        q = data.get("question")
        if isinstance(q, str):
            return q, raw
    return None, raw


def _md_get(metadata: Any, key: str) -> str | None:
    if not isinstance(metadata, dict):
        return None
    value = metadata.get(key)
    if value in (None, "", [], {}):
        return None
    return str(value)


def _extract_router_type(name: str | None, metadata: Any) -> str | None:
    """Prefer metadata.copilot_router_type; fall back to stripping ROUTER- prefix from name."""
    from_md = _md_get(metadata, "copilot_router_type")
    if from_md:
        return from_md
    if isinstance(name, str) and name.startswith("ROUTER-"):
        return name[len("ROUTER-") :]
    return None


def _output_path(cfg: PipelineConfig) -> Path:
    return cfg.clean_dir / USER_QUERIES_EXTRACTED


def _discover_chunks(raw_path: Path) -> list[Path]:
    if raw_path.is_dir():
        chunks = sorted(raw_path.glob("chunk_*.parquet"))
        if not chunks:
            # Legacy: any parquet in the directory.
            chunks = sorted(raw_path.glob("*.parquet"))
        if not chunks:
            raise RuntimeError(f"No parquet files found under {raw_path}")
        return chunks
    if raw_path.is_file():
        return [raw_path]
    raise RuntimeError(f"Raw path {raw_path} is neither a file nor a directory.")


def _extract_from_chunk(df: pd.DataFrame) -> pd.DataFrame:
    """Filter + project a single chunk to the user-query row shape."""
    missing = [c for c in REQUIRED_COLUMNS if c not in df.columns]
    if missing:
        raise RuntimeError(
            f"Raw parquet missing required columns: {missing}. "
            f"First 30 columns: {list(df.columns)[:30]}"
        )

    root_mask = df["parent_id"].apply(_is_root_span)
    agent_mask = df["attributes.openinference.span.kind"] == "AGENT"
    candidate_mask = root_mask & agent_mask
    if not candidate_mask.any():
        return pd.DataFrame()

    work = df.loc[candidate_mask].copy().reset_index(drop=True)

    parsed = work["attributes.input.value"].apply(_parse_input_value)
    work["query_text"] = parsed.apply(lambda pair: pair[0])
    work["raw_input_value"] = parsed.apply(lambda pair: pair[1])
    work = work.loc[work["query_text"].notna()].reset_index(drop=True)

    md = work["attributes.metadata"]
    work["user_email"] = md.apply(lambda m: _md_get(m, "arize_user_email"))
    work["org_id"] = md.apply(lambda m: _md_get(m, "arize_org_id"))
    work["org_name"] = md.apply(lambda m: _md_get(m, "arize_org_name"))
    work["account_name"] = md.apply(lambda m: _md_get(m, "arize_account_name"))
    work["current_page_url"] = md.apply(lambda m: _md_get(m, "current_page_url"))

    work["router_type"] = [
        _extract_router_type(n, m) for n, m in zip(work["name"], md, strict=True)
    ]
    work["router_name"] = work["name"].astype(str)

    work["trace_id"] = work["context.trace_id"].astype(str)
    work["session_id"] = work["attributes.session.id"].astype("string")
    work["user_id"] = work["attributes.user.id"].astype("string")
    work["timestamp"] = pd.to_datetime(work["start_time"], utc=True, errors="coerce")
    work["source_span_id"] = (
        work["context.span_id"].astype(str) if "context.span_id" in work.columns else ""
    )

    slim_cols = [
        "query_text",
        "router_type",
        "router_name",
        "trace_id",
        "session_id",
        "user_id",
        "user_email",
        "org_id",
        "org_name",
        "account_name",
        "current_page_url",
        "timestamp",
        "raw_input_value",
        "source_span_id",
    ]
    return work[slim_cols].reset_index(drop=True)


def _assign_turn_indices(df: pd.DataFrame) -> pd.DataFrame:
    """Add ``turn_index`` (0-indexed, by timestamp within session)."""
    if df.empty:
        df["turn_index"] = pd.array([], dtype="Int64")
        return df
    if not df["session_id"].notna().any():
        df["turn_index"] = pd.array([0] * len(df), dtype="Int64")
        return df

    def _assign(group: pd.DataFrame) -> "pd.Series[int]":
        ordered = group.sort_values("timestamp", kind="stable")
        return pd.Series(range(len(ordered)), index=ordered.index)

    df["turn_index"] = (
        df.groupby(df["session_id"].fillna("__none__"), sort=False, group_keys=False)
        .apply(_assign)
        .astype("Int64")
    )
    return df


def run(cfg: PipelineConfig, raw_path: Path, *, force: bool = False) -> Path:
    """Extract one row per user query. Returns the path to the extracted parquet."""
    out_path = _output_path(cfg)
    if out_path.exists() and not force:
        log.info("Extracted queries already exist at %s -- skipping Layer 1a", out_path)
        return out_path

    chunks = _discover_chunks(raw_path)
    log.info("Extract: streaming %d chunk file(s) from %s", len(chunks), raw_path)

    frames: list[pd.DataFrame] = []
    total_rows = 0
    for chunk in chunks:
        df_chunk = pd.read_parquet(chunk)
        total_rows += len(df_chunk)
        extracted = _extract_from_chunk(df_chunk)
        log.info(
            "Chunk %s: %d raw -> %d user-query rows",
            chunk.name,
            len(df_chunk),
            len(extracted),
        )
        if not extracted.empty:
            frames.append(extracted)
        del df_chunk

    if not frames:
        raise RuntimeError("No user-query rows extracted from any chunk.")

    combined = pd.concat(frames, ignore_index=True)
    combined = _assign_turn_indices(combined)

    final_cols = [
        "query_text",
        "router_type",
        "router_name",
        "trace_id",
        "session_id",
        "user_id",
        "user_email",
        "org_id",
        "org_name",
        "account_name",
        "current_page_url",
        "turn_index",
        "timestamp",
        "raw_input_value",
        "source_span_id",
    ]
    out = combined[final_cols].reset_index(drop=True)
    log.info("Extracted %d user-query rows from %d raw spans", len(out), total_rows)

    try:
        log.info(
            "Router-type distribution:\n%s",
            out["router_type"].value_counts(dropna=False).to_string(),
        )
    except Exception:  # noqa: BLE001 - best-effort logging
        pass

    out.to_parquet(out_path, index=False)
    log.info("Wrote %s", out_path)
    return out_path

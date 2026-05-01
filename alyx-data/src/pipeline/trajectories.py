"""Layer 2 -- Reconstruct full session/trace trajectories from Layer 0.

Streams the per-chunk raw parquets and emits two parquets that, joined on
``session_id`` / ``trace_id`` / ``span_id``, give a fully reconstructable view
of every Alyx interaction in the window:

  * ``data/trajectories/spans.parquet``    -- one row per span (the source of
                                              truth for trajectory shape).
  * ``data/trajectories/sessions.parquet`` -- one row per session, with summary
                                              stats and ordered ``query_sequence``
                                              + ``router_type_sequence`` lists.

Why two files (option 2 from the plan) instead of one nested-list parquet:

  * Pandas + pyarrow handle nested ``list[struct]`` columns, but the inner
    structs need a uniform schema. Spans here have very heterogeneous
    ``raw_attrs`` shapes (LLM, TOOL, RETRIEVER, AGENT, ...). Forcing them all
    into one struct would require either lossy projection or JSON-encoding the
    attrs. Either way, scanning trajectories means materializing the whole
    nested column.
  * A flat ``spans.parquet`` keyed by ``(session_id, trace_id, span_id)`` is
    SQL/DuckDB-friendly, predicate-pushdown works, and reconstructing one
    session is a single ``WHERE session_id = ?`` query.
  * ``sessions.parquet`` stays small (~3.8k rows for the 90d window) and is
    safe to load into memory.

To reconstruct a single session::

    sessions = pd.read_parquet("data/trajectories/sessions.parquet")
    spans    = pd.read_parquet("data/trajectories/spans.parquet")
    sid      = sessions.iloc[0]["session_id"]
    one      = (
        spans.loc[spans["session_id"] == sid]
             .sort_values(["trace_start_time", "start_time"])
    )

Memory discipline: we never hold the full corpus in memory. Layer 0 chunks are
read one at a time, the slim per-span projection is appended to a single output
parquet via ``pyarrow.parquet.ParquetWriter``, and only at the end do we do a
second pass to aggregate per-session summary rows.
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Any, cast

import pandas as pd
import pyarrow as pa
import pyarrow.parquet as pq

from .config import PipelineConfig
from .extract import _md_get, _parse_input_value

log = logging.getLogger(__name__)

SPANS_PARQUET = "spans.parquet"
SESSIONS_PARQUET = "sessions.parquet"

# Columns we read from each Layer 0 chunk. Subset of the export whitelist.
SPAN_READ_COLUMNS: tuple[str, ...] = (
    "context.trace_id",
    "context.span_id",
    "parent_id",
    "name",
    "attributes.openinference.span.kind",
    "attributes.input.value",
    "attributes.output.value",
    "attributes.metadata",
    "attributes.session.id",
    "attributes.user.id",
    "start_time",
    "end_time",
    "status_code",
    "status_message",
    "latency_ms",
    "attributes.tool.name",
    "attributes.tool.parameters",
    "attributes.llm.model_name",
    "attributes.llm.provider",
    "attributes.llm.token_count.prompt",
    "attributes.llm.token_count.completion",
    "attributes.llm.token_count.total",
    "attributes.llm.prompt_template.template",
    "attributes.llm.prompt_template.version",
    "events",
)

# Final shape of ``spans.parquet``. All strings; numerics nullable.
SPAN_OUTPUT_COLUMNS: tuple[str, ...] = (
    "session_id",
    "trace_id",
    "span_id",
    "parent_id",
    "name",
    "kind",
    "user_id",
    "user_email",
    "org_id",
    "org_name",
    "start_time",
    "end_time",
    "duration_ms",
    "status_code",
    "status_message",
    "input_value",
    "output_value",
    "tool_name",
    "tool_input",
    "tool_output",
    "llm_model",
    "llm_provider",
    "llm_token_count_prompt",
    "llm_token_count_completion",
    "llm_token_count_total",
    "llm_prompt_template_version",
    "has_error",
    "error",
    "raw_attrs_json",
)


def _truncate(text: Any, limit: int) -> str | None:
    if text is None:
        return None
    if isinstance(text, float) and pd.isna(text):
        return None
    if isinstance(text, str):
        s: str = text
    else:
        try:
            s = json.dumps(text, default=str)
        except (TypeError, ValueError):
            s = str(text)
    if len(s) > limit:
        return s[:limit] + f"... [truncated {len(s) - limit} chars]"
    return s


def _serialize(value: Any) -> str | None:
    """JSON-serialize a possibly-nested value, returning None for missing."""
    if value is None:
        return None
    if isinstance(value, float) and pd.isna(value):
        return None
    if isinstance(value, str):
        return value
    try:
        return json.dumps(value, default=str)
    except (TypeError, ValueError):
        return str(value)


def _events_error(events: Any) -> tuple[bool, str | None]:
    """Return (has_error, error_summary) extracted from OTel ``events`` array.

    OTel error events have ``name == "exception"`` and carry attributes like
    ``exception.type`` / ``exception.message``.
    """
    if events is None:
        return False, None
    if isinstance(events, float) and pd.isna(events):
        return False, None
    try:
        iterable = list(events)
    except TypeError:
        return False, None
    for ev in iterable:
        if not isinstance(ev, dict):
            continue
        if ev.get("name") == "exception":
            attrs = ev.get("attributes") or {}
            etype = attrs.get("exception.type")
            emsg = attrs.get("exception.message")
            summary = ": ".join(str(p) for p in (etype, emsg) if p)
            return True, summary or "exception"
    return False, None


def _row_to_span(row: "pd.Series[Any]", *, trunc: int) -> dict[str, Any]:
    md = row.get("attributes.metadata")
    kind = row.get("attributes.openinference.span.kind")
    has_err, err_summary = _events_error(row.get("events"))

    # For TOOL spans, surface the tool I/O distinctly. Otherwise fall back to
    # the generic span input.value / output.value strings.
    tool_name = row.get("attributes.tool.name")
    tool_params = row.get("attributes.tool.parameters")
    is_tool = isinstance(kind, str) and kind.upper() == "TOOL"

    input_value = _truncate(row.get("attributes.input.value"), trunc)
    output_value = _truncate(row.get("attributes.output.value"), trunc)

    tool_input = (
        _truncate(_serialize(tool_params) or row.get("attributes.input.value"), trunc)
        if is_tool
        else None
    )
    tool_output = _truncate(row.get("attributes.output.value"), trunc) if is_tool else None

    start = _to_dt(row.get("start_time"))
    end = _to_dt(row.get("end_time"))
    if pd.isna(start) or pd.isna(end):
        duration_ms: float | None = None
    else:
        duration_ms = float((end - start).total_seconds() * 1000.0)

    raw_attrs = {k: row[k] for k in row.index if k.startswith("attributes.")}
    raw_attrs_json = _truncate(_serialize(raw_attrs), trunc * 4)

    return {
        "session_id": _serialize(row.get("attributes.session.id")),
        "trace_id": str(row.get("context.trace_id")),
        "span_id": str(row.get("context.span_id")),
        "parent_id": _serialize(row.get("parent_id")),
        "name": _serialize(row.get("name")),
        "kind": _serialize(kind),
        "user_id": _serialize(row.get("attributes.user.id")),
        "user_email": _md_get(md, "arize_user_email"),
        "org_id": _md_get(md, "arize_org_id"),
        "org_name": _md_get(md, "arize_org_name"),
        # Floor to microseconds before pydatetime conversion so we don't get
        # the "discarding nonzero nanoseconds" warning from pandas.
        "start_time": (start.floor("us").to_pydatetime() if not pd.isna(start) else None),
        "end_time": (end.floor("us").to_pydatetime() if not pd.isna(end) else None),
        "duration_ms": duration_ms,
        "status_code": _serialize(row.get("status_code")),
        "status_message": _serialize(row.get("status_message")),
        "input_value": input_value,
        "output_value": output_value,
        "tool_name": _serialize(tool_name),
        "tool_input": tool_input,
        "tool_output": tool_output,
        "llm_model": _serialize(row.get("attributes.llm.model_name")),
        "llm_provider": _serialize(row.get("attributes.llm.provider")),
        "llm_token_count_prompt": _to_int(row.get("attributes.llm.token_count.prompt")),
        "llm_token_count_completion": _to_int(row.get("attributes.llm.token_count.completion")),
        "llm_token_count_total": _to_int(row.get("attributes.llm.token_count.total")),
        "llm_prompt_template_version": _serialize(
            row.get("attributes.llm.prompt_template.version")
        ),
        "has_error": bool(has_err),
        "error": err_summary,
        "raw_attrs_json": raw_attrs_json,
    }


def _to_dt(value: Any) -> pd.Timestamp:
    """``pd.to_datetime`` wrapper that's mypy-friendly across object-dtype values.

    Returns a ``pd.Timestamp`` (or ``NaT``, which is technically ``NaTType`` but
    type-compatible at runtime). Always UTC-tz, ``errors='coerce'``.
    """
    return cast(pd.Timestamp, pd.to_datetime(cast(Any, value), utc=True, errors="coerce"))


def _to_int(value: Any) -> int | None:
    if value is None:
        return None
    if isinstance(value, float) and pd.isna(value):
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _spans_arrow_schema() -> pa.Schema:
    """Static schema for spans.parquet so chunk batches are concatenable."""
    fields: list[tuple[str, pa.DataType]] = [
        ("session_id", pa.string()),
        ("trace_id", pa.string()),
        ("span_id", pa.string()),
        ("parent_id", pa.string()),
        ("name", pa.string()),
        ("kind", pa.string()),
        ("user_id", pa.string()),
        ("user_email", pa.string()),
        ("org_id", pa.string()),
        ("org_name", pa.string()),
        ("start_time", pa.timestamp("us", tz="UTC")),
        ("end_time", pa.timestamp("us", tz="UTC")),
        ("duration_ms", pa.float64()),
        ("status_code", pa.string()),
        ("status_message", pa.string()),
        ("input_value", pa.string()),
        ("output_value", pa.string()),
        ("tool_name", pa.string()),
        ("tool_input", pa.string()),
        ("tool_output", pa.string()),
        ("llm_model", pa.string()),
        ("llm_provider", pa.string()),
        ("llm_token_count_prompt", pa.int64()),
        ("llm_token_count_completion", pa.int64()),
        ("llm_token_count_total", pa.int64()),
        ("llm_prompt_template_version", pa.string()),
        ("has_error", pa.bool_()),
        ("error", pa.string()),
        ("raw_attrs_json", pa.string()),
    ]
    return pa.schema(fields)


def _discover_chunks(raw_path: Path) -> list[Path]:
    if raw_path.is_dir():
        chunks = sorted(raw_path.glob("chunk_*.parquet"))
        if not chunks:
            chunks = sorted(raw_path.glob("*.parquet"))
        if not chunks:
            raise RuntimeError(f"No parquet files found under {raw_path}")
        return chunks
    if raw_path.is_file():
        return [raw_path]
    raise RuntimeError(f"Raw path {raw_path} is neither a file nor a directory.")


def _read_chunk(path: Path) -> pd.DataFrame:
    """Read a Layer 0 chunk, projecting only the columns we need for Layer 2."""
    available = pq.ParquetFile(path).schema_arrow.names  # type: ignore[no-untyped-call]
    cols = [c for c in SPAN_READ_COLUMNS if c in available]
    return pd.read_parquet(path, columns=cols)


def _build_spans(cfg: PipelineConfig, chunks: list[Path], out_path: Path) -> int:
    """Stream Layer 0 chunks -> spans.parquet. Returns total span rows."""
    schema = _spans_arrow_schema()
    writer: pq.ParquetWriter | None = None
    total = 0
    try:
        for chunk in chunks:
            df = _read_chunk(chunk)
            log.info("Trajectories: chunk %s -> %d spans", chunk.name, len(df))
            if df.empty:
                continue
            records: list[dict[str, Any]] = []
            for _, row in df.iterrows():
                records.append(_row_to_span(row, trunc=cfg.trajectory_text_trunc_chars))
            del df
            if not records:
                continue
            table = pa.Table.from_pylist(records, schema=schema)
            if writer is None:
                writer = pq.ParquetWriter(  # type: ignore[no-untyped-call]
                    out_path, schema, compression="snappy"
                )
            writer.write_table(table)  # type: ignore[no-untyped-call]
            total += table.num_rows
            del records, table
    finally:
        if writer is not None:
            writer.close()  # type: ignore[no-untyped-call]
    return total


@dataclass
class SessionAgg:
    session_id: str
    user_id: str | None = None
    user_email: str | None = None
    org_id: str | None = None
    org_name: str | None = None
    is_internal: bool = False
    trace_ids: set[str] | None = None
    turn_count: int = 0
    span_count: int = 0
    error_count: int = 0
    start_time: pd.Timestamp | None = None
    end_time: pd.Timestamp | None = None
    # Ordered by trace start time.
    traces: list[tuple[pd.Timestamp, str, str, str | None]] | None = (
        None  # (ts, trace_id, router_name, query_text)
    )


def _build_sessions(
    cfg: PipelineConfig, raw_chunks: list[Path], spans_path: Path, sessions_out: Path
) -> int:
    """Second pass: aggregate per-session metadata + ordered trace summaries.

    We re-stream the raw chunks (cheap relative to span build) so we can pick
    out the root AGENT span per trace and grab its parsed user-query text
    without rejoining against Layer 1.
    """
    sessions: dict[str, SessionAgg] = {}

    spans_df = pd.read_parquet(
        spans_path,
        columns=[
            "session_id",
            "trace_id",
            "span_id",
            "has_error",
            "start_time",
            "end_time",
        ],
    )
    # Per-session aggregates from the spans table (cheap, fully streamable later
    # if memory pressure ever becomes a problem -- spans.parquet is the bulk).
    grp = spans_df.dropna(subset=["session_id"]).groupby("session_id", sort=False)
    for sid, sub in grp:
        agg = SessionAgg(
            session_id=str(sid),
            trace_ids=set(sub["trace_id"].astype(str)),
            span_count=int(len(sub)),
            error_count=int(sub["has_error"].fillna(False).sum()),
            start_time=sub["start_time"].min(),
            end_time=sub["end_time"].max(),
            traces=[],
        )
        sessions[str(sid)] = agg
    log.info("Trajectories: %d sessions seen across %d span rows", len(sessions), len(spans_df))
    del spans_df

    # Second pass: pick out root AGENT spans to grab user identity + query text
    # in time order per session.
    for chunk in raw_chunks:
        df = _read_chunk(chunk)
        if df.empty:
            continue
        roots = df.loc[
            (df["parent_id"].isna() | (df["parent_id"].astype(str).str.strip() == ""))
            & (df["attributes.openinference.span.kind"] == "AGENT")
        ].copy()
        if roots.empty:
            del df
            continue
        for _, row in roots.iterrows():
            sid_raw: Any = row.get("attributes.session.id")
            if sid_raw is None or (isinstance(sid_raw, float) and pd.isna(sid_raw)):
                continue
            sid_key: str = str(sid_raw)
            agg_opt = sessions.get(sid_key)
            if agg_opt is None:
                continue
            agg = agg_opt
            md = row.get("attributes.metadata")
            email = _md_get(md, "arize_user_email")
            org = _md_get(md, "arize_org_name")
            if agg.user_email is None and email is not None:
                agg.user_email = email
            if agg.user_id is None:
                uid = row.get("attributes.user.id")
                if uid is not None and not (isinstance(uid, float) and pd.isna(uid)):
                    agg.user_id = str(uid)
            if agg.org_name is None and org is not None:
                agg.org_name = org
            if agg.org_id is None:
                org_id = _md_get(md, "arize_org_id")
                if org_id is not None:
                    agg.org_id = org_id
            agg.is_internal = agg.is_internal or bool(
                email and any(email.lower().endswith(d) for d in cfg.internal_email_domains)
            )
            ts = _to_dt(row.get("start_time"))
            qtext, _ = _parse_input_value(row.get("attributes.input.value"))
            router = row.get("name")
            if agg.traces is not None:
                agg.traces.append(
                    (
                        ts if not pd.isna(ts) else pd.Timestamp("1970-01-01", tz="UTC"),
                        str(row.get("context.trace_id")),
                        str(router) if router is not None else "",
                        qtext,
                    )
                )
        agg_count = len(roots)
        log.info("Trajectories(sessions pass): chunk %s -> %d root agents", chunk.name, agg_count)
        del df, roots

    rows: list[dict[str, Any]] = []
    for sid, agg in sessions.items():
        traces_sorted = sorted(agg.traces or [], key=lambda x: x[0])
        agg.turn_count = len(traces_sorted)
        rows.append(
            {
                "session_id": sid,
                "user_id": agg.user_id,
                "user_email": agg.user_email,
                "org_id": agg.org_id,
                "org_name": agg.org_name,
                "is_internal": agg.is_internal,
                "trace_count": len(agg.trace_ids or set()),
                "turn_count": agg.turn_count,
                "span_count": agg.span_count,
                "error_count": agg.error_count,
                "start_time": (
                    agg.start_time.to_pydatetime()
                    if agg.start_time is not None and not pd.isna(agg.start_time)
                    else None
                ),
                "end_time": (
                    agg.end_time.to_pydatetime()
                    if agg.end_time is not None and not pd.isna(agg.end_time)
                    else None
                ),
                "duration_ms": (
                    float((agg.end_time - agg.start_time).total_seconds() * 1000.0)
                    if (
                        agg.start_time is not None
                        and agg.end_time is not None
                        and not pd.isna(agg.start_time)
                        and not pd.isna(agg.end_time)
                    )
                    else None
                ),
                "trace_ids": [t[1] for t in traces_sorted],
                "router_type_sequence": [t[2] for t in traces_sorted],
                "query_sequence": [t[3] or "" for t in traces_sorted],
            }
        )

    if not rows:
        raise RuntimeError("No sessions reconstructed; check Layer 0 outputs.")

    sessions_df = pd.DataFrame(rows)
    sessions_df.to_parquet(sessions_out, index=False)
    log.info("Wrote %s (%d sessions)", sessions_out, len(sessions_df))
    return len(sessions_df)


def run(cfg: PipelineConfig, raw_path: Path, *, force: bool = False) -> tuple[Path, Path]:
    """Build Layer 2. Returns (spans_path, sessions_path)."""
    spans_out = cfg.trajectories_dir / SPANS_PARQUET
    sessions_out = cfg.trajectories_dir / SESSIONS_PARQUET

    if spans_out.exists() and sessions_out.exists() and not force:
        log.info(
            "Trajectories already exist (%s, %s) -- skipping Layer 2",
            spans_out,
            sessions_out,
        )
        return spans_out, sessions_out

    chunks = _discover_chunks(raw_path)
    log.info("Layer 2: building from %d chunks", len(chunks))

    if force or not spans_out.exists():
        if spans_out.exists():
            spans_out.unlink()
        n_spans = _build_spans(cfg, chunks, spans_out)
        log.info("spans.parquet: %d rows", n_spans)
    else:
        log.info("spans.parquet already present, reusing")

    if force or not sessions_out.exists():
        if sessions_out.exists():
            sessions_out.unlink()
        n_sessions = _build_sessions(cfg, chunks, spans_out, sessions_out)
        log.info("sessions.parquet: %d rows", n_sessions)
    else:
        log.info("sessions.parquet already present, reusing")

    return spans_out, sessions_out

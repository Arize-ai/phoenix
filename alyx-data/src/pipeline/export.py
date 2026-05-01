"""Layer 0 -- Export ~90 days of copilot-prod spans from Arize.

Uses the Arize SDK v8 ``ArizeClient.spans.export_to_df``. Windows are chunked
into ``EXPORT_CHUNK_DAYS``-wide sub-windows, and each chunk is written to its
own parquet file under::

    data/raw/<window>/chunk_YYYY-MM-DD_YYYY-MM-DD.parquet
    data/raw/<window>/_manifest.json

We deliberately do NOT concatenate all chunks in memory -- at 90 days / ~400k
rows each row carries several nested dicts (``attributes.metadata``,
``attributes.llm.input_messages``, ...), which puts multi-GB pressure on the
process. Layer 1 / Layer 2 read chunks one at a time.

Re-runs are idempotent per chunk: an existing chunk parquet is skipped unless
``force=True``.
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timedelta
from pathlib import Path
from typing import TYPE_CHECKING, Any

import pandas as pd

from .config import PipelineConfig

if TYPE_CHECKING:
    from arize.client import ArizeClient

log = logging.getLogger(__name__)

MANIFEST_NAME = "_manifest.json"

# Only keep columns the downstream pipeline needs. This serves two purposes:
#   1. Dramatic size reduction -- a full 65-col span has many nested LLM/eval
#      telemetry fields we never look at.
#   2. Avoids pyarrow "cannot mix list and non-list" errors on heterogeneous
#      object columns (e.g. ``attributes.llm.prompt_template.variables``) that
#      surface when serializing larger frames.
#
# This whitelist is wider than the predecessor's so Layer 2 (trajectories) can
# reconstruct tool calls, LLM I/O, and model/token metadata. See
# docs/data-schema.md for the full provenance.
KEEP_COLUMNS: tuple[str, ...] = (
    # identity / tree shape
    "context.trace_id",
    "context.span_id",
    "parent_id",
    "name",
    "attributes.openinference.span.kind",
    # span I/O
    "attributes.input.value",
    "attributes.output.value",
    "attributes.input.mime_type",
    "attributes.output.mime_type",
    # session / user identity
    "attributes.session.id",
    "attributes.user.id",
    "attributes.metadata",
    # timing / status
    "start_time",
    "end_time",
    "status_code",
    "status_message",
    "latency_ms",
    # tool spans
    "attributes.tool.name",
    "attributes.tool.description",
    "attributes.tool.parameters",
    # LLM spans
    "attributes.llm.model_name",
    "attributes.llm.provider",
    "attributes.llm.system",
    "attributes.llm.token_count.prompt",
    "attributes.llm.token_count.completion",
    "attributes.llm.token_count.total",
    "attributes.llm.prompt_template.template",
    "attributes.llm.prompt_template.version",
    # retriever / chain
    "attributes.retrieval.documents",
    # error events
    "events",
)


def _narrow(df: pd.DataFrame) -> pd.DataFrame:
    """Return ``df`` with only ``KEEP_COLUMNS`` that exist, in that order."""
    cols = [c for c in KEEP_COLUMNS if c in df.columns]
    return df[cols].copy()


def _window_dir(cfg: PipelineConfig) -> Path:
    start = cfg.start_time.strftime("%Y-%m-%d")
    end = cfg.end_time.strftime("%Y-%m-%d")
    d = cfg.raw_dir / f"copilot-prod-spans-{start}_to_{end}"
    d.mkdir(parents=True, exist_ok=True)
    return d


def _chunk_path(window_dir: Path, start: datetime, end: datetime) -> Path:
    return window_dir / f"chunk_{start.strftime('%Y-%m-%d')}_{end.strftime('%Y-%m-%d')}.parquet"


def _window_chunks(
    start: datetime, end: datetime, chunk_days: int
) -> list[tuple[datetime, datetime]]:
    chunks: list[tuple[datetime, datetime]] = []
    cur = start
    while cur < end:
        nxt = min(cur + timedelta(days=chunk_days), end)
        chunks.append((cur, nxt))
        cur = nxt
    return chunks


def _export_chunk(
    client: "ArizeClient",
    cfg: PipelineConfig,
    start: datetime,
    end: datetime,
) -> pd.DataFrame:
    """Export a single window and return rows as a DataFrame."""
    log.info("Exporting %s -> %s", start.isoformat(), end.isoformat())
    df: pd.DataFrame = client.spans.export_to_df(
        space_id=cfg.space_id,
        project_name=cfg.model_id,
        start_time=start,
        end_time=end,
    )
    return df


def _manifest_path(window_dir: Path) -> Path:
    return window_dir / MANIFEST_NAME


def _write_manifest(window_dir: Path, chunks: list[dict[str, Any]]) -> None:
    _manifest_path(window_dir).write_text(json.dumps({"chunks": chunks}, indent=2))


def run(cfg: PipelineConfig, *, force: bool = False) -> Path:
    """Run Layer 0. Returns the directory of raw per-chunk parquets."""
    window_dir = _window_dir(cfg)
    manifest = _manifest_path(window_dir)

    # Short-circuit: manifest exists AND all chunk files are present.
    if manifest.exists() and not force:
        existing = sorted(window_dir.glob("chunk_*.parquet"))
        if existing:
            log.info(
                "Raw export already present at %s (%d chunk files) -- skipping Layer 0",
                window_dir,
                len(existing),
            )
            return window_dir

    # Import at call time so --help works without arize installed.
    from arize.client import ArizeClient

    client: Any = ArizeClient(api_key=cfg.arize_api_key)

    chunks = _window_chunks(cfg.start_time, cfg.end_time, cfg.export_chunk_days)
    log.info("Exporting %d chunks across %d-day windows", len(chunks), cfg.export_chunk_days)

    manifest_entries: list[dict[str, Any]] = []
    total_rows = 0
    for start, end in chunks:
        out = _chunk_path(window_dir, start, end)
        if out.exists() and not force:
            n = int(pd.read_parquet(out, columns=[]).shape[0])
            log.info("Chunk %s already exists (%d rows) -- skipping", out.name, n)
            manifest_entries.append(
                {
                    "path": out.name,
                    "start": start.isoformat(),
                    "end": end.isoformat(),
                    "rows": n,
                }
            )
            total_rows += n
            continue

        try:
            df = _export_chunk(client, cfg, start, end)
        except Exception as exc:  # noqa: BLE001 - log & continue on partial-window failure
            log.error("Chunk %s-%s failed: %s", start, end, exc)
            continue

        if df.empty:
            log.warning("Chunk %s-%s returned 0 rows", start.date(), end.date())
            continue

        df = _narrow(df)
        tmp = out.with_suffix(out.suffix + ".tmp")
        df.to_parquet(tmp, index=False)
        tmp.replace(out)
        n_rows = len(df)
        total_rows += n_rows
        manifest_entries.append(
            {"path": out.name, "start": start.isoformat(), "end": end.isoformat(), "rows": n_rows}
        )
        log.info("Wrote %s (%d rows, %.1f MB)", out.name, n_rows, out.stat().st_size / 1e6)
        # Free memory before the next chunk
        del df

    if not manifest_entries:
        raise RuntimeError("No chunks were successfully exported.")

    _write_manifest(window_dir, manifest_entries)
    log.info(
        "Export complete: %d chunks, %d rows total, window %s",
        len(manifest_entries),
        total_rows,
        window_dir.name,
    )
    return window_dir

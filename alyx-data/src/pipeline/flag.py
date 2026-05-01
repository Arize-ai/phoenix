"""Layer 1b -- Annotate extracted user queries with scope flags.

Adapted from the predecessor's ``filter.py``. The key change: this step does
NOT drop scoped rows. It only adds boolean flag columns and applies a single
hard validity drop (``is_empty``). Stages 2/3 of the alyx-data project decide
how to use the flags downstream.

Input:  ``data/clean/user-queries-extracted.parquet``  (from extract.py)
Output: ``data/clean/user-queries.parquet``            (canonical Layer 1)

Flags added (all bool, never null):

  * ``is_internal``           -- ``user_email`` ends in any internal domain.
                                  Also True if email is null AND ``org_name``
                                  is in ``cfg.internal_org_names``.
  * ``is_empty``              -- normalized query length < ``min_query_chars``.
                                  This is the only HARD DROP at Layer 1.
  * ``is_trivial``            -- normalized query is in ``cfg.trivial_queries``.
  * ``is_naked_identifier``   -- query is a bare UUID, S3 URI, URL, hex hash,
                                  email, or long number (SEARCH-style lookup).
  * ``is_seed_button_match``  -- normalized query appears as a *first-turn*
                                  query across at least
                                  ``cfg.seed_query_min_distinct_users`` distinct
                                  ``user_id``s. Heuristic for landing-page
                                  canned-suggestion buttons.

Two helper columns ride along for downstream debug/sorting:

  * ``query_norm``                   -- ``str.strip().lower()`` w/ collapsed ws.
  * ``seed_distinct_first_turn_users`` -- distinct user count for the heuristic
                                         (Int64, null where N/A).
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from pathlib import Path

import pandas as pd

from .config import PipelineConfig

log = logging.getLogger(__name__)

USER_QUERIES_FLAGGED = "user-queries.parquet"

_WS_RE = re.compile(r"\s+")

# Patterns whose full-string match means the query is a "naked identifier", i.e.
# a SEARCH-style lookup payload rather than a natural-language question.
_NAKED_ID_PATTERNS: tuple[re.Pattern[str], ...] = (
    re.compile(r"^s3://\S+$"),  # S3 URI
    re.compile(r"^https?://\S+$"),  # bare URL
    re.compile(r"^[a-f0-9]{16,}$"),  # long hex hash
    re.compile(  # bare UUID
        r"^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$"
    ),
    re.compile(r"^[\w.+-]+@[\w-]+\.[\w.-]+$"),  # bare email
    re.compile(r"^\d{5,}$"),  # bare long number
)


def _normalize(text: str | None) -> str:
    if text is None:
        return ""
    return _WS_RE.sub(" ", text.strip().lower())


def _is_naked_identifier(text: str) -> bool:
    stripped = text.strip()
    return any(p.match(stripped) for p in _NAKED_ID_PATTERNS)


def _ends_with_any(email: str, domains: tuple[str, ...]) -> bool:
    low = email.lower()
    return any(low.endswith(d) for d in domains)


@dataclass
class FlagCounts:
    loaded: int = 0
    flagged_internal: int = 0
    flagged_empty: int = 0
    dropped_empty: int = 0
    flagged_trivial: int = 0
    flagged_naked_identifier: int = 0
    flagged_seed_button_match: int = 0
    kept: int = 0

    def as_rows(self) -> list[tuple[str, int]]:
        return [
            ("loaded", self.loaded),
            ("flagged: is_internal", self.flagged_internal),
            ("flagged: is_empty", self.flagged_empty),
            ("hard drop: is_empty (only validity drop)", self.dropped_empty),
            ("flagged: is_trivial", self.flagged_trivial),
            ("flagged: is_naked_identifier", self.flagged_naked_identifier),
            ("flagged: is_seed_button_match", self.flagged_seed_button_match),
            ("kept", self.kept),
        ]


def _output_path(cfg: PipelineConfig) -> Path:
    return cfg.clean_dir / USER_QUERIES_FLAGGED


def run(cfg: PipelineConfig, extracted_parquet: Path, *, force: bool = False) -> Path:
    """Annotate extracted queries with flags. Returns the flagged-parquet path."""
    out_path = _output_path(cfg)
    if out_path.exists() and not force:
        log.info("Flagged queries already exist at %s -- skipping Layer 1b", out_path)
        return out_path

    log.info("Loading extracted queries from %s", extracted_parquet)
    df = pd.read_parquet(extracted_parquet)
    counts = FlagCounts(loaded=len(df))
    log.info("Loaded %d candidate queries", counts.loaded)

    # -- Compute helper column once -------------------------------------------
    df["query_norm"] = df["query_text"].apply(_normalize)

    # -- is_internal -----------------------------------------------------------
    email_col = df["user_email"].astype("string").fillna("")
    org_col = df["org_name"].astype("string").fillna("")
    email_internal = email_col.apply(
        lambda e: bool(e) and _ends_with_any(e, cfg.internal_email_domains)
    )
    # Fallback: email empty AND org in internal_org_names
    org_internal = (~email_col.astype(bool)) & org_col.isin(cfg.internal_org_names)
    df["is_internal"] = (email_internal | org_internal).astype(bool)
    counts.flagged_internal = int(df["is_internal"].sum())
    log.info(
        "Flag is_internal: %d / %d (%.1f%%)",
        counts.flagged_internal,
        counts.loaded,
        100.0 * counts.flagged_internal / max(counts.loaded, 1),
    )

    # -- is_empty (the only hard validity drop) -------------------------------
    df["is_empty"] = (df["query_norm"].str.len() < cfg.min_query_chars).astype(bool)
    counts.flagged_empty = int(df["is_empty"].sum())
    log.info("Flag is_empty: %d", counts.flagged_empty)

    # Hard drop: is_empty rows can never survive validity. They have no usable
    # query text. Preserved counts for the docs run-log.
    if counts.flagged_empty:
        counts.dropped_empty = counts.flagged_empty
        df = df.loc[~df["is_empty"]].reset_index(drop=True)
    log.info("Hard-dropped %d empty rows", counts.dropped_empty)

    # -- is_trivial -----------------------------------------------------------
    df["is_trivial"] = df["query_norm"].isin(cfg.trivial_queries).astype(bool)
    counts.flagged_trivial = int(df["is_trivial"].sum())
    log.info("Flag is_trivial: %d", counts.flagged_trivial)

    # -- is_naked_identifier --------------------------------------------------
    df["is_naked_identifier"] = (
        df["query_text"].astype(str).apply(_is_naked_identifier).astype(bool)
    )
    counts.flagged_naked_identifier = int(df["is_naked_identifier"].sum())
    log.info("Flag is_naked_identifier: %d", counts.flagged_naked_identifier)

    # -- is_seed_button_match -------------------------------------------------
    first_turn = df.loc[df["turn_index"].fillna(0) == 0]
    distinct_users = first_turn.groupby("query_norm")["user_id"].nunique().rename("distinct_users")
    seed_norms = set(distinct_users[distinct_users >= cfg.seed_query_min_distinct_users].index)
    df["is_seed_button_match"] = df["query_norm"].isin(seed_norms).astype(bool)
    df["seed_distinct_first_turn_users"] = df["query_norm"].map(distinct_users).astype("Int64")
    counts.flagged_seed_button_match = int(df["is_seed_button_match"].sum())
    log.info(
        "Flag is_seed_button_match (>=%d distinct first-turn users): %d",
        cfg.seed_query_min_distinct_users,
        counts.flagged_seed_button_match,
    )

    counts.kept = len(df)
    log.info("Layer 1 kept %d rows", counts.kept)

    df.to_parquet(out_path, index=False)
    log.info("Wrote %s", out_path)
    return out_path

"""Shared configuration for the alyx-data pipeline.

IDs, paths, flag thresholds, and credentials loading all live here so the
individual step modules stay focused on logic.
"""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from pathlib import Path

from dotenv import load_dotenv

# -- Paths ---------------------------------------------------------------------

PROJECT_ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = PROJECT_ROOT / "data"
RAW_DIR = DATA_DIR / "raw"
CLEAN_DIR = DATA_DIR / "clean"
TRAJECTORIES_DIR = DATA_DIR / "trajectories"
CACHE_DIR = DATA_DIR / "cache"
DOCS_DIR = PROJECT_ROOT / "docs"

for _d in (RAW_DIR, CLEAN_DIR, TRAJECTORIES_DIR, CACHE_DIR, DOCS_DIR):
    _d.mkdir(parents=True, exist_ok=True)

# -- Arize IDs (verified 2026-04-21 by the predecessor pipeline) ---------------

SPACE_ID = "U3BhY2U6NzE5Mjp4V1Q1"  # Space:7192:xWT5
MODEL_ID = "copilot-prod"
# Informational: project global ID is TW9kZWw6MjMwMDI5NDQwNDpqdlp4 (Model:2300294404:jvZx)

EXPORT_WINDOW_DAYS = 90
EXPORT_CHUNK_DAYS = 14  # chunk long windows to avoid timeouts

# -- Flag thresholds (Layer 1) -------------------------------------------------

INTERNAL_EMAIL_DOMAINS = ("@arize.com",)

# Internal-org allowlist used as a fallback when ``user_email`` is null.
# Start empty; refine by inspecting Layer 1 once it has run.
INTERNAL_ORG_NAMES: tuple[str, ...] = ()

# Queries shorter than this (after normalization) are considered ``is_empty``.
# Note: ``is_empty`` is the ONLY hard validity drop at Layer 1. Everything else
# stays as a flagged row for Stages 2/3 to interpret.
MIN_QUERY_CHARS = 3

# Hard-coded trivial queries we always FLAG (not drop) at Layer 1.
TRIVIAL_QUERIES = frozenset(
    {
        "test",
        "hello",
        "hi",
        "hey",
        "asdf",
        "qwerty",
        "ok",
        "yes",
        "no",
        "thanks",
        "ty",
    }
)

# A first-turn query that appears across at least this many distinct user_ids is
# flagged as a likely Alyx landing-page seed ("canned suggestion" button).
SEED_QUERY_MIN_DISTINCT_USERS = 5

# -- Layer 2 (trajectories) ----------------------------------------------------

# Per-span text values are truncated to this many characters in the trajectory
# parquet so the file stays workable. Full text remains in Layer 0.
TRAJECTORY_TEXT_TRUNC_CHARS = 8_000

# -- Credentials ---------------------------------------------------------------

# Precedence: local .env (project dir) -> ~/Projects/phoenix/.env -> OS env.
_LOCAL_ENV = PROJECT_ROOT / ".env"
_PHOENIX_ENV = Path.home() / "Projects" / "phoenix" / ".env"
if _LOCAL_ENV.exists():
    load_dotenv(_LOCAL_ENV, override=False)
if _PHOENIX_ENV.exists():
    load_dotenv(_PHOENIX_ENV, override=False)


def require_env(name: str) -> str:
    """Get a required env var or raise."""
    value = os.environ.get(name)
    if not value:
        raise RuntimeError(
            f"{name} is not set. Checked {_LOCAL_ENV}, {_PHOENIX_ENV}, and process env."
        )
    return value


# -- Runtime config object -----------------------------------------------------


@dataclass(frozen=True)
class PipelineConfig:
    """Runtime-resolved config. Construct via ``PipelineConfig.load()``."""

    space_id: str
    model_id: str
    start_time: datetime
    end_time: datetime
    arize_api_key: str

    raw_dir: Path = RAW_DIR
    clean_dir: Path = CLEAN_DIR
    trajectories_dir: Path = TRAJECTORIES_DIR
    cache_dir: Path = CACHE_DIR
    docs_dir: Path = DOCS_DIR

    export_chunk_days: int = EXPORT_CHUNK_DAYS

    # Flag parameters
    internal_email_domains: tuple[str, ...] = INTERNAL_EMAIL_DOMAINS
    internal_org_names: tuple[str, ...] = INTERNAL_ORG_NAMES
    min_query_chars: int = MIN_QUERY_CHARS
    trivial_queries: frozenset[str] = field(default_factory=lambda: TRIVIAL_QUERIES)
    seed_query_min_distinct_users: int = SEED_QUERY_MIN_DISTINCT_USERS

    # Trajectory
    trajectory_text_trunc_chars: int = TRAJECTORY_TEXT_TRUNC_CHARS

    @classmethod
    def load(cls, window_days: int = EXPORT_WINDOW_DAYS) -> "PipelineConfig":
        end = datetime.now(tz=timezone.utc).replace(microsecond=0)
        start = end - timedelta(days=window_days)
        return cls(
            space_id=SPACE_ID,
            model_id=MODEL_ID,
            start_time=start,
            end_time=end,
            arize_api_key=require_env("ARIZE_API_KEY"),
        )


# -- Logging -------------------------------------------------------------------


def setup_logging(level: int = logging.INFO) -> logging.Logger:
    """Initialize a sane, one-time logger for pipeline scripts."""
    root = logging.getLogger()
    if not root.handlers:
        handler = logging.StreamHandler()
        handler.setFormatter(
            logging.Formatter("%(asctime)s  %(levelname)-7s  %(name)s: %(message)s", "%H:%M:%S")
        )
        root.addHandler(handler)
    root.setLevel(level)
    return logging.getLogger("pipeline")

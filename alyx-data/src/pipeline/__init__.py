"""alyx-data pipeline.

Reproducible, idempotent pipeline that pulls 90 days of copilot-prod (Alyx)
spans from Arize and emits three layered artifacts on disk:

  Layer 0 -- raw per-chunk parquets (data/raw/...)
  Layer 1 -- user queries with scope flags (data/clean/user-queries.parquet)
  Layer 2 -- session/trace trajectories  (data/trajectories/...)
"""

__version__ = "0.1.0"

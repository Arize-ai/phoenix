"""Stage 2 analysis helpers for the alyx-data project.

The Stage 2 notebook (`notebooks/stage2-analysis.ipynb`) and any follow-on
analysis scripts should import from the submodules directly, e.g.::

    from analysis.loaders import load_queries, load_sessions, load_spans
    from analysis.plots import setup, bar_counts

Two submodules:

- ``loaders`` — cached readers for the Layer 0 / 1 / 2 parquets, plus a
  DuckDB connection helper that registers the layers as virtual tables.
- ``plots`` — matplotlib helpers that pre-style figures the way the report
  expects (consistent palette, percentage axes, bar-label conventions).
"""

from __future__ import annotations

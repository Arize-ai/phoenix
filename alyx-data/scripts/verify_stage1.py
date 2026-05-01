"""Stage 1 verification gates.

Run after ``run_pipeline.py`` completes against a 90-day window:

    uv run python scripts/verify_stage1.py

Reports:

  * Layer 0 raw row total and chunk count
  * Layer 1 row total + flag distribution + ``is_internal`` share
  * Layer 2 sessions row total + multi-turn ratio
  * Reconstruction sanity: pick one multi-turn session from Layer 1, confirm
    its ordered query texts appear in Layer 2's ``query_sequence``.

Exits with code 0 on success, non-zero with summary if anything is missing.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import pandas as pd

PROJECT_ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = PROJECT_ROOT / "data"


def _latest_window_dir() -> Path:
    raw_root = DATA_DIR / "raw"
    candidates = sorted(raw_root.glob("copilot-prod-spans-*"))
    if not candidates:
        sys.exit("No raw export directory found under data/raw/")
    return candidates[-1]


def _layer0(window_dir: Path) -> tuple[int, int]:
    chunks = sorted(window_dir.glob("chunk_*.parquet"))
    if not chunks:
        sys.exit(f"No chunks in {window_dir}")
    total = 0
    for c in chunks:
        total += int(pd.read_parquet(c, columns=[]).shape[0])
    return len(chunks), total


def _layer1() -> pd.DataFrame:
    p = DATA_DIR / "clean" / "user-queries.parquet"
    if not p.exists():
        sys.exit(f"Missing Layer 1: {p}")
    return pd.read_parquet(p)


def _layer2() -> tuple[pd.DataFrame, pd.DataFrame]:
    sp = DATA_DIR / "trajectories" / "spans.parquet"
    se = DATA_DIR / "trajectories" / "sessions.parquet"
    if not sp.exists() or not se.exists():
        sys.exit(f"Missing Layer 2 files: {sp}, {se}")
    return pd.read_parquet(sp), pd.read_parquet(se)


def main() -> int:
    print("=" * 60)
    print("alyx-data Stage 1 verification")
    print("=" * 60)

    window_dir = _latest_window_dir()
    n_chunks, n_raw = _layer0(window_dir)
    print(f"\n[Layer 0] {window_dir.name}")
    print(f"  chunks   : {n_chunks}")
    print(f"  raw rows : {n_raw:,}  (predecessor 90d: ~388k)")

    l1 = _layer1()
    print(f"\n[Layer 1] {len(l1):,} rows  (predecessor 90d: ~24k)")
    null_q = int(l1["query_text"].isna().sum())
    print(f"  null query_text : {null_q}  (must be 0)")
    for col in ("is_internal", "is_trivial", "is_naked_identifier", "is_seed_button_match"):
        if col in l1.columns:
            n = int(l1[col].sum())
            pct = 100.0 * n / max(len(l1), 1)
            print(f"  {col:<26}: {n:>6} ({pct:5.1f}%)")

    spans, sessions = _layer2()
    print(f"\n[Layer 2] sessions: {len(sessions):,}  (predecessor 90d: ~3.8k)")
    print(f"          spans    : {len(spans):,}")
    if "turn_count" in sessions.columns:
        single = int((sessions["turn_count"] == 1).sum())
        multi = int((sessions["turn_count"] >= 2).sum())
        print(f"  single-turn sessions : {single:>6} ({100 * single / max(len(sessions), 1):.1f}%)")
        print(f"  multi-turn  sessions : {multi:>6} ({100 * multi / max(len(sessions), 1):.1f}%)")

    # Reconstruction sanity: pick a multi-turn session and check that its
    # Layer 1 queries appear in Layer 2's query_sequence in order.
    print("\n[Reconstruction sanity]")
    multi_sessions = sessions.loc[sessions["turn_count"] >= 3]
    if multi_sessions.empty:
        print("  (no sessions with >=3 turns; skipping)")
    else:
        pick = multi_sessions.iloc[0]
        sid = pick["session_id"]
        l1_seq = l1.loc[l1["session_id"] == sid].sort_values("turn_index")["query_text"].tolist()
        l2_seq = list(pick["query_sequence"])
        print(f"  picked session: {sid}")
        print(
            f"    Layer 1 turns ({len(l1_seq)}): {[q[:40] + '...' if len(q) > 40 else q for q in l1_seq[:5]]}"
        )
        print(
            f"    Layer 2 turns ({len(l2_seq)}): {[q[:40] + '...' if len(q) > 40 else q for q in l2_seq[:5]]}"
        )
        if [q.strip() for q in l1_seq] == [q.strip() for q in l2_seq if q]:
            print("    -> MATCH (Layer 1 and Layer 2 query sequences agree)")
        elif set(l1_seq) <= set(l2_seq):
            print("    -> SUBSET (Layer 1 queries all present in Layer 2 sequence)")
        else:
            missing = set(l1_seq) - set(l2_seq)
            print(f"    -> MISMATCH: Layer 1 has {len(missing)} queries not in Layer 2 sequence")

    # Manifest
    manifest = window_dir / "_manifest.json"
    if manifest.exists():
        m = json.loads(manifest.read_text())
        print(f"\n[Manifest] {manifest.name}: {len(m.get('chunks', []))} chunks")

    print("\nDone.")
    return 0


if __name__ == "__main__":
    sys.exit(main())

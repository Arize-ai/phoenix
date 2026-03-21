# /// script
# dependencies = []
# ///
"""
Cross-revision Collector Benchmark Comparison Driver

Creates worktrees for two git refs, then runs the *current checkout's*
``benchmark_span_insertion.py`` as a subprocess with ``PYTHONPATH=<worktree>/src``
prepended for each ref.  This ensures both runs use the same harness while
benchmarking different production code.

Usage:
    python compare_collector_benchmarks.py [options]
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Any, Optional, Sequence


def _resolve_ref(ref: str) -> str:
    """Resolve a git ref to a full SHA."""
    result = subprocess.run(
        ["git", "rev-parse", ref],
        capture_output=True,
        text=True,
        check=True,
    )
    return result.stdout.strip()


def _create_worktree(ref: str, directory: str) -> None:
    """Create a detached worktree for *ref* at *directory*."""
    subprocess.run(
        ["git", "worktree", "add", "--detach", directory, ref],
        capture_output=True,
        text=True,
        check=True,
    )


def _remove_worktree(directory: str) -> None:
    """Remove a worktree, ignoring errors."""
    try:
        subprocess.run(
            ["git", "worktree", "remove", "--force", directory],
            capture_output=True,
            text=True,
            check=True,
        )
    except subprocess.CalledProcessError:
        pass


def _run_benchmark(
    *,
    worktree_src: str,
    output_dir: str,
    db_url: Optional[str],
    runs: int,
    seed: Optional[int],
    batch_sizes: str,
    topologies: str,
    label: str,
) -> dict[str, Any]:
    """Run the benchmark harness against code in *worktree_src*.

    The harness script is always taken from the current checkout.
    ``PYTHONPATH`` is set so that ``import phoenix.db`` resolves inside the
    worktree, exercising that ref's production code.
    """
    repo_root = Path(__file__).resolve().parent.parent.parent.parent
    harness = repo_root / "scripts" / "perf" / "collector" / "benchmark_span_insertion.py"

    env = os.environ.copy()
    # Prepend the worktree's src so `import phoenix.*` picks up that ref's code
    existing = env.get("PYTHONPATH", "")
    env["PYTHONPATH"] = worktree_src + (os.pathsep + existing if existing else "")

    cmd: list[str] = [
        sys.executable,
        str(harness),
        "--output",
        output_dir,
        "--runs",
        str(runs),
        "--batch-sizes",
        batch_sizes,
        "--topologies",
        topologies,
    ]
    if db_url is not None:
        cmd.extend(["--db-url", db_url])
    if seed is not None:
        cmd.extend(["--seed", str(seed)])

    print(f"\n{'=' * 60}")
    print(f"  Running benchmark for: {label}")
    print(f"  PYTHONPATH prefix: {worktree_src}")
    print(f"{'=' * 60}\n", flush=True)

    subprocess.run(cmd, env=env, check=True)

    json_path = Path(output_dir) / "benchmark_results.json"
    result: dict[str, Any] = json.loads(json_path.read_text())
    return result


# ---------------------------------------------------------------------------
# Comparison logic: join-by-dimensions and delta computation
# ---------------------------------------------------------------------------

# Dimension keys used to join base and candidate run entries.
# The benchmark JSON ``runs`` array contains objects with these fields (some
# will only appear once upstream tasks land the runner/workload overhaul).
_DIMENSION_KEYS: Sequence[str] = (
    "runner",
    "topology",
    "batch_size",
    "session_mode",
    "project_mode",
    "token_mode",
    "db_backend",
)


def _dimension_key(entry: dict[str, Any]) -> tuple[Any, ...]:
    """Extract a hashable dimension key from a run entry.

    Missing keys are replaced with ``None`` so that the current schema (which
    may not yet have all dimension fields) still joins correctly.
    """
    return tuple(entry.get(k) for k in _DIMENSION_KEYS)


def _pct_delta(base_val: float, candidate_val: float) -> Optional[float]:
    """Compute percentage change from *base_val* to *candidate_val*.

    Returns ``None`` when *base_val* is zero (division undefined).
    A positive result means *candidate_val* is larger than *base_val*.
    """
    if base_val == 0:
        return None
    return round((candidate_val - base_val) / base_val * 100, 2)


def compute_comparison(
    base_data: dict[str, Any],
    candidate_data: dict[str, Any],
) -> list[dict[str, Any]]:
    """Join base and candidate benchmark results by dimension keys.

    Each element in the returned list contains the matched dimension values,
    the base and candidate stats, and computed deltas for p50 latency,
    throughput, and query count.
    """
    base_runs: list[dict[str, Any]] = base_data.get("results", [])
    candidate_runs: list[dict[str, Any]] = candidate_data.get("results", [])

    candidate_by_key: dict[tuple[Any, ...], dict[str, Any]] = {}
    for entry in candidate_runs:
        candidate_by_key[_dimension_key(entry)] = entry

    rows: list[dict[str, Any]] = []
    for base_entry in base_runs:
        key = _dimension_key(base_entry)
        cand_entry = candidate_by_key.get(key)
        if cand_entry is None:
            continue

        base_stats: dict[str, Any] = base_entry.get("stats", {})
        cand_stats: dict[str, Any] = cand_entry.get("stats", {})

        base_p50 = float(base_stats.get("p50_latency_sec", 0))
        cand_p50 = float(cand_stats.get("p50_latency_sec", 0))
        base_throughput = float(base_stats.get("mean_spans_per_sec", 0))
        cand_throughput = float(cand_stats.get("mean_spans_per_sec", 0))
        base_queries = float(base_stats.get("mean_query_count", 0))
        cand_queries = float(cand_stats.get("mean_query_count", 0))

        # Build dimensions dict from the entry (only include present keys)
        dimensions: dict[str, Any] = {}
        for k in _DIMENSION_KEYS:
            val = base_entry.get(k)
            if val is not None:
                dimensions[k] = val

        rows.append(
            {
                "dimensions": dimensions,
                "base": base_stats,
                "candidate": cand_stats,
                "delta": {
                    "p50_latency_pct": _pct_delta(base_p50, cand_p50),
                    "throughput_pct": _pct_delta(base_throughput, cand_throughput),
                    "query_count_pct": _pct_delta(base_queries, cand_queries),
                },
            }
        )

    return rows


def format_comparison_markdown(
    rows: list[dict[str, Any]],
    meta: dict[str, Any],
) -> str:
    """Format comparison rows as a markdown summary table."""
    lines: list[str] = []
    base_label = f"{meta.get('base_ref', '?')} ({meta.get('base_sha', '?')[:12]})"
    cand_label = f"{meta.get('candidate_ref', '?')} ({meta.get('candidate_sha', '?')[:12]})"

    lines.append(f"## Benchmark Comparison: {base_label} vs {cand_label}\n")
    lines.append(
        "| Dimensions | Base P50 (s) | Cand P50 (s) | P50 Delta "
        "| Base Spans/s | Cand Spans/s | Throughput Delta "
        "| Base Queries | Cand Queries | Query Delta |"
    )
    lines.append(
        "|------------|-------------:|-------------:|----------:"
        "|-------------:|-------------:|----------------:"
        "|-------------:|-------------:|------------:|"
    )

    for row in rows:
        dims = row["dimensions"]
        dim_parts = [f"{v}" for v in dims.values()]
        dim_str = " / ".join(dim_parts) if dim_parts else "—"

        base_s: dict[str, Any] = row["base"]
        cand_s: dict[str, Any] = row["candidate"]
        delta: dict[str, Any] = row["delta"]

        def _fmt_pct(val: Optional[float]) -> str:
            if val is None:
                return "N/A"
            sign = "+" if val > 0 else ""
            return f"{sign}{val:.1f}%"

        lines.append(
            f"| {dim_str} "
            f"| {base_s.get('p50_latency_sec', 0):.4f} "
            f"| {cand_s.get('p50_latency_sec', 0):.4f} "
            f"| {_fmt_pct(delta.get('p50_latency_pct'))} "
            f"| {base_s.get('mean_spans_per_sec', 0):.1f} "
            f"| {cand_s.get('mean_spans_per_sec', 0):.1f} "
            f"| {_fmt_pct(delta.get('throughput_pct'))} "
            f"| {base_s.get('mean_query_count', 0):.1f} "
            f"| {cand_s.get('mean_query_count', 0):.1f} "
            f"| {_fmt_pct(delta.get('query_count_pct'))} |"
        )

    lines.append("")
    return "\n".join(lines)


def run_comparison(
    *,
    base_ref: str,
    candidate_ref: str,
    db_url: Optional[str] = None,
    runs: int = 20,
    seed: Optional[int] = None,
    output_dir: Optional[Path] = None,
    batch_sizes: str = "100,500,1000",
    topologies: str = "linear,branching,mixed",
) -> dict[str, Any]:
    """Run the benchmark against two refs and return combined results.

    Returns a dict with keys ``base``, ``candidate``, and ``meta`` containing
    the raw JSON output from each run plus revision metadata.
    """
    base_sha = _resolve_ref(base_ref)
    candidate_sha = _resolve_ref(candidate_ref)

    print(f"Base ref:      {base_ref} ({base_sha[:12]})")
    print(f"Candidate ref: {candidate_ref} ({candidate_sha[:12]})")

    tmpdir = tempfile.mkdtemp(prefix="bench_compare_")
    base_worktree = os.path.join(tmpdir, "base")
    candidate_worktree = os.path.join(tmpdir, "candidate")

    try:
        _create_worktree(base_sha, base_worktree)
        _create_worktree(candidate_sha, candidate_worktree)

        base_output = os.path.join(tmpdir, "output_base")
        candidate_output = os.path.join(tmpdir, "output_candidate")
        os.makedirs(base_output, exist_ok=True)
        os.makedirs(candidate_output, exist_ok=True)

        base_src = os.path.join(base_worktree, "src")
        candidate_src = os.path.join(candidate_worktree, "src")

        base_results = _run_benchmark(
            worktree_src=base_src,
            output_dir=base_output,
            db_url=db_url,
            runs=runs,
            seed=seed,
            batch_sizes=batch_sizes,
            topologies=topologies,
            label=f"base ({base_ref} = {base_sha[:12]})",
        )

        candidate_results = _run_benchmark(
            worktree_src=candidate_src,
            output_dir=candidate_output,
            db_url=db_url,
            runs=runs,
            seed=seed,
            batch_sizes=batch_sizes,
            topologies=topologies,
            label=f"candidate ({candidate_ref} = {candidate_sha[:12]})",
        )

        meta: dict[str, Any] = {
            "base_ref": base_ref,
            "base_sha": base_sha,
            "candidate_ref": candidate_ref,
            "candidate_sha": candidate_sha,
        }

        comparison_rows = compute_comparison(base_results, candidate_results)

        combined: dict[str, Any] = {
            "meta": meta,
            "base": base_results,
            "candidate": candidate_results,
            "comparison": comparison_rows,
        }

        # Print markdown summary to stdout
        md = format_comparison_markdown(comparison_rows, meta)
        print(md)

        if output_dir is not None:
            output_dir.mkdir(parents=True, exist_ok=True)
            json_path = output_dir / "comparison_results.json"
            json_path.write_text(json.dumps(combined, indent=2) + "\n")
            md_path = output_dir / "comparison_results.md"
            md_path.write_text(md)
            print(f"Comparison results written to:\n  {json_path}\n  {md_path}")

        return combined

    finally:
        _remove_worktree(candidate_worktree)
        _remove_worktree(base_worktree)
        # Clean up temp dir (worktrees already removed)
        try:
            import shutil

            shutil.rmtree(tmpdir, ignore_errors=True)
        except Exception:
            pass


def _parse_args(argv: Optional[list[str]] = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Compare collector benchmark results across two git revisions.",
    )
    parser.add_argument(
        "--base-ref",
        type=str,
        default="main",
        help="Git ref for the baseline (default: main)",
    )
    parser.add_argument(
        "--candidate-ref",
        type=str,
        default="HEAD",
        help="Git ref for the candidate (default: HEAD)",
    )
    parser.add_argument(
        "--db-url",
        type=str,
        default=None,
        help="Database URL (default: in-memory SQLite). Use postgresql://user@host/dbname for PG.",
    )
    parser.add_argument(
        "--runs",
        type=int,
        default=20,
        help="Number of measurement batches per configuration (default: 20)",
    )
    parser.add_argument(
        "--seed",
        type=int,
        default=None,
        help="RNG seed for reproducibility (passed to benchmark harness)",
    )
    parser.add_argument(
        "--output",
        type=str,
        default=None,
        help="Output directory for comparison results JSON",
    )
    parser.add_argument(
        "--batch-sizes",
        type=str,
        default="100,500,1000",
        help="Comma-separated batch sizes (default: 100,500,1000)",
    )
    parser.add_argument(
        "--topologies",
        type=str,
        default="linear,branching,mixed",
        help="Comma-separated topologies (default: linear,branching,mixed)",
    )
    return parser.parse_args(argv)


def main(argv: Optional[list[str]] = None) -> None:
    """CLI entry point."""
    args = _parse_args(argv)
    output_dir = Path(args.output) if args.output else None

    run_comparison(
        base_ref=args.base_ref,
        candidate_ref=args.candidate_ref,
        db_url=args.db_url,
        runs=args.runs,
        seed=args.seed,
        output_dir=output_dir,
        batch_sizes=args.batch_sizes,
        topologies=args.topologies,
    )


if __name__ == "__main__":
    main()

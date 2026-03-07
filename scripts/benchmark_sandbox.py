#!/usr/bin/env python3
"""Benchmark script for Phoenix sandbox backends.

Measures cold-start latency, warm execution latency, E2B session-reuse speedup,
and concurrent throughput for the wasm, e2b, vercel, and daytona backends.

Usage:
    uv run python scripts/benchmark_sandbox.py --backend wasm
    uv run python scripts/benchmark_sandbox.py --backend e2b
    uv run python scripts/benchmark_sandbox.py --backend vercel
    uv run python scripts/benchmark_sandbox.py --backend daytona
    uv run python scripts/benchmark_sandbox.py  # runs all available backends

Environment variables:
    PHOENIX_SANDBOX_API_KEY   — required for E2B
    VERCEL_OIDC_TOKEN         — required for Vercel (Vercel-hosted)
    PHOENIX_SANDBOX_TOKEN     — required for Vercel (self-hosted)
    DAYTONA_API_KEY           — required for Daytona
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import statistics
import sys
import time
from pathlib import Path
from typing import Any

# ---------------------------------------------------------------------------
# Representative evaluator payload
# ---------------------------------------------------------------------------
# Mirrors the harness format used by CodeEvaluatorRunner.evaluate() in
# src/phoenix/server/api/evaluators.py (lines 755-764):
#   - User function `score(**inputs)` is called with JSON-decoded inputs
#   - Result printed as JSON to stdout
#   - Errors printed to stderr, sys.exit(1)
# ---------------------------------------------------------------------------

_USER_SCORE_FUNCTION = """\
import re
import statistics
from difflib import SequenceMatcher


def _tokenize(text):
    return re.findall(r"\\b\\w+\\b", text.lower())


def _bleu_1gram(reference, hypothesis):
    ref_tokens = _tokenize(reference)
    hyp_tokens = _tokenize(hypothesis)
    if not hyp_tokens:
        return 0.0
    hits = sum(1 for t in hyp_tokens if t in set(ref_tokens))
    return hits / len(hyp_tokens)


def _semantic_similarity(a, b):
    return SequenceMatcher(None, a.lower(), b.lower()).ratio()


def _length_penalty(response, min_words=5, max_words=500):
    word_count = len(_tokenize(response))
    if word_count < min_words:
        return 0.5
    if word_count > max_words:
        return 0.8
    return 1.0


def _keyword_coverage(response, keywords):
    if not keywords:
        return 1.0
    response_lower = response.lower()
    covered = sum(1 for kw in keywords if kw.lower() in response_lower)
    return covered / len(keywords)


def evaluate(
    reference_answer="",
    model_response="",
    expected_keywords=None,
    rubric_items=None,
):
    if expected_keywords is None:
        expected_keywords = []
    if rubric_items is None:
        rubric_items = []

    bleu = _bleu_1gram(reference_answer, model_response)
    similarity = _semantic_similarity(reference_answer, model_response)
    length_ok = _length_penalty(model_response)
    keyword_cov = _keyword_coverage(model_response, expected_keywords)

    # Weighted composite score
    components = [
        bleu * 0.3,
        similarity * 0.3,
        length_ok * 0.2,
        keyword_cov * 0.2,
    ]
    final_score = sum(components)

    label = "pass" if final_score >= 0.5 else "fail"
    explanation = (
        f"BLEU-1: {bleu:.3f}, "
        f"similarity: {similarity:.3f}, "
        f"length_ok: {length_ok:.2f}, "
        f"keyword_coverage: {keyword_cov:.2f}"
    )

    return {
        "score": round(final_score, 4),
        "label": label,
        "explanation": explanation,
        "components": {
            "bleu_1gram": round(bleu, 4),
            "semantic_similarity": round(similarity, 4),
            "length_penalty": round(length_ok, 4),
            "keyword_coverage": round(keyword_cov, 4),
        },
    }
"""

_SAMPLE_INPUTS: dict[str, Any] = {
    "reference_answer": (
        "The mitochondria is the powerhouse of the cell. "
        "It produces ATP through oxidative phosphorylation."
    ),
    "model_response": (
        "Mitochondria generate energy for the cell by producing adenosine triphosphate "
        "(ATP) via a process called oxidative phosphorylation. They are often described "
        "as the powerhouse of the cell."
    ),
    "expected_keywords": ["mitochondria", "ATP", "oxidative phosphorylation", "energy"],
    "rubric_items": ["mentions ATP", "mentions mitochondria", "describes mechanism"],
}


def _make_harness(inputs: dict[str, Any]) -> str:
    """Build the harness code string that matches CodeEvaluatorRunner exactly."""
    return (
        "import json, sys\n"
        f"{_USER_SCORE_FUNCTION}\n"
        f"_inputs = json.loads({json.dumps(json.dumps(inputs))})\n"
        "try:\n"
        "    _result = score(**_inputs)\n"
        "    print(json.dumps(_result))\n"
        "except Exception as _e:\n"
        "    print(str(_e), file=sys.stderr)\n"
        "    sys.exit(1)\n"
    )


HARNESS = _make_harness(_SAMPLE_INPUTS)

# ---------------------------------------------------------------------------
# Benchmark measurements
# ---------------------------------------------------------------------------


async def measure_cold_start(backend: Any) -> float:
    """Time from first execute() call to first result (ms)."""
    t0 = time.perf_counter()
    result = await backend.execute(HARNESS, timeout=60.0)
    elapsed_ms = (time.perf_counter() - t0) * 1000
    if result.timed_out:
        print("  [!] cold-start timed out", file=sys.stderr)
    elif result.exit_code != 0:
        print(f"  [!] cold-start error: {result.stderr[:200]}", file=sys.stderr)
    return elapsed_ms


async def measure_warm_latency(backend: Any, n: int = 10) -> list[float]:
    """Run n sequential executions; return per-call latencies in ms."""
    latencies = []
    for i in range(n):
        t0 = time.perf_counter()
        result = await backend.execute(HARNESS, timeout=60.0)
        elapsed_ms = (time.perf_counter() - t0) * 1000
        latencies.append(elapsed_ms)
        if result.exit_code != 0 and not result.timed_out:
            print(f"  [!] run {i + 1} error: {result.stderr[:100]}", file=sys.stderr)
    return latencies


async def measure_concurrent(backend: Any, concurrency: int = 5) -> list[float]:
    """Run `concurrency` executions in parallel; return per-call latencies in ms."""
    t_start = time.perf_counter()

    async def _timed() -> float:
        t0 = time.perf_counter()
        await backend.execute(HARNESS, timeout=60.0)
        return (time.perf_counter() - t0) * 1000

    latencies = await asyncio.gather(*[_timed() for _ in range(concurrency)])
    total_ms = (time.perf_counter() - t_start) * 1000
    print(f"  concurrent total wall time: {total_ms:.0f} ms")
    return list(latencies)


# ---------------------------------------------------------------------------
# Backend factory helpers
# ---------------------------------------------------------------------------


def _check_wasm() -> bool:
    try:
        import importlib.util

        if importlib.util.find_spec("wasmtime") is None:
            print("[SKIP] wasm: wasmtime not installed", file=sys.stderr)
            return False
        wasm_path = (
            Path(__file__).parent.parent / "src" / "phoenix" / "sandbox" / "python-3.12.0.wasm"
        )
        if not wasm_path.exists():
            # try working dir convention
            from phoenix.config import get_working_dir

            wasm_path = get_working_dir() / "sandbox" / "python-3.12.0.wasm"
        if not wasm_path.exists():
            print(f"[SKIP] wasm: binary not found at {wasm_path}", file=sys.stderr)
            return False
        return True
    except Exception as e:
        print(f"[SKIP] wasm: {e}", file=sys.stderr)
        return False


def _check_e2b() -> str | None:
    key = os.environ.get("PHOENIX_SANDBOX_API_KEY", "")
    if not key:
        print(
            "[SKIP] e2b: PHOENIX_SANDBOX_API_KEY not set — set it to run E2B benchmarks",
            file=sys.stderr,
        )
        return None
    return key


def _check_vercel() -> str | None:
    token = os.environ.get("VERCEL_OIDC_TOKEN") or os.environ.get("PHOENIX_SANDBOX_TOKEN")
    if not token:
        print(
            "[SKIP] vercel: neither VERCEL_OIDC_TOKEN nor PHOENIX_SANDBOX_TOKEN is set — "
            "set one to run Vercel benchmarks",
            file=sys.stderr,
        )
        return None
    return token


def _check_daytona() -> str | None:
    key = os.environ.get("DAYTONA_API_KEY", "")
    if not key:
        print(
            "[SKIP] daytona: DAYTONA_API_KEY not set — set it to run Daytona benchmarks",
            file=sys.stderr,
        )
        return None
    return key


# ---------------------------------------------------------------------------
# Result formatting
# ---------------------------------------------------------------------------


def _p(values: list[float], pct: int) -> float:
    return statistics.quantiles(values, n=100)[pct - 1] if len(values) >= 2 else values[0]


def print_results_table(results: dict[str, dict[str, Any]]) -> None:
    if not results:
        print("\nNo results to display.")
        return

    print("\n## Sandbox Backend Benchmark Results\n")
    header = (
        "| Backend | Cold Start (ms) | Warm P50 (ms) | Warm P95 (ms) "
        "| Session Speedup | Concurrent P50 (ms) |"
    )
    sep = (
        "|---------|-----------------|---------------|"
        "---------------|-----------------|---------------------|"
    )
    print(header)
    print(sep)

    for name, r in results.items():
        cold = (
            f"{r.get('cold_start_ms', 'N/A'):.0f}"
            if isinstance(r.get("cold_start_ms"), float)
            else "N/A"
        )
        warm_p50 = f"{r['warm_p50']:.0f}" if "warm_p50" in r else "N/A"
        warm_p95 = f"{r['warm_p95']:.0f}" if "warm_p95" in r else "N/A"
        speedup = f"{r['session_speedup']:.1f}x" if "session_speedup" in r else "—"
        conc_p50 = f"{r['concurrent_p50']:.0f}" if "concurrent_p50" in r else "N/A"
        row = (
            f"| {name:<7} | {cold:>15} | {warm_p50:>13} | {warm_p95:>13}"
            f" | {speedup:>15} | {conc_p50:>19} |"
        )
        print(row)

    print()


# ---------------------------------------------------------------------------
# Per-backend benchmark runners
# ---------------------------------------------------------------------------


async def run_wasm_benchmark() -> dict[str, Any] | None:
    if not _check_wasm():
        return None

    from phoenix.config import get_working_dir
    from phoenix.server.sandbox.wasm_backend import WASMBackend

    wasm_path = get_working_dir() / "sandbox" / "python-3.12.0.wasm"
    backend = WASMBackend(wasm_binary=wasm_path)

    print("\n### WASM backend")
    print("  measuring cold start...")
    cold_ms = await measure_cold_start(backend)
    print(f"  cold start: {cold_ms:.0f} ms")

    print("  measuring warm latency (10 runs)...")
    warm = await measure_warm_latency(backend, n=10)
    warm_tail = warm[1:]  # drop first (may include JIT warm-up)
    print(f"  warm runs: {[f'{v:.0f}' for v in warm]}")

    print("  measuring concurrent throughput (5 parallel)...")
    conc = await measure_concurrent(backend, concurrency=5)
    print(f"  concurrent: {[f'{v:.0f}' for v in conc]}")

    await backend.close()

    return {
        "cold_start_ms": cold_ms,
        "warm_all_ms": warm,
        "warm_p50": statistics.median(warm_tail),
        "warm_p95": _p(warm_tail, 95),
        "concurrent_ms": conc,
        "concurrent_p50": statistics.median(conc),
    }


async def run_e2b_benchmark() -> dict[str, Any] | None:
    api_key = _check_e2b()
    if not api_key:
        return None

    from phoenix.server.sandbox.e2b_backend import E2BSandboxBackend

    print("\n### E2B backend (ephemeral mode)")
    ephemeral = E2BSandboxBackend(api_key=api_key, session_mode=False)

    print("  measuring cold start (ephemeral)...")
    cold_ms = await measure_cold_start(ephemeral)
    print(f"  cold start: {cold_ms:.0f} ms")

    print("  measuring warm latency, ephemeral (10 runs)...")
    warm_ephem = await measure_warm_latency(ephemeral, n=10)
    print(f"  warm (ephemeral): {[f'{v:.0f}' for v in warm_ephem]}")

    print("\n### E2B backend (session mode)")
    session = E2BSandboxBackend(api_key=api_key, session_mode=True)
    async with session:
        print("  measuring warm latency, session (10 runs)...")
        warm_session = await measure_warm_latency(session, n=10)
        print(f"  warm (session): {[f'{v:.0f}' for v in warm_session]}")

    ephem_p50 = statistics.median(warm_ephem[1:])
    session_p50 = statistics.median(warm_session[1:])
    speedup = ephem_p50 / session_p50 if session_p50 > 0 else float("inf")
    print(
        f"  session speedup: {speedup:.1f}x "
        f"(ephemeral P50={ephem_p50:.0f}ms, session P50={session_p50:.0f}ms)"
    )

    print("  measuring concurrent throughput, ephemeral (5 parallel)...")
    conc = await measure_concurrent(ephemeral, concurrency=5)
    print(f"  concurrent: {[f'{v:.0f}' for v in conc]}")

    await ephemeral.close()

    return {
        "cold_start_ms": cold_ms,
        "warm_all_ms": warm_ephem,
        "warm_p50": statistics.median(warm_ephem[1:]),
        "warm_p95": _p(warm_ephem[1:], 95),
        "session_p50": session_p50,
        "session_speedup": speedup,
        "concurrent_ms": conc,
        "concurrent_p50": statistics.median(conc),
    }


async def run_vercel_benchmark() -> dict[str, Any] | None:
    token = _check_vercel()
    if not token:
        return None

    from phoenix.server.sandbox.vercel_backend import VercelSandboxBackend

    backend = VercelSandboxBackend(token=token)

    print("\n### Vercel backend")
    print("  measuring cold start...")
    cold_ms = await measure_cold_start(backend)
    print(f"  cold start: {cold_ms:.0f} ms")

    print("  measuring warm latency (10 runs)...")
    warm = await measure_warm_latency(backend, n=10)
    print(f"  warm runs: {[f'{v:.0f}' for v in warm]}")

    print("  measuring concurrent throughput (5 parallel)...")
    conc = await measure_concurrent(backend, concurrency=5)
    print(f"  concurrent: {[f'{v:.0f}' for v in conc]}")

    await backend.close()

    return {
        "cold_start_ms": cold_ms,
        "warm_all_ms": warm,
        "warm_p50": statistics.median(warm[1:]) if len(warm) > 1 else warm[0],
        "warm_p95": _p(warm[1:], 95) if len(warm) > 1 else warm[0],
        "concurrent_ms": conc,
        "concurrent_p50": statistics.median(conc),
    }


async def run_daytona_benchmark() -> dict[str, Any] | None:
    api_key = _check_daytona()
    if not api_key:
        return None

    from phoenix.server.sandbox.daytona_backend import DaytonaSandboxBackend

    print("\n### Daytona backend (ephemeral mode)")
    ephemeral = DaytonaSandboxBackend(api_key=api_key, session_mode=False)

    print("  measuring cold start (ephemeral)...")
    cold_ms = await measure_cold_start(ephemeral)
    print(f"  cold start: {cold_ms:.0f} ms")

    print("  measuring warm latency, ephemeral (10 runs)...")
    warm_ephem = await measure_warm_latency(ephemeral, n=10)
    print(f"  warm (ephemeral): {[f'{v:.0f}' for v in warm_ephem]}")

    print("\n### Daytona backend (session mode)")
    session = DaytonaSandboxBackend(api_key=api_key, session_mode=True)
    async with session:
        print("  measuring warm latency, session (10 runs)...")
        warm_session = await measure_warm_latency(session, n=10)
        print(f"  warm (session): {[f'{v:.0f}' for v in warm_session]}")

    ephem_p50 = statistics.median(warm_ephem[1:])
    session_p50 = statistics.median(warm_session[1:])
    speedup = ephem_p50 / session_p50 if session_p50 > 0 else float("inf")
    print(
        f"  session speedup: {speedup:.1f}x "
        f"(ephemeral P50={ephem_p50:.0f}ms, session P50={session_p50:.0f}ms)"
    )

    print("  measuring concurrent throughput, ephemeral (5 parallel)...")
    conc = await measure_concurrent(ephemeral, concurrency=5)
    print(f"  concurrent: {[f'{v:.0f}' for v in conc]}")

    await ephemeral.close()

    return {
        "cold_start_ms": cold_ms,
        "warm_all_ms": warm_ephem,
        "warm_p50": statistics.median(warm_ephem[1:]),
        "warm_p95": _p(warm_ephem[1:], 95),
        "session_p50": session_p50,
        "session_speedup": speedup,
        "concurrent_ms": conc,
        "concurrent_p50": statistics.median(conc),
    }


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

BACKEND_RUNNERS = {
    "wasm": run_wasm_benchmark,
    "e2b": run_e2b_benchmark,
    "vercel": run_vercel_benchmark,
    "daytona": run_daytona_benchmark,
}


async def main(backends: list[str]) -> None:
    results: dict[str, dict[str, Any]] = {}

    for name in backends:
        runner = BACKEND_RUNNERS[name]
        r = await runner()
        if r is not None:
            results[name] = r
            print(
                f"\n  {name} raw timings (ms): cold={r.get('cold_start_ms', 'N/A'):.0f} "
                f"warm_p50={r.get('warm_p50', 'N/A'):.0f} "
                f"conc_p50={r.get('concurrent_p50', 'N/A'):.0f}"
            )

    print_results_table(results)

    # Also dump raw JSON for programmatic use
    raw_path = Path(__file__).parent / "benchmark_sandbox_results.json"
    raw_path.write_text(json.dumps(results, indent=2))
    print(f"Raw results saved to {raw_path}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Phoenix sandbox backend benchmark")
    parser.add_argument(
        "--backend",
        choices=["wasm", "e2b", "vercel", "daytona"],
        help="Backend to benchmark (default: all available)",
    )
    args = parser.parse_args()

    backends_to_run = [args.backend] if args.backend else list(BACKEND_RUNNERS.keys())
    asyncio.run(main(backends_to_run))

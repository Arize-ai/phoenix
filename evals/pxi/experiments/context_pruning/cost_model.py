from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class TokenPrices:
    input_per_mtok: float
    output_per_mtok: float
    cache_read_multiplier: float
    cache_write_multiplier: float


ANTHROPIC_OPUS_4_6_2026_07_03 = TokenPrices(
    input_per_mtok=5.00,
    output_per_mtok=25.00,
    cache_read_multiplier=0.10,
    cache_write_multiplier=1.25,
)


def usage_from_output(output: dict[str, Any]) -> dict[str, int]:
    usage = output.get("usage") if isinstance(output, dict) else None
    if not isinstance(usage, dict):
        return {
            "input_tokens": 0,
            "output_tokens": 0,
            "cache_read_tokens": 0,
            "cache_write_tokens": 0,
        }
    return {
        "input_tokens": int(usage.get("input_tokens", 0) or 0),
        "output_tokens": int(usage.get("output_tokens", 0) or 0),
        "cache_read_tokens": int(usage.get("cache_read_tokens", 0) or 0),
        "cache_write_tokens": int(usage.get("cache_write_tokens", 0) or 0),
    }


def anthropic_cost_usd(
    usage: dict[str, int],
    *,
    prices: TokenPrices = ANTHROPIC_OPUS_4_6_2026_07_03,
) -> float:
    billable_input = max(
        0,
        usage["input_tokens"] - usage["cache_read_tokens"] - usage["cache_write_tokens"],
    )
    input_cost = billable_input * prices.input_per_mtok
    cache_read_cost = (
        usage["cache_read_tokens"] * prices.input_per_mtok * prices.cache_read_multiplier
    )
    cache_write_cost = (
        usage["cache_write_tokens"] * prices.input_per_mtok * prices.cache_write_multiplier
    )
    output_cost = usage["output_tokens"] * prices.output_per_mtok
    return (input_cost + cache_read_cost + cache_write_cost + output_cost) / 1_000_000


def summarize_outputs(outputs: list[dict[str, Any]]) -> dict[str, Any]:
    usage_totals = {
        "input_tokens": 0,
        "output_tokens": 0,
        "cache_read_tokens": 0,
        "cache_write_tokens": 0,
    }
    latencies: list[int] = []
    total_cost = 0.0
    for output in outputs:
        usage = usage_from_output(output)
        for key, value in usage.items():
            usage_totals[key] += value
        latency = output.get("latency_ms")
        if isinstance(latency, int):
            latencies.append(latency)
        total_cost += anthropic_cost_usd(usage)
    sorted_latencies = sorted(latencies)
    midpoint = len(sorted_latencies) // 2
    median_latency = sorted_latencies[midpoint] if sorted_latencies else 0
    return {
        "runs": len(outputs),
        "usage": usage_totals,
        "anthropic_opus_4_6_cost_usd": total_cost,
        "median_latency_ms": median_latency,
    }

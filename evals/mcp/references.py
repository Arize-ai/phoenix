"""Compute references from seed spans, independently of the candidate interfaces."""

from __future__ import annotations

import math
from collections import Counter, defaultdict
from decimal import Decimal
from typing import Any, TypeVar

T = TypeVar("T", str, tuple[str, str])


def span_cost(span: dict[str, Any], pricing: dict[str, Any]) -> Decimal:
    attrs = span["attributes"]
    model = attrs.get("llm.model_name")
    if not model:
        return Decimal(0)
    rates = pricing["models"][model]  # Unknown pricing is setup failure.
    prompt = max(0, int(attrs.get("llm.token_count.prompt", 0)))
    completion = max(0, int(attrs.get("llm.token_count.completion", 0)))
    total = max(0, int(attrs.get("llm.token_count.total", 0)))
    if total > prompt + completion:
        if not prompt:
            prompt = total - completion
        else:
            completion = total - prompt
    cached = min(prompt, max(0, int(attrs.get("llm.token_count.prompt_details.cache_read", 0))))
    return sum(
        (
            Decimal(str(rates[k])) * n
            for k, n in (("input", prompt - cached), ("cache_read", cached), ("output", completion))
        ),
        Decimal(0),
    )


def compute(payload: dict[str, Any], pricing: dict[str, Any]) -> dict[str, Any]:
    traces: dict[str, list[dict[str, Any]]] = defaultdict(list)
    failures: Counter[str] = Counter()
    repeats: Counter[tuple[str, str]] = Counter()
    aliases: dict[str, set[str]] = defaultdict(set)
    signatures: set[str] = set()
    for span in payload["spans"]:
        trace_id = span["context"]["trace_id"]
        traces[trace_id].append(span)
        if span["span_kind"] == "TOOL":
            name = span["name"]
            aliases[name].add(name)
            if alias := span["attributes"].get("tool.name"):
                aliases[name].add(alias)
            repeats[(trace_id, name)] += 1
            if span["status_code"] == "ERROR":
                failures[name] += 1
                if name == "PageDownTool":
                    signatures.add(span.get("status_message", ""))
                    for event in span.get("events", []):
                        if message := event.get("attributes", {}).get("exception.message"):
                            signatures.add(message)
    if not traces:
        raise ValueError("Seed contains no traces")
    costs = {
        t: sum((span_cost(s, pricing) for s in spans), Decimal(0)) for t, spans in traces.items()
    }
    total = sum(costs.values(), Decimal(0))
    categories = Counter(
        a["result"]["label"]
        for a in {
            (a["span_id"], a["name"], a["identifier"]): a for a in payload["span_annotations"]
        }.values()
        if a["name"] == "trail_error" and a["result"].get("label")
    )

    def winners(counts: Counter[T]) -> list[T]:
        return sorted(k for k, v in counts.items() if v == max(counts.values())) if counts else []

    rates = {}
    for group in ("short", "long"):
        spans = [
            s
            for ss in traces.values()
            if (len(ss) < 15 if group == "short" else len(ss) >= 40)
            for s in ss
        ]
        rates[group] = (
            100 * sum(s["status_code"] == "ERROR" for s in spans) / len(spans) if spans else None
        )
    repeat_count = max(repeats.values(), default=0)
    top = sorted(costs, key=lambda t: (-costs[t], t))[: math.ceil(len(traces) / 10)]
    return {
        "count-traces": {"value": len(traces)},
        "total-cost": {"value": float(total)},
        "most-failing-tool": {"winners": [sorted(aliases[k]) for k in winners(failures)]},
        "top-error-category": {"winners": [[k] for k in winners(categories)]},
        "error-rate-by-length": rates,
        "max-llm-calls": {
            "value": max(sum(s["span_kind"] == "LLM" for s in ss) for ss in traces.values())
        },
        "repeated-tool-calls": {
            "winners": [sorted(aliases[name]) for _, name in winners(repeats)],
            "value": repeat_count,
        },
        "spend-concentration": {
            "value": float(100 * sum((costs[t] for t in top), Decimal(0)) / total)
            if total
            else None
        },
        "pagedown-root-cause": {"signatures": sorted(signatures)},
        "noop-surface-cost": {},
    }

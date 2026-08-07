"""Deterministic reference answers, computed straight from the REST API.

Neither arm is trusted to grade itself. Everything here goes over plain HTTP to
``/v1``, the same data both MCP surfaces sit on top of, so the reference is
independent of how an arm chose to fetch or reduce. The judge compares an arm's
prose answer against these numbers.

Recomputed on every run rather than pinned, because the benchmark points at a
live Phoenix whose traces keep moving.
"""

from __future__ import annotations

import statistics
from typing import Any, Iterable, Optional

import httpx

from evals.mcp.questions import BENCHMARK_PROJECTS, SPAN_SAMPLE_LIMIT

#: OTLP status codes as they appear on the wire. 1 is OK, 2 is ERROR.
_STATUS_ERROR = 2

_SPAN_KIND_ATTR = "openinference.span.kind"
_MODEL_NAME_ATTR = "llm.model_name"


def _attr(span: dict[str, Any], key: str) -> Optional[str]:
    """Read one OTLP attribute off a span, unwrapping the typed envelope."""
    for kv in span.get("attributes") or []:
        if kv.get("key") == key:
            value = kv.get("value") or {}
            for slot in ("string_value", "int_value", "double_value", "bool_value"):
                if value.get(slot) is not None:
                    return str(value[slot])
    return None


def _latency_ms(span: dict[str, Any]) -> Optional[float]:
    start, end = span.get("start_time_unix_nano"), span.get("end_time_unix_nano")
    if start is None or end is None:
        return None
    return (end - start) / 1_000_000


def _percentile(values: list[float], pct: float) -> Optional[float]:
    """Nearest-rank percentile.

    Deliberately not ``statistics.quantiles``: on the small samples here its
    interpolation drifts far enough from what an agent's own sort-and-index
    implementation produces to cause spurious judge failures.
    """
    if not values:
        return None
    ordered = sorted(values)
    rank = max(1, min(len(ordered), int(round(pct / 100 * len(ordered) + 0.5))))
    return round(ordered[rank - 1], 2)


def _summarize_latency(spans: Iterable[dict[str, Any]]) -> dict[str, Any]:
    latencies = [ms for ms in (_latency_ms(s) for s in spans) if ms is not None]
    return {
        "count": len(latencies),
        "p50_ms": _percentile(latencies, 50),
        "p95_ms": _percentile(latencies, 95),
        "max_ms": round(max(latencies), 2) if latencies else None,
        "mean_ms": round(statistics.fmean(latencies), 2) if latencies else None,
    }


def _normalize_theme(message: str) -> str:
    """Reduce a status message to the failure type it represents.

    A single failure surfaces twice in these traces: once on the parent AGENT
    span as ``agent failed: RateLimitError`` and once on the child span as
    ``RateLimitError: 429 rate_limit_exceeded: retry after 12s``. Keying themes
    on the raw message therefore splits every theme in half, which marked a
    correct answer wrong on the first run — an agent that merges the pair is
    reading the data right, not double-counting.
    """
    stripped = message.removeprefix("agent failed: ")
    return stripped.split(":")[0].strip() or "unknown"


def _is_error(span: dict[str, Any]) -> bool:
    return (span.get("status") or {}).get("code") == _STATUS_ERROR


async def _get_all(client: httpx.AsyncClient, path: str, **params: Any) -> list[dict[str, Any]]:
    """Follow ``next_cursor`` until the endpoint stops handing one back."""
    rows: list[dict[str, Any]] = []
    cursor: Optional[str] = None
    while True:
        query = dict(params)
        if cursor:
            query["cursor"] = cursor
        response = await client.get(path, params=query)
        response.raise_for_status()
        payload = response.json()
        rows.extend(payload.get("data") or [])
        cursor = payload.get("next_cursor")
        if not cursor:
            return rows


async def _get_spans(client: httpx.AsyncClient, project: str) -> list[dict[str, Any]]:
    """Fetch one page of spans, matching the bound stated in the question text."""
    response = await client.get(
        f"/v1/projects/{project}/spans/otlpv1", params={"limit": SPAN_SAMPLE_LIMIT}
    )
    response.raise_for_status()
    return response.json().get("data") or []


async def _get_all_spans(client: httpx.AsyncClient, project: str) -> list[dict[str, Any]]:
    """Page every span in a project.

    Only the failure-theming question asks about a whole project rather than a
    recent sample, and its reference has to be computed the same way or the
    grader marks a correct answer wrong — which it did, on the first run.
    """
    spans: list[dict[str, Any]] = []
    cursor: Optional[str] = None
    while True:
        params: dict[str, Any] = {"limit": 500}
        if cursor:
            params["cursor"] = cursor
        response = await client.get(f"/v1/projects/{project}/spans/otlpv1", params=params)
        response.raise_for_status()
        payload = response.json()
        spans.extend(payload.get("data") or [])
        cursor = payload.get("next_cursor")
        if not cursor:
            return spans


async def compute_ground_truth(base_url: str, api_key: str) -> dict[str, Any]:
    """Compute every reference answer the question set needs."""
    headers = {"Authorization": f"Bearer {api_key}"}
    async with httpx.AsyncClient(base_url=base_url, headers=headers, timeout=60.0) as client:
        projects = await _get_all(client, "/v1/projects")
        spans_by_project = {p: await _get_spans(client, p) for p in BENCHMARK_PROJECTS}
        all_support_spans = await _get_all_spans(client, "support-agent")

        datasets = await _get_all(client, "/v1/datasets")
        experiments_by_dataset: dict[str, int] = {}
        for dataset in datasets:
            experiments = await _get_all(client, f"/v1/datasets/{dataset['id']}/experiments")
            if experiments:
                experiments_by_dataset[dataset["name"]] = len(experiments)

    support_spans = spans_by_project["support-agent"]
    llm_spans = [s for s in support_spans if _attr(s, _SPAN_KIND_ATTR) == "LLM"]

    kind_mix: dict[str, int] = {}
    for span in support_spans:
        kind = _attr(span, _SPAN_KIND_ATTR) or "UNKNOWN"
        kind_mix[kind] = kind_mix.get(kind, 0) + 1

    # Whole project, not the recent sample: the question asks about every span.
    error_spans = [s for s in all_support_spans if _is_error(s)]
    error_themes: dict[str, int] = {}
    for span in error_spans:
        message = (span.get("status") or {}).get("message") or "unknown"
        theme = _normalize_theme(message)
        error_themes[theme] = error_themes.get(theme, 0) + 1

    by_model: dict[str, list[dict[str, Any]]] = {}
    for span in llm_spans:
        by_model.setdefault(_attr(span, _MODEL_NAME_ATTR) or "unknown", []).append(span)

    slowest = max(
        (s for s in support_spans if _latency_ms(s) is not None),
        key=lambda s: _latency_ms(s) or 0.0,
        default=None,
    )

    cross_project = {}
    for project, spans in spans_by_project.items():
        mix: dict[str, int] = {}
        for span in spans:
            kind = _attr(span, _SPAN_KIND_ATTR) or "UNKNOWN"
            mix[kind] = mix.get(kind, 0) + 1
        errors = sum(1 for s in spans if _is_error(s))
        cross_project[project] = {
            "spans_sampled": len(spans),
            "span_kinds": mix,
            "errors": errors,
            "error_rate_pct": round(100 * errors / len(spans), 2) if spans else 0.0,
        }

    return {
        "project_count": len(projects),
        "span_kind_mix": kind_mix,
        "llm_latency": _summarize_latency(llm_spans),
        "error_themes": {
            "project_spans_total": len(all_support_spans),
            "error_spans": len(error_spans),
            "themes": error_themes,
        },
        "cross_project_health": cross_project,
        "slowest_span": (
            {
                "name": slowest.get("name"),
                "span_kind": _attr(slowest, _SPAN_KIND_ATTR),
                "latency_ms": round(_latency_ms(slowest) or 0.0, 2),
            }
            if slowest
            else None
        ),
        "datasets_with_experiments": experiments_by_dataset,
        "latency_by_model": {
            model: _summarize_latency(spans) for model, spans in sorted(by_model.items())
        },
    }

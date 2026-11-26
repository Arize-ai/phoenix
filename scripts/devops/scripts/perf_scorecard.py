#!/usr/bin/env python3
"""Print the performance numbers of a Phoenix server from its Grafana (otel-lgtm).

The scorecard reads Prometheus and Loki through Grafana's datasource proxy, so it
works against the local `lgtm` profile and against a hosted Grafana that has the
same datasource UIDs (`prometheus`, `loki`).

    # the last hour of the local stack
    ./scripts/perf_scorecard.py

    # a hosted Grafana, a fixed window, and a saved result
    ./scripts/perf_scorecard.py --url https://grafana.example.com \
        --end 2026-11-10T23:00:00Z --window 3h --json before.json

    # compare a later run with a saved one
    ./scripts/perf_scorecard.py --compare before.json

Run it once before a change and once after, over windows with the same load.
For each number, lower is better unless the row says otherwise.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from typing import Any, Optional

DEFAULT_URL = "http://localhost:18273/lgtm"

# GraphQL operations whose latency and call count the scorecard reports. A span
# name is "GraphQL Query: <operation>".
OPERATIONS = [
    "ProjectPageQuery",
    "ProjectPageQueriesTracesQuery",
    "ProjectPageQueriesSpansQuery",
    "TracesTableQuery",
    "SpansTableSpansQuery",
    "SessionsTableQuery",
    "TraceCountTimeSeriesQuery",
    "TraceFilterConditionFieldVocabularyQuery",
    "ProjectEvaluatorsTablePaginationQuery",
    "ProjectEvaluatorScopePanelSpansQuery",
    "ProjectEvaluatorScopePanelCountQuery",
]
OPERATION_PATTERNS = ["ProjectAnnotationMetrics.*Query"]


class Grafana:
    def __init__(self, url: str, token: Optional[str]) -> None:
        self._base = url.rstrip("/") + "/api/datasources/proxy/uid"
        self._headers = {"Authorization": f"Bearer {token}"} if token else {}

    def _get(self, path: str, **params: Any) -> Any:
        request = urllib.request.Request(
            f"{self._base}/{path}?{urllib.parse.urlencode(params)}", headers=self._headers
        )
        with urllib.request.urlopen(request, timeout=90) as response:
            return json.load(response)

    def prometheus(self, query: str, at: float) -> list[dict[str, Any]]:
        result = self._get("prometheus/api/v1/query", query=query, time=at)["data"]["result"]
        return list(result)

    def loki(self, query: str, at: float) -> list[dict[str, Any]]:
        result = self._get("loki/loki/api/v1/query", query=query, time=int(at))["data"]["result"]
        return list(result)


def scalar(result: list[dict[str, Any]]) -> Optional[float]:
    """The value of a one-series result, or None when there is no data."""
    if not result:
        return None
    value = float(result[0]["value"][1])
    return None if value != value else value  # NaN


def by_label(result: list[dict[str, Any]], label: str) -> dict[str, float]:
    return {r["metric"].get(label, ""): float(r["value"][1]) for r in result}


def collect(grafana: Grafana, end: float, window: str) -> dict[str, Any]:
    def prom(query: str) -> Optional[float]:
        return scalar(grafana.prometheus(query, end))

    completed = prom(f"sum(increase(phoenix_online_eval_completed_work_units_total[{window}]))")
    rss_growth = prom(f'delta(process_resident_memory_bytes{{job="phoenix"}}[{window}])')
    numbers: dict[str, Any] = {
        "evaluations_completed": completed,
        "rss_bytes_at_end": prom('max(process_resident_memory_bytes{job="phoenix"})'),
        "rss_growth_bytes": rss_growth,
        "rss_growth_bytes_per_evaluation": (
            rss_growth / completed if rss_growth is not None and completed else None
        ),
        "fewest_evaluations_completed_in_a_minute": prom(
            "min_over_time(sum(increase("
            f"phoenix_online_eval_completed_work_units_total[1m]))[{window}:1m])"
        ),
        "auth_refresh_avg_seconds": prom(
            "sum(increase(starlette_requests_processing_time_seconds_summary_sum"
            f'{{path="/auth/refresh"}}[{window}])) / '
            "sum(increase(starlette_requests_processing_time_seconds_summary_count"
            f'{{path="/auth/refresh"}}[{window}]))'
        ),
        "span_insertion_avg_seconds": prom(
            f"sum(increase(phoenix_bulk_loader_span_insertion_time_seconds_sum[{window}])) / "
            f"sum(increase(phoenix_bulk_loader_span_insertion_time_seconds_count[{window}]))"
        ),
        "graphql_requests": prom(
            "sum(increase(traces_spanmetrics_calls_total"
            f'{{span_name=~"GraphQL (Query|Mutation|Subscription).*"}}[{window}]))'
        ),
        "connection_pool_timeouts": scalar(
            grafana.loki(
                'sum(count_over_time({service_name="arize-phoenix-server"} '
                # The message is in the log record's exception metadata, not its body.
                f'| exception_message=~".*QueuePool limit.*" [{window}]))',
                end,
            )
        )
        or 0.0,
    }

    names = "|".join(OPERATIONS + OPERATION_PATTERNS)
    selector = f'span_name=~"GraphQL Query: ({names})"'
    calls = by_label(
        grafana.prometheus(
            f"sum by (span_name)(increase(traces_spanmetrics_calls_total{{{selector}}}[{window}]))",
            end,
        ),
        "span_name",
    )
    seconds = by_label(
        grafana.prometheus(
            f"sum by (span_name)(increase(traces_spanmetrics_latency_sum{{{selector}}}[{window}]))",
            end,
        ),
        "span_name",
    )
    operations = {}
    for span_name, count in calls.items():
        if count < 1:
            continue
        operations[span_name.removeprefix("GraphQL Query: ")] = {
            "calls": round(count),
            "avg_seconds": seconds.get(span_name, 0.0) / count,
            "total_seconds": seconds.get(span_name, 0.0),
        }
    numbers["operations"] = operations
    return numbers


ROWS = [
    ("Evaluations completed (higher is better)", "evaluations_completed", "{:,.0f}"),
    (
        "Fewest evaluations in any minute (0 means a stall)",
        "fewest_evaluations_completed_in_a_minute",
        "{:,.1f}",
    ),
    ("Server memory at the end", "rss_bytes_at_end", "{:,.0f} B"),
    ("Server memory growth", "rss_growth_bytes", "{:,.0f} B"),
    ("Memory growth per evaluation", "rss_growth_bytes_per_evaluation", "{:,.0f} B"),
    ("Connection pool timeouts", "connection_pool_timeouts", "{:,.0f}"),
    ("/auth/refresh average", "auth_refresh_avg_seconds", "{:.3f} s"),
    ("Span insertion average", "span_insertion_avg_seconds", "{:.4f} s"),
    ("GraphQL requests", "graphql_requests", "{:,.0f}"),
]


def show(value: Optional[float], fmt: str) -> str:
    return "no data" if value is None else fmt.format(value)


def print_scorecard(card: dict[str, Any], before: Optional[dict[str, Any]]) -> None:
    print(f"Grafana: {card['url']}")
    print(f"Window:  {card['window']} ending {card['end']}")
    if before:
        print(f"Before:  {before['window']} ending {before['end']} ({before['url']})")
    print()
    numbers, old = card["numbers"], (before or {}).get("numbers", {})
    for label, key, fmt in ROWS:
        line = f"{label:<52} {show(numbers.get(key), fmt):>18}"
        if before:
            line += f"   was {show(old.get(key), fmt)}"
        print(line)
    print()
    header = f"{'GraphQL operation':<46} {'calls':>7} {'avg s':>8} {'total s':>9}"
    print(header + ("   was: calls, avg s" if before else ""))
    old_operations = old.get("operations", {})
    operations = numbers["operations"]
    for name in sorted(
        set(operations) | set(old_operations),
        key=lambda n: -operations.get(n, old_operations.get(n, {})).get("total_seconds", 0.0),
    ):
        row = operations.get(name)
        line = (
            f"{name:<46} {row['calls']:>7} {row['avg_seconds']:>8.2f} {row['total_seconds']:>9.0f}"
            if row
            else f"{name:<46} {'-':>7} {'-':>8} {'-':>9}"
        )
        if before:
            was = old_operations.get(name)
            line += f"   {was['calls']}, {was['avg_seconds']:.2f}" if was else "   -"
        print(line)
    if not operations and not old_operations:
        print("(none of the tracked operations ran in this window)")


def parse_end(value: Optional[str]) -> float:
    if value is None:
        return time.time()
    try:
        return float(value)
    except ValueError:
        return datetime.fromisoformat(value.replace("Z", "+00:00")).timestamp()


def main() -> int:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument(
        "--url",
        default=os.environ.get("LGTM_URL", DEFAULT_URL),
        help=f"Grafana base URL (default: $LGTM_URL or {DEFAULT_URL})",
    )
    parser.add_argument("--end", help="end of the window: epoch seconds or ISO 8601 (default: now)")
    parser.add_argument("--window", default="1h", help="window length, such as 30m or 3h")
    parser.add_argument("--json", metavar="FILE", help="also save the result to FILE")
    parser.add_argument("--compare", metavar="FILE", help="show a saved result beside this one")
    args = parser.parse_args()

    end = parse_end(args.end)
    grafana = Grafana(args.url, os.environ.get("LGTM_TOKEN"))
    try:
        numbers = collect(grafana, end, args.window)
    except (urllib.error.URLError, TimeoutError) as error:
        print(f"Could not read {args.url}: {error}", file=sys.stderr)
        return 1
    card = {
        "url": args.url,
        "window": args.window,
        "end": datetime.fromtimestamp(end, timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "numbers": numbers,
    }
    before = None
    if args.compare:
        with open(args.compare) as file:
            before = json.load(file)
    print_scorecard(card, before)
    if args.json:
        with open(args.json, "w") as file:
            json.dump(card, file, indent=2)
            file.write("\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())

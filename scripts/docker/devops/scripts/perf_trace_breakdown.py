#!/usr/bin/env python3
"""Show where the time goes inside one server trace of a GraphQL operation.

The script finds the traces of an operation in Tempo, through Grafana's
datasource proxy, picks one, and adds up its spans by name. Each resolver is a
span named "GraphQL Resolving: <field>", so the table shows which fields hold
the request.

    # the median trace of the operation in the last 15 minutes
    ./scripts/perf_trace_breakdown.py ProjectPageQueriesTracesQuery

    # the slowest trace in a fixed window, from a hosted Grafana
    ./scripts/perf_trace_breakdown.py ProjectPageQueriesSpansQuery --pick slowest \
        --start 2026-11-13T10:26:57Z --end 2026-11-13T10:38:37Z \
        --url https://grafana.example.com
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
from collections import defaultdict
from datetime import datetime
from typing import Any, Optional

DEFAULT_URL = "http://localhost:18273/lgtm"


def parse_time(value: Optional[str], default: float) -> int:
    if value is None:
        return int(default)
    try:
        return int(float(value))
    except ValueError:
        return int(datetime.fromisoformat(value.replace("Z", "+00:00")).timestamp())


def main() -> int:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument("operation", help="GraphQL operation name, such as ProjectPageQuery")
    parser.add_argument(
        "--url",
        default=os.environ.get("LGTM_URL", DEFAULT_URL),
        help=f"Grafana base URL (default: $LGTM_URL or {DEFAULT_URL})",
    )
    parser.add_argument(
        "--start", help="window start: epoch seconds or ISO 8601 (default: 15m ago)"
    )
    parser.add_argument("--end", help="window end: epoch seconds or ISO 8601 (default: now)")
    parser.add_argument("--pick", choices=["median", "slowest"], default="median")
    parser.add_argument("--top", type=int, default=15, help="rows to print")
    args = parser.parse_args()

    now = time.time()
    end = parse_time(args.end, now)
    start = parse_time(args.start, end - 900)
    base = args.url.rstrip("/") + "/api/datasources/proxy/uid/tempo"

    def get(path: str, **params: Any) -> Any:
        with urllib.request.urlopen(
            f"{base}/{path}?{urllib.parse.urlencode(params)}", timeout=60
        ) as response:
            return json.load(response)

    query = f'{{ name = "GraphQL Query: {args.operation}" }}'
    try:
        found = get("api/search", q=query, start=start, end=end, limit=50).get("traces", [])
    except (urllib.error.URLError, TimeoutError) as error:
        print(f"Could not read {args.url}: {error}", file=sys.stderr)
        return 1
    if not found:
        print(f"No traces of {args.operation} in the window.", file=sys.stderr)
        return 1
    found.sort(key=lambda trace: trace.get("durationMs", 0))
    picked = found[-1] if args.pick == "slowest" else found[(len(found) - 1) // 2]
    durations = [trace.get("durationMs") for trace in found]
    print(f"{args.operation}: {len(found)} traces in the window, durations in ms: {durations}")
    print(f"Using the {args.pick} one: {picked['traceID']} ({picked.get('durationMs')} ms)")

    trace = get(f"api/traces/{picked['traceID']}")
    spans = [
        span
        for batch in trace.get("batches", [])
        for scope in batch.get("scopeSpans", [])
        for span in scope.get("spans", [])
    ]

    def duration_ms(span: dict[str, Any]) -> float:
        return (int(span["endTimeUnixNano"]) - int(span["startTimeUnixNano"])) / 1e6

    by_name: dict[str, list[float]] = defaultdict(lambda: [0, 0.0, 0.0])
    for span in spans:
        row = by_name[span["name"]]
        row[0] += 1
        row[1] += duration_ms(span)
        row[2] = max(row[2], duration_ms(span))

    print(f"\n{len(spans)} spans. Sorted by the longest single span of each name:")
    print(f"{'span name':<58}{'count':>7}{'sum ms':>10}{'max ms':>9}")
    rows = sorted(by_name.items(), key=lambda item: -item[1][2])
    for name, (count, total, longest) in rows[: args.top]:
        print(f"{name[:57]:<58}{int(count):>7}{total:>10.0f}{longest:>9.0f}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

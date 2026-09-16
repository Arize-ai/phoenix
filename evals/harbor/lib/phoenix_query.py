"""Read a project's spans from the local Phoenix, for the reference solutions.

Solutions run inside the task image, where this package lives under
``/opt/verifier`` and Phoenix answers on port 6006. They query the GraphQL
route directly: px is installed only for the CLI agents, not in the image.
"""

from __future__ import annotations

import json
import urllib.request
from collections import defaultdict
from typing import Any

PHOENIX_URL = "http://127.0.0.1:6006"
ANSWER_PATH = "/app/answer.txt"
SPAN_FIELDS = (
    "name spanKind statusCode statusMessage trace { traceId }"
    " costSummary { total { cost } } spanAnnotations { name label }"
)

Span = dict[str, Any]


def graphql(query: str) -> dict[str, Any]:
    """Run a GraphQL query against the local Phoenix and return its ``data``."""
    request = urllib.request.Request(
        f"{PHOENIX_URL}/graphql",
        data=json.dumps({"query": query}).encode(),
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(request, timeout=60) as response:
        payload = json.load(response)
    if payload.get("errors"):
        raise SystemExit(payload["errors"])
    data: dict[str, Any] = payload["data"]
    return data


def project_spans(project: str) -> list[Span]:
    """Every span in the project, paged 500 at a time."""
    edges = graphql("{ projects(first: 100) { edges { node { id name } } } }")["projects"]["edges"]
    project_id = json.dumps(next(e["node"]["id"] for e in edges if e["node"]["name"] == project))
    spans: list[Span] = []
    cursor: str | None = None
    while True:
        after = ", after: " + json.dumps(cursor) if cursor else ""
        page = graphql(
            "{ node(id: " + project_id + ") { ... on Project { spans(first: 500" + after + ") {"
            " edges { node { " + SPAN_FIELDS + " } } pageInfo { hasNextPage endCursor } } } } }"
        )["node"]["spans"]
        spans.extend(e["node"] for e in page["edges"])
        if not page["pageInfo"]["hasNextPage"]:
            return spans
        cursor = page["pageInfo"]["endCursor"]


def spans_by_trace(spans: list[Span]) -> dict[str, list[Span]]:
    """Group spans by trace id."""
    traces: dict[str, list[Span]] = defaultdict(list)
    for span in spans:
        traces[span["trace"]["traceId"]].append(span)
    return traces


def span_cost(span: Span) -> float:
    """The span's total cost, or zero when Phoenix has none."""
    cost = ((span.get("costSummary") or {}).get("total") or {}).get("cost")
    return float(cost or 0.0)


def write_answer(answer: str) -> None:
    """Write the answer file the verifier grades and echo it to the log."""
    with open(ANSWER_PATH, "w") as handle:
        handle.write(answer + "\n")
    print(answer)

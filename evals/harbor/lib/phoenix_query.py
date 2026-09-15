"""Read a project's spans through the px CLI, for the reference solutions.

Solutions run inside the agent image, where this package lives under
``/opt/verifier`` and px under ``/opt/px``.
"""

from __future__ import annotations

import json
import subprocess
from collections import defaultdict
from typing import Any

PX = "/opt/px/bin/px"
ANSWER_PATH = "/workspace/answer.txt"
SPAN_FIELDS = (
    "name spanKind statusCode statusMessage trace { traceId }"
    " costSummary { total { cost } } spanAnnotations { name label }"
)

Span = dict[str, Any]


def graphql(query: str) -> dict[str, Any]:
    """Run a GraphQL query through px and return its ``data``."""
    result = subprocess.run(
        [PX, "api", "graphql", query], capture_output=True, text=True, check=True
    )
    payload = json.loads(result.stdout)
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

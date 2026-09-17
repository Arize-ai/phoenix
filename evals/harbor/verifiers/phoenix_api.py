"""Phoenix query helpers for reference solutions in task images.

Use the typed Phoenix client for spans and annotations. Per-span cost requires
GraphQL, so :func:`span_costs` uses the GraphQL API.
"""

from __future__ import annotations

import json
import urllib.request
from collections import defaultdict
from typing import Any

from phoenix.client import Client
from phoenix.client.__generated__ import v1

PHOENIX_URL = "http://127.0.0.1:6006"
ANSWER_PATH = "/app/answer.txt"
SPAN_LIMIT = 1_000_000  # The client fetches 100 spans per page up to this limit.


def client() -> Client:
    return Client(base_url=PHOENIX_URL)


def project_spans(project: str) -> list[v1.Span]:
    return client().spans.get_spans(project_identifier=project, limit=SPAN_LIMIT)


def spans_by_trace(spans: list[v1.Span]) -> dict[str, list[v1.Span]]:
    traces: dict[str, list[v1.Span]] = defaultdict(list)
    for span in spans:
        traces[span["context"]["trace_id"]].append(span)
    return traces


def annotation_labels(project: str, name: str) -> list[str]:
    annotations = client().spans.get_span_annotations(
        spans=project_spans(project), project_identifier=project, include_annotation_names=[name]
    )
    return [
        str(annotation["result"]["label"])
        for annotation in annotations
        if annotation.get("result") and annotation["result"].get("label")
    ]


def graphql(query: str) -> dict[str, Any]:
    """Return the ``data`` object from a local Phoenix GraphQL query."""
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


def span_costs(project: str) -> dict[str, float]:
    """Return total cost by span ID, omitting spans without cost data."""
    edges = graphql("{ projects(first: 100) { edges { node { id name } } } }")["projects"]["edges"]
    project_id = json.dumps(next(e["node"]["id"] for e in edges if e["node"]["name"] == project))
    costs: dict[str, float] = {}
    cursor: str | None = None
    while True:
        after = ", after: " + json.dumps(cursor) if cursor else ""
        page = graphql(
            "{ node(id: " + project_id + ") { ... on Project { spans(first: 500" + after + ") {"
            " edges { node { spanId costSummary { total { cost } } } }"
            " pageInfo { hasNextPage endCursor } } } } }"
        )["node"]["spans"]
        for edge in page["edges"]:
            cost = ((edge["node"].get("costSummary") or {}).get("total") or {}).get("cost")
            if cost:
                costs[edge["node"]["spanId"]] = float(cost)
        if not page["pageInfo"]["hasNextPage"]:
            return costs
        cursor = page["pageInfo"]["endCursor"]


def write_answer(answer: str) -> None:
    """Write the answer for grading and print it to the task log."""
    with open(ANSWER_PATH, "w") as handle:
        handle.write(answer + "\n")
    print(answer)

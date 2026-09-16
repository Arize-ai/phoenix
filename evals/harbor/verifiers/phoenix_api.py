"""Read a project's data from the local Phoenix, for the reference solutions.

Solutions run inside the task image, where this package lives under
``/opt/verifier`` and Phoenix answers on port 6006. Spans and annotations come
through the typed Phoenix client; per-span cost is only exposed by GraphQL, so
:func:`span_costs` is the one query here.
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
SPAN_LIMIT = 1_000_000  # the client pages 100 at a time up to this many spans


def client() -> Client:
    return Client(base_url=PHOENIX_URL)


def project_spans(project: str) -> list[v1.Span]:
    """Every span in the project."""
    return client().spans.get_spans(project_identifier=project, limit=SPAN_LIMIT)


def spans_by_trace(spans: list[v1.Span]) -> dict[str, list[v1.Span]]:
    """Group spans by trace id."""
    traces: dict[str, list[v1.Span]] = defaultdict(list)
    for span in spans:
        traces[span["context"]["trace_id"]].append(span)
    return traces


def annotation_labels(project: str, name: str) -> list[str]:
    """The label of every annotation called ``name`` on the project's spans."""
    annotations = client().spans.get_span_annotations(
        spans=project_spans(project), project_identifier=project, include_annotation_names=[name]
    )
    return [
        str(annotation["result"]["label"])
        for annotation in annotations
        if annotation.get("result") and annotation["result"].get("label")
    ]


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


def span_costs(project: str) -> dict[str, float]:
    """Total cost by span id, for spans Phoenix has a cost for. GraphQL only."""
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
    """Write the answer file the verifier grades and echo it to the log."""
    with open(ANSWER_PATH, "w") as handle:
        handle.write(answer + "\n")
    print(answer)

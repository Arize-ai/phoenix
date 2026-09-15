#!/usr/bin/env python3
"""Reference solution through the px CLI: fetch the project's spans over GraphQL."""

import json
import subprocess
from collections import Counter, defaultdict

PROJECT = "research-assistant"
PX = "/opt/px/bin/px"


def graphql(query):
    result = subprocess.run(
        [PX, "api", "graphql", query], capture_output=True, text=True, check=True
    )
    payload = json.loads(result.stdout)
    if payload.get("errors"):
        raise SystemExit(payload["errors"])
    return payload["data"]


def fetch_spans():
    edges = graphql("{ projects(first: 100) { edges { node { id name } } } }")["projects"]["edges"]
    project_id = json.dumps(next(e["node"]["id"] for e in edges if e["node"]["name"] == PROJECT))
    spans, cursor = [], None
    while True:
        after = ", after: " + json.dumps(cursor) if cursor else ""
        page = graphql(
            "{ node(id: " + project_id + ") { ... on Project { spans(first: 500" + after + ") {"
            " edges { node { name spanKind statusCode statusMessage trace { traceId }"
            " costSummary { total { cost } } spanAnnotations { name label } } }"
            " pageInfo { hasNextPage endCursor } } } } }"
        )["node"]["spans"]
        spans.extend(e["node"] for e in page["edges"])
        if not page["pageInfo"]["hasNextPage"]:
            return spans
        cursor = page["pageInfo"]["endCursor"]


def by_trace(spans):
    traces = defaultdict(list)
    for span in spans:
        traces[span["trace"]["traceId"]].append(span)
    return traces


def cost(span):
    return ((span.get("costSummary") or {}).get("total") or {}).get("cost") or 0.0


labels = Counter(
    annotation["label"]
    for span in fetch_spans()
    for annotation in span["spanAnnotations"]
    if annotation["name"] == "trail_error" and annotation["label"]
)
top = max(labels.values())
answer = ", ".join(sorted(label for label, count in labels.items() if count == top))

with open("/workspace/answer.txt", "w") as handle:
    handle.write(answer + "\n")
print(answer)

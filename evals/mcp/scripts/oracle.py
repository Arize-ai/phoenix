"""Unpaid reference solution: query the actual target through the installed px CLI.

The solution reads server costs and stored annotations. It does not receive the
private seed or verifier references. Only Harbor's oracle adapter gets this file.
"""

import json
import math
import re
import subprocess
import uuid
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

STEPS: list[dict[str, Any]] = []


def graphql(query):
    result = subprocess.run(
        ["px", "api", "graphql", query], capture_output=True, text=True, check=True
    )
    value = json.loads(result.stdout)
    if value.get("errors"):
        raise RuntimeError(value["errors"])
    call_id = str(uuid.uuid4())
    STEPS.append(
        {
            "step_id": len(STEPS) + 1,
            "source": "agent",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "message": "Query Phoenix",
            "llm_call_count": 0,
            "tool_calls": [
                {"tool_call_id": call_id, "function_name": "px", "arguments": {"query": query}}
            ],
            "observation": {"results": [{"source_call_id": call_id, "content": result.stdout}]},
        }
    )
    return value["data"]


def solve(project, task):
    if task == "noop-surface-cost":
        return "ok"
    cursor = None
    project_id = None
    while True:
        after = ", after: " + json.dumps(cursor) if cursor else ""
        page = graphql(
            "{ projects(first: 100"
            + after
            + ") { edges { node { id name traceCount } } pageInfo { hasNextPage endCursor } } }"
        )["projects"]
        for edge in page["edges"]:
            if edge["node"]["name"] == project:
                project_id = edge["node"]["id"]
                if task == "count-traces":
                    return str(edge["node"]["traceCount"])
        if project_id or not page["pageInfo"]["hasNextPage"]:
            break
        cursor = page["pageInfo"]["endCursor"]
    if not project_id:
        raise RuntimeError("Project absent")
    spans: list[dict[str, Any]] = []
    cursor = None
    while True:
        after = ", after: " + json.dumps(cursor) if cursor else ""
        query = (
            "{ node(id: "
            + json.dumps(project_id)
            + ") { ... on Project { spans(first: 500"
            + after
            + ") { edges { node { name spanKind statusCode statusMessage trace { traceId } "
            "costSummary { total { cost } } spanAnnotations { name label } } } "
            "pageInfo { hasNextPage endCursor } } } } }"
        )
        page = graphql(query)["node"]["spans"]
        spans.extend(e["node"] for e in page["edges"])
        if not page["pageInfo"]["hasNextPage"]:
            break
        cursor = page["pageInfo"]["endCursor"]
    traces = defaultdict(list)
    failures: Counter[str] = Counter()
    repeats: Counter[tuple[str, str]] = Counter()
    categories: Counter[str] = Counter()
    costs: dict[str, float] = defaultdict(float)
    for span in spans:
        t = span["trace"]["traceId"]
        traces[t].append(span)
        costs[t] += ((span.get("costSummary") or {}).get("total") or {}).get("cost") or 0
        if span["spanKind"] == "tool":
            repeats[(t, span["name"])] += 1
            if span["statusCode"] == "ERROR":
                failures[span["name"]] += 1
        categories.update(
            a["label"] for a in span["spanAnnotations"] if a["name"] == "trail_error" and a["label"]
        )
    total = sum(costs.values())
    if task == "total-cost":
        return f"${total:.2f}"
    if task == "most-failing-tool":
        return ", ".join(k for k, v in failures.items() if v == max(failures.values()))
    if task == "top-error-category":
        return ", ".join(k for k, v in categories.items() if v == max(categories.values()))
    if task == "max-llm-calls":
        return str(max(sum(s["spanKind"] == "llm" for s in ss) for ss in traces.values()))
    if task == "repeated-tool-calls":
        (_, name), count = repeats.most_common(1)[0]
        return f"{name}: {count} calls"
    if task == "error-rate-by-length":
        groups = [
            ("Short", [s for ss in traces.values() if len(ss) < 15 for s in ss]),
            ("Long", [s for ss in traces.values() if len(ss) >= 40 for s in ss]),
        ]
        return "; ".join(
            f"{label}: {100 * sum(s['statusCode'] == 'ERROR' for s in ss) / len(ss):.1f}%"
            for label, ss in groups
        )
    if task == "spend-concentration":
        top = sorted(costs, key=lambda t: (-costs[t], t))[: math.ceil(len(costs) / 10)]
        return f"{100 * sum(costs[t] for t in top) / total:.1f}%"
    if task == "pagedown-root-cause":
        messages = [s["statusMessage"] for s in spans if s["name"] == "PageDownTool"]
        message = next(m for m in messages if re.search("unexpected keyword argument", m))
        return "The caller passes an unsupported keyword to forward(): " + message
    raise ValueError(task)


if __name__ == "__main__":
    config = json.loads(Path("/solution/config.json").read_text())
    answer = solve(**config)
    Path("/workspace/answer.txt").write_text(answer)
    STEPS.append(
        {
            "step_id": len(STEPS) + 1,
            "source": "agent",
            "message": answer,
            "llm_call_count": 0,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
    )
    Path("/logs/agent/trajectory.json").write_text(
        json.dumps(
            {
                "schema_version": "ATIF-v1.6",
                "session_id": str(uuid.uuid4()),
                "agent": {"name": "phoenix-cli-oracle", "version": "2"},
                "steps": STEPS,
            }
        )
    )
    print(answer)

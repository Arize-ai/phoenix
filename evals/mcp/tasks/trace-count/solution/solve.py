"""Oracle exercises the CLI against a seeded target. No fixture answer is embedded."""

import json
import subprocess
from pathlib import Path

cursor = None
while True:
    after = f", after: {json.dumps(cursor)}" if cursor else ""
    query = (
        "{ projects(first: 100" + after + ") { edges { node { name traceCount "
        "traces(first: 1) { edges { node { traceId } } } } } "
        "pageInfo { hasNextPage endCursor } } }"
    )
    result = json.loads(subprocess.check_output(["px", "api", "graphql", query], text=True))
    if result.get("errors"):
        raise RuntimeError("Oracle GraphQL returned errors")
    projects = result["data"]["projects"]
    for edge in projects["edges"]:
        project = edge["node"]
        if project["name"] == "mcp-trail-gaia":
            Path("/workspace/answer.json").write_text(
                json.dumps(
                    {
                        "project": project["name"],
                        "trace_count": project["traceCount"],
                        "evidence_trace_ids": [
                            e["node"]["traceId"] for e in project["traces"]["edges"]
                        ],
                    }
                )
            )
            raise SystemExit(0)
    page = projects["pageInfo"]
    if not page["hasNextPage"] or page["endCursor"] == cursor:
        raise RuntimeError("Oracle target project not found")
    cursor = page["endCursor"]

#!/bin/sh
# Reference solution through the px CLI: read the project's trace count.
set -eu
/opt/px/bin/px api graphql '{ projects(first: 100) { edges { node { name traceCount } } } }' \
  | python3 -c 'import json, sys
edges = json.load(sys.stdin)["data"]["projects"]["edges"]
print(next(e["node"]["traceCount"] for e in edges if e["node"]["name"] == "research-assistant"))' \
  > /workspace/answer.txt
cat /workspace/answer.txt

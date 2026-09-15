#!/bin/sh
# Read the seeded project's trace count through px.
set -eu
/opt/px/bin/px api graphql '{ projects(first: 100) { edges { node { name traceCount } } } }' \
  | python3 -c 'import json, sys
edges = json.load(sys.stdin)["data"]["projects"]["edges"]
print(next(e["node"]["traceCount"] for e in edges if e["node"]["name"] == "research-assistant"))' \
  > /workspace/answer.txt
cat /workspace/answer.txt

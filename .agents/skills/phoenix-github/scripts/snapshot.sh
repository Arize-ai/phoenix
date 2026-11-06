#!/usr/bin/env bash
# Snapshot every item on the Phoenix board (project #42) to a JSON file.
#
# The board carries ~6.3k items and the ProjectV2 API has no server-side field
# filter, so this walks ~63 sequential pages and takes roughly 60-90s. Take the
# snapshot ONCE and point every check at it, rather than re-querying per check.
#
# Usage: snapshot.sh [OUT]     (default: ./board.json)
set -euo pipefail

OUT="${1:-board.json}"
ORG="${PHOENIX_PROJECT_ORG:-Arize-ai}"
NUM="${PHOENIX_PROJECT_NUMBER:-42}"

echo "Snapshotting $ORG project #$NUM -> $OUT (this takes ~60-90s)..." >&2

# Write to a sibling temp file and move it into place only on success: a
# rate-limited walk halfway through must not destroy the snapshot you were
# already working from.
TMP="$(mktemp "${OUT}.XXXXXX")"
trap 'rm -f "$TMP"' EXIT

gh api graphql --paginate --slurp \
  -F org="$ORG" -F num="$NUM" \
  -f query='
query($org: String!, $num: Int!, $endCursor: String) {
  organization(login: $org) {
    projectV2(number: $num) {
      title
      items(first: 100, after: $endCursor) {
        pageInfo { hasNextPage endCursor }
        nodes {
          id
          sprint: fieldValueByName(name: "Sprint") {
            ... on ProjectV2ItemFieldIterationValue { title startDate duration }
          }
          status: fieldValueByName(name: "Status") {
            ... on ProjectV2ItemFieldSingleSelectValue { name }
          }
          content {
            ... on Issue {
              number title url state createdAt updatedAt
              assignees(first: 10) { nodes { login } }
              labels(first: 20) { nodes { name } }
            }
          }
        }
      }
    }
  }
}' > "$TMP"

mv "$TMP" "$OUT"

echo "Wrote $OUT ($(wc -c < "$OUT" | tr -d ' ') bytes)" >&2

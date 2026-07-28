#!/usr/bin/env bash
#
# Posts a single comment on the issue that triggered the workflow.
# Usage: ./scripts/comment.sh --body "your comment text"
#
# The issue number is read from the workflow event payload, so the comment can
# only ever land on the triggering issue.
#

set -euo pipefail

# Read from event payload so the issue number is bound to the triggering event
ISSUE=$(jq -r '.issue.number // empty' "${GITHUB_EVENT_PATH:?GITHUB_EVENT_PATH not set}")
if ! [[ "$ISSUE" =~ ^[0-9]+$ ]]; then
  echo "Error: no issue number in event payload" >&2
  exit 1
fi

BODY=""

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --body)
      BODY="$2"
      shift 2
      ;;
    *)
      echo "Error: unknown argument (only --body is accepted)" >&2
      exit 1
      ;;
  esac
done

if [[ -z "$BODY" ]]; then
  echo "Error: --body is required and must be non-empty" >&2
  exit 1
fi

gh issue comment "$ISSUE" --body "$BODY"
echo "Commented on #$ISSUE"

#!/usr/bin/env bash
#
# Posts a single comment on a GitHub issue during scheduled triage.
# Usage: ./scripts/comment.sh --issue 123 --body "your comment text"
#
# The issue number is passed explicitly and MUST be one of the issues the
# workflow approved for this run (TRIAGE_ALLOWED_ISSUES). This fails closed, so
# a prompt-injected run can never comment on an issue outside the current batch.
#

set -euo pipefail

ISSUE=""
BODY=""

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --issue)
      ISSUE="$2"
      shift 2
      ;;
    --body)
      BODY="$2"
      shift 2
      ;;
    *)
      echo "Error: unknown argument (only --issue and --body are accepted)" >&2
      exit 1
      ;;
  esac
done

if ! [[ "$ISSUE" =~ ^[0-9]+$ ]]; then
  echo "Error: --issue <number> is required" >&2
  exit 1
fi

# Fail closed: the issue must be one the workflow approved for this batch.
if [[ -z "${TRIAGE_ALLOWED_ISSUES:-}" ]]; then
  echo "Error: TRIAGE_ALLOWED_ISSUES is not set; refusing to comment" >&2
  exit 1
fi
if ! printf '%s\n' ${TRIAGE_ALLOWED_ISSUES} | grep -qxF "$ISSUE"; then
  echo "Error: issue #$ISSUE is not in the approved triage batch" >&2
  exit 1
fi

if [[ -z "$BODY" ]]; then
  echo "Error: --body is required and must be non-empty" >&2
  exit 1
fi

gh issue comment "$ISSUE" --body "$BODY"
echo "Commented on #$ISSUE"

#!/usr/bin/env bash
#
# Edits labels on a GitHub issue during scheduled triage.
# Usage: ./scripts/edit-issue-labels.sh --issue 123 --add-label bug --remove-label triage
#
# The issue number is passed explicitly and MUST be one of the issues the
# workflow approved for this run (TRIAGE_ALLOWED_ISSUES). This fails closed, so
# a prompt-injected run can never edit an issue outside the current batch.
#

set -euo pipefail

ISSUE=""
ADD_LABELS=()
REMOVE_LABELS=()

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --issue)
      ISSUE="$2"
      shift 2
      ;;
    --add-label)
      ADD_LABELS+=("$2")
      shift 2
      ;;
    --remove-label)
      REMOVE_LABELS+=("$2")
      shift 2
      ;;
    *)
      echo "Error: unknown argument (only --issue, --add-label, --remove-label are accepted)" >&2
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
  echo "Error: TRIAGE_ALLOWED_ISSUES is not set; refusing to edit labels" >&2
  exit 1
fi
if ! printf '%s\n' ${TRIAGE_ALLOWED_ISSUES} | grep -qxF "$ISSUE"; then
  echo "Error: issue #$ISSUE is not in the approved triage batch" >&2
  exit 1
fi

if [[ ${#ADD_LABELS[@]} -eq 0 && ${#REMOVE_LABELS[@]} -eq 0 ]]; then
  exit 1
fi

# Fetch valid labels from the repo
VALID_LABELS=$(gh label list --limit 500 --json name --jq '.[].name')

# Filter to only labels that exist in the repo
FILTERED_ADD=()
for label in "${ADD_LABELS[@]}"; do
  if echo "$VALID_LABELS" | grep -qxF "$label"; then
    FILTERED_ADD+=("$label")
  fi
done

FILTERED_REMOVE=()
for label in "${REMOVE_LABELS[@]}"; do
  if echo "$VALID_LABELS" | grep -qxF "$label"; then
    FILTERED_REMOVE+=("$label")
  fi
done

if [[ ${#FILTERED_ADD[@]} -eq 0 && ${#FILTERED_REMOVE[@]} -eq 0 ]]; then
  exit 0
fi

# Build gh command arguments
GH_ARGS=("issue" "edit" "$ISSUE")

for label in "${FILTERED_ADD[@]}"; do
  GH_ARGS+=("--add-label" "$label")
done

for label in "${FILTERED_REMOVE[@]}"; do
  GH_ARGS+=("--remove-label" "$label")
done

gh "${GH_ARGS[@]}"

if [[ ${#FILTERED_ADD[@]} -gt 0 ]]; then
  echo "Added to #$ISSUE: ${FILTERED_ADD[*]}"
fi
if [[ ${#FILTERED_REMOVE[@]} -gt 0 ]]; then
  echo "Removed from #$ISSUE: ${FILTERED_REMOVE[*]}"
fi

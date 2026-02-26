#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
PLAN_FILE="${REPO_ROOT}/UPSERT_DATASET_EXECUTION_PLAN.md"
LOG_DIR="${REPO_ROOT}/.codex/step-loop-logs"
RUN_ONCE=0
DRY_RUN=0

usage() {
  cat <<USAGE
Usage: $(basename "$0") [options]

Runs Codex in a loop, one unchecked STEP at a time, using the execution plan markdown.

Options:
  --plan <path>   Path to plan markdown file
  --log-dir <dir> Directory for per-step Codex logs (default: ./.codex/step-loop-logs)
  --once          Run only the next unchecked step, then exit
  --dry-run       Print the prompt that would be sent to Codex; do not execute Codex
  -h, --help      Show this help text

Environment:
  CODEX_MODEL     Optional model name passed to codex exec --model
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --plan)
      PLAN_FILE="$2"
      shift 2
      ;;
    --log-dir)
      LOG_DIR="$2"
      shift 2
      ;;
    --once)
      RUN_ONCE=1
      shift
      ;;
    --dry-run)
      DRY_RUN=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if [[ ! -f "$PLAN_FILE" ]]; then
  echo "Plan file not found: $PLAN_FILE" >&2
  exit 1
fi

mkdir -p "$LOG_DIR"

cd "$REPO_ROOT"

next_step_line() {
  grep -E '^- \[ \] STEP-[0-9]+:' "$PLAN_FILE" | head -n 1 || true
}

extract_step_id() {
  sed -E 's/^- \[ \] (STEP-[0-9]+):.*/\1/'
}

extract_step_title() {
  sed -E 's/^- \[ \] STEP-[0-9]+:[[:space:]]*//'
}

extract_global_context() {
  awk '
    /^## Goal/{flag=1}
    /^## STEP-01/{flag=0}
    flag {print}
  ' "$PLAN_FILE"
}

extract_step_section() {
  local step_id="$1"
  awk -v step="$step_id" '
    $0 ~ "^## " step ":" {flag=1; print; next}
    flag && $0 ~ /^## STEP-[0-9]+:/ {exit}
    flag {print}
  ' "$PLAN_FILE"
}

build_prompt_file() {
  local step_id="$1"
  local step_title="$2"
  local prompt_file="$3"

  local global_context
  local step_section
  global_context="$(extract_global_context)"
  step_section="$(extract_step_section "$step_id")"

  cat > "$prompt_file" <<PROMPT
You are running one step in a multi-agent execution loop.

Rules:
1. Execute only the current step. Do not start future steps.
2. Use the plan file as the source of truth for scope and verification.
3. Make code changes required for this step.
4. Run the verification listed for this step.
5. Commit all changes for this step in exactly one commit.
6. Update the plan file:
   - mark this step complete in the top checklist using - [x] STEP-..
   - set this step section status to Status: Completed
   - fill the Commit: line with the commit SHA
7. After finishing this single step, stop.

Plan file: ${PLAN_FILE}
Current step: ${step_id}: ${step_title}

Global context from plan:
${global_context}

Current step section from plan:
${step_section}
PROMPT
}

run_count=0

while true; do
  step_line="$(next_step_line)"
  if [[ -z "$step_line" ]]; then
    echo "All steps are completed in ${PLAN_FILE}."
    exit 0
  fi

  step_id="$(printf '%s\n' "$step_line" | extract_step_id)"
  step_title="$(printf '%s\n' "$step_line" | extract_step_title)"
  old_head="$(git rev-parse HEAD)"

  prompt_file="$(mktemp)"
  build_prompt_file "$step_id" "$step_title" "$prompt_file"
  timestamp="$(date +%Y%m%d-%H%M%S)"
  log_file="${LOG_DIR}/${timestamp}_${step_id}.log"
  prompt_log_file="${LOG_DIR}/${timestamp}_${step_id}.prompt.md"
  cp "$prompt_file" "$prompt_log_file"

  echo "Starting ${step_id}: ${step_title}"
  echo "Log file: ${log_file}"

  if [[ "$DRY_RUN" -eq 1 ]]; then
    echo "--- BEGIN PROMPT ---"
    cat "$prompt_file"
    echo "--- END PROMPT ---"
    echo "Prompt written to ${prompt_log_file}"
    rm -f "$prompt_file"
    exit 0
  fi

  codex_cmd=(codex exec --sandbox danger-full-access -C "$REPO_ROOT")
  if [[ -n "${CODEX_MODEL:-}" ]]; then
    codex_cmd+=(--model "$CODEX_MODEL")
  fi
  codex_cmd+=(-)

  if ! "${codex_cmd[@]}" < "$prompt_file" 2>&1 | tee "$log_file"; then
    rm -f "$prompt_file"
    echo "Codex execution failed for ${step_id}. See ${log_file}" >&2
    exit 4
  fi
  rm -f "$prompt_file"

  if grep -q "^- \[ \] ${step_id}:" "$PLAN_FILE"; then
    echo "Step ${step_id} is still unchecked in plan. Stopping for manual review." >&2
    exit 2
  fi

  new_head="$(git rev-parse HEAD)"
  if [[ "$new_head" == "$old_head" ]]; then
    echo "No new commit detected for ${step_id}. Stopping for manual review." >&2
    exit 3
  fi

  run_count=$((run_count + 1))
  echo "Completed ${step_id} in commit ${new_head}."

  if [[ "$RUN_ONCE" -eq 1 ]]; then
    echo "--once set; exiting after one step."
    exit 0
  fi
done

#!/bin/bash
#
# ralph.sh - Ralph harness for Phoenix Insight CLI development
#
# Runs an AI coding agent in a loop until all tasks are complete.
# Each iteration: agent picks next task, implements, tests, commits, exits.
#
# Usage:
#   ./ralph.sh                                              # Uses claude-opus-4.5
#   MODEL="anthropic/claude-sonnet-4-20250514" ./ralph.sh   # Use different model
#
# Environment variables:
#   MODEL          - Model to use (default: anthropic/claude-opus-4-20250514)
#   MAX_ITERATIONS - Safety limit (default: 100)
#   PAUSE_SECONDS  - Pause between iterations (default: 3)
#
# See: https://opencode.ai/docs/cli/
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PACKAGE_DIR="$(dirname "$SCRIPT_DIR")"  # phoenix-insight root (where opencode.json lives)
PROMPT_FILE="$SCRIPT_DIR/PROMPT.md"
TASKS_FILE="$SCRIPT_DIR/TASKS.md"
LOG_FILE="$SCRIPT_DIR/ralph.log"

# Model configuration
MODEL="${MODEL:-anthropic/claude-opus-4-20250514}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log() {
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo -e "${BLUE}[$timestamp]${NC} $1"
    echo "[$timestamp] $1" >> "$LOG_FILE"
}

log_success() {
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo -e "${GREEN}[$timestamp] ✓${NC} $1"
    echo "[$timestamp] ✓ $1" >> "$LOG_FILE"
}

log_warning() {
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo -e "${YELLOW}[$timestamp] ⚠${NC} $1"
    echo "[$timestamp] ⚠ $1" >> "$LOG_FILE"
}

log_error() {
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo -e "${RED}[$timestamp] ✗${NC} $1"
    echo "[$timestamp] ✗ $1" >> "$LOG_FILE"
}

# Check required files exist
if [[ ! -f "$PROMPT_FILE" ]]; then
    log_error "PROMPT.md not found at $PROMPT_FILE"
    exit 1
fi

if [[ ! -f "$TASKS_FILE" ]]; then
    log_error "TASKS.md not found at $TASKS_FILE"
    exit 1
fi

# Verify opencode is available
if ! command -v opencode &> /dev/null; then
    log_error "opencode not found in PATH"
    log_error "Install: curl -fsSL https://opencode.ai/install | bash"
    log_error "See: https://opencode.ai/docs/cli/"
    exit 1
fi

log "Starting Ralph loop"
log "Model: $MODEL"
log "Prompt: $PROMPT_FILE"
log "Tasks: $TASKS_FILE"
echo ""

iteration=0
max_iterations=${MAX_ITERATIONS:-100}  # Safety limit

while true; do
    iteration=$((iteration + 1))
    
    # Safety check
    if [[ $iteration -gt $max_iterations ]]; then
        log_error "Exceeded max iterations ($max_iterations). Stopping."
        exit 1
    fi
    
    log "=== Iteration $iteration ==="
    
    # Count task statuses using awk for precise matching
    # Only count lines that are exactly "- status: <value>" (task status lines)
    pending=$(awk '/^- status: pending$/ {count++} END {print count+0}' "$TASKS_FILE")
    in_progress=$(awk '/^- status: in_progress$/ {count++} END {print count+0}' "$TASKS_FILE")
    complete=$(awk '/^- status: complete$/ {count++} END {print count+0}' "$TASKS_FILE")
    total=$((pending + in_progress + complete))
    
    log "Tasks: $complete/$total complete, $in_progress in progress, $pending pending"
    
    # Check if all tasks are complete (must have at least 1 task to be valid)
    if [[ "$total" -gt 0 && "$pending" -eq 0 && "$in_progress" -eq 0 ]]; then
        log_success "All $complete tasks complete!"
        log_success "Total iterations: $iteration"
        exit 0
    fi
    
    # Sanity check - if no tasks found, something is wrong
    if [[ "$total" -eq 0 ]]; then
        log_error "No tasks found in $TASKS_FILE - check file format"
        exit 1
    fi
    
    # Check for stuck in_progress tasks (from previous failed run)
    if [[ "$in_progress" != "0" ]]; then
        log_warning "Found $in_progress task(s) marked in_progress from previous run"
        log_warning "Agent will handle or reset these"
    fi
    
    # Feed prompt to agent
    log "Invoking agent..."
    
    # Run opencode from the package root (where opencode.json lives for permissions)
    cd "$PACKAGE_DIR"
    
    # OpenCode run format: opencode run "message" -f file1 -f file2
    # Message must come BEFORE -f flags
    if opencode run -m "$MODEL" \
        "Read the attached PROMPT.md and TASKS.md files. Follow the instructions in PROMPT.md to complete the next pending task." \
        -f todo/PROMPT.md -f todo/TASKS.md; then
        log_success "Agent completed iteration $iteration"
    else
        exit_code=$?
        log_error "Agent exited with code $exit_code"
        
        # Don't immediately fail - agent might have partially succeeded
        # Check if any progress was made
        new_complete=$(awk '/^- status: complete$/ {count++} END {print count+0}' "$TASKS_FILE")
        if [[ "$new_complete" -gt "$complete" ]]; then
            log_warning "Progress was made despite error, continuing..."
        else
            log_error "No progress made. Check logs and LEARNINGS.md"
            # Continue anyway - next iteration might succeed
        fi
    fi
    
    # Brief pause between iterations
    log "Pausing before next iteration..."
    sleep ${PAUSE_SECONDS:-3}
    echo ""
done

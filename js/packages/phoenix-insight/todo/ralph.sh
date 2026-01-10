#!/bin/bash
#
# ralph.sh - Ralph harness for Phoenix Insight CLI development
#
# Runs an AI coding agent in a loop until all tasks are complete.
# Each iteration: agent picks next task, implements, tests, commits, exits.
#
# Usage:
#   ./ralph.sh                                    # Uses cursor-agent with claude-opus-4.5
#   AGENT_CMD="your-agent-command" ./ralph.sh    # Override with custom agent
#
# Examples:
#   ./ralph.sh                                    # Default: cursor-agent -m claude-opus-4-20250514
#   AGENT_CMD="cursor-agent -m claude-sonnet-4-20250514" ./ralph.sh
#   AGENT_CMD="claude-code" ./ralph.sh
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROMPT_FILE="$SCRIPT_DIR/PROMPT.md"
TASKS_FILE="$SCRIPT_DIR/TASKS.md"
LOG_FILE="$SCRIPT_DIR/ralph.log"

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

# Agent command - override with AGENT_CMD env var
AGENT="${AGENT_CMD:-cursor-agent -m claude-opus-4-20250514}"

# Verify agent is available (check first word of command)
AGENT_BIN=$(echo "$AGENT" | awk '{print $1}')
if ! command -v "$AGENT_BIN" &> /dev/null; then
    log_warning "Agent command '$AGENT_BIN' not found in PATH"
    log_warning "Install cursor-agent or set AGENT_CMD environment variable"
    log_warning "See: https://docs.cursor.com/cli"
fi

log "Starting Ralph loop"
log "Agent: $AGENT"
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
    
    # Count task statuses
    pending=$(grep -c "status: pending" "$TASKS_FILE" 2>/dev/null || echo "0")
    in_progress=$(grep -c "status: in_progress" "$TASKS_FILE" 2>/dev/null || echo "0")
    complete=$(grep -c "status: complete" "$TASKS_FILE" 2>/dev/null || echo "0")
    
    log "Tasks: $complete complete, $in_progress in progress, $pending pending"
    
    # Check if all tasks are complete
    if [[ "$pending" == "0" && "$in_progress" == "0" ]]; then
        log_success "All tasks complete!"
        log_success "Total iterations: $iteration"
        exit 0
    fi
    
    # Check for stuck in_progress tasks (from previous failed run)
    if [[ "$in_progress" != "0" ]]; then
        log_warning "Found $in_progress task(s) marked in_progress from previous run"
        log_warning "Agent will handle or reset these"
    fi
    
    # Feed prompt to agent
    log "Invoking agent..."
    
    # Run agent with prompt as input
    # The agent reads the prompt and TASKS.md to determine what to do
    if cat "$PROMPT_FILE" | $AGENT; then
        log_success "Agent completed iteration $iteration"
    else
        exit_code=$?
        log_error "Agent exited with code $exit_code"
        
        # Don't immediately fail - agent might have partially succeeded
        # Check if any progress was made
        new_complete=$(grep -c "status: complete" "$TASKS_FILE" 2>/dev/null || echo "0")
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

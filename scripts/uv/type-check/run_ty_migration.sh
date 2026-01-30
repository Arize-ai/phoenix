#!/bin/bash

# Script to run claude iteratively until modules_with_type_errors.txt is empty

# Exit on error
set -e

# Get the directory where this script lives
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Navigate to repo root (3 levels up from scripts/uv/type-check/)
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

# Use absolute paths
ERRORS_FILE="$REPO_ROOT/scripts/uv/type-check/modules_with_type_errors.txt"
PLAN_FILE="$SCRIPT_DIR/TY_MIGRATION_PLAN.md"

# Validate we're in the right place
if [ ! -f "$ERRORS_FILE" ]; then
    echo "Error: Could not find $ERRORS_FILE"
    exit 1
fi

if [ ! -f "$PLAN_FILE" ]; then
    echo "Error: Could not find $PLAN_FILE"
    exit 1
fi

# Change to repo root
cd "$REPO_ROOT"

# ANSI color codes
BRIGHT_CYAN='\033[1;96m'
BRIGHT_GREEN='\033[1;92m'
BRIGHT_YELLOW='\033[1;93m'
RESET='\033[0m'

iteration=1

while true; do
    # Count non-empty lines in the errors file
    line_count=$(grep -c '.' "$ERRORS_FILE" 2>/dev/null || echo "0")
    
    if [ "$line_count" -eq 0 ]; then
        echo -e "${BRIGHT_GREEN}✓ No more modules with type errors! Migration complete.${RESET}"
        break
    fi
    
    echo ""
    echo -e "${BRIGHT_CYAN}════════════════════════════════════════════════════════════${RESET}"
    echo -e "${BRIGHT_CYAN}                    ITERATION ${iteration}${RESET}"
    echo -e "${BRIGHT_CYAN}        Remaining modules with errors: ${line_count}${RESET}"
    echo -e "${BRIGHT_CYAN}════════════════════════════════════════════════════════════${RESET}"
    echo ""
    
    # Run claude with the migration plan (pass absolute path)
    echo "$PLAN_FILE" | claude -p --dangerously-skip-permissions --output-format stream-json --verbose
    
    exit_code=$?
    if [ $exit_code -ne 0 ]; then
        echo -e "${BRIGHT_YELLOW}⚠ Claude exited with code $exit_code${RESET}"
    fi
    
    ((iteration++))
done

echo ""
echo -e "${BRIGHT_GREEN}════════════════════════════════════════════════════════════${RESET}"
echo -e "${BRIGHT_GREEN}              TY MIGRATION COMPLETED${RESET}"
echo -e "${BRIGHT_GREEN}              Total iterations: $((iteration - 1))${RESET}"
echo -e "${BRIGHT_GREEN}════════════════════════════════════════════════════════════${RESET}"

#!/bin/bash

# Script to run claude iteratively until modules_with_type_errors.txt is empty

ERRORS_FILE="scripts/uv/type_check/modules_with_type_errors.txt"
PLAN_FILE="TY_MIGRATION_PLAN.md"

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
    
    # Run claude with the migration plan
    echo "$PLAN_FILE" | claude -p --dangerously-skip-permissions --output-format stream-json
    
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

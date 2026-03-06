# mypy: ignore-errors
"""
Selected tau-bench retail tasks for trajectory evaluation.

10 tasks chosen to cover a range of complexity:
- Simple lookups (tasks 24, 67)
- Multi-step mutations (tasks 0, 23)
- Policy-sensitive escalation (tasks 10, 50)
- Cancellation/return combos (tasks 16, 59)
- Ambiguous/error-prone (tasks 65, 69)

Task IDs correspond to indices in tau-bench's TASKS_TEST list.
"""

import os
import sys

# Add vendor path so we can import tau-bench types
sys.path.insert(
    0,
    os.path.join(os.path.dirname(__file__), "..", "vendor", "tau-bench"),
)

from tau_bench.types import Task

# Selected task IDs (indices into TASKS_TEST)
SELECTED_TASK_IDS = [0, 10, 16, 23, 24, 50, 59, 65, 67, 69]


def load_selected_tasks() -> list[tuple[int, Task]]:
    """Load the 10 selected tasks from tau-bench's test split.

    Returns a list of (task_id, Task) tuples.
    """
    from tau_bench.envs.retail.tasks_test import TASKS_TEST

    return [(tid, TASKS_TEST[tid]) for tid in SELECTED_TASK_IDS]

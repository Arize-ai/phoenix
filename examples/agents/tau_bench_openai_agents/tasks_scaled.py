# mypy: ignore-errors
"""
Scaled tau-bench task selection: 20 tasks stratified by complexity.

Extends the original 10-task selection from tasks.py with 10 additional tasks
to broaden coverage across complexity tiers and failure mode categories.

Stratification:
- Simple lookups / single ops (1 action): 5 tasks
- Double mutations (2 actions): 3 tasks
- Multi-step mutations (3-4 actions): 5 tasks
- Complex multi-type (5-7 actions): 4 tasks
- Policy-sensitive / edge cases (0-1 actions): 3 tasks

Original 10 tasks are preserved for continuity with stages 3/5.
"""

import os
import sys

# Add vendor path so we can import tau-bench types
sys.path.insert(
    0,
    os.path.join(os.path.dirname(__file__), "..", "vendor", "tau-bench"),
)

from tau_bench.types import Task

# Original 10 tasks from stages 3/5
_ORIGINAL_TASKS: list[tuple[str, int]] = [
    ("dev", 0),  # Single cancel, name+zip auth
    ("dev", 1),  # Single exchange, email auth
    ("dev", 6),  # Cancel with multiple-email edge case
    ("dev", 9),  # Modify pending order items, name+zip auth
    ("dev", 12),  # Complex: 3x (payment change + item modify) across orders
    ("dev", 14),  # Multi-step: address change + item modify on same order
    ("dev", 15),  # Argumentative user, out-of-scope then cancel
    ("dev", 17),  # Zero-action: user complains, nothing actionable
    ("train", 35),  # Multi-type: address + items + return + exchange (4 actions)
    ("train", 351),  # Complex: 7 actions, most complex available
]

# 10 new tasks to broaden coverage
_NEW_TASKS: list[tuple[str, int]] = [
    # Simple: single return (different auth methods, different personas)
    ("train", 2),  # Return water bottle, email auth, 1 action
    ("train", 4),  # Cancel pending order, name+zip auth, 1 action
    # Double mutations: mixed operation types
    ("train", 3),  # Exchange + cancel across orders, 2 actions
    ("train", 8),  # Return + modify items on different orders, 2 actions
    ("train", 13),  # Cancel two orders sequentially, 2 actions (same tool twice)
    # Multi-step: diverse tool combinations (3-4 actions)
    ("train", 43),  # Cancel + modify items + modify address, 3 actions, 3 unique tools
    ("train", 130),  # Address + payment + items + cancel, 4 actions, 4 unique tools
    # Complex: high action count (5-6 actions)
    ("train", 139),  # Modify + return + items + cancel, 5 actions across orders
    ("train", 431),  # Cancel + return + exchange + modify (all 3 types), 6 actions, 6 unique tools
    # Policy-sensitive: tricky user behavior
    ("dev", 13),  # User changes mind mid-return (return charger -> also bookshelf+thermostat)
]

# Combined scaled task list (20 tasks total)
SCALED_TASKS: list[tuple[str, int]] = _ORIGINAL_TASKS + _NEW_TASKS

# Flat list of task IDs for CLI display
SCALED_TASK_IDS = [f"{split}:{idx}" for split, idx in SCALED_TASKS]


def _load_split(split: str) -> list[Task]:
    """Load a tau-bench task split by name."""
    if split == "test":
        from tau_bench.envs.retail.tasks_test import TASKS_TEST

        return TASKS_TEST
    elif split == "dev":
        from tau_bench.envs.retail.tasks_dev import TASKS_DEV

        return TASKS_DEV
    elif split == "train":
        from tau_bench.envs.retail.tasks_train import TASKS_TRAIN

        return TASKS_TRAIN
    else:
        raise ValueError(f"Unknown split: {split}")


def load_scaled_tasks() -> list[tuple[str, Task]]:
    """Load the scaled 20-task selection from tau-bench's dev and train splits.

    Returns a list of (task_label, Task) tuples where task_label
    is formatted as "split:index" (e.g., "dev:0", "train:35").
    """
    results = []
    for split, idx in SCALED_TASKS:
        tasks = _load_split(split)
        label = f"{split}:{idx}"
        results.append((label, tasks[idx]))
    return results

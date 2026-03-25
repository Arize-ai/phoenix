# mypy: ignore-errors
"""
Selected tau-bench retail tasks for trajectory evaluation.

Tasks are drawn from the dev and train splits (not test, which is held out).

10 tasks chosen to cover a range of complexity:
- Single-write operations (dev 0, 1, 6, 9)
- Edge cases / policy boundaries (dev 15, 17)
- Multi-step mutations (dev 12, 14)
- Complex multi-type operations (train 35, 351)

See exploration/tau_bench_notes.md for the full rationale and split analysis.

This is identical to the OpenAI Agents SDK version — the task selection
is framework-independent.
"""

import os
import sys

# Add vendor path so we can import tau-bench types
sys.path.insert(
    0,
    os.path.join(os.path.dirname(__file__), "..", "vendor", "tau-bench"),
)

from tau_bench.types import Task

# Selected tasks as (split, index) pairs.
# Using dev and train splits — test is held out.
SELECTED_TASKS: list[tuple[str, int]] = [
    ("dev", 0),  # Single cancel, name+zip auth
    ("dev", 1),  # Single exchange, email auth
    ("dev", 6),  # Cancel with multiple-email edge case
    ("dev", 9),  # Modify pending order items, name+zip auth
    ("dev", 12),  # Complex: 3x (payment change + item modify) across orders
    ("dev", 14),  # Multi-step: address change + item modify on same order
    ("dev", 15),  # Argumentative user, out-of-scope then cancel
    ("dev", 17),  # Zero-action: user complains, nothing actionable
    ("train", 35),  # Multi-type: address + items + return + exchange
    ("train", 351),  # Complex: cancel + exchange + payment + items + return + address
]

# Flat list of task IDs for CLI display (formatted as "split:index")
SELECTED_TASK_IDS = [f"{split}:{idx}" for split, idx in SELECTED_TASKS]


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


def load_selected_tasks() -> list[tuple[str, Task]]:
    """Load the selected tasks from tau-bench's dev and train splits.

    Returns a list of (task_label, Task) tuples where task_label
    is formatted as "split:index" (e.g., "dev:0", "train:35").
    """
    results = []
    for split, idx in SELECTED_TASKS:
        tasks = _load_split(split)
        label = f"{split}:{idx}"
        results.append((label, tasks[idx]))
    return results

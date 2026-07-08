# mypy: ignore-errors
"""
Task loader for TRAJECT-Bench from HuggingFace.

Loads selected tasks from bigboss24/TRAJECT-Bench covering parallel (simple/hard)
and sequential configs. Handles the field name inconsistency between parallel
(`tool_list`) and sequential (`tool list`) schemas.

9 tasks chosen to cover:
- Parallel simple: 3 tasks (2-3 tools, baseline multi-tool)
- Parallel hard: 3 tasks (5 tools, cross-platform)
- Sequential: 3 tasks (3-step chains, with/without errors)

See exploration/traject_bench_summary.md for full rationale.
"""

from __future__ import annotations

import json
from dataclasses import dataclass

from datasets import load_dataset

# HuggingFace dataset identifier
HF_DATASET = "bigboss24/TRAJECT-Bench"


@dataclass
class TrajectTask:
    """A single TRAJECT-Bench task with parsed fields."""

    label: str  # e.g. "parallel_ecommerce_simple:0"
    config: str  # e.g. "parallel_ecommerce_simple"
    index: int
    query: str
    final_answer: str
    tools: list[dict]  # Parsed tool list (list of tool dicts)
    trajectory_type: str  # "parallel" or "sequential"
    task_description: str  # task_description (parallel) or sequence_description (sequential)

    # Sequential-specific fields
    executable: bool = True
    num_successful_tools: int = 0


# Selected tasks: (config_name, index, trajectory_type)
SELECTED_TASKS: list[tuple[str, int, str]] = [
    # Parallel Simple (ecommerce, 2-3 tools each)
    ("parallel_ecommerce_simple", 0, "parallel"),  # Wayfair reviews + product info + Aliexpress
    ("parallel_ecommerce_simple", 1, "parallel"),  # Wayfair images + Aliexpress store + Weee
    ("parallel_ecommerce_simple", 2, "parallel"),  # Asos countries + Wayfair autocomplete + Amazon
    # Parallel Hard (ecommerce, 5 tools each)
    ("parallel_ecommerce_hard", 10, "parallel"),  # Asos + 4x Wayfair
    ("parallel_ecommerce_hard", 11, "parallel"),  # 5 different providers
    ("parallel_ecommerce_hard", 12, "parallel"),  # Wayfair pricing/financing/reviews + IKEA + Weee
    # Sequential (travel, 3-step chains)
    ("sequential_travel", 0, "sequential"),  # Clean chain (all success)
    ("sequential_travel", 1, "sequential"),  # Error in hotel details
    ("sequential_travel", 2, "sequential"),  # Error propagation
]

SELECTED_TASK_IDS = [f"{config}:{idx}" for config, idx, _ in SELECTED_TASKS]

# Cache loaded datasets to avoid re-downloading
_dataset_cache: dict[str, object] = {}


def _load_config(config: str) -> object:
    """Load a dataset config, caching the result."""
    if config not in _dataset_cache:
        ds = load_dataset(HF_DATASET, config, split="test")
        _dataset_cache[config] = ds
    return _dataset_cache[config]


def _parse_tool_list(raw: str) -> list[dict]:
    """Parse the tool list JSON string into a list of tool dicts."""
    if isinstance(raw, list):
        return raw
    try:
        return json.loads(raw)
    except (json.JSONDecodeError, TypeError):
        return []


def _row_to_task(config: str, index: int, traj_type: str, row: dict) -> TrajectTask:
    """Convert a dataset row to a TrajectTask."""
    # Handle field name inconsistency: tool_list (parallel) vs tool list (sequential)
    if traj_type == "parallel":
        raw_tools = row.get("tool_list", "[]")
        description = row.get("task_description", "")
    else:
        raw_tools = row.get("tool list", "[]")
        description = row.get("sequence_description", "")

    tools = _parse_tool_list(raw_tools)

    task = TrajectTask(
        label=f"{config}:{index}",
        config=config,
        index=index,
        query=row["query"],
        final_answer=row.get("final_answer", ""),
        tools=tools,
        trajectory_type=traj_type,
        task_description=description,
    )

    # Sequential-specific fields
    if traj_type == "sequential":
        task.executable = row.get("executable", True)
        task.num_successful_tools = row.get("num_successful_tools", len(tools))

    return task


def load_selected_tasks() -> list[TrajectTask]:
    """Load the selected TRAJECT-Bench tasks.

    Returns a list of TrajectTask objects with parsed tool definitions
    and ground truth information.
    """
    tasks = []
    for config, index, traj_type in SELECTED_TASKS:
        ds = _load_config(config)
        row = ds[index]
        task = _row_to_task(config, index, traj_type, row)
        tasks.append(task)
    return tasks


def load_task(config: str, index: int, traj_type: str) -> TrajectTask:
    """Load a single task by config name and index."""
    ds = _load_config(config)
    row = ds[index]
    return _row_to_task(config, index, traj_type, row)

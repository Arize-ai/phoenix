# mypy: ignore-errors
"""
Scaled TRAJECT-Bench task selection: 20 tasks across domains and difficulty.

Extends the original 9-task (ecommerce + travel only) selection with 11 new
tasks across finance, education, music, gaming, news_media, and weather domains.

Stratification:
- Parallel simple (5): ecommerce (3 existing) + finance (1) + travel (1)
- Parallel hard (5): ecommerce (3 existing) + education (1) + music (1)
- Sequential clean (4): travel (1 existing) + ecommerce (1) + gaming (1) + finance (1)
- Sequential with errors (4): travel (2 existing) + news_media (1) + weather (1)
- Sequential long chains (2): finance (1) + music (1)

Original 9 tasks are preserved for continuity with stage 4.
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


# Original 9 tasks from stage 4
_ORIGINAL_TASKS: list[tuple[str, int, str]] = [
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

# 11 new tasks across new domains
_NEW_TASKS: list[tuple[str, int, str]] = [
    # Parallel simple: new domains
    ("parallel_finance_simple", 0, "parallel"),  # Finance: stock/crypto lookups
    ("parallel_travel_simple", 0, "parallel"),  # Travel: hotel/flight search
    # Parallel hard: new domains
    ("parallel_education_hard", 0, "parallel"),  # Education: 5 tools
    ("parallel_music_hard", 0, "parallel"),  # Music: 5 tools
    # Sequential clean: new domains (pick tasks where all tools succeed)
    ("sequential_ecommerce", 0, "sequential"),  # Ecommerce: product search chain
    ("sequential_gaming", 0, "sequential"),  # Gaming: game search chain
    ("sequential_finance", 0, "sequential"),  # Finance: stock analysis chain
    # Sequential with errors: new domains
    ("sequential_news_media", 0, "sequential"),  # News: article search with error
    ("sequential_weather", 0, "sequential"),  # Weather: forecast chain with error
    # Sequential long chains: deeper dependency chains
    ("sequential_finance", 5, "sequential"),  # Finance: longer chain
    ("sequential_music", 0, "sequential"),  # Music: multi-step search chain
]

# Combined scaled task list (20 tasks total)
SCALED_TASKS: list[tuple[str, int, str]] = _ORIGINAL_TASKS + _NEW_TASKS

SCALED_TASK_IDS = [f"{config}:{idx}" for config, idx, _ in SCALED_TASKS]

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


def load_scaled_tasks() -> list[TrajectTask]:
    """Load the scaled 20-task selection from TRAJECT-Bench.

    Returns a list of TrajectTask objects with parsed tool definitions
    and ground truth information.
    """
    tasks = []
    for config, index, traj_type in SCALED_TASKS:
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

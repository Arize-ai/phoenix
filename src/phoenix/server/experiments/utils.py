from __future__ import annotations

from secrets import token_hex

from phoenix.db.cleanup_tasks import (
    EXPERIMENT_PROJECT_NAME_PATTERN,
    is_generated_experiment_project_name,
)


def generate_experiment_project_name() -> str:
    return f"Experiment-{token_hex(12)}"


def is_experiment_project_name(name: str) -> bool:
    return is_generated_experiment_project_name(name)


__all__ = [
    "EXPERIMENT_PROJECT_NAME_PATTERN",
    "generate_experiment_project_name",
    "is_experiment_project_name",
]

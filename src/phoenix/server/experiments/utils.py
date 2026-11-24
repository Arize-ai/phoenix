from __future__ import annotations

import re
from secrets import token_hex

EXPERIMENT_PROJECT_NAME_PATTERN = re.compile(r"^Experiment-[0-9a-f]{24}$")


def generate_experiment_project_name() -> str:
    return f"Experiment-{token_hex(12)}"


def is_experiment_project_name(name: str) -> bool:
    return bool(EXPERIMENT_PROJECT_NAME_PATTERN.match(name))

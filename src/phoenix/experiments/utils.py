import functools
from collections.abc import Callable
from typing import Any

from phoenix.config import get_web_base_url


def generate_experiment_project_name(prefix: str = "Experiment") -> str:
    """
    Generate a dynamic project name with a given prefix.
    This ensures each experiment gets its own project to avoid conflicts.
    
    Args:
        prefix: The prefix for the project name. Defaults to "Experiment".
        
    Returns:
        A unique project name in the format "{prefix}-{random_hex}".
    """
    from random import getrandbits
    return f"{prefix}-{getrandbits(96).to_bytes(12, 'big').hex()}"


def get_experiment_url(*, dataset_id: str, experiment_id: str) -> str:
    return f"{get_web_base_url()}datasets/{dataset_id}/compare?experimentId={experiment_id}"


def get_dataset_experiments_url(*, dataset_id: str) -> str:
    return f"{get_web_base_url()}datasets/{dataset_id}/experiments"


def get_func_name(fn: Callable[..., Any]) -> str:
    """
    Makes a best-effort attempt to get the name of the function.
    """

    if isinstance(fn, functools.partial):
        return fn.func.__qualname__
    if hasattr(fn, "__qualname__") and not fn.__qualname__.endswith("<lambda>"):
        return fn.__qualname__.split(".<locals>.")[-1]
    return str(fn)

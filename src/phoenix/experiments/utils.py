import functools
from typing import Any, Callable

from phoenix.config import get_web_base_url


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

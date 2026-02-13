import functools
from collections.abc import Callable
from typing import Any

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
        func = fn.func
        qualname = getattr(func, "__qualname__", None)
        if isinstance(qualname, str):
            return qualname
    qualname = getattr(fn, "__qualname__", None)
    if isinstance(qualname, str) and not qualname.endswith("<lambda>"):
        return qualname.split(".<locals>.")[-1]
    return str(fn)

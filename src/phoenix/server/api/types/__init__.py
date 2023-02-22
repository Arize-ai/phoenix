from importlib import import_module
from inspect import getmembers, isclass

from phoenix.metrics import Metric, metrics

METRICS = dict(
    getmembers(
        import_module(metrics.__name__),
        lambda member: isclass(member)
        and member.__module__ == metrics.__name__
        and issubclass(member, Metric),
    )
)

import math
import threading
from dataclasses import dataclass, field
from random import random
from typing import Any, Iterator, Optional

import numpy as np
import pandas as pd
from numpy import typing as npt


def random_string() -> str:
    """Generates a random string, useful for adding a new column to a
    dataframe, such that it won't conflict with the existing column names.
    It's intended to be short and gibberish looking.
    """
    return hex(int(random() * 1e9))


@dataclass(frozen=True, repr=False, eq=False)
class ConstantValueSeriesFactory:
    """The intent is to share memory for readonly situations where a constant
    value, e.g. NaN, is expected from a non-existent dataframe column by the
    downstream calculations. To avoid duplicating memory when we require such
    columns multiple times or need to subset them frequently, we first check for
    a previously allocated array that's longer, and subset from it, thereby
    sharing the memory already allocated (since the value is constant and does
    not change). If the cached array is not long enough, we then allocate and
    cache a new array, replacing the old one. This cache is intended to be
    attached to a Model instance, and will be garbage collected alongside it,
    while the `lru_cache` decorator's cache is scoped at the module level and
    can potentially leak memory.
    """

    value: Any = field(default=np.nan)
    _dtype: Any = field(init=False, default=None)
    _cached_array: npt.NDArray[Any] = field(
        init=False,
        default_factory=lambda: np.empty(0),
    )
    """If a longer Series is requested, the cached array is expanded;
    otherwise, a subset can be returned, assuming it won't be altered by the
    caller.
    """
    _lock: threading.Lock = field(
        init=False,
        default_factory=threading.Lock,
    )
    """A lock is applied at the class instance level for thread safety, with
    minimal overhead expected, unless too many callers simultaneously rely on
    the same instance.
    """

    def __post_init__(self) -> None:
        if isinstance(self.value, float) and math.isnan(self.value):
            object.__setattr__(self, "_dtype", np.float32)

    def __call__(self, length: int) -> "pd.Series[Any]":
        with self._lock:
            if length > len(self._cached_array):
                object.__setattr__(
                    self,
                    "_cached_array",
                    np.full(length, self.value, dtype=self._dtype),
                )
            return pd.Series(self._cached_array[:length])


def agg_min_max(series: "pd.Series[Any]") -> "pd.Series[Any]":
    return series.agg(["min", "max"])


def iterate_except_str(obj: Any) -> Iterator[Any]:
    """Strings are iterable (by character), but we don't want that because
    e.g. in the event that we asked the user for a list of strings but the
    user only had one string and just gave us the string itself (e.g. `"abc"`)
    instead of putting it into a list (i.e. `["abc"]`), we don't want to
    iterate over `"abc"` and end up with `["a", "b", "c"]`. Instead, we would
    put `"abc"` into a list on the user's behalf. Note that if `["a", "b", "c"]`
    is really what the user wanted, the user can alternatively specify it
    simply as `list("abc")`."""
    if isinstance(obj, str):
        yield obj
        return
    try:
        yield from iter(obj)
    except TypeError:
        yield obj


def coerce_to_string(obj: Optional[str]) -> str:
    return "" if obj is None else str(obj)

# Type Guards

from typing import TypeGuard
from pandas import Series


def is_series_of_str(series: Series) -> "TypeGuard[Series[str]]":
    """Determines whether all entries in the list are strings"""
    return all(isinstance(v, str) for v in series)

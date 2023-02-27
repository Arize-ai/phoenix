from dataclasses import dataclass
from functools import cached_property
from itertools import chain
from typing import Any, Callable, List

import pandas as pd

from .dimension_data_type import DimensionDataType
from .dimension_type import DimensionType


@dataclass
class Dimension:
    name: str
    data_type: DimensionDataType
    type: DimensionType
    data: Callable[[], List["pd.Series[Any]"]]

    @cached_property
    def unique_string_values(self) -> List[str]:
        if self.data_type == DimensionDataType.NUMERIC:
            return []
        return sorted(
            v
            for v in set(chain.from_iterable(s.unique() for s in self.data()))
            if isinstance(v, str)
        )

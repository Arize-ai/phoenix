from typing import Any, List, Mapping, Protocol, runtime_checkable

import pandas as pd


@runtime_checkable
class Metric(Protocol):
    def __call__(self, df: pd.DataFrame) -> Any:
        ...

    def id(self) -> int:
        ...

    def input_column_names(self) -> List[str]:
        ...

    def get_value(self, result: Mapping[int, Any]) -> Any:
        ...

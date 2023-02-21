from typing import Any, Iterable, Mapping, Protocol, Tuple, runtime_checkable

import pandas as pd


@runtime_checkable
class Metric(Protocol):
    def __call__(self, df: pd.DataFrame) -> Tuple[int, Any]:
        ...

    def input_columns(self) -> Iterable[str]:
        ...

    def get_value(self, result: Mapping[int, Any]) -> Any:
        ...

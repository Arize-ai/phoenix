from dataclasses import dataclass
from typing import Any, Generator, Mapping, Optional, Protocol, runtime_checkable

import pandas as pd


@dataclass
class Column:
    """A function that extracts from a DataFrame a column of a specific name.

    If the column is not found, an empty Series is returned.
    """

    name: Optional[str] = None

    def __bool__(self) -> bool:
        return bool(self.name)

    def __call__(self, df: Optional[pd.DataFrame] = None) -> "pd.Series[Any]":
        return (
            df.loc[:, self.name]
            if self.name and isinstance(df, pd.DataFrame) and self.name in df.columns
            else pd.Series(dtype=float, name=self.name)
        )


@runtime_checkable
class Metric(Protocol):
    def __call__(self, df: pd.DataFrame) -> Any:
        ...

    def id(self) -> int:
        ...

    def operands(self) -> Generator[Column, None, None]:
        ...

    def get_value(self, result: Mapping[int, Any]) -> Any:
        ...

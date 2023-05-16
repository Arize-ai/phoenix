from typing import Any, Iterable, Iterator, Mapping, Protocol, runtime_checkable

import pandas as pd


@runtime_checkable
class Metric(Protocol):
    def __call__(self, df: pd.DataFrame) -> Any:
        ...

    def id(self) -> int:
        ...

    def input_column_names(self) -> Iterator[str]:
        ...

    def get_value(self, result: Mapping[int, Any]) -> Any:
        ...


def multi_calculate(
    df: pd.DataFrame,
    calcs: Iterable[Metric],
) -> "pd.Series[Any]":
    """
    Calculates multiple metrics on the same dataframe.
    """
    return pd.Series({calc.id(): calc(df) for calc in calcs})

import logging
import warnings
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any, Iterable, List, Mapping, Optional, Union

import numpy as np
import pandas as pd

from phoenix.core.model_schema import Column

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class Metric(ABC):
    def id(self) -> int:
        """
        id is a unique identifier for each metric instance. This is used to
        extract the metric's own value from a collective output containing
        results from other metrics.
        """
        return id(self)

    @property
    def initial_value(self) -> Any:
        return np.nan

    def get_value(self, result: Mapping[int, Any]) -> Any:
        try:
            return result[self.id()]
        except KeyError:
            return self.initial_value

    @abstractmethod
    def calc(self, dataframe: pd.DataFrame) -> Any: ...

    @abstractmethod
    def operands(self) -> List[Column]: ...

    def __call__(
        self,
        df: pd.DataFrame,
        /,
        subset_rows: Optional[Union[slice, List[int]]] = None,
    ) -> Any:
        """
        Computes the metric on a dataframe.

        Parameters
        ----------
        df: pandas DataFrame
            The dataframe input to the metric.
        subset_rows: Optional[Union[slice, List[int]]] = None
            Optionally specifying a subset of rows for the computation.
            Can be a list or slice (e.g. `slice(100, 200)`) of integers.
        """
        subset_rows = slice(None) if subset_rows is None else subset_rows
        df = df.iloc[
            subset_rows,
            sorted(
                {
                    df.columns.get_loc(name)
                    for name in map(str, self.operands())
                    if name in df.columns
                }
            ),
        ]
        try:
            with warnings.catch_warnings():
                warnings.simplefilter("ignore", category=RuntimeWarning)
                return self.calc(df)
        except (TypeError, ValueError, NotImplementedError) as exc:
            logger.warning(exc, exc_info=True)
            return self.initial_value


def multi_calculate(
    df: pd.DataFrame,
    calcs: Iterable[Metric],
) -> "pd.Series[Any]":
    """
    Calculates multiple metrics on the same dataframe.
    """
    return pd.Series({calc.id(): calc(df) for calc in calcs})

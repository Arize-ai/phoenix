from dataclasses import dataclass, field
from typing import Any, Iterator, Union, overload

import pandas as pd

from phoenix.core.helpers import ConstantValueSeriesFactory, random_string


@dataclass(frozen=True)
class Column:
    """Extracts a value (i.e. scalar) from pd.Series or a series (i.e. a
    column) from pd.DataFrame. If not found, return the default value
    (e.g. NaN) or a series of the default value (on each row), respectively.
    """

    name: str = ""
    is_dummy: bool = False
    """dummy columns are fillers for the model structure, so our functions
    can remain relatively declarative and compact, i.e. by not having to keep
    writing `if ... is not None:` everywhere. Dummy columns always return NaNs,
    because they have random column names not found in any dataframe."""
    _default: ConstantValueSeriesFactory = field(
        default_factory=ConstantValueSeriesFactory,
    )

    def __post_init__(self) -> None:
        if not self.name:
            object.__setattr__(self, "is_dummy", True)
            object.__setattr__(self, "name", random_string())

    @overload
    def __call__(self, data: pd.DataFrame) -> "pd.Series[Any]":
        ...

    @overload
    def __call__(self, data: "pd.Series[Any]") -> Any:
        ...

    def __call__(self, data: Union[pd.DataFrame, "pd.Series[Any]"]) -> Any:
        """Extracts a value from series, or a series from a dataframe. If
        not found, return the default value (e.g. NaN) or a series of the
        default value (on each row), respectively.
        """
        if isinstance(data, pd.DataFrame):
            try:
                return data.loc[:, self.name]
            except KeyError:
                # It's important to glue the index to the default series,
                # so it would look like the series came from the dataframe.
                return self._default(len(data)).set_axis(
                    data.index,
                    copy=False,
                )
        if isinstance(data, pd.Series):
            try:
                return data.at[self.name]
            except KeyError:
                return self._default.value
        raise ValueError(f"invalid data: {repr(data)}")

    def __iter__(self) -> Iterator[str]:
        """This is to partake in the iteration of column names by a
        larger data structure of which this object is a member. Dummy
        columns need not be yielded because they represent columns
        that don't (physically) exist (i.e. they are just fillers for
        the Model to make the Schema whole).
        """
        if not self.is_dummy:
            yield self.name

    def __str__(self) -> str:
        return self.name

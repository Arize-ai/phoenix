import inspect
from abc import ABC
from inspect import Signature
from itertools import chain, islice
from typing import Any, cast

import numpy as np
import pandas as pd
from pandas.core.dtypes.common import is_categorical_dtype
from wrapt import PartialCallableObjectProxy


class Eval(PartialCallableObjectProxy):  # type: ignore
    def __call__(self, *args: Any, **kwargs: Any) -> float:
        pos_args = list(args)
        all_series = [
            s
            for s in chain(
                args,
                kwargs.values(),
            )
            if isinstance(s, pd.Series)
        ]
        if all_series:
            # Remove all rows with any missing value.
            not_na: "pd.Series[bool]" = ~all_series[0].isna()
            for s in islice(all_series, 1, None):
                not_na &= ~s.isna()
            for i, v in enumerate(pos_args):
                if isinstance(v, pd.Series):
                    pos_args[i] = v.loc[not_na]
            for k, v in tuple(kwargs.items()):
                if isinstance(v, pd.Series):
                    kwargs[k] = v.loc[not_na]
        try:
            return cast(float, super().__call__(*pos_args, **kwargs))
        except (IndexError, ZeroDivisionError):
            return np.nan


class SupportsPosLabel(ABC):
    @property
    def __signature__(self) -> Signature:
        pos_label = inspect.Parameter(
            "pos_label",
            inspect.Parameter.KEYWORD_ONLY,
            default=1,
        )
        signature = inspect.signature(
            getattr(self, "__wrapped__", lambda: None),
        )
        parameters = signature.parameters
        if pos_label.name in parameters:
            return signature
        return inspect.Signature(
            list(parameters.values()) + [pos_label],
        )


class ClassificationEval(SupportsPosLabel, Eval):
    def __call__(
        self,
        y_true: "pd.Series[Any]",
        y_pred: "pd.Series[Any]",
        *args: Any,
        pos_label: Any = None,
        **kwargs: Any,
    ) -> float:
        if pos_label is not None:
            y_true = _binarize(pos_label, y_true)
            y_pred = _binarize(pos_label, y_pred)
        return super().__call__(y_true, y_pred, *args, **kwargs)


class ScoredClassificationEval(SupportsPosLabel, Eval):
    def __call__(
        self,
        y_true: "pd.Series[Any]",
        y_pred: "pd.Series[Any]",
        *args: Any,
        pos_label: Any = None,
        **kwargs: Any,
    ) -> float:
        if pos_label is not None:
            y_true = _binarize(pos_label, y_true)
        return super().__call__(y_true, y_pred, *args, **kwargs)


def _binarize(
    pos_label: Any,
    s: "pd.Series[Any]",
) -> "pd.Series[float]":
    if is_categorical_dtype(s):
        try:
            t = s.cat.codes == s.cat.categories.get_loc(pos_label)
        except KeyError:
            t = pd.Series(np.full(len(s), 0, dtype=np.float16))
    else:
        t = s == pos_label
    return cast(
        "pd.Series[float]",
        t.astype(np.float16).mask(s.isna()),
    )

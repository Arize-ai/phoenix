"""
This module contains (callable) wrapper objects (also known as proxy objects)
intended for wrapping functions from sklearn. Before calling the actual sklearn
function, the wrappers need to perform a variety of preprocessing steps, e.g.
    - Eliminate missing values from all series passed in from the arguments,
    e.g. y_true, y_pred, sample_weight.
    - For binary classification, turn a series into a binary (boolean) variable
    according to the positive label (if specified).
    - For classification, coerce the dtype if necessary. For example, if user
    passes in the series [True, None] as y_true, then it will have the `object`
    dtype even after removing the missing value, and sklearn will reject it.
    So, after the missing values are removed, we still need to coerce the dtype
    to that of the first non-missing value in the series.
"""

import inspect
from abc import ABC
from enum import Enum
from inspect import Signature
from itertools import chain, islice
from typing import Any, Dict, List, Tuple, cast

import numpy as np
import pandas as pd
from pandas.core.dtypes.common import is_categorical_dtype, is_object_dtype
from sklearn import metrics as sk
from sklearn.utils.multiclass import check_classification_targets
from wrapt import PartialCallableObjectProxy


class Eval(PartialCallableObjectProxy, ABC):  # type: ignore
    def __call__(
        self,
        *args: Any,
        **kwargs: Any,
    ) -> float:
        try:
            return cast(float, super().__call__(*args, **kwargs))
        except (IndexError, ZeroDivisionError):
            return np.nan


class RegressionEval(Eval):
    def __call__(
        self,
        *args: Any,
        **kwargs: Any,
    ) -> float:
        positional_arguments, keyword_arguments = _eliminate_missing_values_from_all_series(
            *args,
            **kwargs,
        )
        return super().__call__(
            *positional_arguments,
            **keyword_arguments,
        )


class SupportsPositiveLabel(ABC):
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


class ClassificationEval(SupportsPositiveLabel, Eval):
    def __call__(
        self,
        y_true: "pd.Series[Any]",
        y_pred: "pd.Series[Any]",
        *args: Any,
        pos_label: Any = None,
        **kwargs: Any,
    ) -> float:
        positional_arguments, keyword_arguments = _eliminate_missing_values_from_all_series(
            y_true,
            y_pred,
            *args,
            **kwargs,
        )
        y_true, y_pred, *positional_arguments = positional_arguments
        if pos_label is not None:
            y_true = _binarize(pos_label, y_true)
            y_pred = _binarize(pos_label, y_pred)
        y_true = _coerce_dtype_if_necessary(y_true)
        y_pred = _coerce_dtype_if_necessary(y_pred)
        return super().__call__(
            y_true,
            y_pred,
            *positional_arguments,
            **keyword_arguments,
        )


class ScoredClassificationEval(SupportsPositiveLabel, Eval):
    def __call__(
        self,
        y_true: "pd.Series[Any]",
        y_pred: "pd.Series[Any]",
        *args: Any,
        pos_label: Any = None,
        **kwargs: Any,
    ) -> float:
        positional_arguments, keyword_arguments = _eliminate_missing_values_from_all_series(
            y_true,
            y_pred,
            *args,
            **kwargs,
        )
        y_true, y_pred, *positional_arguments = positional_arguments
        if pos_label is not None:
            y_true = _binarize(pos_label, y_true)
        y_true = _coerce_dtype_if_necessary(y_true)
        return super().__call__(
            y_true,
            y_pred,
            *positional_arguments,
            **keyword_arguments,
        )


def _coerce_dtype_if_necessary(
    series: "pd.Series[Any]",
) -> "pd.Series[Any]":
    """For classification, coerce the dtype if necessary. For example, if user
    passes in the series [True, None] as y_true, then it will have the `object`
    dtype even after removing the missing value, and sklearn will reject it.
    So, after the missing values are removed, we still need to coerce the dtype
    to that of the first non-missing value in the series."""
    if len(series) == 0:
        return series
    try:
        check_classification_targets(series)
    except ValueError as exc:
        if is_object_dtype(series):
            try:
                return series.astype(type(series.iloc[0]))
            except ValueError:
                raise exc
        else:
            raise exc
    return series


def _eliminate_missing_values_from_all_series(
    *args: Any,
    **kwargs: Any,
) -> Tuple[List[Any], Dict[str, Any]]:
    positional_arguments = list(args)
    keyword_arguments = dict(kwargs)
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
        for i, v in enumerate(positional_arguments):
            if isinstance(v, pd.Series):
                positional_arguments[i] = v.loc[not_na]
        for k, v in tuple(kwargs.items()):
            if isinstance(v, pd.Series):
                keyword_arguments[k] = v.loc[not_na]
    return positional_arguments, keyword_arguments


def _binarize(
    pos_label: Any,
    series: "pd.Series[Any]",
) -> "pd.Series[bool]":
    """Given pos_label, converts series into a binary (boolean) variable, i.e.
    rows are assigned True when their values match pos_label, and False
    otherwise. Series is assumed to contain no missing values."""
    if is_categorical_dtype(series):
        try:
            return cast(
                "pd.Series[bool]",
                series.cat.codes == series.cat.categories.get_loc(pos_label),
            )
        except KeyError:
            return cast(
                "pd.Series[bool]",
                pd.Series(np.full(len(series), False, dtype=bool)),
            )
    else:
        return cast(
            "pd.Series[bool]",
            series == pos_label,
        )


class SkEval(Enum):
    accuracy_score = ClassificationEval(sk.accuracy_score)
    average_precision_score = ScoredClassificationEval(sk.average_precision_score)
    balanced_accuracy_score = ClassificationEval(sk.balanced_accuracy_score)
    brier_score_loss = ScoredClassificationEval(sk.brier_score_loss)
    explained_variance_score = RegressionEval(sk.explained_variance_score)
    f1_score = ClassificationEval(sk.f1_score)
    hamming_loss = ClassificationEval(sk.hamming_loss)
    jaccard_score = ClassificationEval(sk.jaccard_score)
    log_loss = ScoredClassificationEval(sk.log_loss)
    matthews_corrcoef = ClassificationEval(sk.matthews_corrcoef)
    max_error = RegressionEval(sk.max_error)
    mean_absolute_error = RegressionEval(sk.mean_absolute_error)
    mean_absolute_percentage_error = RegressionEval(sk.mean_absolute_percentage_error)
    mean_gamma_deviance = RegressionEval(sk.mean_gamma_deviance)
    mean_pinball_loss = RegressionEval(sk.mean_pinball_loss)
    mean_poisson_deviance = RegressionEval(sk.mean_poisson_deviance)
    mean_squared_error = RegressionEval(sk.mean_squared_error)
    mean_squared_log_error = RegressionEval(sk.mean_squared_log_error)
    mean_tweedie_deviance = RegressionEval(sk.mean_tweedie_deviance)
    median_absolute_error = RegressionEval(sk.median_absolute_error)
    precision_score = ClassificationEval(sk.precision_score)
    r2_score = RegressionEval(sk.r2_score)
    recall_score = ClassificationEval(sk.recall_score)
    roc_auc_score = ScoredClassificationEval(sk.roc_auc_score)
    root_mean_squared_error = RegressionEval(sk.mean_squared_error, squared=False)
    zero_one_loss = ClassificationEval(sk.zero_one_loss)

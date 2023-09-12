import inspect
import math
from collections import ChainMap
from typing import Any, Callable, Dict, Iterable, Optional, cast

import numpy as np
import pandas as pd
import pytest
from numpy.testing import assert_almost_equal
from pandas.core.dtypes.common import is_object_dtype
from phoenix.core.model_schema import Column
from phoenix.metrics.mixins import EvaluationMetric, EvaluationMetricKeywordParameters
from phoenix.metrics.wrappers import Eval
from phoenix.metrics.wrappers import SkEval as ev
from sklearn import metrics as sk

N = 32
NA_PCT = 0.25

rng = np.random.default_rng(1234567890)

actual_label_column_name = hex(int(rng.random() * 1e9))
actual_score_column_name = hex(int(rng.random() * 1e9))
predicted_label_column_name = hex(int(rng.random() * 1e9))
predicted_score_column_name = hex(int(rng.random() * 1e9))
sample_weight_column_name = hex(int(rng.random() * 1e9))


def add_na(na_pct: float, series: "pd.Series[Any]") -> "pd.Series[Any]":
    series = series.sample(frac=1, random_state=rng)
    n_miss = int(len(series) * na_pct)
    series[: n_miss // 3] = None
    series[n_miss // 3 : 2 * n_miss // 3] = float("nan")
    series[2 * n_miss // 3 : n_miss] = np.nan
    return series.sample(frac=1, ignore_index=True, random_state=rng)


def gen_series(
    n: int,
    na_pct: float,
    cats: Optional[Iterable[Any]] = None,
    f: Callable[[Any], Any] = lambda x: x,
) -> "pd.Series[Any]":
    if n == 0:
        return pd.Series(dtype=object)
    if cats is None:
        return add_na(na_pct, pd.Series(rng.random(n)))
    cats = tuple(cats)
    weights = np.arange(1, len(cats) + 1)
    return add_na(
        na_pct,
        pd.Series(f(rng.choice(cats, n, p=weights / weights.sum()))),
    )


def gen_df(
    n: int = N,
    na_pct: float = 0.1,
    cats: Iterable[Any] = "01",
    f: Callable[[Any], Any] = lambda x: x,
) -> pd.DataFrame:
    df = pd.DataFrame(
        {
            actual_label_column_name: gen_series(n, na_pct, cats, f),
            actual_score_column_name: gen_series(n, na_pct),
            predicted_label_column_name: gen_series(n, na_pct, cats, f),
            predicted_score_column_name: gen_series(n, na_pct),
            sample_weight_column_name: gen_series(n, na_pct),
        },
    ).set_axis(rng.random(n), axis=0)
    assert len(df) == n
    assert list(df.isna().sum()) == [int(n * na_pct)] * len(df.columns)
    return df


@pytest.mark.parametrize(
    "df",
    [
        pd.DataFrame(),
        gen_df(0),
        gen_df(N, 1),
        gen_df(N, NA_PCT),
    ],
)
@pytest.mark.parametrize(
    "metric,desired,parameters",
    [
        (ev.d2_absolute_error_score, sk.d2_absolute_error_score, {}),
        (ev.d2_pinball_score, sk.d2_pinball_score, {}),
        (ev.d2_tweedie_score, sk.d2_tweedie_score, {}),
        (ev.explained_variance_score, sk.explained_variance_score, {}),
        (ev.max_error, sk.max_error, {}),
        (ev.mean_absolute_error, sk.mean_absolute_error, {}),
        (ev.mean_absolute_percentage_error, sk.mean_absolute_percentage_error, {}),
        (ev.mean_gamma_deviance, sk.mean_gamma_deviance, {}),
        (ev.mean_pinball_loss, sk.mean_pinball_loss, {}),
        (ev.mean_poisson_deviance, sk.mean_poisson_deviance, {}),
        (ev.mean_squared_error, sk.mean_squared_error, {}),
        (ev.mean_squared_log_error, sk.mean_squared_log_error, {}),
        (ev.mean_tweedie_deviance, sk.mean_tweedie_deviance, {}),
        (ev.median_absolute_error, sk.median_absolute_error, {}),
        (ev.r2_score, sk.r2_score, {}),
        (ev.root_mean_squared_error, sk.mean_squared_error, {"squared": False}),
    ],
)
def test_regression(
    df: pd.DataFrame,
    metric: Eval,
    desired: Callable[..., float],
    parameters: Dict[str, Any],
) -> None:
    run_test(
        df,
        actual_score_column_name,
        predicted_score_column_name,
        sample_weight_column_name,
        metric,
        desired,
        parameters,
    )


@pytest.mark.parametrize(
    "pos_label,df",
    [
        ("Y", pd.DataFrame()),
        ("Y", gen_df(0)),
        ("Y", gen_df(N, 1)),
        ("Y", gen_df(N, NA_PCT, "XY")),
        ("Y", gen_df(N, NA_PCT, "XY", f=pd.Categorical)),
        ("Y", gen_df(N, NA_PCT, "XYZ")),
        ("Y", gen_df(N, NA_PCT, "XYZ", f=pd.Categorical)),
        (10, gen_df(N, NA_PCT, [9, 10])),
        (10, gen_df(N, NA_PCT, [9, 10], f=pd.Categorical)),
        (10, gen_df(N, NA_PCT, [9, 10, 11])),
        (10, gen_df(N, NA_PCT, [9, 10, 11], f=pd.Categorical)),
        (True, gen_df(N, NA_PCT, [False, True])),
        (True, gen_df(N, NA_PCT, [False, True], f=pd.Categorical)),
    ],
)
@pytest.mark.parametrize(
    "metric,desired,parameters,is_binary,pred_is_score",
    [
        (ev.accuracy_score, sk.accuracy_score, {}, False, False),
        (ev.accuracy_score, sk.accuracy_score, {}, True, False),
        (ev.average_precision_score, sk.average_precision_score, {}, True, True),
        (ev.balanced_accuracy_score, sk.balanced_accuracy_score, {}, True, False),
        (ev.brier_score_loss, sk.brier_score_loss, {}, True, True),
        (ev.f1_score, sk.f1_score, {}, True, False),
        (ev.hamming_loss, sk.hamming_loss, {}, True, False),
        (ev.jaccard_score, sk.jaccard_score, {}, True, False),
        (ev.log_loss, sk.log_loss, {}, True, True),
        (ev.matthews_corrcoef, sk.matthews_corrcoef, {}, True, False),
        (ev.precision_score, sk.precision_score, {}, True, False),
        (ev.recall_score, sk.recall_score, {}, True, False),
        (ev.roc_auc_score, sk.roc_auc_score, {}, True, True),
        (ev.zero_one_loss, sk.zero_one_loss, {}, True, False),
    ],
)
def test_classification(
    pos_label: Any,
    df: pd.DataFrame,
    metric: Eval,
    desired: Callable[..., float],
    parameters: Dict[str, Any],
    is_binary: bool,
    pred_is_score: bool,
) -> None:
    run_test(
        df,
        actual_label_column_name,
        predicted_score_column_name if pred_is_score else predicted_label_column_name,
        sample_weight_column_name,
        metric,
        desired,
        parameters,
        actual_label=pos_label if is_binary else None,
        predicted_label=None if pred_is_score or not is_binary else pos_label,
    )


def run_test(
    df: pd.DataFrame,
    actual_column_name: str,
    predicted_column_name: str,
    sample_weight_column_name: str,
    eval: Eval,
    desired: Callable[..., float],
    parameters: Dict[str, Any],
    actual_label: Any = None,
    predicted_label: Any = None,
) -> None:
    # calculation without sample weights
    actual_result = EvaluationMetric(
        eval=eval,
        actual=Column(actual_column_name),
        predicted=Column(predicted_column_name),
        parameters=EvaluationMetricKeywordParameters(
            pos_label=actual_label,
        ),
    )(df)
    try:
        actual = df.loc[:, actual_column_name]
    except KeyError:
        actual = pd.Series(dtype=object)
    try:
        predicted = df.loc[:, predicted_column_name]
    except KeyError:
        predicted = pd.Series(dtype=object)
    both_not_na = ~actual.isna() & ~predicted.isna()
    try:
        desired_result = desired(
            _ensure_dtype(_binarize(actual_label, actual).loc[both_not_na]),
            _ensure_dtype(_binarize(predicted_label, predicted).loc[both_not_na]),
            **parameters,
        )
    except (ValueError, IndexError, ZeroDivisionError) as exc:
        if both_not_na.sum():
            raise exc
        desired_result = np.nan
    # Since we are using random numbers as input, we want to make sure that we
    # don't mess up something and inadvertently return NaN for comparisons.
    assert not math.isnan(desired_result) or both_not_na.sum() == 0
    assert_almost_equal(actual_result, desired_result)
    # calculation with sample weights
    actual_result = EvaluationMetric(
        eval=eval,
        actual=Column(actual_column_name),
        predicted=Column(predicted_column_name),
        parameters=EvaluationMetricKeywordParameters(
            sample_weight=Column(sample_weight_column_name),
            pos_label=actual_label,
        ),
    )(df)
    try:
        sample_weight = df.loc[:, sample_weight_column_name]
    except KeyError:
        sample_weight = pd.Series(dtype=object)
    allowed_parameters = inspect.signature(desired).parameters.keys()
    all_not_na = (
        both_not_na & ~sample_weight.isna()
        if "sample_weight" in allowed_parameters
        else both_not_na
    )
    try:
        desired_result = desired(
            _ensure_dtype(_binarize(actual_label, actual).loc[all_not_na]),
            _ensure_dtype(_binarize(predicted_label, predicted).loc[all_not_na]),
            **{
                k: v
                for k, v in ChainMap(
                    parameters,
                    {"sample_weight": sample_weight.loc[all_not_na]},
                ).items()
                if k in allowed_parameters
            },
        )
    except (ValueError, IndexError, ZeroDivisionError) as exc:
        if all_not_na.sum():
            raise exc
        desired_result = np.nan
    # Since we are using random numbers as input, we want to make sure that we
    # don't mess up something and inadvertently return NaN for comparisons.
    assert not math.isnan(desired_result) or both_not_na.sum() == 0
    assert_almost_equal(actual_result, desired_result)


def _ensure_dtype(series: "pd.Series[Any]") -> "pd.Series[Any]":
    if is_object_dtype(series) and len(series) and not isinstance(series.iloc[0], str):
        return series.astype(type(series.iloc[0]))
    return series


def _binarize(
    pos_label: Any,
    series: "pd.Series[Any]",
) -> "pd.Series[bool]":
    return (
        series
        if pos_label is None
        else cast(
            "pd.Series[bool]",
            series == pos_label,
        )
    )

import inspect
from collections import ChainMap
from dataclasses import replace
from typing import Any, Callable, Dict, Iterable, Optional, cast

import numpy as np
import numpy.typing as npt
import pandas as pd
import pytest
from numpy.testing import assert_almost_equal
from phoenix.server.api.input_types.PerformanceMetricInput import (
    MetricParametersInput,
    PerformanceMetricInput,
)
from phoenix.server.api.types.PerformanceMetric import PerformanceMetric
from phoenix.server.api.types.PerformanceMetric import PerformanceMetric as mc
from sklearn import metrics as sk

N = 1000
NA_PCT = 0.1

rng = np.random.default_rng(1234567890)

actual_column_name = hex(int(rng.random() * 1e9))
predicted_column_name = hex(int(rng.random() * 1e9))
sample_weight_column_name = hex(int(rng.random() * 1e9))


def add_na(na_pct: float, x: "pd.Series[Any]") -> "pd.Series[Any]":
    x = x.sample(frac=1, ignore_index=True, random_state=rng)
    n = int(len(x) * na_pct)
    x[: n // 2] = None
    x[n // 2 : n] = np.nan
    x = x.sample(frac=1, ignore_index=True, random_state=rng)
    return x


def cat_series(
    n: int,
    cats: Iterable[Any],
    f: Callable[..., npt.NDArray[Any]] = lambda x: x,  # type: ignore
) -> "pd.Series[Any]":
    if n == 0:
        return pd.Series(dtype=object)
    cats = tuple(cats)
    weights = np.arange(1, len(cats) + 1)
    return pd.Series(f(rng.choice(cats, n, p=weights / weights.sum())))


def gen_df(
    n: int = N,
    na_pct: float = 0.3,
    actual: Optional[Iterable[Any]] = None,
    predicted: Optional[Iterable[Any]] = None,
    f: Callable[..., Any] = lambda x: x,
) -> pd.DataFrame:
    df = pd.DataFrame(
        {
            actual_column_name: add_na(
                na_pct,
                pd.Series(rng.random(n)) if actual is None else cat_series(n, actual, f),
            ),
            predicted_column_name: add_na(
                na_pct,
                pd.Series(rng.random(n)) if predicted is None else cat_series(n, predicted, f),
            ),
            sample_weight_column_name: add_na(
                na_pct,
                pd.Series(rng.random(n)),
            ),
        },
    ).set_axis(
        pd.Series(
            np.arange(2 * n, 5 * n, 3),
        ).sample(frac=1),
        axis=0,
    )
    assert len(df) == n
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
        (mc.d2_absolute_error_score, sk.d2_absolute_error_score, {}),
        (mc.d2_pinball_score, sk.d2_pinball_score, {}),
        (mc.d2_tweedie_score, sk.d2_tweedie_score, {}),
        (mc.explained_variance_score, sk.explained_variance_score, {}),
        (mc.max_error, sk.max_error, {}),
        (mc.mean_absolute_error, sk.mean_absolute_error, {}),
        (mc.mean_absolute_percentage_error, sk.mean_absolute_percentage_error, {}),
        (mc.mean_gamma_deviance, sk.mean_gamma_deviance, {}),
        (mc.mean_pinball_loss, sk.mean_pinball_loss, {}),
        (mc.mean_poisson_deviance, sk.mean_poisson_deviance, {}),
        (mc.mean_squared_error, sk.mean_squared_error, {}),
        (mc.mean_squared_log_error, sk.mean_squared_log_error, {}),
        (mc.mean_tweedie_deviance, sk.mean_tweedie_deviance, {}),
        (mc.median_absolute_error, sk.median_absolute_error, {}),
        (mc.r2_score, sk.r2_score, {}),
        (mc.root_mean_squared_error, sk.mean_squared_error, {"squared": False}),
    ],
)
def test_regression(
    df: pd.DataFrame,
    metric: PerformanceMetric,
    desired: Callable[..., float],
    parameters: Dict[str, Any],
) -> None:
    run_test(
        df,
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
        ("Y", gen_df(N, NA_PCT, "XY", "XY")),
        ("Y", gen_df(N, NA_PCT, "XY", "XY", f=pd.Categorical)),
        ("Y", gen_df(N, NA_PCT, "XYZ", "XYZ")),
        ("Y", gen_df(N, NA_PCT, "XYZ", "XYZ", f=pd.Categorical)),
        (10, gen_df(N, NA_PCT, [9, 10], [9, 10])),
        (10, gen_df(N, NA_PCT, [9, 10], [9, 10], f=pd.Categorical)),
        (10, gen_df(N, NA_PCT, [9, 10, 11], [9, 10, 11])),
        (10, gen_df(N, NA_PCT, [9, 10, 11], [9, 10, 11], f=pd.Categorical)),
        (True, gen_df(N, NA_PCT, [False, True], [False, True])),
        (True, gen_df(N, NA_PCT, [False, True], [False, True], f=pd.Categorical)),
    ],
)
@pytest.mark.parametrize(
    "metric,desired,parameters,pred_is_score",
    [
        (mc.accuracy_score, sk.accuracy_score, {}, False),
        (mc.average_precision_score, sk.average_precision_score, {}, True),
        (mc.balanced_accuracy_score, sk.balanced_accuracy_score, {}, False),
        (mc.brier_score_loss, sk.brier_score_loss, {}, True),
        (mc.f1_score, sk.f1_score, {}, False),
        (mc.hamming_loss, sk.hamming_loss, {}, False),
        (mc.jaccard_score, sk.jaccard_score, {}, False),
        (mc.log_loss, sk.log_loss, {}, True),
        (mc.matthews_corrcoef, sk.matthews_corrcoef, {}, False),
        (mc.precision_score, sk.precision_score, {}, False),
        (mc.recall_score, sk.recall_score, {}, False),
        (mc.roc_auc_score, sk.roc_auc_score, {}, True),
        (mc.zero_one_loss, sk.zero_one_loss, {}, False),
    ],
)
def test_classification_binary(
    pos_label: Any,
    df: pd.DataFrame,
    metric: PerformanceMetric,
    desired: Callable[..., float],
    parameters: Dict[str, Any],
    pred_is_score: bool,
) -> None:
    run_test(
        df,
        metric,
        desired,
        parameters,
        actual_label=pos_label,
        predicted_label=None if pred_is_score else pos_label,
    )


def run_test(
    df: pd.DataFrame,
    metric: PerformanceMetric,
    desired: Callable[..., float],
    parameters: Dict[str, Any],
    actual_label: Any = None,
    predicted_label: Any = None,
) -> None:
    try:
        actual = df.loc[:, actual_column_name]
    except KeyError:
        actual = pd.Series(dtype=object)
    try:
        predicted = df.loc[:, predicted_column_name]
    except KeyError:
        predicted = pd.Series(dtype=object)
    both_not_na = ~actual.isna() & ~predicted.isna()
    metric_parameters_input = MetricParametersInput()
    if isinstance(actual_label, str):
        metric_parameters_input = replace(
            metric_parameters_input,  # type: ignore
            pos_label_str=actual_label,
        )
    elif isinstance(actual_label, int):
        metric_parameters_input = replace(
            metric_parameters_input,  # type: ignore
            pos_label_int=actual_label,
        )
    elif isinstance(actual_label, bool):
        metric_parameters_input = replace(
            metric_parameters_input,  # type: ignore
            pos_label_bool=actual_label,
        )
    # calculation without sample weights
    try:
        desired_result = desired(
            binarize(actual_label, actual).loc[both_not_na],
            binarize(predicted_label, predicted).loc[both_not_na],
            **parameters,
        )
    except (TypeError, ValueError, IndexError, ZeroDivisionError):
        desired_result = np.nan
    actual_result = PerformanceMetricInput(
        metric=metric,
        actual_column_name=actual_column_name,
        predicted_column_name=predicted_column_name,
        parameters=metric_parameters_input,
    ).metric_instance(df)
    assert_almost_equal(actual_result, desired_result)
    # calculation with sample weights
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
            binarize(actual_label, actual).loc[all_not_na],
            binarize(predicted_label, predicted).loc[all_not_na],
            **{
                k: v
                for k, v in ChainMap(
                    parameters,
                    {"sample_weight": sample_weight.loc[all_not_na]},
                ).items()
                if k in allowed_parameters
            },
        )
    except (TypeError, ValueError, IndexError, ZeroDivisionError):
        desired_result = np.nan
    actual_result = PerformanceMetricInput(
        metric=metric,
        actual_column_name=actual_column_name,
        predicted_column_name=predicted_column_name,
        parameters=replace(
            metric_parameters_input,  # type: ignore
            sample_weight_column_name=sample_weight_column_name,
        ),
    ).metric_instance(df)
    assert_almost_equal(actual_result, desired_result)


def binarize(pos_label: Any, s: "pd.Series[Any]") -> "pd.Series[Any]":
    return (
        s
        if pos_label is None
        else cast(
            "pd.Series[int]",
            (s == pos_label).astype(int),
        )
    )

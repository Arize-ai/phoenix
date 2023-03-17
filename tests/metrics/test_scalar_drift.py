import pandas as pd
from numpy.testing import assert_almost_equal
from phoenix.metrics import binning, metrics

name = "x"
data = pd.DataFrame(
    {
        name: pd.Series(
            [-1, 0, 1, 2, 3, None, ""],
            dtype=object,
        ),
    }
)


def test_psi_categorical_binning():
    metric = metrics.PSI(
        operand=name,
        reference_data=data,
        normalize=binning.AdditiveSmoothing(pseudocount=1),
        binning=binning.Categorical(),
    )
    assert_almost_equal(0.0, metric(data))
    for i, desired in enumerate((0.026, 0.127, 0.1762, 0.1907, 0.181, 0.2511)):
        test = pd.DataFrame({name: pd.Series(range(i))})
        assert_almost_equal(
            metric(test).round(4),
            desired,
            err_msg=f"i={i} test={test.loc[:,name].to_numpy()}",
        )


def test_psi_categorical_binning_with_missing():
    metric = metrics.PSI(
        operand=name,
        reference_data=data,
        normalize=binning.AdditiveSmoothing(pseudocount=1),
        binning=binning.Categorical(special_missing_values=(-1,)),
    )
    assert_almost_equal(0.0, metric(data))
    for i, desired in enumerate((0.0924, 0.231, 0.2971, 0.3177, 0.3081, 0.3732)):
        test = pd.DataFrame({name: pd.Series(range(i))})
        assert_almost_equal(
            metric(test).round(4),
            desired,
            err_msg=f"i={i} test={test.loc[:,name].to_numpy()}",
        )


def test_psi_categorical_binning_with_missing_and_dropna():
    metric = metrics.PSI(
        operand=name,
        reference_data=data,
        normalize=binning.AdditiveSmoothing(pseudocount=1),
        binning=binning.Categorical(special_missing_values=(-1,), dropna=True),
    )
    assert_almost_equal(0.0, metric(data))
    for i, desired in enumerate((0.0, 0.1040, 0.1155, 0.0743, 0.0, 0.0616)):
        test = pd.DataFrame({name: pd.Series(range(i))})
        assert_almost_equal(
            metric(test).round(4),
            desired,
            err_msg=f"i={i} test={test.loc[:,name].to_numpy()}",
        )


def test_psi_interval_binning():
    metric = metrics.PSI(
        operand=name,
        reference_data=data,
        normalize=binning.AdditiveSmoothing(pseudocount=1),
        binning=binning.Interval(
            bins=pd.IntervalIndex(
                (
                    pd.Interval(float("-inf"), 1.0, closed="left"),
                    pd.Interval(1.0, 2.0, closed="left"),
                    pd.Interval(2.0, float("inf"), closed="left"),
                )
            )
        ),
    )
    assert_almost_equal(0.0, metric(data))
    for i, desired in enumerate((0.0276, 0.0956, 0.2085, 0.1321, 0.1715, 0.2474)):
        test = pd.DataFrame({name: pd.Series(range(i))})
        assert_almost_equal(
            metric(test).round(4),
            desired,
            err_msg=f"i={i} test={test.loc[:,name].to_numpy()}",
        )


def test_psi_interval_binning_with_missing():
    metric = metrics.PSI(
        operand=name,
        reference_data=data,
        normalize=binning.AdditiveSmoothing(pseudocount=1),
        binning=binning.Interval(
            bins=pd.IntervalIndex(
                (
                    pd.Interval(float("-inf"), 1.0, closed="left"),
                    pd.Interval(1.0, 2.0, closed="left"),
                    pd.Interval(2.0, float("inf"), closed="left"),
                )
            ),
            special_missing_values=(-1,),
        ),
    )
    assert_almost_equal(0.0, metric(data))
    for i, desired in enumerate((0.088, 0.2941, 0.3896, 0.3008, 0.3308, 0.3995)):
        test = pd.DataFrame({name: pd.Series(range(i))})
        assert_almost_equal(
            metric(test).round(4),
            desired,
            err_msg=f"i={i} test={test.loc[:,name].to_numpy()}",
        )


def test_psi_interval_binning_with_missing_and_dropna():
    metric = metrics.PSI(
        operand=name,
        reference_data=data,
        normalize=binning.AdditiveSmoothing(pseudocount=1),
        binning=binning.Interval(
            bins=pd.IntervalIndex(
                (
                    pd.Interval(float("-inf"), 1.0, closed="left"),
                    pd.Interval(1.0, 2.0, closed="left"),
                    pd.Interval(2.0, float("inf"), closed="left"),
                )
            ),
            special_missing_values=(-1,),
            dropna=True,
        ),
    )
    assert_almost_equal(0.0, metric(data))
    for i, desired in enumerate((0.0386, 0.2209, 0.2511, 0.0386, 0.0, 0.0205)):
        test = pd.DataFrame({name: pd.Series(range(i))})
        assert_almost_equal(
            metric(test).round(4),
            desired,
            err_msg=f"i={i} test={test.loc[:,name].to_numpy()}",
        )


def test_psi_quantile_binning():
    metric = metrics.PSI(
        operand=name,
        reference_data=data,
        normalize=binning.AdditiveSmoothing(pseudocount=1),
        binning=binning.Quantile(
            data=data.x,
            prob=(0.25, 0.5, 0.75),
        ),
    )
    assert_almost_equal(0.0, metric(data))
    for i, desired in enumerate((0.0405, 0.1831, 0.2519, 0.1662, 0.1911, 0.2542)):
        test = pd.DataFrame({name: pd.Series(range(i))})
        assert_almost_equal(
            metric(test).round(4),
            desired,
            err_msg=f"i={i} test={test.loc[:,name].to_numpy()}",
        )


def test_psi_quantile_binning_with_missing():
    metric = metrics.PSI(
        operand=name,
        reference_data=data,
        normalize=binning.AdditiveSmoothing(pseudocount=1),
        binning=binning.Quantile(
            data=data.x,
            prob=(0.25, 0.5, 0.75),
            special_missing_values=(-1,),
        ),
    )
    assert_almost_equal(0.0, metric(data))
    for i, desired in enumerate((0.0924, 0.231, 0.2971, 0.3177, 0.3081, 0.3775)):
        test = pd.DataFrame({name: pd.Series(range(i))})
        assert_almost_equal(
            metric(test).round(4),
            desired,
            err_msg=f"i={i} test={test.loc[:,name].to_numpy()}",
        )


def test_psi_quantile_binning_with_missing_and_dropna():
    metric = metrics.PSI(
        operand=name,
        reference_data=data,
        normalize=binning.AdditiveSmoothing(pseudocount=1),
        binning=binning.Quantile(
            data=data.x,
            prob=(0.25, 0.5, 0.75),
            special_missing_values=(-1,),
            dropna=True,
        ),
    )
    assert_almost_equal(0.0, metric(data))
    for i, desired in enumerate((0.0, 0.104, 0.1155, 0.0743, 0.0, 0.0338)):
        test = pd.DataFrame({name: pd.Series(range(i))})
        assert_almost_equal(
            metric(test).round(4),
            desired,
            err_msg=f"i={i} test={test.loc[:,name].to_numpy()}",
        )

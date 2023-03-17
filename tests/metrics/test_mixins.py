from dataclasses import dataclass

import pandas as pd
from pandas.testing import assert_series_equal
from phoenix.metrics.mixins import Operand


@dataclass
class T:
    op: Operand = Operand()


def test_operand():
    x = pd.Series([None, 0], dtype=float, name="x")
    y = pd.Series([1, None], dtype=object, name="y")
    z = pd.Series(dtype=float, name="z")

    df = pd.DataFrame({"x": x, "y": y})

    assert_series_equal(T(op="x").op(df), x)
    assert_series_equal(T(op="y").op(df), y)
    assert_series_equal(T(op="z").op(df), z)

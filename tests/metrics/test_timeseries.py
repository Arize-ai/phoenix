from datetime import timedelta
from io import StringIO
from typing import Union

import numpy as np
import numpy.typing as npt
import pandas as pd

from phoenix.metrics.metrics import Count, Mean, VectorMean, VectorSum
from phoenix.metrics.timeseries import timeseries


def txt2arr(s: str) -> Union[float, npt.NDArray[np.float]]:
    if isinstance(s, str) and len(s) > 1 and s[0] == "[" and s[-1] == "]":
        return np.array(s[1:-1].split(), dtype=float)
    return float(s)


metrics = (Mean("x"), Count("x"), VectorSum(col="v", shape=5), VectorMean(col="v", shape=5))
names = ["Mean(x)", "Count(x)", "VectorSum(v)", "VectorMean(v)"]

start = pd.to_datetime("2023-01-01 11:50:52")
end = pd.to_datetime("2023-01-28 11:26:50")  # end instant is exclusive

data = pd.read_csv(
    StringIO(
        """
        2023-01-01 11:50:52,839,A,[1 2 3 4 5]
        2023-01-07 00:46:53,895,A,[2 3 4 5 6]
        2023-01-08 20:22:47,382,A,[3 4 5 6 7]
        2023-01-10 09:37:54,276,A,[4 5 6 7 8]
        2023-01-15 11:56:26,875,B,[5 6 7 8 9]
        2023-01-18 21:13:50,954,A,[6 7 8 9 10]
        2023-01-21 05:23:50,750,A,[7 8 9 10 11]
        2023-01-22 00:24:26,267,A,[8 9 10 11 12]
        2023-01-28 06:52:08,642,A,[9 10 11 12 13]
        2023-01-28 11:26:50,446,A,[10 11 12 13 14]
        """
    ),
    names=["ts", "x", "y", "v"],
    parse_dates=["ts"],
    date_parser=pd.to_datetime,
    index_col="ts",
)
data["v"] = data["v"].apply(txt2arr)


def test_timeseries_durational_granularity() -> None:
    expected = pd.read_csv(
        StringIO(
            """
            2023-01-02 11:26:50,839.,1,[1. 2. 3. 4. 5.],[1. 2. 3. 4. 5.]
            2023-01-03 11:26:50,839.,1,[1. 2. 3. 4. 5.],[1. 2. 3. 4. 5.]
            2023-01-04 11:26:50,839.,1,[1. 2. 3. 4. 5.],[1. 2. 3. 4. 5.]
            2023-01-05 11:26:50,nan,0,[0. 0. 0. 0. 0.],nan
            2023-01-06 11:26:50,nan,0,[0. 0. 0. 0. 0.],nan
            2023-01-07 11:26:50,895.,1,[2. 3. 4. 5. 6.],[2. 3. 4. 5. 6.]
            2023-01-08 11:26:50,895.,1,[2. 3. 4. 5. 6.],[2. 3. 4. 5. 6.]
            2023-01-09 11:26:50,638.5,2,[5. 7. 9. 11. 13.],[2.5 3.5 4.5 5.5 6.5]
            2023-01-10 11:26:50,329.,2,[7. 9. 11. 13. 15.],[3.5 4.5 5.5 6.5 7.5]
            2023-01-11 11:26:50,329.,2,[7. 9. 11. 13. 15.],[3.5 4.5 5.5 6.5 7.5]
            2023-01-12 11:26:50,276.,1,[4. 5. 6. 7. 8.],[4. 5. 6. 7. 8.]
            2023-01-13 11:26:50,nan,0,[0. 0. 0. 0. 0.],nan
            2023-01-14 11:26:50,nan,0,[0. 0. 0. 0. 0.],nan
            2023-01-15 11:26:50,nan,0,[0. 0. 0. 0. 0.],nan
            2023-01-16 11:26:50,nan,0,[0. 0. 0. 0. 0.],nan
            2023-01-17 11:26:50,nan,0,[0. 0. 0. 0. 0.],nan
            2023-01-18 11:26:50,nan,0,[0. 0. 0. 0. 0.],nan
            2023-01-19 11:26:50,954.,1,[6. 7. 8. 9. 10.],[6. 7. 8. 9. 10.]
            2023-01-20 11:26:50,954.,1,[6. 7. 8. 9. 10.],[6. 7. 8. 9. 10.]
            2023-01-21 11:26:50,852,2,[13. 15. 17. 19. 21.],[6.5  7.5  8.5  9.5 10.5]
            2023-01-22 11:26:50,508.5,2,[15. 17. 19. 21. 23.],[7.5  8.5  9.5 10.5 11.5]
            2023-01-23 11:26:50,508.5,2,[15. 17. 19. 21. 23.],[7.5  8.5  9.5 10.5 11.5]
            2023-01-24 11:26:50,267.,1,[8. 9. 10. 11. 12.],[8. 9. 10. 11. 12.]
            2023-01-25 11:26:50,nan,0,[0. 0. 0. 0. 0.],nan
            2023-01-26 11:26:50,nan,0,[0. 0. 0. 0. 0.],nan
            2023-01-27 11:26:50,nan,0,[0. 0. 0. 0. 0.],nan
            2023-01-28 11:26:50,642.,1,[9. 10. 11. 12. 13.],[9. 10. 11. 12. 13.]
            """
        ),
        names=["ts"] + names,
        parse_dates=["ts"],
        date_parser=pd.to_datetime,
        index_col="ts",
    )
    expected["VectorSum(v)"] = expected["VectorSum(v)"].apply(txt2arr)
    expected["VectorMean(v)"] = expected["VectorMean(v)"].apply(txt2arr)
    actual = data.pipe(
        timeseries(start, end, timedelta(hours=72), timedelta(hours=24)),
        metrics=metrics,
        where="y != 'B'",  # TODO: where= is only proof of concept
    )
    assert expected.shape == actual.shape
    assert expected.index.equals(actual.index)
    for timestamp, row in actual.iterrows():
        assert expected.loc[timestamp].equals(
            pd.Series({name: metric.get_value(row) for name, metric in zip(names, metrics)})
        )


def test_timeseries_simple_granularity() -> None:
    expected = pd.read_csv(
        StringIO(
            """
            2023-01-01 19:26:50,839,1,[1. 2. 3. 4. 5.],[1. 2. 3. 4. 5.]
            2023-01-05 3:26:50,nan,0,[0. 0. 0. 0. 0.],nan
            2023-01-08 11:26:50,895,1,[2. 3. 4. 5. 6.],[2. 3. 4. 5. 6.]
            2023-01-11 19:26:50,329,2,[7. 9. 11. 13. 15.],[3.5 4.5 5.5 6.5 7.5]
            2023-01-15 3:26:50,nan,0,[0. 0. 0. 0. 0.],nan
            2023-01-18 11:26:50,875,1,[5. 6. 7. 8. 9.],[5. 6. 7. 8. 9.]
            2023-01-21 19:26:50,852,2,[13. 15. 17. 19. 21.],[6.5  7.5  8.5  9.5 10.5]
            2023-01-25 3:26:50,267,1,[8. 9. 10. 11. 12.],[8. 9. 10. 11. 12.]
            2023-01-28 11:26:50,642,1,[9. 10. 11. 12. 13.],[9. 10. 11. 12. 13.]
            """
        ),
        names=["ts"] + names,
        parse_dates=["ts"],
        date_parser=pd.to_datetime,
        index_col="ts",
    )
    expected["VectorSum(v)"] = expected["VectorSum(v)"].apply(txt2arr)
    expected["VectorMean(v)"] = expected["VectorMean(v)"].apply(txt2arr)
    actual = data.pipe(timeseries(start, end, timedelta(hours=80)), metrics=metrics)
    assert expected.shape == actual.shape
    assert expected.index.equals(actual.index)
    for timestamp, row in actual.iterrows():
        assert expected.loc[timestamp].equals(
            pd.Series({name: metric.get_value(row) for name, metric in zip(names, metrics)})
        )


def test_timeseries_all_granularity() -> None:
    expected = pd.read_csv(
        StringIO(
            """
            2023-01-28 11:26:50,653.3333333333334,9,[45. 54. 63. 72. 81.],[5. 6. 7. 8. 9.]
            """
        ),
        names=["ts"] + names,
        parse_dates=["ts"],
        date_parser=pd.to_datetime,
        index_col="ts",
    )
    expected["VectorSum(v)"] = expected["VectorSum(v)"].apply(txt2arr)
    expected["VectorMean(v)"] = expected["VectorMean(v)"].apply(txt2arr)
    actual = data.pipe(timeseries(start, end), metrics=metrics)
    assert expected.shape == actual.shape
    assert expected.index.equals(actual.index)
    for timestamp, row in actual.iterrows():
        assert expected.loc[timestamp].equals(
            pd.Series({name: metric.get_value(row) for name, metric in zip(names, metrics)})
        )


def test_timeseries_empty_result() -> None:
    expected = pd.concat((metric.empty_result() for metric in metrics), axis=1)
    actual = data.pipe(timeseries(end, start), metrics=metrics)
    assert expected.shape == actual.shape
    assert expected.index.equals(actual.index)
    for timestamp, row in actual.iterrows():
        assert expected.loc[timestamp].equals(
            pd.Series({name: metric.get_value(row) for name, metric in zip(names, metrics)})
        )

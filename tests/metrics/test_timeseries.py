from datetime import timedelta
from io import StringIO
from typing import NamedTuple, Union, cast

import numpy as np
import numpy.typing as npt
import pandas as pd

from phoenix.metrics import Metric
from phoenix.metrics.metrics import Count, Mean, VectorMean, VectorSum
from phoenix.metrics.timeseries import timeseries


def txt2arr(s: str) -> Union[float, npt.NDArray[np.float64]]:
    if isinstance(s, str) and len(s) > 1 and s[0] == "[" and s[-1] == "]":
        return np.array(s[1:-1].split(), dtype=float)
    return float(s)


MetricTest = NamedTuple("MetricTest", [("name", str), ("metric", Metric)])

metric_tests = (
    MetricTest("Mean(x)", Mean("x")),
    MetricTest("Count(x)", Count("x")),
    MetricTest("VectorSum(v)", VectorSum(column_name="v", shape=5)),
    MetricTest("VectorMean(v)", VectorMean(column_name="v", shape=5)),
)
names = list(map(lambda t: t.name, metric_tests))
metrics = list(map(lambda t: t.metric, metric_tests))
start = pd.to_datetime("2023-01-01 11:50:52")
end = pd.to_datetime("2023-01-28 11:26:50")  # end instant is exclusive

# The `index` column is added here because it can be a common occurrence in
# dataframes read from csv files, and it will confuse `pandas.DataFrame.query()`
# when index filtering is attempted, so it's a good edge case for testing.
data = pd.read_csv(
    StringIO(
        """
        2023-01-01 11:50:52,0,839,A,[1 2 3 4 5]
        2023-01-07 00:46:53,1,895,B,[2 3 4 5 6]
        2023-01-08 20:22:47,2,382,A,[3 4 5 6 7]
        2023-01-10 09:37:54,3,276,B,[4 5 6 7 8]
        2023-01-15 11:56:26,4,875,A,[5 6 7 8 9]
        2023-01-18 21:13:50,5,954,B,[6 7 8 9 10]
        2023-01-21 05:23:50,6,750,A,[7 8 9 10 11]
        2023-01-22 00:24:26,7,267,B,[8 9 10 11 12]
        2023-01-28 06:52:08,8,642,A,[9 10 11 12 13]
        2023-01-28 11:26:50,9,446,B,[10 11 12 13 14]
        """
    ),
    names=["ts", "index", "x", "y", "v"],
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
            2023-01-16 11:26:50,875.,1,[5. 6. 7. 8. 9.],[5. 6. 7. 8. 9.]
            2023-01-17 11:26:50,875.,1,[5. 6. 7. 8. 9.],[5. 6. 7. 8. 9.]
            2023-01-18 11:26:50,875.,1,[5. 6. 7. 8. 9.],[5. 6. 7. 8. 9.]
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
    compare(
        expected,
        data.pipe(
            timeseries(
                start_time=start,
                end_time=end,
                evaluation_window=timedelta(hours=72),
                sampling_interval=timedelta(hours=24),
            ),
            metrics=metrics,
        ),
    )

    expected = pd.read_csv(
        StringIO(
            """
            2023-01-03 11:26:50,839.,1.,[1. 2. 3. 4. 5.],[1. 2. 3. 4. 5.]
            2023-01-04 11:26:50,839.,1.,[1. 2. 3. 4. 5.],[1. 2. 3. 4. 5.]
            2023-01-09 11:26:50,895.,1.,[2. 3. 4. 5. 6.],[2. 3. 4. 5. 6.]
            2023-01-10 11:26:50,329.,2.,[ 7.  9. 11. 13. 15.],[3.5 4.5 5.5 6.5 7.5]
            2023-01-11 11:26:50,276.,1.,[4. 5. 6. 7. 8.],[4. 5. 6. 7. 8.]
            2023-01-16 11:26:50,875.,1.,[5. 6. 7. 8. 9.],[5. 6. 7. 8. 9.]
            2023-01-17 11:26:50,875.,1.,[5. 6. 7. 8. 9.],[5. 6. 7. 8. 9.]
            2023-01-21 11:26:50,954.,1.,[ 6.  7.  8.  9. 10.],[ 6.  7.  8.  9. 10.]
            2023-01-22 11:26:50,508.5,2.,[15. 17. 19. 21. 23.],[ 7.5  8.5  9.5 10.5 11.5]
            2023-01-23 11:26:50,267.,1.,[ 8.  9. 10. 11. 12.],[ 8.  9. 10. 11. 12.]
            2023-01-28 11:26:50,642.,1.,[ 9. 10. 11. 12. 13.],[ 9. 10. 11. 12. 13.]
            """
        ),
        names=["ts"] + names,
        parse_dates=["ts"],
        date_parser=pd.to_datetime,
        index_col="ts",
    )
    expected["VectorSum(v)"] = expected["VectorSum(v)"].apply(txt2arr)
    expected["VectorMean(v)"] = expected["VectorMean(v)"].apply(txt2arr)
    compare(
        expected,
        data.pipe(
            timeseries(
                start_time=start,
                end_time=end,
                evaluation_window=timedelta(hours=72),
                sampling_interval=timedelta(hours=48),
            ),
            metrics=metrics,
        ),
    )

    expected = pd.read_csv(
        StringIO(
            """
            2023-01-03 05:26:50,839.,1,[1. 2. 3. 4. 5.],[1. 2. 3. 4. 5.]
            2023-01-07 10:26:50,895.,1,[2. 3. 4. 5. 6.],[2. 3. 4. 5. 6.]
            2023-01-11 15:26:50,329.,2,[7. 9. 11. 13. 15.],[3.5 4.5 5.5 6.5 7.5]
            2023-01-15 20:26:50,875.,1,[5. 6. 7. 8. 9.],[5. 6. 7. 8. 9.]
            2023-01-20 01:26:50,954.,1,[6. 7. 8. 9. 10.],[6. 7. 8. 9. 10.]
            2023-01-24 06:26:50,508.5,2,[15. 17. 19. 21. 23.],[7.5  8.5  9.5 10.5 11.5]
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
    compare(
        expected,
        data.pipe(
            timeseries(
                start_time=start,
                end_time=end,
                evaluation_window=timedelta(hours=100),
                sampling_interval=timedelta(hours=99),
            ),
            metrics=metrics,
        ),
    )

    expected = pd.read_csv(
        StringIO(
            """
            2023-01-11 15:26:50,329.,2,[7. 9. 11. 13. 15.],[3.5 4.5 5.5 6.5 7.5]
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
    compare(
        expected,
        data.pipe(
            timeseries(
                start_time=start,
                end_time=end,
                evaluation_window=timedelta(hours=100),
                sampling_interval=timedelta(hours=396),
            ),
            metrics=metrics,
        ),
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
    compare(
        expected,
        data.pipe(
            timeseries(
                start_time=start,
                end_time=end,
                evaluation_window=timedelta(hours=80),
                sampling_interval=timedelta(hours=80),
            ),
            metrics=metrics,
        ),
    )


def test_timeseries_all_granularity() -> None:
    expected = pd.read_csv(
        StringIO(
            """
            2023-01-28 11:26:50,653.3333333333334,9,[45. 54. 63. 72. 81.],[5. 6. 7. 8. 9.1]
            """
        ),
        names=["ts"] + names,
        parse_dates=["ts"],
        date_parser=pd.to_datetime,
        index_col="ts",
    )
    expected["VectorSum(v)"] = expected["VectorSum(v)"].apply(txt2arr)
    expected["VectorMean(v)"] = expected["VectorMean(v)"].apply(txt2arr)
    compare(
        expected,
        data.pipe(
            timeseries(
                start_time=start,
                end_time=end,
                evaluation_window=end - start,
                sampling_interval=end - start,
            ),
            metrics=metrics,
        ),
    )


def test_timeseries_empty_result() -> None:
    compare(
        pd.DataFrame(),
        data.pipe(
            timeseries(
                start_time=end,
                end_time=start,
                evaluation_window=end - start,
                sampling_interval=end - start,
            ),
            metrics=metrics,
        ),
    )


def compare(expected: pd.DataFrame, actual: pd.DataFrame) -> None:
    assert len(expected) >= len(actual)
    for timestamp, row in expected.iterrows():
        try:
            result = actual.iloc[cast(int, actual.index.get_loc(timestamp)), :].to_dict()
        except KeyError:
            result = {}
        assert row.equals(
            pd.Series({name: metric.get_value(result) for name, metric in zip(names, metrics)})
        )

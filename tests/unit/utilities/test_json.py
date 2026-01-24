from datetime import datetime, timezone

import numpy as np
import pandas as pd
from pandas.testing import assert_frame_equal

from phoenix.utilities.json import decode_df_from_json_string, encode_df_as_json_string


class TestDataFrameJSONRoundtrip:
    def test_roundtrip(self) -> None:
        t = datetime.now(timezone.utc)
        keys = [("한", 3, t), (2, "\"\n'", t), ("\\n\r\n\r\n", 1, t)]
        data = [
            ([np.nan, {}], '{"1": {}}'),
            ({"2": [{}, []]}, {}),
            ([[{"3\r\n": []}, []]], None),
        ]
        index = pd.MultiIndex.from_tuples(keys, names=(None, "a", "index"))
        columns = ["a", "index"]
        df1 = pd.DataFrame(data, columns=columns, index=index)
        df2 = pd.DataFrame(data[::-1], columns=columns, index=index)
        df3 = pd.concat([df1, df2], axis=1)
        expected = pd.concat([df3, df3], axis=0)
        assert expected.size == 4 * df1.size
        assert len(expected.columns) == 2 * len(set(expected.columns))
        assert len(expected.index) == 2 * len(set(expected.index))
        payload = encode_df_as_json_string(expected)
        received = decode_df_from_json_string(payload)
        assert_frame_equal(received, expected)

    def test_can_handle_empty_dataframe(self) -> None:
        expected = pd.DataFrame()
        payload = encode_df_as_json_string(expected)
        received = decode_df_from_json_string(payload)
        assert_frame_equal(received, expected, check_column_type=False, check_index_type=False)

    def test_can_handle_dataframe_with_no_rows(self) -> None:
        expected = pd.DataFrame([], columns=["a"])
        payload = encode_df_as_json_string(expected)
        received = decode_df_from_json_string(payload)
        assert_frame_equal(received, expected, check_column_type=False, check_index_type=False)

    def test_can_handle_dataframe_with_no_rows_and_no_columns(
        self,
    ) -> None:
        expected = pd.DataFrame({"a": []}).set_index("a")
        payload = encode_df_as_json_string(expected)
        received = decode_df_from_json_string(payload)
        assert_frame_equal(received, expected, check_column_type=False, check_index_type=False)

    def test_can_handle_dataframe_with_no_columns(self) -> None:
        expected = pd.DataFrame({"a": [1]}).set_index("a")
        payload = encode_df_as_json_string(expected)
        received = decode_df_from_json_string(payload)
        assert_frame_equal(received, expected)

    def test_can_handle_dataframe_with_multi_index_and_no_columns(
        self,
    ) -> None:
        expected = pd.DataFrame({"a": [1], "b": [2]}).set_index(["a", "b"])
        payload = encode_df_as_json_string(expected)
        received = decode_df_from_json_string(payload)
        assert_frame_equal(received, expected)

    def test_can_handle_integer_strings(self) -> None:
        expected = pd.DataFrame({"a": ["01", "02", "03"]})
        payload = encode_df_as_json_string(expected)
        received = decode_df_from_json_string(payload)
        assert_frame_equal(received, expected)

    def test_can_handle_duplicated_column_names(self) -> None:
        df1 = pd.DataFrame({"a": [1, 2, 3.0]})
        df2 = pd.DataFrame({"a": [3.0, 2, 1]})
        expected = pd.concat([df1, df2], axis=1)
        assert expected.size == 2 * df1.size
        payload = encode_df_as_json_string(expected)
        received = decode_df_from_json_string(payload)
        assert_frame_equal(received, expected)

    def test_can_handle_non_ascii_characters(self) -> None:
        df = pd.DataFrame({"a": ["하나", "둘", "셋"]})
        payload = encode_df_as_json_string(df)
        received = decode_df_from_json_string(payload)
        assert_frame_equal(received, df)

    def test_can_handle_simple_mixed_types(self) -> None:
        expected = pd.DataFrame({"a": [1, "2", 3]}, index=["3", 2, "1"])
        payload = encode_df_as_json_string(expected)
        received = decode_df_from_json_string(payload)
        assert_frame_equal(received, expected)

    def test_can_handle_a_column_named_index(self) -> None:
        expected = pd.DataFrame({"index": [1, 2, 3]}, index=[3, 2, 1])
        payload = encode_df_as_json_string(expected)
        received = decode_df_from_json_string(payload)
        assert_frame_equal(received, expected)

    def test_can_handle_multi_index(self) -> None:
        keys = [(1, 3), (2, 2), (3, 1)]
        index = pd.MultiIndex.from_tuples(keys, names=(None, "a"))
        expected = pd.DataFrame({"b": [1, 2, 3], "c": [3, 2, 1]}, index=index)
        payload = encode_df_as_json_string(expected)
        received = decode_df_from_json_string(payload)
        assert_frame_equal(received, expected)

    def test_can_handle_index_with_the_same_names_as_columns(
        self,
    ) -> None:
        tuples = [(1, 3), (2, 2), (3, 1)]
        columns = ["a", "b"]
        index = pd.MultiIndex.from_tuples(tuples, names=columns)
        expected = pd.DataFrame(tuples, columns=columns, index=index)
        payload = encode_df_as_json_string(expected)
        received = decode_df_from_json_string(payload)
        assert_frame_equal(received, expected)

    def test_can_handle_complex_types(self) -> None:
        expected = pd.DataFrame(
            {
                "a": [
                    0,
                    [{}, [[1, {}, []], {"2\r": [None]}]],
                    [np.nan],
                    {"3\n": [{}, [{}]]},
                ]
            }
        )
        payload = encode_df_as_json_string(expected)
        received = decode_df_from_json_string(payload)
        assert_frame_equal(received, expected)

    def test_can_handle_datetime(self) -> None:
        t = datetime.now(timezone.utc)
        expected = pd.DataFrame({"t": [t]}, index=[t])
        payload = encode_df_as_json_string(expected)
        received = decode_df_from_json_string(payload)
        assert_frame_equal(received, expected)

    def test_can_handle_none(self) -> None:
        expected = pd.DataFrame({"a": [None]})
        payload = encode_df_as_json_string(expected)
        received = decode_df_from_json_string(payload)
        assert_frame_equal(received, expected)

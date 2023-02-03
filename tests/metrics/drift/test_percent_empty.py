from pandas import DataFrame
from numpy.testing import assert_array_almost_equal

from phoenix.metrics.percent_empty import percent_empty


def test_percent_empty_returns_correct_percents_including_for_empty_and_full_columns():
    dataframe = DataFrame(
        {
            'col0': [None, None, None],
            'col1': [1.0, None, None],
            'col2': ['string-entry', None, 'another-string-entry'],
            'col3': [0.1, 0.2, 0.3],
        }
    )
    expected_column_name_to_percent_empty = {
        'col0': 1.0,
        'col1': 2 / 3,
        'col2': 1 / 3,
        'col3': 0.0,
    }
    expected_column_names = ['col0', 'col1', 'col2', 'col3']
    column_name_to_percent_empty = percent_empty(dataframe)
    assert expected_column_names == sorted(column_name_to_percent_empty.keys())
    assert_array_almost_equal(
        [column_name_to_percent_empty[col] for col in expected_column_names],
        [expected_column_name_to_percent_empty[col] for col in expected_column_names],
    )


def test_percent_empty_for_dataframe_with_no_rows_returns_none():
    dataframe = DataFrame({"col0": [], "col1": []})
    column_name_to_percent_empty = percent_empty(dataframe)
    assert column_name_to_percent_empty is None

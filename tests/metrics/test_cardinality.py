"""
Test cardinality.
"""

import random
import string
from typing import Dict, Union

import numpy as np
import pandas as pd
import pytest
from pytest_lazyfixture import lazy_fixture

from phoenix.metrics.cardinality import cardinality


@pytest.fixture
def random_seed():
    random.seed(0)
    np.random.seed(0)


@pytest.fixture(params=[5, 10, 12])
def unique_strings(request, random_seed):
    num_words = request.param
    words = []
    max_word_length = 1
    for _ in range(num_words):
        word_length = random.randint(1, max_word_length)
        random_word = "".join(random.choice(string.ascii_letters) for _ in range(word_length))
        words.append(random_word)
        max_word_length += 1
    return words


@pytest.fixture(params=[1, 7, 15])
def unique_ints(request, random_seed):
    num_ints = request.param
    return np.random.choice(np.arange(30), num_ints, replace=False)


@pytest.fixture(params=[8, 13, 21])
def unique_ints_with_nan(request, random_seed):
    num_values = request.param
    values = list(np.random.choice(np.arange(30), num_values, replace=False))
    values[0] = float("nan")
    return pd.Categorical(values)


@pytest.fixture
def unique_ints_and_strings():
    return [123, "abc", "hello world", 34]


@pytest.mark.parametrize(
    "unique_values",
    [
        lazy_fixture("unique_ints"),
        lazy_fixture("unique_strings"),
        lazy_fixture("unique_ints_with_nan"),
        lazy_fixture("unique_ints_and_strings"),
    ],
    ids=[
        "all_integer_column",
        "all_string_column",
        "mixed_integer_and_nan_column",
        "mixed_integer_and_string_column",
    ],
)
def test_cardinality_produces_correct_counts_for_columns_of_various_data_types(
    unique_values, random_seed
):
    max_count = 30
    value_to_count = {value: random.randint(1, max_count) for value in unique_values}
    column, expected_cardinality = _get_data_column_and_expected_cardinality(value_to_count)
    expected_cardinality_data = {"feature0": expected_cardinality}
    input_df = pd.DataFrame.from_dict({"feature0": column})
    cardinality_data = cardinality(input_df, input_df.columns)
    assert cardinality_data == expected_cardinality_data


def test_cardinality_produces_correct_counts_for_dataframe_with_multiple_columns():
    first_column = pd.Series(["a", "b", "a", "a", "c"])
    second_column = pd.Series([1, 2, 3, 4, 5], dtype=np.int8)
    third_column = pd.Series([0, 0, 0, 0, 0], dtype=np.int8)  # omitted column
    input_df = pd.DataFrame.from_dict(
        {"feature0": first_column, "feature1": second_column, "feature2": third_column}
    )
    column_names = ["feature0", "feature1"]
    cardinality_data = cardinality(input_df, column_names)
    assert cardinality_data == {
        "feature0": 3,
        "feature1": 5,
    }


def _get_data_column_and_expected_cardinality(value_to_count: Dict[Union[str, float], int]):
    column = []
    for value, count in value_to_count.items():
        column.extend([value] * count)
    random.shuffle(column)
    column = pd.Series(column)
    expected_cardinality = len(value_to_count)
    return column, expected_cardinality

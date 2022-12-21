"""
Test cardinality.
"""

import random
import string

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
def unique_ints_with_nans(request, random_seed):
    num_values = request.param
    values = list(np.random.choice(np.arange(30), num_values, replace=False))
    values[0] = float("nan")
    return pd.Categorical(values)


@pytest.fixture
def unique_ints_and_strings():
    return [123, "abc", "hello world", 34]


@pytest.mark.parametrize(
    "unique_values, max_count",
    [
        (lazy_fixture("unique_ints"), 10),
        (lazy_fixture("unique_strings"), 15),
        (lazy_fixture("unique_ints_with_nans"), 20),
        (lazy_fixture("unique_ints_and_strings"), 25),
    ],
)
def test_cardinality_produces_correct_counts_for_columns_of_various_data_types(
    unique_values, max_count, random_seed
):
    value_to_count = {value: random.randint(1, max_count) for value in unique_values}
    column = []
    for value, count in value_to_count.items():
        column.extend([value] * count)
    random.shuffle(column)
    column = pd.Series(column)
    input_df = pd.DataFrame.from_dict({"feature0": column})
    output_df = cardinality(input_df)
    expected_column_values, expected_counts = zip(*value_to_count.items())
    expected_df = pd.DataFrame(
        expected_counts, index=expected_column_values, columns=input_df.columns
    )
    output_df = output_df.sort_index(key=lambda x: x.astype("str"))
    expected_df = expected_df.sort_index(key=lambda x: x.astype("str"))
    assert expected_df.equals(output_df)

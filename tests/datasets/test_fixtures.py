import pandas as pd
from phoenix.datasets import Dataset
from phoenix.datasets.fixtures import DatasetDict
from phoenix.datasets.schema import Schema


def test_datasetdict_repr_happy_path() -> None:
    datasets = DatasetDict(
        primary=Dataset(
            dataframe=pd.DataFrame({"A": [1, 2], "B": [3, 4]}),
            schema=Schema(),
            name="primary",
            persist_to_disc=False,
        ),
        reference=Dataset(
            dataframe=pd.DataFrame({"A": [5, 6], "B": [7, 8]}),
            schema=Schema(),
            name="reference",
            persist_to_disc=False,
        ),
    )
    expected_repr = """DatasetDict(
    primary: Dataset(name: 'primary'),
    reference: Dataset(name: 'reference'),
)"""
    assert repr(datasets) == expected_repr

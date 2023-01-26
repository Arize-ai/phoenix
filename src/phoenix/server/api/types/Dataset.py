from datetime import datetime

import strawberry

from phoenix.datasets import Dataset as InternalDataset


@strawberry.type
class Dataset:
    name: str
    start_time: datetime
    end_time: datetime


def to_gql_dataset(dataset: InternalDataset) -> Dataset:
    """
    Converts a phoenix.datasets.Dataset to a phoenix.server.api.types.Dataset
    """
    return Dataset(
        name=dataset.name,
        start_time=dataset.start_time,
        end_time=dataset.end_time,
    )

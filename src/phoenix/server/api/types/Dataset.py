from datetime import datetime
from src.phoenix.datasets import Dataset as PhoenixDataset
import strawberry


@strawberry.type
class Dataset:
    name: str
    start_time: datetime
    end_time: datetime


def to_gql_dataset(dataset: PhoenixDataset) -> Dataset:
    """
    Converts a phoenix.datasets.Dataset to a phoenix.server.api.types.Dataset
    """
    return Dataset(
        name=dataset.name,
        start_time=dataset.start_time,
        end_time=dataset.end_time,
    )

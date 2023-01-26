from datetime import datetime
from src.phoenix.datasets import Dataset as CoreDataset
import strawberry


@strawberry.type
class Dataset:
    name: str
    start_time: datetime
    end_time: datetime


def to_gql_dataset(dataset: CoreDataset) -> Dataset:
    """
    Converts a phoenix.core.Dimension to a phoenix.server.api.types.Dimension
    """
    return Dataset(
        name=dataset.name,
        start_time=dataset.start_time,
        end_time=dataset.end_time,
    )

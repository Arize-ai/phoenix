from datetime import datetime
from typing import List, Optional

import strawberry
from strawberry.scalars import ID

from phoenix.datasets import Dataset as InternalDataset
from phoenix.server.api.input_types.DimensionInput import DimensionInput

from .Event import Event


@strawberry.type
class Dataset:
    name: str
    start_time: datetime
    end_time: datetime

    @strawberry.field
    def events(
        self,
        event_ids: List[ID],
        dimensions: Optional[List[DimensionInput]],
    ) -> List[Event]:
        # TODO implement
        raise NotImplementedError("To be implemented")


def to_gql_dataset(dataset: InternalDataset) -> Dataset:
    """
    Converts a phoenix.datasets.Dataset to a phoenix.server.api.types.Dataset
    """
    return Dataset(
        name=dataset.name,
        start_time=dataset.start_time,
        end_time=dataset.end_time,
    )

from typing import Optional

import strawberry
from strawberry import UNSET

from .DataSampler import DataSampler
from .TimeRange import TimeRange


@strawberry.input
class DataSelector:
    time_range: Optional[TimeRange] = UNSET
    data_sampler: Optional[DataSampler] = UNSET

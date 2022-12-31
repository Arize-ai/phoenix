from dataclasses import dataclass

from .dimension_data_type import DimensionDataType
from .dimension_type import DimensionType


@dataclass
class Dimension:
    name: str
    data_type: DimensionDataType
    type: DimensionType

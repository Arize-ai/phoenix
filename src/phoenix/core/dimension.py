#                  Copyright 2023 Arize AI and contributors.
#                   Licensed under the Elastic License 2.0;
# you may not use this file except in compliance with the Elastic License 2.0.

from dataclasses import dataclass

from .dimension_data_type import DimensionDataType
from .dimension_type import DimensionType


@dataclass
class Dimension:
    name: str
    data_type: DimensionDataType
    type: DimensionType

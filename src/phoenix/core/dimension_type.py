#                    Copyright 2023 Arize AI and contributors.
#                     Licensed under the Elastic License 2.0;
#   you may not use this file except in compliance with the Elastic License 2.0.

from enum import Enum


class DimensionType(Enum):
    PREDICTION = "prediction"
    ACTUAL = "actual"
    FEATURE = "feature"
    TAG = "tag"
    EMBEDDING = "embedding"

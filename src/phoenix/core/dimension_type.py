from enum import Enum


class DimensionType(Enum):
    PREDICTION = "PREDICTION"
    ACTUAL = "ACTUAL"
    FEATURE = "FEATURE"
    TAG = "TAG"
    EMBEDDING = "EMBEDDING"

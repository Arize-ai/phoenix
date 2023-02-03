from enum import Enum


class DimensionType(Enum):
    PREDICTION = "prediction"
    ACTUAL = "actual"
    FEATURE = "feature"
    TAG = "tag"
    EMBEDDING = "embedding"

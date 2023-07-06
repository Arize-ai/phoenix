from enum import IntEnum, auto


class DataType(IntEnum):
    UNKNOWN = auto()
    DISCRETE = auto()  # usually names, e.g. California, or Monday.
    CONTINUOUS = auto()  # usually amounts, e.g. 5 bucks, or 6.7 miles.


UNKNOWN = DataType.UNKNOWN
DISCRETE = DataType.DISCRETE
CONTINUOUS = DataType.CONTINUOUS

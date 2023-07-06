from enum import Enum, auto


class DatasetRole(Enum):
    """A dataframe's role in a Model: primary or reference (as
    baseline for drift).
    """

    PRIMARY = auto()
    REFERENCE = auto()


PRIMARY = DatasetRole.PRIMARY
REFERENCE = DatasetRole.REFERENCE

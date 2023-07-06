from enum import auto, unique

from phoenix.core.dimension_role import DimensionRole
from phoenix.core.singular_dimensional_role import SingularDimensionalRole


@unique
class MultiDimensionalRole(DimensionRole):
    # It's important to keep the numeric values disjoint among all subclass
    # enums (hence the +1 here), because we'll use `groupby(sorted(...))` to
    # collate the dimensions. The (integer) ordering here is also important
    # in that it'll be used as tie-breaker when e.g. the user assigns a
    # column to both feature and tag, in which case the role with a lower
    # integer value will prevail.
    FEATURE = 1 + max(SingularDimensionalRole)
    TAG = auto()


FEATURE = MultiDimensionalRole.FEATURE
TAG = MultiDimensionalRole.TAG

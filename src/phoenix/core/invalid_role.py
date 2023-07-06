from enum import auto, unique

from phoenix.core.dimension_role import DimensionRole


@unique
class InvalidRole(DimensionRole):
    UNASSIGNED = auto()

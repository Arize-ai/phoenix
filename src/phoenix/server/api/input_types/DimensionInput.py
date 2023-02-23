import strawberry

from phoenix.server.api.types.DimensionType import DimensionType


@strawberry.input
class DimensionInput:
    name: str
    type: DimensionType

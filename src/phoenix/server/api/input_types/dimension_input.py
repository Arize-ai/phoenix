import strawberry

from phoenix.server.api.types.dimension_data_type import DimensionType


@strawberry.input
class DimensionInput:
    name: str
    type: DimensionType

from typing import Optional

import strawberry
from strawberry.types import Info

from phoenix.server.api.context import Context


@strawberry.type
class DimensionDataQuality:
    dimension_name: strawberry.Private[str]

    @strawberry.field
    async def cardinality(self, info: Info[Context, None]) -> Optional[int]:
        return await info.context.loaders.cardinality.load(self.dimension_name)

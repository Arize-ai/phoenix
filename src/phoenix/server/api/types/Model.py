import base64
from typing import Optional

import strawberry
from strawberry.arguments import UNSET
from strawberry.types import Info

from phoenix.server.api.context import Context

from .Dimension import Dimension
from .DimensionDataType import DimensionDataType
from .pagination import Connection, Cursor, Edge, PageInfo


def build_dimension_cursor(dimension: Dimension) -> str:
    """
    Adapt this method to build an *opaque* ID from an instance
    """
    dimension_id = f"{id(dimension)}".encode("utf-8")
    return base64.b64encode(dimension_id).decode()


def parse_dimension_cursor(cursor: Cursor) -> int:
    """
    Adapt this method to parse an *opaque* ID into an instance
    """
    dimension_id = int(base64.b64decode(cursor).decode())
    print(f"parse_dimension_cursor: {dimension_id}")
    return dimension_id


@strawberry.type
class Model:
    @strawberry.field
    def dimensions(
        self, info: Info[Context, None], first: int = 10, after: Optional[Cursor] = UNSET
    ) -> Connection[Dimension]:
        """
        A non-trivial implementation should efficiently fetch only
        the necessary books after the offset.
        For simplicity, here we build the list and then slice it accordingly
        """
        dimensions = [
            Dimension(
                id_attr=index,
                name=dimension.name,
                dataType=DimensionDataType[dimension.data_type.value],
            )
            for index, dimension in enumerate(info.context.model.dimensions)
        ]

        after_id = None
        if isinstance(after, Cursor):
            after_id = parse_dimension_cursor(after)

        # Fetch the requested dimensions plus one, just to calculate `has_next_page`
        dimensions[after_id : first + 1]

        edges = [
            Edge(node=dimension, cursor=build_dimension_cursor(dimension))
            for dimension in dimensions
        ]

        return Connection(
            page_info=PageInfo(
                has_previous_page=False,
                has_next_page=len(dimensions) > first,
                start_cursor=edges[0].cursor if edges else None,
                end_cursor=edges[-2].cursor if len(edges) > 1 else None,
            ),
            edges=edges[:-1],  # exclude last one as it was fetched to know if there is a next page
        )

import base64
from typing import Any, Optional

import strawberry
from strawberry.arguments import UNSET
from strawberry.types import Info

from .context import Context
from .Dimension import Dimension
from .DimensionDataType import DimensionDataType
from .DimensionType import DimensionType
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
        self, info: Info[Context, Any], first: int = 10, after: Optional[Cursor] = UNSET
    ) -> Connection[Dimension]:
        """
        A non-trivial implementation should efficiently fetch only
        the necessary books after the offset.
        For simplicity, here we build the list and then slice it accordingly
        """

        dimensions = [
            Dimension(
                name=dim.name,
                data_type=DimensionDataType[dim.data_type.value],
                type=DimensionType[dim.type.value],
            )
            for dim in info.context.model.dimensions
        ]

        # after_id = None
        # if isinstance(after, Cursor):
        #     after_id = parse_dimension_cursor(after)

        # Fetch the requested dimensions plus one, just to calculate `has_next_page`
        # dimensions[0 : first + 1]

        print(f"num dimensions: {len(dimensions)}")

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
            edges=edges,
        )

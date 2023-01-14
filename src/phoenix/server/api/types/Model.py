from typing import Optional

import strawberry
from strawberry.arguments import UNSET
from strawberry.types import Info

from phoenix.server.api.context import Context

from .Dimension import Dimension, to_gql_dimension
from .pagination import Connection, ConnectionArgs, Cursor, connection_from_list


@strawberry.type
class Model:
    @strawberry.field
    def dimensions(
        self,
        info: Info[Context, None],
        first: Optional[int] = 50,
        last: Optional[int] = None,
        after: Optional[Cursor] = UNSET,
        before: Optional[Cursor] = UNSET,
    ) -> Connection[Dimension]:
        """
        A non-trivial implementation should efficiently fetch only
        the necessary books after the offset.
        For simplicity, here we build the list and then slice it accordingly
        """
        print("resolving")
        return connection_from_list(
            [
                to_gql_dimension(index, dimension)
                for index, dimension in enumerate(info.context.model.dimensions)
            ],
            args=ConnectionArgs(
                first=first,
                after=after if isinstance(after, Cursor) else None,
                last=last,
                before=before if isinstance(before, Cursor) else None,
            ),
        )

    # dimensions_with_offset = [
    #     (to_gql_dimension(index, dimension), index + 1)
    #     for index, dimension in enumerate(info.context.model.dimensions)
    # ]

    # offset = 0
    # if isinstance(after, Cursor):
    #     offset = cursor_to_offset(after)

    # # Fetch the requested dimensions plus one, just to calculate `has_next_page`
    # dimensions_with_offset = dimensions_with_offset[offset : offset + first + 1]

    # edges = [
    #     Edge(node=dim_with_offset[0], cursor=offset_to_cursor(dim_with_offset[1]))
    #     for index, dim_with_offset in enumerate(dimensions_with_offset)
    # ]

    # return Connection(
    #     page_info=PageInfo(
    #         has_previous_page=False,
    #         has_next_page=len(dimensions_with_offset) > first,
    #         start_cursor=edges[0].cursor if edges else None,
    #         end_cursor=edges[-2].cursor if len(edges) > 1 else None,
    #     ),
    #     edges=edges[:-1],  # exclude last one as it was fetched to know if there is a next page
    # )

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

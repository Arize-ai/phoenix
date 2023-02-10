from typing import Optional

import strawberry
from strawberry.arguments import UNSET
from strawberry.types import Info

from phoenix.server.api.context import Context

from .Dataset import Dataset, to_gql_dataset
from .Dimension import Dimension, to_gql_dimension
from .EmbeddingDimension import EmbeddingDimension, to_gql_embedding_dimension
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

    @strawberry.field
    def primary_dataset(self, info: Info[Context, None]) -> Dataset:
        return to_gql_dataset(info.context.model.primary_dataset)

    @strawberry.field
    def reference_dataset(self, info: Info[Context, None]) -> Optional[Dataset]:
        if info.context.model.reference_dataset is None:
            return None
        return to_gql_dataset(info.context.model.reference_dataset)

    @strawberry.field
    def embedding_dimensions(
        self,
        info: Info[Context, None],
        first: Optional[int] = 50,
        last: Optional[int] = None,
        after: Optional[Cursor] = UNSET,
        before: Optional[Cursor] = UNSET,
    ) -> Connection[EmbeddingDimension]:
        """
        A non-trivial implementation should efficiently fetch only
        the necessary books after the offset.
        For simplicity, here we build the list and then slice it accordingly
        """
        return connection_from_list(
            [
                to_gql_embedding_dimension(index, embedding_dimension)
                for index, embedding_dimension in enumerate(info.context.model.embedding_dimensions)
            ],
            args=ConnectionArgs(
                first=first,
                after=after if isinstance(after, Cursor) else None,
                last=last,
                before=before if isinstance(before, Cursor) else None,
            ),
        )

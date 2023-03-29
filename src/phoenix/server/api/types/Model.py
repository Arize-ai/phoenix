import asyncio
from typing import List, Optional

import strawberry
from strawberry.types import Info
from strawberry.unset import UNSET

from phoenix.config import EXPORT_DIR, get_exported_files
from phoenix.server.api.context import Context

from .Dataset import Dataset, to_gql_dataset
from .Dimension import Dimension, to_gql_dimension
from .EmbeddingDimension import EmbeddingDimension, to_gql_embedding_dimension
from .ExportedFile import ExportedFile
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
        return to_gql_dataset(
            dataset=info.context.model.primary_dataset,
            type="primary",
        )

    @strawberry.field
    def reference_dataset(self, info: Info[Context, None]) -> Optional[Dataset]:
        if info.context.model.reference_dataset is None:
            return None
        return to_gql_dataset(
            dataset=info.context.model.reference_dataset,
            type="reference",
        )

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
                for index, embedding_dimension in enumerate(
                    info.context.model.embedding_dimensions,
                )
            ],
            args=ConnectionArgs(
                first=first,
                after=after if isinstance(after, Cursor) else None,
                last=last,
                before=before if isinstance(before, Cursor) else None,
            ),
        )

    @strawberry.field(
        description=(
            "Returns n most recent exported Parquet files sorted by descending modification time."
        ),
    )  # type: ignore  # https://github.com/strawberry-graphql/strawberry/issues/1929
    async def exported_files(
        self,
        n_latest: int = 5,
    ) -> List[ExportedFile]:
        loop = asyncio.get_running_loop()
        return [
            ExportedFile(
                file_name=path.stem,
                directory=str(EXPORT_DIR),
            )
            for path in await loop.run_in_executor(
                None,
                get_exported_files,
                n_latest,
            )
        ]

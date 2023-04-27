import asyncio
from typing import List, Optional

import strawberry
from strawberry.types import Info
from strawberry.unset import UNSET

from phoenix.config import get_exported_files
from phoenix.core.model_schema import PRIMARY, REFERENCE
from phoenix.server.api.context import Context

from .Dataset import Dataset
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
        model = info.context.model
        return connection_from_list(
            [
                to_gql_dimension(index, dimension)
                for index, dimension in enumerate(model.scalar_dimensions)
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
        dataset = info.context.model[PRIMARY]
        start, end = dataset.time_range
        return Dataset(
            start_time=start,
            end_time=end,
            dataset=dataset,
        )

    @strawberry.field
    def reference_dataset(self, info: Info[Context, None]) -> Optional[Dataset]:
        if (dataset := info.context.model[REFERENCE]).empty:
            return None
        start, end = dataset.time_range
        return Dataset(
            start_time=start,
            end_time=end,
            dataset=dataset,
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
        model = info.context.model
        return connection_from_list(
            [
                to_gql_embedding_dimension(index, embedding_dimension)
                for index, embedding_dimension in enumerate(
                    model.embedding_dimensions,
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
        description="Returns exported file names sorted by descending modification time.",
    )  # type: ignore  # https://github.com/strawberry-graphql/strawberry/issues/1929
    async def exported_files(
        self,
        info: Info[Context, None],
    ) -> List[ExportedFile]:
        loop = asyncio.get_running_loop()
        return [
            ExportedFile(file_name=path.stem)
            for path in sorted(
                await loop.run_in_executor(
                    None,
                    get_exported_files,
                    info.context.export_path,
                ),
                key=lambda p: p.stat().st_mtime,
                reverse=True,
            )
        ]

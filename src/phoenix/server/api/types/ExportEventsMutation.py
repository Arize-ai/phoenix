import asyncio
from datetime import datetime
from typing import List, Optional

import strawberry
from strawberry import ID, UNSET
from strawberry.types import Info

from phoenix.server.api.context import Context
from phoenix.server.api.types.Event import parse_event_ids
from phoenix.server.api.types.ExportedFile import ExportedFile


@strawberry.type
class ExportEventsMutation:
    @strawberry.mutation(
        description=(
            "Given a list of event ids, export the corresponding data subset in Parquet format."
            " File name is optional, but if specified, should be without file extension. By default"
            " the exported file name is current timestamp."
        ),
    )  # type: ignore  # https://github.com/strawberry-graphql/strawberry/issues/1929
    async def export_events(
        self,
        info: Info[Context, None],
        event_ids: List[ID],
        file_name: Optional[str] = UNSET,
    ) -> ExportedFile:
        if not isinstance(file_name, str):
            file_name = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
        row_ids = parse_event_ids(event_ids)
        path = info.context.export_path
        with open(path / (file_name + ".parquet"), "wb") as fd:
            loop = asyncio.get_running_loop()
            await loop.run_in_executor(
                None,
                info.context.model.export_rows_as_parquet_file,
                row_ids,
                fd,
            )
        return ExportedFile(file_name=file_name)

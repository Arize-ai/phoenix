import asyncio
from datetime import datetime
from typing import List, Optional

import strawberry
from strawberry import ID
from strawberry.types import Info

from phoenix.config import EXPORT_DIR
from phoenix.server.api.context import Context
from phoenix.server.api.types.Event import parse_event_ids


@strawberry.type
class ExportResponse:
    file_name: str
    directory: str


@strawberry.type
class ExportEventsMutation:
    @strawberry.mutation
    async def export_events(
        self,
        info: Info[Context, None],
        event_ids: List[ID],
        file_name: Optional[str] = None,
    ) -> ExportResponse:
        if file_name is None:
            file_name = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
        row_ids = parse_event_ids(event_ids)
        with open(EXPORT_DIR / (file_name + ".parquet"), "wb") as fd:
            loop = asyncio.get_running_loop()
            await loop.run_in_executor(
                None,
                info.context.model.export_events_as_parquet_file,
                row_ids,
                fd,
            )
        return ExportResponse(
            file_name=file_name,
            directory=str(EXPORT_DIR),
        )

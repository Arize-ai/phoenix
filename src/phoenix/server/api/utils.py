from typing import Optional

from phoenix.server.cleanup.lifecycle import delete_standalone_traces_by_trace_id
from phoenix.server.cleanup.primitives import CLEANUP_BATCH_ROWS
from phoenix.server.dml_event import DmlEvent
from phoenix.server.types import CanPutItem, DbSessionFactory


async def delete_traces(
    db: DbSessionFactory,
    *trace_ids: str,
    event_queue: Optional[CanPutItem[DmlEvent]] = None,
    batch_limit: int = CLEANUP_BATCH_ROWS,
) -> set[int]:
    return await delete_standalone_traces_by_trace_id(
        db,
        trace_ids,
        event_queue=event_queue,
        batch_limit=batch_limit,
    )

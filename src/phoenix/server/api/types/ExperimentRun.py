from datetime import datetime
from typing import Optional

import strawberry
from strawberry.relay import GlobalID, Node, NodeID
from strawberry.scalars import JSON


@strawberry.type
class ExperimentRun(Node):
    id_attr: NodeID[int]
    trace_id: GlobalID
    output: Optional[JSON]
    start_time: datetime
    end_time: datetime
    error: Optional[str]

from datetime import datetime
from typing import Optional

import strawberry
from strawberry.relay import Node, NodeID
from strawberry.scalars import JSON

from phoenix.db import models


@strawberry.type
class ExperimentRun(Node):
    id_attr: NodeID[int]
    trace_id: Optional[str]
    output: Optional[JSON]
    start_time: datetime
    end_time: datetime
    error: Optional[str]


def to_gql_experiment_run(run: models.ExperimentRun) -> ExperimentRun:
    """
    Converts an ORM experiment run to a GraphQL ExperimentRun.
    """
    return ExperimentRun(
        id_attr=run.id,
        trace_id=trace_id
        if (trace := run.trace) and (trace_id := trace.trace_id) is not None
        else None,
        output=run.output,
        start_time=run.start_time,
        end_time=run.end_time,
        error=run.error,
    )

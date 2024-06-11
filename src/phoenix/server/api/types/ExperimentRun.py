from datetime import datetime
from typing import Optional

import strawberry
from strawberry.relay import GlobalID, Node, NodeID
from strawberry.scalars import JSON

from phoenix.db import models


@strawberry.type
class ExperimentRun(Node):
    id_attr: NodeID[int]
    trace_id: Optional[GlobalID]
    output: Optional[JSON]
    start_time: datetime
    end_time: datetime
    error: Optional[str]


def to_gql_experiment_run(run: models.ExperimentRun) -> ExperimentRun:
    # return ExperimentRun(
    #     id_attr=run.id,
    #     trace_id=run.trace.id,
    #     output=run.output,
    #     start_time=run.start_time,
    #     end_time=run.end_time,
    #     error=run.error,
    # )
    raise NotImplementedError("to_gql_experiment_run resolver not implemented")

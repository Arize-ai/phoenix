from enum import Enum
from typing import Any

import strawberry
from sqlalchemy.orm import InstrumentedAttribute
from typing_extensions import assert_never

from phoenix.db import models
from phoenix.server.api.types.SortDir import SortDir


@strawberry.enum
class ExperimentColumn(Enum):
    # `sequenceNumber` is the 1-based, per-dataset ordinal (oldest = 1). It is
    # monotonic in the experiment's row id, so ordering by id reproduces it.
    sequenceNumber = "id"
    createdAt = "created_at"

    @property
    def orm_expression(self) -> InstrumentedAttribute[Any]:
        """The ORM column this sort key orders by."""
        if self is ExperimentColumn.sequenceNumber:
            return models.Experiment.id
        if self is ExperimentColumn.createdAt:
            return models.Experiment.created_at
        assert_never(self)


@strawberry.input(description="The sort key and direction for experiment connections")
class ExperimentSort:
    col: ExperimentColumn
    dir: SortDir

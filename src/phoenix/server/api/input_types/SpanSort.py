from enum import Enum

import strawberry
<<<<<<< HEAD
from pandas import DataFrame
=======
>>>>>>> 4d4b555 (add span sort direction)

from phoenix.server.api.types.SortDir import SortDir


@strawberry.enum
class SpanColumn(Enum):
<<<<<<< HEAD
    startTime = "start_time"
=======
    startTime = "startTime"
>>>>>>> 4d4b555 (add span sort direction)


@strawberry.input
class SpanSort:
    """
    The sort column and direction for span connections
    """

    col: SpanColumn
    dir: SortDir
<<<<<<< HEAD

    def apply(self, spans: DataFrame) -> DataFrame:
        """
        Sorts the spans by the given column and direction
        """
        return spans.sort_values(
            by=self.col.value,
            ascending=self.dir.value == SortDir.asc.value,
        )
=======
>>>>>>> 4d4b555 (add span sort direction)

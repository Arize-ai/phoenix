from enum import Enum

import strawberry
from pandas import DataFrame

from phoenix.server.api.types.SortDir import SortDir
from phoenix.trace.semantic_conventions import (
    LLM_TOKEN_COUNT_COMPLETION,
    LLM_TOKEN_COUNT_PROMPT,
    LLM_TOKEN_COUNT_TOTAL,
)


@strawberry.enum
class SpanColumn(Enum):
    startTime = "start_time"
    endTime = "end_time"
    latencyMs = "latency_ms"
    tokenCountTotal = "attributes." + LLM_TOKEN_COUNT_TOTAL
    tokenCountPrompt = "attributes." + LLM_TOKEN_COUNT_PROMPT
    tokenCountCompletion = "attributes." + LLM_TOKEN_COUNT_COMPLETION


@strawberry.input
class SpanSort:
    """
    The sort column and direction for span connections
    """

    col: SpanColumn
    dir: SortDir

    def apply(self, spans: DataFrame) -> DataFrame:
        """
        Sorts the spans by the given column and direction
        """
        return spans.sort_values(
            by=self.col.value,
            ascending=self.dir.value == SortDir.asc.value,
        )

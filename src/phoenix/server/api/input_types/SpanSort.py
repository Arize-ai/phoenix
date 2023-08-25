from enum import Enum

import strawberry
from pandas import DataFrame

from phoenix.core.traces import (
    CUMULATIVE_LLM_TOKEN_COUNT_COMPLETION,
    CUMULATIVE_LLM_TOKEN_COUNT_PROMPT,
    CUMULATIVE_LLM_TOKEN_COUNT_TOTAL,
    END_TIME,
    LATENCY_MS,
    LLM_TOKEN_COUNT_COMPLETION,
    LLM_TOKEN_COUNT_PROMPT,
    LLM_TOKEN_COUNT_TOTAL,
    START_TIME,
)
from phoenix.server.api.types.SortDir import SortDir


@strawberry.enum
class SpanColumn(Enum):
    startTime = START_TIME
    endTime = END_TIME
    latencyMs = LATENCY_MS
    tokenCountTotal = LLM_TOKEN_COUNT_TOTAL
    tokenCountPrompt = LLM_TOKEN_COUNT_PROMPT
    tokenCountCompletion = LLM_TOKEN_COUNT_COMPLETION
    cumulativeTokenCountTotal = CUMULATIVE_LLM_TOKEN_COUNT_TOTAL
    cumulativeTokenCountPrompt = CUMULATIVE_LLM_TOKEN_COUNT_PROMPT
    cumulativeTokenCountCompletion = CUMULATIVE_LLM_TOKEN_COUNT_COMPLETION


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

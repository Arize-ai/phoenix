from enum import Enum
from functools import partial
from typing import Any, Iterable, Iterator

import pandas as pd
import strawberry

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
from phoenix.trace.schemas import Span


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

    def __call__(self, spans: Iterable[Span]) -> Iterator[Span]:
        """
        Sorts the spans by the given column and direction
        """
        yield from pd.Series(spans, dtype=object).sort_values(
            key=lambda series: series.apply(partial(_get_column, span_column=self.col)),
            ascending=self.dir.value == SortDir.asc.value,
        )


def _get_column(span: Span, span_column: SpanColumn) -> Any:
    if span_column == SpanColumn.startTime:
        return span.start_time
    if span_column == SpanColumn.endTime:
        return span.end_time
    else:
        span.attributes.get(span_column.value)

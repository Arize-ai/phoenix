from enum import Enum
from functools import partial
from typing import Any, Iterable, Iterator

import pandas as pd
import strawberry

from phoenix.core.traces import (
    END_TIME,
    LLM_TOKEN_COUNT_COMPLETION,
    LLM_TOKEN_COUNT_PROMPT,
    LLM_TOKEN_COUNT_TOTAL,
    START_TIME,
    ComputedAttributes,
)
from phoenix.server.api.types.SortDir import SortDir
from phoenix.trace.schemas import Span


@strawberry.enum
class SpanColumn(Enum):
    startTime = START_TIME
    endTime = END_TIME
    latencyMs = ComputedAttributes.LATENCY_MS.value
    tokenCountTotal = LLM_TOKEN_COUNT_TOTAL
    tokenCountPrompt = LLM_TOKEN_COUNT_PROMPT
    tokenCountCompletion = LLM_TOKEN_COUNT_COMPLETION
    cumulativeTokenCountTotal = ComputedAttributes.CUMULATIVE_LLM_TOKEN_COUNT_TOTAL.value
    cumulativeTokenCountPrompt = ComputedAttributes.CUMULATIVE_LLM_TOKEN_COUNT_PROMPT.value
    cumulativeTokenCountCompletion = ComputedAttributes.CUMULATIVE_LLM_TOKEN_COUNT_COMPLETION.value


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
    if span_column is SpanColumn.startTime:
        return span.start_time
    if span_column is SpanColumn.endTime:
        return span.end_time
    return span.attributes.get(span_column.value)

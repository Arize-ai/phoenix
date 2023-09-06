from enum import Enum
from functools import partial
from operator import attrgetter
from typing import Any, Iterable, Iterator

import pandas as pd
import strawberry

from phoenix.core.traces import (
    CUMULATIVE_LLM_TOKEN_COUNT_COMPLETION,
    CUMULATIVE_LLM_TOKEN_COUNT_PROMPT,
    CUMULATIVE_LLM_TOKEN_COUNT_TOTAL,
    LATENCY_MS,
)
from phoenix.server.api.types.SortDir import SortDir
from phoenix.trace.schemas import Span
from phoenix.trace.semantic_conventions import (
    LLM_TOKEN_COUNT_COMPLETION,
    LLM_TOKEN_COUNT_PROMPT,
    LLM_TOKEN_COUNT_TOTAL,
)


def _get_attribute_value(span: Span, key: str) -> Any:
    return span.attributes.get(key)


@strawberry.enum
class SpanColumn(Enum):
    startTime = attrgetter("start_time")
    endTime = attrgetter("end_time")
    latencyMs = partial(
        _get_attribute_value,
        key=LATENCY_MS,
    )
    tokenCountTotal = partial(
        _get_attribute_value,
        key=LLM_TOKEN_COUNT_TOTAL,
    )
    tokenCountPrompt = partial(
        _get_attribute_value,
        key=LLM_TOKEN_COUNT_PROMPT,
    )
    tokenCountCompletion = partial(
        _get_attribute_value,
        key=LLM_TOKEN_COUNT_COMPLETION,
    )
    cumulativeTokenCountTotal = partial(
        _get_attribute_value,
        key=CUMULATIVE_LLM_TOKEN_COUNT_TOTAL,
    )
    cumulativeTokenCountPrompt = partial(
        _get_attribute_value,
        key=CUMULATIVE_LLM_TOKEN_COUNT_PROMPT,
    )
    cumulativeTokenCountCompletion = partial(
        _get_attribute_value,
        key=CUMULATIVE_LLM_TOKEN_COUNT_COMPLETION,
    )


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
            key=lambda s: s.apply(self.col.value),
            ascending=self.dir.value == SortDir.asc.value,
        )

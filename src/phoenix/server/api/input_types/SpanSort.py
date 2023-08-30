from enum import Enum
from typing import Any, Iterable, List, SupportsFloat, Union

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
    ReadableSpan,
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


class _MissingValue:
    def __lt__(
        self,
        other: Union[str, SupportsFloat],
    ) -> bool:
        return False

    def __repr__(self) -> str:
        return "None"


_MISSING_VALUE = _MissingValue()


@strawberry.input
class SpanSort:
    """
    The sort column and direction for span connections
    """

    col: SpanColumn
    dir: SortDir

    def __call__(
        self,
        spans: Iterable[ReadableSpan],
    ) -> List[ReadableSpan]:
        """
        Sorts the spans by the given column and direction
        """

        def key(span: ReadableSpan) -> Any:
            if value := span[self.col.value] is None:
                return _MISSING_VALUE
            return value

        return sorted(
            spans,
            key=key,
            reverse=self.dir.value == SortDir.desc.value,
        )

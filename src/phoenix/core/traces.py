import math
from collections import defaultdict
from typing import Any, Iterable, Tuple, cast

import numpy as np
import pandas as pd

import phoenix.trace.semantic_conventions as sc
from phoenix.trace.schemas import ATTRIBUTE_PREFIX, SpanID

NAME = "name"
STATUS_CODE = "status_code"
SPAN_KIND = "span_kind"
TRACE_ID = "context.trace_id"
SPAN_ID = "context.span_id"
PARENT_ID = "parent_id"
START_TIME = "start_time"
END_TIME = "end_time"
LATENCY_MS = "__computed__latency_ms"
"The latency (or duration) of the span in milliseconds"
LLM_TOKEN_COUNT_TOTAL = ATTRIBUTE_PREFIX + sc.LLM_TOKEN_COUNT_TOTAL
LLM_TOKEN_COUNT_PROMPT = ATTRIBUTE_PREFIX + sc.LLM_TOKEN_COUNT_PROMPT
LLM_TOKEN_COUNT_COMPLETION = ATTRIBUTE_PREFIX + sc.LLM_TOKEN_COUNT_COMPLETION
CUMULATIVE_LLM_TOKEN_COUNT_TOTAL = "__computed__cumulative_token_count_total"
CUMULATIVE_LLM_TOKEN_COUNT_PROMPT = "__computed__cumulative_token_count_prompt"
CUMULATIVE_LLM_TOKEN_COUNT_COMPLETION = "__computed__cumulative_token_count_completion"


class Traces:
    """
    Traces class is used to contain abstractions around the traces dataframe
    """

    def __init__(self, df: pd.DataFrame):
        df = df.set_index(SPAN_ID, drop=False)
        df[LATENCY_MS] = (df[END_TIME] - df[START_TIME]).dt.total_seconds() * 1000
        parent_span_ids = df.loc[:, PARENT_ID]
        for column, cumulative_column in (
            (LLM_TOKEN_COUNT_TOTAL, CUMULATIVE_LLM_TOKEN_COUNT_TOTAL),
            (LLM_TOKEN_COUNT_PROMPT, CUMULATIVE_LLM_TOKEN_COUNT_PROMPT),
            (LLM_TOKEN_COUNT_COMPLETION, CUMULATIVE_LLM_TOKEN_COUNT_COMPLETION),
        ):
            try:
                df[cumulative_column] = _cumulative(
                    df[column],
                    parent_span_ids,
                )
            except KeyError:
                pass
        self._dataframe = df
        self._adjacency_lists = defaultdict(list)
        for span_id, parent_id in cast(
            Iterable[Tuple[SpanID, SpanID]],
            parent_span_ids.dropna().items(),
        ):
            self._adjacency_lists[parent_id].append(span_id)

    def get_descendant_span_ids(self, span_id: SpanID) -> Iterable[SpanID]:
        for span_id in self._adjacency_lists[span_id]:
            yield span_id
            yield from self.get_descendant_span_ids(span_id)


def _cumulative(
    values: "pd.Series[Any]",
    parents: "pd.Series[Any]",
) -> "pd.Series[Any]":
    cumulative_values = pd.Series(
        np.full(len(values), np.nan),
        index=values.index,
    )
    for span_id, value in values.items():
        if not isinstance(value, float) or not math.isfinite(value):
            continue
        while span_id:
            cumulative_value = cumulative_values.loc[span_id]  # type: ignore
            if not isinstance(cumulative_value, float) or math.isnan(cumulative_value):
                cumulative_value = 0
            cumulative_values.loc[span_id] = cumulative_value + value  # type: ignore
            span_id = parents.loc[span_id]  # type: ignore
    return cumulative_values

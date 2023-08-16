from collections import defaultdict
from typing import DefaultDict, List, cast

import pandas as pd
from wrapt import ObjectProxy

from phoenix.trace.schemas import SpanID


class Traces(ObjectProxy):  # type: ignore
    """
    Traces class is used to contain abstractions around the traces dataframe
    """

    def __init__(
        self,
        df: pd.DataFrame,
    ):
        df = df.set_index("context.span_id", drop=False)
        super().__init__(df)
        self._self_adjacency_list = _build_adjacency_list(df)

    def get_adjacency_list(
        self,
        span_id: SpanID,
    ) -> DefaultDict[SpanID, List[SpanID]]:
        """Adjacency list rooted at span_id"""
        ans = defaultdict(list)
        ans[span_id] = self._self_adjacency_list[span_id]
        for child_span_id in self._self_adjacency_list[span_id]:
            ans.update(self.get_adjacency_list(child_span_id))
        return ans


def _build_adjacency_list(
    df: pd.DataFrame,
) -> DefaultDict[SpanID, List[SpanID]]:
    ans = defaultdict(list)
    for span_id, parent_id in df.loc[:, "parent_id"].items():
        ans[parent_id].append(span_id)
    return cast(DefaultDict[SpanID, List[SpanID]], ans)

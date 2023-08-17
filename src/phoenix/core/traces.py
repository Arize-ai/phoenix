from collections import defaultdict
from typing import DefaultDict, Iterable, List, cast

from pandas import DataFrame

from phoenix.trace.schemas import SpanID


class Traces:
    """
    Traces class is used to contain abstractions around the traces dataframe
    """

    _dataframe: DataFrame

    def __init__(self, dataframe: DataFrame):
        dataframe = dataframe.set_index("context.span_id", drop=False)
        self._dataframe = dataframe
        self._self_adjacency_list = _build_adjacency_lists(dataframe)

    def get_descendant_span_ids(self, span_id: SpanID) -> Iterable[SpanID]:
        for span_id in self._self_adjacency_list[span_id]:
            yield span_id
            yield from self.get_descendant_span_ids(span_id)


def _build_adjacency_lists(
    df: DataFrame,
) -> DefaultDict[SpanID, List[SpanID]]:
    adjacency_lists = defaultdict(list)
    for span_id, parent_id in df.loc[:, "parent_id"].items():
        adjacency_lists[parent_id].append(span_id)
    return cast(DefaultDict[SpanID, List[SpanID]], adjacency_lists)

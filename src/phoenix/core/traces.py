from collections import defaultdict
from typing import Iterable, Tuple, cast

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
        self._adjacency_lists = defaultdict(list)
        for span_id, parent_id in cast(
            Iterable[Tuple[SpanID, SpanID]],
            dataframe.loc[:, "parent_id"].dropna().items(),
        ):
            self._adjacency_lists[parent_id].append(span_id)

    def get_descendant_span_ids(self, span_id: SpanID) -> Iterable[SpanID]:
        for span_id in self._adjacency_lists[span_id]:
            yield span_id
            yield from self.get_descendant_span_ids(span_id)

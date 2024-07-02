import math
from functools import cached_property
from typing import Any, Dict, Iterable, Optional, Tuple

import pandas as pd
import strawberry
from strawberry import UNSET, Private

from phoenix.metrics.retrieval_metrics import RetrievalMetrics


@strawberry.type(
    description="Summarization of retrieval metrics: Average NDCG@K, Average "
    "Precision@K, Mean Reciprocal Rank, Hit Rate, etc."
)
class DocumentEvaluationSummary:
    evaluation_name: str
    metrics_collection: Private["pd.Series[Any]"]

    def __init__(
        self,
        evaluation_name: str,
        metrics_collection: Iterable[RetrievalMetrics],
    ) -> None:
        self.evaluation_name = evaluation_name
        self.metrics_collection = pd.Series(metrics_collection, dtype=object)
        self._cached_average_ndcg_results: Dict[Optional[int], Tuple[float, int]] = {}
        self._cached_average_precision_results: Dict[Optional[int], Tuple[float, int]] = {}

    @strawberry.field
    def average_ndcg(self, k: Optional[int] = UNSET) -> Optional[float]:
        value, _ = self._average_ndcg(None if k is UNSET else k)
        return value if math.isfinite(value) else None

    @strawberry.field
    def count_ndcg(self, k: Optional[int] = UNSET) -> int:
        _, count = self._average_ndcg(None if k is UNSET else k)
        return count

    @strawberry.field
    def average_precision(self, k: Optional[int] = UNSET) -> Optional[float]:
        value, _ = self._average_precision(None if k is UNSET else k)
        return value if math.isfinite(value) else None

    @strawberry.field
    def count_precision(self, k: Optional[int] = UNSET) -> int:
        _, count = self._average_precision(None if k is UNSET else k)
        return count

    @strawberry.field
    def mean_reciprocal_rank(self) -> Optional[float]:
        value, _ = self._average_reciprocal_rank
        return value if math.isfinite(value) else None

    @strawberry.field
    def count_reciprocal_rank(self) -> int:
        _, count = self._average_reciprocal_rank
        return count

    @strawberry.field
    def hit_rate(self) -> Optional[float]:
        value, _ = self._average_hit
        return value if math.isfinite(value) else None

    @strawberry.field
    def count_hit(self) -> int:
        _, count = self._average_hit
        return count

    def _average_ndcg(self, k: Optional[int] = None) -> Tuple[float, int]:
        if (result := self._cached_average_ndcg_results.get(k)) is not None:
            return result
        values = self.metrics_collection.apply(lambda m: m.ndcg(k))
        result = (values.mean(), values.count())
        self._cached_average_ndcg_results[k] = result
        return result

    def _average_precision(self, k: Optional[int] = None) -> Tuple[float, int]:
        if (result := self._cached_average_precision_results.get(k)) is not None:
            return result
        values = self.metrics_collection.apply(lambda m: m.precision(k))
        result = (values.mean(), values.count())
        self._cached_average_precision_results[k] = result
        return result

    @cached_property
    def _average_reciprocal_rank(self) -> Tuple[float, int]:
        values = self.metrics_collection.apply(lambda m: m.reciprocal_rank())
        return values.mean(), values.count()

    @cached_property
    def _average_hit(self) -> Tuple[float, int]:
        values = self.metrics_collection.apply(lambda m: m.hit())
        return values.mean(), values.count()

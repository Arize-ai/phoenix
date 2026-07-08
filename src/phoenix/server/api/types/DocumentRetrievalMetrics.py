import math
import re
from typing import Optional

import strawberry
from strawberry import UNSET, Private

from phoenix.metrics.retrieval_metrics import RetrievalMetrics


def _clean_docstring(docstring: Optional[str]) -> Optional[str]:
    return re.sub(r"\s*\n+\s*", " ", docstring).strip() if docstring else None


_ndcg_docstring = _clean_docstring(RetrievalMetrics.ndcg.__doc__)
_precision_docstring = _clean_docstring(RetrievalMetrics.precision.__doc__)
_reciprocal_rank_docstring = _clean_docstring(RetrievalMetrics.reciprocal_rank.__doc__)
_hit_docstring = _clean_docstring(RetrievalMetrics.hit.__doc__)


@strawberry.type(
    description="A collection of retrieval metrics computed on a list of document "
    "evaluation scores: NDCG@K, Precision@K, Reciprocal Rank, etc."
)
class DocumentRetrievalMetrics:
    evaluation_name: str
    metrics: Private[RetrievalMetrics]

    @strawberry.field(description=_ndcg_docstring)  # type: ignore
    def ndcg(self, k: Optional[int] = UNSET) -> Optional[float]:
        value = self.metrics.ndcg(None if k is UNSET else k)
        return value if math.isfinite(value) else None

    @strawberry.field(description=_precision_docstring)  # type: ignore
    def precision(self, k: Optional[int] = UNSET) -> Optional[float]:
        value = self.metrics.precision(None if k is UNSET else k)
        return value if math.isfinite(value) else None

    @strawberry.field(description=_reciprocal_rank_docstring)  # type: ignore
    def reciprocal_rank(self) -> Optional[float]:
        value = self.metrics.reciprocal_rank()
        return value if math.isfinite(value) else None

    @strawberry.field(description=_hit_docstring)  # type: ignore
    def hit(self) -> Optional[float]:
        value = self.metrics.hit()
        return value if math.isfinite(value) else None

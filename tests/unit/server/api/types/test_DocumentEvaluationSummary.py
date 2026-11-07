import math

import pytest
import strawberry

from phoenix.metrics.retrieval_metrics import RetrievalMetrics
from phoenix.server.api.types.DocumentEvaluationSummary import DocumentEvaluationSummary


@pytest.mark.parametrize(
    "scores, expected_count, expected_value",
    [
        ([[1.0], [1.0]], 2, 1.0),
        ([[1.0], [math.nan]], 1, 1.0),
        ([], 0, None),
    ],
)
def test_retrieval_summary_numeric_fields_serialize(
    scores: list[list[float]], expected_count: int, expected_value: float | None
) -> None:
    @strawberry.type
    class Query:
        summary: DocumentEvaluationSummary

    schema = strawberry.Schema(query=Query)
    root = Query(
        summary=DocumentEvaluationSummary(
            evaluation_name="relevance",
            metrics_collection=[RetrievalMetrics(values) for values in scores],
        )
    )
    query = """
      {
        summary {
          averageNdcg countNdcg
          averagePrecision countPrecision
          meanReciprocalRank countReciprocalRank
          hitRate countHit
          ndcgAtOne: countNdcg(k: 1)
          precisionAtOne: countPrecision(k: 1)
        }
      }
    """
    # Query twice to cover cached aggregates as well as their initial computation.
    for _ in range(2):
        result = schema.execute_sync(query, root_value=root)
        assert not result.errors
        assert result.data == {
            "summary": {
                "averageNdcg": expected_value,
                "countNdcg": expected_count,
                "averagePrecision": expected_value,
                "countPrecision": expected_count,
                "meanReciprocalRank": expected_value,
                "countReciprocalRank": expected_count,
                "hitRate": expected_value,
                "countHit": expected_count,
                "ndcgAtOne": expected_count,
                "precisionAtOne": expected_count,
            }
        }

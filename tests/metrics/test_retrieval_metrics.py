import numpy as np
import pytest
from phoenix.metrics.retrieval_metrics import RetrievalMetrics
from sklearn.metrics import ndcg_score


@pytest.mark.parametrize("k", [None, -1, 0, 1, 2, 1000])
@pytest.mark.parametrize("scores", [[], [0], [1], [0, 0, 1], [np.nan, 1], [np.nan], [0, 2, np.nan]])
def test_ranking_metrics_ndcg(k, scores):
    actual = RetrievalMetrics(scores).ndcg(k)
    if not np.all(np.isfinite(np.array(scores))):
        desired = np.nan
    elif k is not None and k < 1:
        desired = 0
    else:
        if len(scores) < 2:
            _scores = np.zeros(2)
            _scores[: len(scores)] = scores
        else:
            _scores = scores
        y_true, y_score = [_scores], [list(reversed(range(len(_scores))))]
        desired = ndcg_score(y_true, y_score, k=k, ignore_ties=True)
    assert np.isclose(actual, desired, equal_nan=True)


@pytest.mark.parametrize("k", [None, -1, 0, 1, 2, 1000])
@pytest.mark.parametrize("scores", [[], [0], [1], [0, 0, 1], [np.nan, 1], [np.nan], [0, 2, np.nan]])
def test_ranking_metrics_precision(k, scores):
    actual = RetrievalMetrics(scores).precision(k)
    if not np.all(np.isfinite(np.array(scores))):
        desired = np.nan
    else:
        k = len(scores) if k is None else k
        desired = 0 if k < 1 else sum(map(bool, scores[:k])) / k
    assert np.isclose(actual, desired, equal_nan=True)


@pytest.mark.parametrize(
    "scores,desired",
    [
        ([], 0),
        ([0], 0),
        ([1], 1),
        ([0, 0, 1], 1 / 3),
        ([np.nan, 1], np.nan),
        ([np.nan], np.nan),
        ([0, 2, np.nan], 1 / 2),
    ],
)
def test_ranking_metrics_reciprocal_rank(scores, desired):
    actual = RetrievalMetrics(scores).reciprocal_rank()
    assert np.isclose(actual, desired, equal_nan=True)


@pytest.mark.parametrize(
    "scores,desired",
    [
        ([], 0),
        ([0], 0),
        ([1], 1),
        ([0, 0, 1], 1),
        ([np.nan, 1], 1),
        ([np.nan], np.nan),
        ([0, 2, np.nan], 1),
    ],
)
def test_ranking_metrics_hit(scores, desired):
    actual = RetrievalMetrics(scores).hit()
    assert np.isclose(actual, desired, equal_nan=True)

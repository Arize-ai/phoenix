from collections.abc import Iterable
from dataclasses import dataclass, field
from numbers import Integral
from typing import Optional

import numpy as np
import pandas as pd


@dataclass(frozen=True)
class RetrievalMetrics:
    """
    Ranking metrics computed on a list of evaluation scores sorted from high to
    low by their ranking scores (prior to evaluation). For example, if the items
    are search results and the evaluation scores are their relevance scores (e.g.
    1 if relevant and 0 if not relevant), then the evaluation scores should be
    sorted by the original order of the displayed results, i.e. the first search
    result should go first. For more info on these metrics,
    see https://cran.r-project.org/web/packages/recometrics/vignettes/Evaluating_recommender_systems.html
    """  # noqa: E501

    eval_scores: "pd.Series[float]"
    length: int = field(init=False)
    has_nan: bool = field(init=False)

    def __init__(self, eval_scores: Iterable[float]) -> None:
        _eval_scores = np.fromiter(eval_scores, dtype=float)
        object.__setattr__(self, "length", len(_eval_scores))
        object.__setattr__(self, "has_nan", not np.all(np.isfinite(_eval_scores)))
        if self.length < 2:
            # Preserve the padded score representation for short inputs.
            # The original length determines the default metric cutoff.
            _scores = _eval_scores
            _eval_scores = np.zeros(2)
            _eval_scores[: len(_scores)] = _scores
        # For ranking metrics, the actual scores used for ranking are only
        # needed for sorting the items. Since we assume the items are already
        # sorted from high to low by their ranking scores, we can assign ranking
        # scores to be the reverse of the indices of eval_scores, just so that
        # it goes from high to low.
        ranking_scores = reversed(range(len(_eval_scores)))
        object.__setattr__(
            self,
            "eval_scores",
            pd.Series(_eval_scores, dtype=float, index=ranking_scores),  # type: ignore
        )

    def ndcg(self, k: Optional[int] = None) -> float:
        """
        Normalized Discounted Cumulative Gain (NDCG) at `k` with log base 2
        discounting. If `k` is None, it's set to the length of the scores. If
        `k` < 1, return 0.0.
        """
        if self.has_nan:
            return np.nan
        if k is None:
            k = self.length
        if k < 1:
            return 0.0
        if not isinstance(k, Integral):
            raise ValueError("k must be an integer or None")
        scores = self.eval_scores.to_numpy()
        if np.any(scores < 0):
            raise ValueError("ndcg_score should not be used on negative y_true values.")
        cutoff = min(k, len(scores))
        discounts = 1.0 / np.log2(np.arange(2, cutoff + 2))
        gain = np.dot(scores[:cutoff], discounts)
        ideal_gain = np.dot(np.sort(scores)[::-1][:cutoff], discounts)
        return 0.0 if ideal_gain == 0 else float(gain / ideal_gain)

    def precision(self, k: Optional[int] = None) -> float:
        """
        Precision at `k`, defined as the fraction of truthy scores among first
        `k` positions (1-based index). If `k` is None, then it's set to the
        length of the scores. If `k` < 1, return 0.0.
        """
        if self.has_nan:
            return np.nan
        if k is None:
            k = self.length
        if k < 1:
            return 0.0
        return self.eval_scores[:k].astype(bool).sum() / k

    def reciprocal_rank(self) -> float:
        """
        Return `1/R` where `R` is the rank of the first hit, i.e. the 1-based
        index position of first truthy score, e.g. score=1. If a non-finite
        value (e.g. `NaN`) is encountered before the first (finite) truthy
        score, then return `NaN`, otherwise if no truthy score is found (or if
        the count of scores is zero), return 0.0.
        """
        for i, score in enumerate(self.eval_scores):
            if not np.isfinite(score):
                return np.nan
            if score:
                return 1 / (i + 1)
        return 0.0

    def hit(self) -> float:
        """
        Return 1.0 if any score is truthy (i.e. is a hit), e.g. score=1.
        Otherwise, return `NaN` if any score is non-finite (e.g. `NaN`), or
        return 0.0 if all scores are falsy, e.g. all scores are 0.
        """
        if self.eval_scores.any():
            return 1.0
        if self.has_nan:
            return np.nan
        return 0.0

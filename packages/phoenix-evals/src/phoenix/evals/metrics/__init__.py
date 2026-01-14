from .correctness import CorrectnessEvaluator
from .document_relevance import DocumentRelevanceEvaluator
from .exact_match import exact_match
from .faithfulness import FaithfulnessEvaluator
from .hallucination import HallucinationEvaluator  # Deprecated alias
from .matches_regex import MatchesRegex
from .precision_recall import PrecisionRecallFScore

__all__ = [
    "CorrectnessEvaluator",
    "DocumentRelevanceEvaluator",
    "exact_match",
    "FaithfulnessEvaluator",
    "HallucinationEvaluator",  # Deprecated: use FaithfulnessEvaluator
    "MatchesRegex",
    "PrecisionRecallFScore",
]

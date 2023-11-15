from unittest.mock import Mock

import pytest
from phoenix.experimental.evals.evaluators import LLMEvaluator


def test_llm_evaluator_from_criteria_class_method_raises_value_error_for_unsupported_criteria() -> (
    None
):
    with pytest.raises(ValueError):
        LLMEvaluator.from_criteria(criteria="unsupported", model=Mock())

"""Phoenix pytest plugin.

Mark a test with ``@pytest.mark.phoenix`` and record output / evaluations through the
module-level helpers::

    from phoenix.client.pytest import log_output

    @pytest.mark.phoenix(dataset="qa-suite")
    @pytest.mark.parametrize("question,answer", [...], ids=["q1", "q2"])
    def test_answers(question, answer):
        result = my_app(question)
        log_output(result)
        assert result == answer

The pytest11 entry point activates the plugin whenever this package and pytest are both
installed.
"""

from __future__ import annotations

from .context import evaluate, log_evaluation, log_output

__all__ = ["log_output", "log_evaluation", "evaluate"]

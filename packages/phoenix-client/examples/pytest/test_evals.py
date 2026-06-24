"""
Example: a Phoenix eval suite written as pytest tests.

Each test marked with @pytest.mark.phoenix becomes one run in a Phoenix
experiment. The suite (here, this module) maps to a dataset; each test case
maps to a dataset example; the assertion outcome is recorded as the reserved
``pass`` annotation. Extra scores attach via log_evaluation / evaluate.

Run it like any other pytest suite. The plugin activates automatically once
``arize-phoenix-client[pytest]`` is installed:

    pip install "arize-phoenix-client[pytest]" pytest
    export PHOENIX_COLLECTOR_ENDPOINT=...   # your Phoenix endpoint
    export PHOENIX_API_KEY=...              # if your deployment requires auth
    pytest

Iterate locally without recording anything to Phoenix:

    PHOENIX_TEST_TRACKING=0 pytest
"""

import pytest

from phoenix.client.pytest import log_evaluation, log_output


def my_app(question: str) -> str:
    """Stand-in for the system under test."""
    answers = {"What is 2+2?": "4", "Capital of France?": "Paris"}
    return answers.get(question, "I don't know")


# dataset= names the experiment's dataset; it defaults to the module name when omitted.
# parametrize ids give each example a stable identity across runs.
@pytest.mark.phoenix(dataset="qa-suite")
@pytest.mark.parametrize(
    "question,expected",
    [("What is 2+2?", "4"), ("Capital of France?", "Paris")],
    ids=["arithmetic", "geography"],
)
def test_answers(question: str, expected: str) -> None:
    result = my_app(question)
    # Capture the output explicitly (pytest warns on non-None test returns).
    log_output(result)
    # Attach an extra score in addition to the assertion-derived ``pass`` annotation.
    log_evaluation(name="exact_match", score=1.0 if result == expected else 0.0)
    # A failed assertion records pass=False for this run; it does not stop the suite
    # from recording the other runs.
    assert result == expected

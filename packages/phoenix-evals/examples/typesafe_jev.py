"""Classify with Jev using the built-in hallucination evaluator.

Install: pip install 'arize-phoenix-evals[typesafe]'
Set TYPESAFE_API_KEY before running this example. It makes a real API request
and is not run in CI. SDK clients own credentials, timeouts, retries and cleanup.
"""

from typesafe_sdk import TypeSafeClient

from phoenix.evals import TypeSafeEvaluationModel
from phoenix.evals.metrics import HallucinationEvaluator


def main() -> None:
    with TypeSafeClient() as client:
        evaluator = HallucinationEvaluator(llm=TypeSafeEvaluationModel(client=client))
        score = evaluator.evaluate(
            {
                "input": (
                    "Tool: The Eiffel Tower was completed in 1889. User: When was it completed?"
                ),
                "output": "The Eiffel Tower was completed in 1889.",
            }
        )[0]
        print("Label:", score.label)
        print("Score:", score.score)
        print("Probabilities:", score.metadata["probabilities"])
        # A grounded answer has hallucination score 0, regardless of confidence.
        assert score.explanation is None


if __name__ == "__main__":
    main()

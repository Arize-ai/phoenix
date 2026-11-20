from ..evaluators import Score, create_evaluator


@create_evaluator(name="exact_match", kind="code")
def exact_match(output: str, expected: str) -> Score:
    """Return exact_match score: 1.0 if output == expected else 0.0.

    Note: No text normalization is performed.

    Args:
        output (str): The output to evaluate.
        expected (str): The expected output.

    Returns:
        Score: A Score object with score 1.0 if output matches expected, 0.0 otherwise.

    Examples:

        1. No input_mapping needed::

            eval_input_direct = {"output": "no", "expected": "yes"}
            scores_direct = exact_match.evaluate(eval_input_direct)
            print("Without input_mapping:", scores_direct)
            [Score(name='exact_match', score=0.0, label=None, explanation=None,
             metadata={}, kind='code', direction='maximize')]

        2. Input mapping needed to map input keys to those expected by the evaluator::

            eval_input = {"prediction": "yes", "gold": "yes"}
            input_mapping = {"output": "prediction", "expected": "gold"}
            scores = exact_match.evaluate(eval_input, input_mapping=input_mapping)
            print("With input_mapping:", scores)
            [Score(name='exact_match', score=1.0, label=None, explanation=None,
             metadata={}, kind='code', direction='maximize')]
    """
    correct = output == expected
    return Score(score=float(correct))

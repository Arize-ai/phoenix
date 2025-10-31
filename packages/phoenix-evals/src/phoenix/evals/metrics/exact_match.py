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

        1. No field_mapping needed::

            eval_input_direct = {"output": "no", "expected": "yes"}
            scores_direct = exact_match(eval_input_direct)
            print("Without field_mapping:", scores_direct)
            [Score(score=0.0, name='exact_match', label=False, explanation=None,
             direction='maximize', kind='code', metadata={})]

        2. Field mapping needed to map input keys to those expected by the evaluator::

            eval_input = {"prediction": "yes", "gold": "yes"}
            field_mapping = {"output": "prediction", "expected": "gold"}
            scores = exact_match(eval_input, field_mapping=field_mapping)
            print("With field_mapping:", scores)
            [Score(score=1.0, name='exact_match',label=True, explanation=None, direction='maximize',
             kind='code', metadata={})]
    """
    correct = output == expected
    return Score(score=float(correct))

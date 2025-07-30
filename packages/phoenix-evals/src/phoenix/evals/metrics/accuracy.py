"""
Example Usage:

Example 1: (no field_mapping needed)
>>> eval_input_direct = {"output": "no", "expected": "yes"}
>>> scores_direct = accuracy(eval_input_direct)
>>> print("Without field_mapping:", scores_direct)
[Score(score=0.0, name='accuracy', label=None, explanation=None, metadata={},
source='heuristic')]

Example 2: (field_mapping needed to map input keys to those expected by the evaluator)
>>> eval_input = {"prediction": "yes", "gold": "yes"}
>>> field_mapping = {"output": "prediction", "expected": "gold"}
>>> scores = accuracy(eval_input, field_mapping=field_mapping)
>>> print("With field_mapping:", scores)
[Score(score=1.0, name='accuracy',label=None, explanation=None, metadata={},
source='heuristic')]
"""

from phoenix.evals.core.evaluators import Score, simple_evaluator


@simple_evaluator(name="accuracy", source="heuristic")
def accuracy(output: str, expected: str) -> Score:
    """Return accuracy score: 1.0 if output == expected else 0.0."""
    correct = output == expected
    return Score(score=float(correct))

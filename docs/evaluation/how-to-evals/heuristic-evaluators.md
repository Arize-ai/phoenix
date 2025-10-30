# Heuristic Evaluators

Evaluations do not all require LLMs, and often it's useful to create Evaluators that perform basic checks or calculations on datasets that, in concert with LLM evaluations, can help provide useful signal to improve an application.

These evaluations that don't use an LLM are indicated by a `source="heuristic"` flag on the scores.

### Using `create_evaluator`

For convenience, a simple (sync or async) function can be converted into an Evaluator using the `create_evaluator` decorator. This function can either directly return a `Score` object or a value that can be converted into a score.

In the following examples, our decorated evaluation function and coroutine return a boolean, which when used as an Evaluator, is converted into a `Score` with a score value of `1` or `0` and a corresponding label of `True` or `False`.

```python
from phoenix.evals import create_evaluator

@create_evaluator(
    name="exact-match", source="heuristic", direction="maximize"
)
def exact_match(input: str, output: str) -> bool:
    return input == output

exact_match.evaluate({"input": "hello world", "output": "hello world"})
# [
#     Score(
#         name='exact-match',
#         score=1,
#         label=None,
#         explanation=None,
#         metadata={},
#         source='heuristic',
#         direction='maximize'
#     )
# ]

@create_evaluator(
    name="contains-link", source="heuristic", direction="maximize"
)
async def contains_link(output: str) -> Score:
    link = "https://arize-phoenix.readthedocs.io/projects/evals"
    return link in output
```

Notice that the original functions can still be used as defined for testing purposes:

```python
exact_match("hello", "world")
# False

await contains_link(
    "read the documentation here: "
    "https://arize-phoenix.readthedocs.io/projects/evals"
)
# True
```

#### Returning `Score` objects directly

```python
from phoenix.evals import create_evaluator, Score
from textdistance import levenshtein

@create_evaluator(
    name="levenshtein-distance", source="heuristic", direction="minimize"
)
def levenshtein(output: str, expected: str) -> Score:
    distance = levenshtein(output, expected)
    return Score(
        name="levenshtein-distance",
        score=distance,
        explanation="Levenshtein distance between {output} and {expected}",
        source="heuristic",
        direction="minimize",
    )
```

#### Other `Score` conversions

The `create_evaluator` decorator will convert many different function outputs into scores automatically:

* A Score object (no conversion needed)
* A number (converted to Score.score)
* A boolean (converted to integer Score.score and string Score.label)
* A short string (≤3 words, converted to Score.label)
* A long string (≥4 words, converted to Score.explanation)
* A dictionary with keys "score", "label", or "explanation"
* A tuple of values (only bool, number, str types allowed)

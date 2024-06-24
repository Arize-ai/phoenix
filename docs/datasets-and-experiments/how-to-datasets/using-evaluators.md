# Using Evaluators

{% hint style="info" %}
datasets and experiments is currently in pre-release
{% endhint %}

## LLM Evaluators

We provide LLM evaluators out of the box.

```python
from phoenix.datasets.evaluators import HelpfulnessEvaluator
from phoenix.evals.models import OpenAIModel

helpfulness_evaluator = HelpfulnessEvaluator(model=OpenAIModel())
```

You can implement your own LLM evaluator by subclassing `Evaluator` (see [Custom Evaluators](using-evaluators.md#custom-evaluators)).



## Code Evaluators

These evaluators just run code to evaluate the output of your LLM task. An example might be checking for whether or not a given output contains a link - which can be implemented as a RegEx match.

phoenix.datasets contains some pre-built code evaluators that can be passed to the `evaluators` parameter in experiments.

{% tabs %}
{% tab title="Python" %}
```python
from phoenix.datasets import run_experiment, MatchesRegex

# This defines a code evaluator for links
contains_link = MatchesRegex(
    pattern=r"[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)",
    name="contains_link"
)
```

The above `contains_link` evaluator can then be passed as an evaluator to any experiment you'd like to run.
{% endtab %}
{% endtabs %}

For a full list of code evaluators, please consult repo or API documentation.

## Custom Evaluators

Writing your own evaluator can be as simple as writing a Python function.

{% tabs %}
{% tab title="Edit Distance" %}
Below is an example of using the `editdistance` library to calculate how close the output is to the expected value.

```sh
pip install editdistance
```

```python
def edit_distance(output, expected) -> int:
    return editdistance.eval(
        json.dumps(output, sort_keys=True), json.dumps(expected, sort_keys=True)
    )
```
{% endtab %}
{% endtabs %}




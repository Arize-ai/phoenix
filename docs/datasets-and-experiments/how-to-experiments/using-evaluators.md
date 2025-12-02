# Using Evaluators

Evaluators are a way of validating that your AI task is running as expected. Simply put, an evaluator in relation to an AI task is a function that runs on the result - e.g. `(input, output, expected) -> score`

Phoenix is vendor agnostic and thus doesn't require you to use any particular evals library. Because of this, the eval libraries for Phoenix are distributed as separate packages. The Phoenix eval libraries are very lightweight and provide many utilities to make evaluation simpler.


## LLM Evaluators

We provide LLM evaluators out of the box. These evaluators are vendor agnostic and can be instantiated with any LLM provider:

{% tabs %}
{% tab title="Python" %}
```python
from phoenix.evals.metrics.hallucination import HallucinationEvaluator
from phoenix.evals import LLM

hallucination_evaluator = HallucinationEvaluator(llm=LLM(provider="openai", model="gpt-4o-mini"))
```
{% endtab %}
{% tab title="TypeScript" %}
```typescript
import { createHallucinationEvaluator } from "@arizeai/phoenix-evals";
import { openai } from "@ai-sdk/openai";

const hallucinationEvaluator = createHallucinationEvaluator({
  model: openai("gpt-4o-mini"),
});
```
{% endtab %}
{% endtabs %}

## Code Evaluators

Code evaluators are functions that evaluate the output of your LLM task that don't use another LLM as a judge. An example might be checking for whether or not a given output contains a link - which can be implemented as a RegEx match.

`phoenix.experiments.evaluators` contains some pre-built code evaluators that can be passed to the `evaluators` parameter in experiments.

{% tabs %}
{% tab title="Python" %}
```python
from phoenix.experiments import run_experiment, MatchesRegex

# This defines a code evaluator for links
contains_link = MatchesRegex(
    pattern=r"[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)",
    name="contains_link"
)
```

The above `contains_link` evaluator can then be passed as an evaluator to any experiment you'd like to run.
{% endtab %}
{% tab title="TypeScript" %}
```typescript
import { createEvaluator } from "@arizeai/phoenix-evals";

// This defines a code evaluator for links
const containsLink = createEvaluator<{ output: string }>(
  ({ output }) => {
    const urlPattern = /[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/;
    return urlPattern.test(output) ? 1 : 0;
  },
  {
    name: "contains_link",
    kind: "CODE",
  }
);
```

The above `containsLink` evaluator can then be passed as an evaluator to any experiment you'd like to run.
{% endtab %}
{% endtabs %}

For a full list of code evaluators, please consult repo or API documentation.

## Custom Evaluators

The simplest way to create an evaluator is just to write a Python function. By default, a function of one argument will be passed the `output` of an experiment run. These custom evaluators can either return a `boolean` or numeric value which will be recorded as the evaluation score.

{% tabs %}
{% tab title="Python" %}
Imagine our experiment is testing a `task` that is intended to output a numeric value from 1-100. We can write a simple evaluator to check if the output is within the allowed range:

```python
def in_bounds(x):
    return 1 <= x <= 100
```

By simply passing the `in_bounds` function to `run_experiment`, we will automatically generate evaluations for each experiment run for whether or not the output is in the allowed range.
{% endtab %}
{% tab title="TypeScript" %}
Imagine our experiment is testing a `task` that is intended to output a numeric value from 1-100. We can write a simple evaluator to check if the output is within the allowed range:

```typescript
import { createEvaluator } from "@arizeai/phoenix-evals";

const inBounds = createEvaluator<{ output: number }>(
  ({ output }) => {
    return 1 <= output && output <= 100 ? 1 : 0;
  },
  { name: "in_bounds" }
);
```

The `inBounds` evaluator can be passed to `runExperiment` to automatically generate evaluations for each experiment run for whether or not the output is in the allowed range.
{% endtab %}
{% endtabs %}

More complex evaluations can use additional information. These values can be accessed by defining a function with specific parameter names which are bound to special values:

<table><thead><tr><th width="193">Parameter name</th><th width="256">Description</th><th>Example</th></tr></thead><tbody><tr><td><code>input</code></td><td>experiment run input</td><td><code>def eval(input): ...</code></td></tr><tr><td><code>output</code></td><td>experiment run output</td><td><code>def eval(output): ...</code></td></tr><tr><td><code>expected</code></td><td>example output</td><td><code>def eval(expected): ...</code></td></tr><tr><td><code>reference</code></td><td>alias for <code>expected</code></td><td><code>def eval(reference): ...</code></td></tr><tr><td><code>metadata</code></td><td>experiment metadata</td><td><code>def eval(metadata): ...</code></td></tr></tbody></table>

These parameters can be used in any combination and any order to write custom complex evaluators!

{% tabs %}
{% tab title="Python" %}
Below is an example of using the `editdistance` library to calculate how close the output is to the expected value:

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
{% tab title="TypeScript" %}
Below is an example of calculating how close the output is to the expected value:

```typescript
import { createEvaluator } from "@arizeai/phoenix-evals";

const editDistance = createEvaluator<{ output: unknown; expected: unknown }>(
  ({ output, expected }) => {
    // Convert to strings for comparison
    const outputStr = typeof output === "string" 
      ? output 
      : JSON.stringify(output, null, 2);
    const expectedStr = typeof expected === "string" 
      ? expected 
      : JSON.stringify(expected, null, 2);
    
    // Simple Levenshtein distance implementation
    const calculateDistance = (a: string, b: string): number => {
      const matrix: number[][] = [];
      for (let i = 0; i <= b.length; i++) {
        matrix[i] = [i];
      }
      for (let j = 0; j <= a.length; j++) {
        matrix[0][j] = j;
      }
      for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
          if (b.charAt(i - 1) === a.charAt(j - 1)) {
            matrix[i][j] = matrix[i - 1][j - 1];
          } else {
            matrix[i][j] = Math.min(
              matrix[i - 1][j - 1] + 1,
              matrix[i][j - 1] + 1,
              matrix[i - 1][j] + 1
            );
          }
        }
      }
      return matrix[b.length][a.length];
    };
    
    return calculateDistance(outputStr, expectedStr);
  },
  {
    name: "edit_distance",
    optimizationDirection: "MINIMIZE", // Lower distance is better
  }
);
```
{% endtab %}
{% endtabs %}

For even more customization, use the `create_evaluator` decorator to further customize how your evaluations show up in the Experiments UI.

{% tabs %}
{% tab title="Python" %}
```python
from phoenix.experiments.evaluators import create_evaluator

# the decorator can be used to set display properties
# `name` corresponds to the metric name shown in the UI
# `kind` indicates if the eval was made with a "CODE" or "LLM" evaluator
@create_evaluator(name="wordiness", kind="CODE")
def wordiness_evaluator(expected, output):
    reference_length = len(expected.split())
    output_length = len(output.split())
    return output_length < reference_length
```

The decorated `wordiness_evaluator` can be passed directly into `run_experiment`!
{% endtab %}
{% tab title="TypeScript" %}
```typescript
import { createEvaluator } from "@arizeai/phoenix-evals";

// `createEvaluator` can be used to set display properties
// `name` corresponds to the metric name shown in the UI
// `kind` indicates if the eval was made with a "CODE" or "LLM" evaluator
const wordinessEvaluator = createEvaluator<{ expected: string; output: string }>(
  ({ expected, output }) => {
    const referenceLength = expected.split(" ").length;
    const outputLength = output.split(" ").length;
    return outputLength < referenceLength ? 1 : 0;
  },
  {
    name: "wordiness",
    kind: "CODE",
  }
);
```

The `wordinessEvaluator` can be passed directly into `runExperiment`!
{% endtab %}
{% endtabs %}

## Multiple Evaluators on Experiment Runs

Phoenix supports running multiple evals on a single experiment, allowing you to comprehensively assess your model's performance from different angles. When you provide multiple evaluators, Phoenix creates evaluation runs for every combination of experiment runs and evaluators.&#x20;

{% tabs %}
{% tab title="Python" %}
```python
from phoenix.experiments import run_experiment
from phoenix.experiments.evaluators import ContainsKeyword, MatchesRegex

experiment = run_experiment(
    dataset,
    task,
    evaluators=[
        ContainsKeyword("hello"),
        MatchesRegex(r"\d+"),
        custom_evaluator_function
    ]
)
```
{% endtab %}
{% tab title="TypeScript" %}
```typescript
import { runExperiment } from "@arizeai/phoenix-client";
import { createEvaluator } from "@arizeai/phoenix-evals";

const containsKeyword = createEvaluator<{ output: string }>(
  ({ output }) => {
    return output.toLowerCase().includes("hello") ? 1 : 0;
  },
  { name: "contains_keyword", kind: "CODE" }
);

const matchesRegex = createEvaluator<{ output: string }>(
  ({ output }) => {
    return /\d+/.test(output) ? 1 : 0;
  },
  { name: "matches_regex", kind: "CODE" }
);

const experiment = await runExperiment({
  dataset,
  task,
  evaluators: [
    containsKeyword,
    matchesRegex,
    customEvaluatorFunction,
  ],
});
```
{% endtab %}
{% endtabs %}


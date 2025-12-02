# Using Evaluators

Evaluators are a way of validating that your AI task is running as expected. Simply put, an evaluator in relation to an AI task is a function that runs on the result - e.g. `(input, output, expected) -> score`. 

## Setup

Phoenix is vendor agnostic and thus doesn't require you to use any particular evals library. Because of this, the eval libraries for Phoenix are distributed as separate packages. The Phoenix eval libraries are very lightweight and provide many utilities to make evaluation simpler.

{% tabs %}
{% tab title="Python" %}
```sh
pip install arize-phoenix-evals arize-phoenix-client
```
{% endtab %}
{% tab title="TypeScript" %}
```sh
npm install @arizeai/phoenix-evals @arizeai/phoenix-client
```
{% endtab %}
{% endtabs %}

Phoenix supports two main types of evaluators: **LLM Evaluators** (which use an LLM as a judge) and **Code Evaluators** (which use deterministic functions). You can also define evaluators as simple functions that return a score. See [Running Evaluators in Experiments](#running-evaluators-in-experiments) for a complete example.

## LLM Evaluators

LLM Evaluators are functions where an LLM as a judge performs the scoring of your AI task. LLM Evaluators are useful when you cannot express the scoring as simply a block of code (e.x. is the answer relevant to the question). With Phoenix you can either:

- Use and extend a pre-built evaluator
- Create a custom evaluator using the evals library
- Create your own LLM evaluator using your own tooling

### Pre-built LLM Evaluators

Phoenix provides LLM evaluators out of the box. These evaluators are vendor agnostic and can be instantiated with any LLM provider:

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


Note that pre-built evaluators rarely will work well for your specific AI task and should be used as starting points. Proceed with caution.

### Custom LLM Evaluators

Phoenix eval libraries provide building blocks for you to build your own LLM-as-a-judge evaluators. You can create custom classification evaluators that use an LLM to classify outputs into categories with optional scores.

{% tabs %}
{% tab title="Python" %}
```python
from phoenix.evals import ClassificationEvaluator
from phoenix.evals import LLM

# Define a prompt template with mustache placeholders
HELPFULNESS_TEMPLATE = """Rate how helpful the response is to the question.

Question: {{input}}
Response: {{output}}

"helpful" means the response directly addresses the question.
"not_helpful" means the response does not address the question."""

# Define the classification choices (labels mapped to scores)
choices = {"not_helpful": 0, "helpful": 1}

# Create the custom evaluator
helpfulness_evaluator = ClassificationEvaluator(
    name="helpfulness",
    prompt_template=HELPFULNESS_TEMPLATE,
    llm=LLM(provider="openai", model="gpt-4o-mini"),
    choices=choices
)
```
{% endtab %}
{% tab title="TypeScript" %}
```typescript
import { createClassificationEvaluator } from "@arizeai/phoenix-evals";
import { openai } from "@ai-sdk/openai";

// Define a prompt template with mustache placeholders
const helpfulnessTemplate = `Rate how helpful the response is to the question.

Question: {{input}}
Response: {{output}}

"helpful" means the response directly addresses the question.
"not_helpful" means the response does not address the question.`;

// Create the custom evaluator
const helpfulnessEvaluator = await createClassificationEvaluator<{
  input: string;
  output: string;
}>({
  name: "helpfulness",
  model: openai("gpt-4o-mini"),
  promptTemplate: helpfulnessTemplate,
  choices: { not_helpful: 0, helpful: 1 },
});
```
{% endtab %}
{% endtabs %}

## Code Evaluators

Code evaluators are functions that evaluate the output of your LLM task that don't use another LLM as a judge. An example might be checking for whether or not a given output contains a link - which can be implemented as a RegEx match.

The simplest way to create a code evaluator is to write a function. By default, a function of one argument will be passed the `output` of an experiment run. These evaluators can either return a `boolean` or numeric value which will be recorded as the evaluation score.

### Simple Code Evaluators

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

### Code Evaluators with Multiple Parameters

More complex evaluations can use additional information. These values can be accessed by defining a function with specific parameter names which are bound to special values:

<table><thead><tr><th width="193">Parameter name</th><th width="256">Description</th><th>Example</th></tr></thead><tbody><tr><td><code>input</code></td><td>experiment run input</td><td><code>def eval(input): ...</code></td></tr><tr><td><code>output</code></td><td>experiment run output</td><td><code>def eval(output): ...</code></td></tr><tr><td><code>expected</code></td><td>example output</td><td><code>def eval(expected): ...</code></td></tr><tr><td><code>reference</code></td><td>alias for <code>expected</code></td><td><code>def eval(reference): ...</code></td></tr><tr><td><code>metadata</code></td><td>experiment metadata</td><td><code>def eval(metadata): ...</code></td></tr></tbody></table>

These parameters can be used in any combination and any order to write custom complex evaluators!

{% tabs %}
{% tab title="Python" %}
```python
import json
import editdistance  # pip install editdistance

def edit_distance(output, expected) -> int:
    return editdistance.eval(
        json.dumps(output, sort_keys=True), 
        json.dumps(expected, sort_keys=True)
    )
```
{% endtab %}
{% tab title="TypeScript" %}
```typescript
import { createEvaluator } from "@arizeai/phoenix-evals";
import { distance } from "fastest-levenshtein"; // npm install fastest-levenshtein

const editDistance = createEvaluator<{ output: string; expected: string }>(
  ({ output, expected }) => distance(output, expected),
  { name: "edit_distance" }
);
```
{% endtab %}
{% endtabs %}

### Customizing Code Evaluators with `create_evaluator`

For better integration with the Experiments UI, use the `create_evaluator` function (or decorator in Python) to set display properties like the evaluator name and kind.

{% tabs %}
{% tab title="Python" %}
```python
from phoenix.evals import create_evaluator
import re

@create_evaluator(name="contains_link", kind="CODE")
def contains_link(output):
    pattern = r"https?://[^\s]+"
    return bool(re.search(pattern, output))

@create_evaluator(name="wordiness", kind="CODE")
def wordiness(expected, output):
    return len(output.split()) < len(expected.split())
```
{% endtab %}
{% tab title="TypeScript" %}
```typescript
import { createEvaluator } from "@arizeai/phoenix-evals";

const containsLink = createEvaluator<{ output: string }>(
  ({ output }) => /https?:\/\/[^\s]+/.test(output) ? 1 : 0,
  { name: "contains_link", kind: "CODE" }
);

const wordiness = createEvaluator<{ expected: string; output: string }>(
  ({ expected, output }) => 
    output.split(" ").length < expected.split(" ").length ? 1 : 0,
  { name: "wordiness", kind: "CODE" }
);
```
{% endtab %}
{% endtabs %}

## Running Evaluators in Experiments

Evaluators are passed as a list to the `evaluators` parameter in `run_experiment`. You can use any combination of LLM evaluators, code evaluators, or simple functions.

{% tabs %}
{% tab title="Python" %}
```python
from phoenix.experiments import run_experiment
from phoenix.evals import create_evaluator

@create_evaluator(name="has_greeting", kind="CODE")
def has_greeting(output):
    return any(word in output.lower() for word in ["hello", "hi", "hey"])

def exact_match(output, expected):
    return output.strip() == expected.strip()

experiment = run_experiment(
    dataset=my_dataset,
    task=my_task,
    evaluators=[has_greeting, exact_match]
)
```
{% endtab %}
{% tab title="TypeScript" %}
```typescript
import { runExperiment } from "@arizeai/phoenix-client/experiments";
import { createEvaluator } from "@arizeai/phoenix-evals";

const hasGreeting = createEvaluator<{ output: string }>(
  ({ output }) => 
    ["hello", "hi", "hey"].some(w => output.toLowerCase().includes(w)) ? 1 : 0,
  { name: "has_greeting", kind: "CODE" }
);

const exactMatch = createEvaluator<{ output: string; expected: string }>(
  ({ output, expected }) => output.trim() === expected.trim() ? 1 : 0,
  { name: "exact_match", kind: "CODE" }
);

const experiment = await runExperiment({
  dataset: myDataset,
  task: myTask,
  evaluators: [hasGreeting, exactMatch],
});
```
{% endtab %}
{% endtabs %}


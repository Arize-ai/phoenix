---
description: >-
  How to leverage repetitions to get an understanding of indeterminate LLM
  outputs
---

# Repetitions

{% hint style="info" %}
repetitions are available in Phoenix [11.37.0](https://github.com/Arize-ai/phoenix/releases/tag/arize-phoenix-v11.37.0) and the clients that support them
{% endhint %}

Since LLMs are probabilistic, their synthesis can differ even when the supplied prompts are exactly the same. This can make it challenging to determine if a particular change is warranted as a single execution cannot concretely tell you whether a given change improves or degrades your task.\
\
So what can you do when an execution can change from one run to the next? That's where repetitions come in. Repetitions help you reduce uncertainty in systems prone to variability, notably more "agentic" systems.

### Configuring Repetitions

Repetitions can be configured whenever you run an experiment via the phoenix client. The **repetitions** parameter determines how many times each **example** is used in your task. So if you have 3 examples with 2 repetitions, your task will be run 6 times and evaluated 6 times.



{% tabs %}
{% tab title="Python" %}
```python
from phoenix.client import Client
client = Client()
dataset = client.datasets.get_dataset(dataset="my-dataset")

def my_task(input):
    return f"Hello {input['name']}"

experiment = client.experiments.run_experiment(
    dataset=dataset,
    task=my_task,
    experiment_name="greeting-experiment"
    repetitions=3
)
```
{% endtab %}

{% tab title="TypeScript" %}
```typescript
import { runexperiment } from "@arizeai/phoenix-client/experiments";

const task = async (example) => `hello ${example.input.name}`;

const experiment = await runExperiment({
  dataset: { datasetName: "greeting-dataset" },
  task,
  repetitions=3
});
```
{% endtab %}
{% endtabs %}

### Viewing Repetitions

If you've run your experiments with repetitions, you will see arrow icons at the top of each output. At the bottom you will see the average of the evaluations as well as the score for the evaluation you are looking at. You can click on the arrows to cycle through the repetions or click on the expand icon to view the full details.

<figure><img src="https://storage.googleapis.com/arize-phoenix-assets/assets/images/repetitions_on_grid.png" alt="repetition carousel"><figcaption></figcaption></figure>

<figure><img src="https://storage.googleapis.com/arize-phoenix-assets/assets/images/repetition_details.png" alt="repetition details"><figcaption></figcaption></figure>

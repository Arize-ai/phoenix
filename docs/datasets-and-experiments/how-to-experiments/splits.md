---
description: >-
  How to run experiments over select splits of your dataset for targeted
  experimentation
---

# Splits

{% hint style="info" %}
dataset splits are available in `arize-phoenix` [12.7.0](https://github.com/Arize-ai/phoenix/releases/tag/arize-phoenix-v12.7.0).
{% endhint %}

Often we want to run an experiment over just a subset of our entire dataset. These subsets of dataset examples are called "splits." Common splits include:

* hard examples that frequently produce poor output,
* a split of examples used in a few-shot prompt and a disjoint, non-overlapping split of examples used for evaluation,
* train, validation, and test splits for fine-tuning an LLM.

Running experiments over splits rather than entire datasets produces evaluation metrics that better capture the performance of your agent, workflow, or prompt on the particular type of data you care about.

### Configuring Splits

Experiments can be run over previously configured splits either via the Python or JavaScript clients or via the Phoenix playground.

Coming soon.

{% tabs %}
{% tab title="Python" %}
Splits are implicitly configured when a dataset is pulled from the Phoenix server using the `get_dataset` client method. Subsequent invocations of `run_experiment` only run on the examples belonging to the split(s).

```python
# pip install "arize-phoenix-client>1.22.0"
from phoenix.client import Client
client = Client()

# only pulls examples from the selected splits
dataset = client.datasets.get_dataset(
    dataset="my-dataset",
    splits=["test", "hard_examples"],  # names of previously created splits
)

def my_task(input):
    return f"Hello {input['name']}"

experiment = client.experiments.run_experiment(
    dataset=dataset,  # runs only on the selected splits
    task=my_task,
    experiment_name="greeting-experiment"
)
```
{% endtab %}

{% tab title="TypeScript" %}
Splits can be configured within a DatasetSelector, when fetching datasets. Dataset examples contained within the selected splits will be used in experiment runs, or evaluations.

```typescript
// npm install @arizeai/phoenix-client@latest
import { runExperiment } from "@arizeai/phoenix-client/experiments"
import type { ExperimentTask } from "@arizeai/phoenix-client/types/experiments";
import type { DatasetSelector } from "@arizeai/phoenix-client/types/datasets";

const myTask: ExperimentTask = (example) => {
  return `Hello, ${example?.name ?? "stranger"}!`
}

// Create a dataset selector that can be used to fetch a dataset
const datasetSelector: DatasetSelector = {
  datasetName: "my-dataset",
  splits: ["test", "hard_examples"] // names of previously created splits
}

runExperiment({
  // runExperiment will perform a just-in-time fetch of the dataset "my-dataset"
  // with its examples filtered by the provided splits
  dataset: datasetSelector,
  task,
  experimentName: "greeting-experiment"
})
```
{% endtab %}
{% endtabs %}

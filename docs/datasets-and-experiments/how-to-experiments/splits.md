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

#### Creating Splits

Currently, Splits can be created in the UI on the dataset page. When inspecting the dataset you will see a new splits column along with a splits filter.

<figure><img src="https://storage.googleapis.com/arize-phoenix-assets/assets/images/phoenix-docs-images/phoenix-docs-images/splits_column_and_filter.png" alt="repetition carousel"><figcaption></figcaption></figure>

On the split filter we have the ability to assign splits and create splits

<figure><img src="https://storage.googleapis.com/arize-phoenix-assets/assets/images/phoenix-docs-images/create_splits.png" alt="repetition carousel"><figcaption></figcaption></figure>

A split can be assigned a name, description and a color

{% tabs %}
{% tab title="Creating a Split" %}
<figure><img src="https://storage.googleapis.com/arize-phoenix-assets/assets/images/phoenix-docs-images/split_create_dialogue.png" alt="Create split dialog"><figcaption></figcaption></figure>
{% endtab %}

{% tab title="Split Created" %}
<figure><img src="https://storage.googleapis.com/arize-phoenix-assets/assets/images/phoenix-docs-images/split_create_dialogue_complete.png" alt="Split creation complete"><figcaption></figcaption></figure>
{% endtab %}
{% endtabs %}

#### Assigning Splits

Splits can currently only be assigned from the UI on the dataset page. To assign dataset examples to splits, select a set of examples and using the split filter we can select splits and it will automatically assign those selected examples to the set of selected splits

{% tabs %}
{% tab title="Assigning Splits" %}
<figure><img src="https://storage.googleapis.com/arize-phoenix-assets/assets/images/phoenix-docs-images/assign_split.png" alt="Create split dialog"><figcaption></figcaption></figure>
{% endtab %}

{% tab title="Splits Assigned" %}
<figure><img src="https://storage.googleapis.com/arize-phoenix-assets/assets/images/phoenix-docs-images/assign_split_complete.png" alt="Split creation complete"><figcaption></figcaption></figure>
{% endtab %}
{% endtabs %}

### Using splits

For the rest of this example we will be working with the following dataset, which has 3 examples assigned to test and 7 examples assigned to train.

<figure><img src="https://storage.googleapis.com/arize-phoenix-assets/assets/images/phoenix-docs-images/example_dataset.png" alt="repetition carousel"><figcaption></figcaption></figure>


{% tabs %}
{% tab title="UI" %}
Experiments can be ran over dataset splits from the playground UI. With dataset splits, the dataset selector UI now shows the dataset with the ability to select all examples or to select from a set of splits

<figure><img src="https://storage.googleapis.com/arize-phoenix-assets/assets/images/phoenix-docs-images/playground_dataset_select.png" alt="repetition carousel"><figcaption></figcaption></figure>

To run an experiment over the "train" split, we can select the dataset by the train split which shows the 7 selected examples and hit Run

{% tabs %}
{% tab title="Selected Split" %}
<figure><img src="https://storage.googleapis.com/arize-phoenix-assets/assets/images/phoenix-docs-images/playground_test_select.png" alt="repetition carousel"><figcaption></figcaption></figure>
{% endtab %}

{% tab title="Run Experiment on Split" %}
<figure><img src="https://storage.googleapis.com/arize-phoenix-assets/assets/images/phoenix-docs-images/run_experiment.png" alt="Split creation complete"><figcaption></figcaption></figure>
{% endtab %}
{% endtabs %}

{% endtab %}
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

---
description: >-
  How to run experiments over select subsets splits of your dataset for targeted experimentation
---

# Splits

{% hint style="info" %}
dataset splits are available in `arize-phoenix` [11.37.0](https://github.com/Arize-ai/phoenix/releases/tag/arize-phoenix-v11.37.0).
{% endhint %}

Often we want to run an experiment over just a subset of our entire dataset. These subsets of dataset examples are called "splits." Common splits include:

- hard examples that frequently produce poor output,
- a split of examples used in a few-shot prompt and a disjoint, non-overlapping split of examples used for evaluation,
- train, validation, and test splits for fine-tuning an LLM.

Running experiments over splits rather than entire datasets produces more evaluation metrics that better capture the performance of your agent, workflow, or prompt on a particular type of data you care about.

### Configuring Splits

Experiments can be run over previously configured splits either via the Python or JavaScript clients or via the Phoenix playground.

{% tab title="Playground" %}
Coming soon.
{% endtab %}
{% endtabs %}

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
Coming soon.
{% endtab %}
{% endtabs %}

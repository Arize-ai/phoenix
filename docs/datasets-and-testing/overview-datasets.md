# Overview: Datasets

{% hint style="info" %}
Phoenix Datasets are currently in pre-release.
{% endhint %}

The pace of AI application development is often bottlenecked by quality evaluations because AI engineers often face hard tradeoffs: which prompt or which LLM best balances accuracy, latency, and cost. High quality evaluations can help you answer these types of questions with greater confidence.

## Datasets

Datasets are an integral part of evaluation and experimentation. They are collections of examples that provide the necessary inputs and, optionally, expected `reference` outputs for assessing your AI application. Each example within a dataset represents a single data point, consisting of an `inputs` dictionary, an optional `output` dictionary, and an optional `metadata` dictionary. The `optional` output dictionary will often contain a `reference` key, which is the expected LLM application output for the given input.

Datasets allow you to collect data from production, staging, evaluations, and even manually, and then use that data to run experiments and evaluations to track improvements.

Use datasets to:

* Store evaluation test cases for your eval script instead of managing large JSONL or CSV files
* Capture generations to assess quality manually or using LLM graded evals
* Store user reviewed generations to find new test cases

With Phoenix, datasets are:

* **Integrated**. Datasets are integrated with the platform, so you can add production spans to datasets, use datasets to run experiments, and use metadata to track different segments and use-cases.
* **Versioned**. Every insert, update, and delete is versioned, so you can pin experiments and evaluations to a specific version of a dataset and track changes over time.



\

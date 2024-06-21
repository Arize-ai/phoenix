# Overview: Datasets

{% hint style="info" %}
Phoenix Datasets are currently in pre-release.
{% endhint %}

<figure><img src="https://storage.googleapis.com/arize-assets/phoenix/assets/images/evaluator.png" alt=""><figcaption><p>How Datasets are used to test changes to your AI application</p></figcaption></figure>

AI application development is often bottlenecked by quality evaluations because engineers  are often face hard tradeoffs: which prompt or which LLM best balances performance, latency, and cost. High quality evaluations can help answer these types of questions with greater confidence.

## Datasets

Datasets are an integral to evaluation and experimentation. They are collections of examples that provide the `inputs` and, optionally, expected `reference` outputs for assessing your application. Each example within a dataset represents a single data point, consisting of an `inputs` dictionary, an optional `output` dictionary, and an optional `metadata` dictionary. The `optional` output dictionary often contains the the expected LLM application output for the given input.

Datasets allow you to collect data from production, staging, evaluations, and even manually. The examples collected is  to run experiments and evaluations to track improvements.

Use datasets to:

* Store evaluation test cases for your eval script instead of managing large JSONL or CSV files
* Capture generations to assess quality manually or using LLM graded evals
* Store user reviewed generations to find new test cases

With Phoenix, datasets are:

* **Integrated**. Datasets are integrated with the platform, so you can add production spans to datasets, use datasets to run experiments, and use metadata to track different segments and use-cases.
* **Versioned**. Every insert, update, and delete is versioned, so you can pin experiments and evaluations to a specific version of a dataset and track changes over time.



\

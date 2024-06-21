---
description: There are many ways to build datasets for experimentation and evaluation.
---

# Concepts: Datasets

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

## Creating Datasets

There are various ways to get started with datasets:

**Manually Curated Examples**

This is how we recommend you start. From building your application, you probably have an idea of what types of inputs you expect your application to be able to handle, and what "good" responses look like. You probably want to cover a few different common edge cases or situations you can imagine. Even 20 high-quality, manually-curated examples can go a long way.

**Historical Logs**

Once you have shipped an application, you start get valuable information - how users actually using it. This information can be valuable to capture and store in datasets. This allows you to test against these use cases as you iterate on your application.

If your application is going well, you will likely get a lot of usage. How can you determine which datapoints are valuable to add? There are a few heuristics you can follow. If possible - try to collect end user feedback. You can then see which datapoints got negative feedback. That is super valuable! These are spots where your application did not perform well. You should add these to your dataset to test against in the future. You can also use other heuristics to identify "interesting" datapoints - for example, runs that took a long time to complete could be interesting to look at and add to a dataset.

**Synthetic Data**

Once you have a few examples, you can try to artificially generate examples. It's generally advised to have a few good hand-craft examples before this, as this synthetic data will often resemble them in some way. This can be a useful way to get a lot of datapoints, quickly.

## Dataset Contents

While Phoenix doesn't have dataset types, conceptually you can contain:

1. keys and values:
   * "Inputs" and "outputs" are represented as arbitrary key-value pairs.
   * This dataset type is ideal for evaluating prompts, functions ,and agents that require multiple inputs or generate multiple outputs.
2. LLM inputs and outputs:
   * Simply capture the `input` and `output` as a single string to test the completion of an LLM.
   * The "inputs" dictionary contains a single "input" key mapped to the prompt string.
   * The "outputs" dictionary contains a single "output" key mapped to the corresponding response string.
3. Messages or chat:
   * This type of dataset is designed for evaluating LLM structured messages as inputs and outputs.
   * The "inputs" dictionary contains a a "messages" key mapped to a list of serialized chat messages
   * The "outputs" dictionary contains a a "messages" key mapped to a list of serialized chat messages.
   * This type of data is useful for evaluating conversational AI systems or chatbots.

\

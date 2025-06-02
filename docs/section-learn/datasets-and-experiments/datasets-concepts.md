# Datasets Concepts

## Datasets

Datasets are integral to evaluation and experimentation. They are collections of examples that provide the `inputs` and, optionally, expected `reference` outputs for assessing your application. Each example within a dataset represents a single data point, consisting of an `inputs` dictionary, an optional `output` dictionary, and an optional `metadata` dictionary. The `optional` output dictionary often contains the the expected LLM application output for the given input.

Datasets allow you to collect data from production, staging, evaluations, and even manually. The examples collected are then used to run experiments and evaluations to track improvements.

Use datasets to:

* Store evaluation test cases for your eval script instead of managing large JSONL or CSV files
* Capture generations to assess quality manually or using LLM-graded evals
* Store user reviewed generations to find new test cases

With Phoenix, datasets are:

* **Integrated**. Datasets are integrated with the platform, so you can add production spans to datasets, use datasets to run experiments, and use metadata to track different segments and use-cases.
* **Versioned**. Every insert, update, and delete is versioned, so you can pin experiments and evaluations to a specific version of a dataset and track changes over time.

## Creating Datasets

There are various ways to get started with datasets:

**Manually Curated Examples**

This is how we recommend you start. From building your application, you probably have an idea of what types of inputs you expect your application to be able to handle, and what "good" responses look like. You probably want to cover a few different common edge cases or situations you can imagine. Even 20 high quality, manually curated examples can go a long way.

**Historical Logs**

Once you ship an application, you start gleaning valuable information: how users are actually using it. This information can be valuable to capture and store in datasets. This allows you to test against specific use cases as you iterate on your application.

If your application is going well, you will likely get a lot of usage. How can you determine which datapoints are valuable to add? There are a few heuristics you can follow. If possible, try to collect end user feedback. You can then see which datapoints got negative feedback. That is super valuable! These are spots where your application did not perform well. You should add these to your dataset to test against in the future. You can also use other heuristics to identify interesting datapoints - for example, runs that took a long time to complete could be interesting to analyze and add to a dataset.

**Synthetic Data**

Once you have a few examples, you can try to artificially generate examples to get a lot of datapoints quickly. It's generally advised to have a few good handcrafted examples before this step, as the synthetic data will often resemble the source examples in some way.

## Dataset Contents

While Phoenix doesn't have dataset types, conceptually you can contain:

**Key-Value Pairs:**

* Inputs and outputs are arbitrary key-value pairs.
* This dataset type is ideal for evaluating prompts, functions, and agents that require multiple inputs or generate multiple outputs.

{% tabs %}
{% tab title="Prompt Template" %}
If you have a RAG prompt template such as:

```
Given the context information and not prior knowledge, answer the query.
---------------------
{context}
---------------------

Query: {query}
Answer:  
```

Your dataset might look like:

| Input                                                                                                                                                              | Output                                                                                                                                                 |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| <p>{</p><p>"query": "What is Paul Graham known for?",</p><p>"context": "Paul Graham is an investor, entrepreneur, and computer scientist known for..."</p><p>}</p> | <p>{</p><p>"answer": "Paul Graham is known for co-founding Y Combinator, for his writing, and for his work on the Lisp programming language."<br>}</p> |
{% endtab %}
{% endtabs %}

**LLM inputs and outputs:**

* Simply capture the `input` and `output` as a single string to test the completion of an LLM.
* The "inputs" dictionary contains a single "input" key mapped to the prompt string.
* The "outputs" dictionary contains a single "output" key mapped to the corresponding response string.

| Input                                                                            | Output                                  |
| -------------------------------------------------------------------------------- | --------------------------------------- |
| <p>{</p><p>"input": "do you have to have two license plates in ontario"<br>}</p> | <p>{</p><p>"output": "true"</p><p>}</p> |
| <p>{</p><p>"input": "are black beans the same as turtle beans"<br>}</p>          | <p>{<br>"output": "true"<br>}</p>       |

**Messages or chat:**

* This type of dataset is designed for evaluating LLM structured messages as inputs and outputs.
* The "inputs" dictionary contains a "messages" key mapped to a list of serialized chat messages.
* The "outputs" dictionary contains a "messages" key mapped to a list of serialized chat messages.
* This type of data is useful for evaluating conversational AI systems or chatbots.

| Input                                                                                     | Output                                                                                              |
| ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| <p>{<br>"messages": [{ "role": "system", "content": "You are an expert SQL..."}]<br>}</p> | <p>{<br>"messages": [{ "role": "assistant", "content": "select * from users"}]<br>}</p>             |
| <p>{<br>"messages": [{ "role": "system", "content": "You are a helpful..."}]<br>}</p>     | <p>{<br>"messages": [{ "role": "assistant", "content": "I don't know the answer to that"}]<br>}</p> |

## Types of Datasets

Depending on the type of contents of a given dataset, you might consider the dataset be a certain type.

### Golden Dataset

A dataset that contains the **inputs** and the ideal "golden" **output** is often times is referred to as a **Golden Dataset.** These datasets are hand-labeled dataset and are used in evaluating the performance of LLMs or prompt templates. T.A golden dataset could look something like

| Input                                   | Output |
| --------------------------------------- | ------ |
| Paris is the capital of France          | True   |
| Canada borders the United States        | True   |
| The native language of Japan is English | False  |

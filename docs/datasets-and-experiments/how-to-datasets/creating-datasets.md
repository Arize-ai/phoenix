# Creating Datasets

## From CSV

When manually creating a dataset (let's say collecting hypothetical questions and answers), the easiest way to start is by using a spreadsheet. Once you've collected the information, you can simply upload the CSV of your data to the Phoenix platform using the UI. You can also programmatically upload tabular data using Pandas as [seen below.](creating-datasets.md#from-pandas)

## From Pandas

{% tabs %}
{% tab title="Python" %}
```python
import pandas as pd
import phoenix as px

queries = [
    "What are the 9 planets in the solar system?",
    "How many generations of fundamental particles have we observed?",
    "Is Aluminum a superconductor?",
]
responses = [
    "There are 8 planets in the solar system.",
    "We have observed 3 generations of fundamental particles.",
    "Yes, Aluminum becomes a superconductor at 1.2 degrees Kelvin.",
]

dataset_df = pd.DataFrame(data={"query": queries, "responses": responses})

px.launch_app()
client = px.Client()
dataset = client.upload_dataset(
    dataframe=dataset_df,
    dataset_name="physics-questions",
    input_keys=["query"],
    output_keys=["responses"],
)

```
{% endtab %}
{% endtabs %}

## From Objects

Sometimes you just want to upload datasets using plain objects as CSVs and DataFrames can be too restrictive about the keys.&#x20;

{% tabs %}
{% tab title="Python" %}
```python

ds = px.Client().upload_dataset(
    dataset_name="my-synthetic-dataset",
    inputs=[{ "question": "hello" }, { "question": "good morning" }],
    outputs=[{ "answer": "hi" }, { "answer": "good morning" }],
);
```
{% endtab %}
{% endtabs %}

## Synthetic Data

One of the quicket way of getting started is to produce synthetic queries using an LLM.&#x20;

{% tabs %}
{% tab title="Python" %}
One use case for synthetic data creation is when you want to test your RAG pipeline. You can leverage an LLM to synthesize hypothetical questions about your knowledge base.

In the below example we will use Phoenix's built-in `llm_generate`, but you can leverage any synthetic dataset creation tool you'd like.

{% hint style="info" %}
Before running this example, ensure you've set your `OPENAI_API_KEY` environment variable.
{% endhint %}

Imagine you have a knowledge-base that contains the following documents:

```python
import pandas as pd

document_chunks = [
  "Paul Graham is a VC",
  "Paul Graham loves lisp",
  "Paul founded YC",
]
document_chunks_df = pd.DataFrame({"text": document_chunks})
```

```python
generate_questions_template = (
    "Context information is below.\n\n"
    "---------------------\n"
    "{text}\n"
    "---------------------\n\n"
    "Given the context information and not prior knowledge.\n"
    "generate only questions based on the below query.\n\n"
    "You are a Teacher/ Professor. Your task is to setup "
    "one question for an upcoming "
    "quiz/examination. The questions should be diverse in nature "
    "across the document. Restrict the questions to the "
    "context information provided.\n\n"
    "Output the questions in JSON format with the key question"
)
```

Once your synthetic data has been created, this data can be uploaded to Phoenix for later re-use.

```python
import json

from phoenix.evals import OpenAIModel, llm_generate


def output_parser(response: str, index: int):
    try:
        return json.loads(response)
    except json.JSONDecodeError as e:
        return {"__error__": str(e)}


questions_df = llm_generate(
    dataframe=document_chunks_df,
    template=generate_questions_template,
    model=OpenAIModel(model="gpt-3.5-turbo"),
    output_parser=output_parser,
    concurrency=20,
)
questions_df["output"] = [None, None, None]
```

Once we've constructed a collection of synthetic questions, we can upload them to a Phoenix dataset.

```python
import phoenix as px

# Note that the below code assumes that phoenix is running and accessible
client = px.Client()
client.upload_dataset(
    dataframe=questions_df, dataset_name="paul-graham-questions",
    input_keys=["question"],
    output_keys=["output"],
)
```
{% endtab %}
{% endtabs %}



## From Spans

If you have an application that is traced using instrumentation, you can quickly add any span or group of spans using the Phoenix UI.

To add a single span to a dataset, simply select the span in the trace details view. You should see an add to dataset button on the top right. From there you can select the dataset you would like to add it to and make any changes you might need to make before saving the example.

<figure><img src="https://storage.googleapis.com/arize-assets/phoenix/assets/images/add_span_to_dataset.png" alt=""><figcaption><p>Add a specific span as a golden dataset or an example for further testing</p></figcaption></figure>

\
You can also use the filters on the spans table and select multiple spans to add to a specific dataset.

<figure><img src="https://storage.googleapis.com/arize-assets/phoenix/assets/images/add_llm_spans_for_ft.png" alt=""><figcaption><p>Add LLM spans for fine tuning to a dataset</p></figcaption></figure>

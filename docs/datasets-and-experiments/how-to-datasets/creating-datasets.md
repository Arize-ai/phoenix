# Creating Datasets

{% hint style="info" %}
Datasets is currently in pre-release
{% endhint %}

## From CSV

When manually creating a dataset (let's say collecting hypothetical questions and answers), the easiest way to start is by using a spreadsheet. Once you've collected the information, you can simply upload the CSV of your data to the Phoenix platform using the UI.

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
    dataset_df,
    name="physics-questions",
    input_keys=["query"],
    output_keys=["responses"],
)

```
{% endtab %}
{% endtabs %}

## Syntetic Data

One of the quicket way of getting started is to produce synthetic queries using an LLM.

{% tabs %}
{% tab title="Python" %}
One use-case for synthetic data creation is when you are wanting to test out your RAG pipeline. You can leverage an LLM to synthesize hypothetical questions about your knowledge-base.

In the below example we will use phoenix's built-in llm\_generate, but you can leverage any synthetic dataset creation tool you'd like.

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
    questions_df, name="paul-graham-questions",
    input_keys=["question"],
    output_keys=["output"],
)
```
{% endtab %}
{% endtabs %}

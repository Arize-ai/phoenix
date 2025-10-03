---
hidden: true
---

# Custom Task Evaluation

## Customize Your Own Eval Templates

The LLM Evals library is designed to support the building of any custom Eval templates.

{% embed url="https://storage.googleapis.com/arize-phoenix-assets/assets/images/How_Do_Evals_Work_Diagram.png" %}

## Steps to Building Your Own Eval

Follow the following steps to easily build your own Eval with Phoenix

### 1. Choose a Metric

To do that, you must identify what is the **metric best suited for your use case**. Can you use a pre-existing template or do you need to evaluate something unique to your use case?

### 2. Build a Golden Dataset

Then, you need the **golden dataset**. This should be representative of the type of data you expect the LLM eval to see. The golden dataset should have the “ground truth” label so that we can measure performance of the LLM eval template. Often such labels come from human feedback.

Building such a dataset is laborious, but you can often find a standardized one for the most common use cases. Alternatively, you can use a dataset curated for your use case.&#x20;

```python
from phoenix.client import Client
client = Client()

dataset = client.datasets.get_dataset(dataset="tone_eval_qa_data")

df = dataset.to_dataframe()
df.head()
```

### 3. Decide Which LLM to use For Evaluation

Then you need to decide **which LLM** you want to use for evaluation. This could be a different LLM from the one you are using for your application. For example, you may be using Llama for your application and GPT-4 for your eval. Often this choice is influenced by questions of cost and accuracy.

```python
from phoenix.evals.llm import LLM

llm = LLM(
    provider="openai", model="gpt-4"
)
```

### 4. Build the Eval Template

Now comes the core component that we are trying to benchmark and improve: the **eval template**.

You can adjust an existing template or build your own from scratch.

Be explicit about the following:

* **What is the input?** In our example, it is the documents/context that was retrieved and the query from the user.
* **What are we asking?** In our example, we’re asking the LLM to tell us if the document was relevant to the query
* **What are the possible output formats?** In our example, it is binary relevant/irrelevant, but it can also be multi-class (e.g., fully relevant, partially relevant, not relevant).

In order to create a new template all that is needed is the setting of the input string to the Eval function.

```python
MY_CUSTOM_TEMPLATE = '''
    You are evaluating the positivity or negativity of the responses to questions.
    [BEGIN DATA]
    ************
    [Question]: {question}
    ************
    [Response]: {response}
    [END DATA]


    Please focus on the tone of the response.
    Your answer must be single word, either "positive" or "negative"
    '''
```

The above template shows an example creation of an easy to use string template. The Phoenix Eval templates support both strings and objects.

### 5. Run Eval on your Golden Dataset and Benchmark Performance

This example shows a use of the custom created template on the `df` dataframe.

```python
from phoenix.evals.evaluators import async_evaluate_dataframe
from phoenix.evals import create_classifier

tone_evaluator = create_classifier(
    name="tone",
    llm=llm,
    prompt_template=MY_CUSTOM_TEMPLATE,
    choices={"positive": 1.0, "negative": 0.0},
)


results_df = await async_evaluate_dataframe(
    dataframe=data,
    evaluators=[tone_evaluator],
)
result.head()
```

{% embed url="https://storage.googleapis.com/arize-phoenix-assets/assets/images/concepts-evals-datasets.png" %}

First, you need to run the eval across your golden dataset. Then you can **generate metrics** (overall accuracy, precision, recall, F1, etc.) to determine the benchmark. It is important to look at more than just overall accuracy.

---
hidden: true
---

# Quickstart: Evals

This quickstart guide will walk you through the basics of evaluating data from your AI application.

## Install Phoenix Evals

```bash
pip install -q "arize-phoenix-evals>=2"
pip install -q openai
```

## Prepare your dataset

The first thing you'll need is a dataset to evaluate. This could be your own collected or generated set of examples, or data you've exported from Phoenix traces. If you've already collected some trace data, this makes a great starting point.

For the sake of this guide however, we'll work with some toy data to evaluate. Feel free to substitute this with your own data, just be sure it includes the following columns:

* reference
* query
* response

```python
import pandas as pd

df = pd.DataFrame(
    [
        {
            "reference": "The Eiffel Tower is located in Paris, France. It was constructed in 1889 as the entrance arch to the 1889 World's Fair.",
            "query": "Where is the Eiffel Tower located?",
            "response": "The Eiffel Tower is located in Paris, France.",
        },
        {
            "reference": "The Great Wall of China is over 13,000 miles long. It was built over many centuries by various Chinese dynasties to protect against nomadic invasions.",
            "query": "How long is the Great Wall of China?",
            "response": "The Great Wall of China is approximately 13,171 miles (21,196 kilometers) long.",
        },
        {
            "reference": "The Amazon rainforest is the largest tropical rainforest in the world. It covers much of northwestern Brazil and extends into Colombia, Peru and other South American countries.",
            "query": "What is the largest tropical rainforest?",
            "response": "The Amazon rainforest is the largest tropical rainforest in the world. It is home to the largest number of plant and animal species in the world.",
        },
    ]
)
df.head()
```

## Run Evaluations

Steps: set up evaluators, run the evaluations, and log the results to visualize them in Phoenix.&#x20;

In this example, we want to run two evaluators. For the first, we use the built-in Hallucination evaluator that the Phoenix team has already benchmarked on hallucination detection tasks. For the second, we define our own custom LLM-as-a-judge evaluator to measure answer completeness.

We'll use OpenAI as our evaluation model for this example, but Phoenix also supports a number of [other models](how-to-evals/configuring-the-llm/). First, we need to add our OpenAI API key to our environment.

```python
import os
from getpass import getpass

if not (openai_api_key := os.getenv("OPENAI_API_KEY")):
    openai_api_key = getpass("🔑 Enter your OpenAI API key: ")

os.environ["OPENAI_API_KEY"] = openai_api_key
```

We set up the built-in `HallucinationEvaluator` with the LLM of choice. We have to bind an `input_mapping` so that the evaluator (which expects inputs named `input`, `output`, and `context`) works on our dataframe. Alternatively, you could rename the columns in the dataframe.&#x20;

```python
from phoenix.evals.llm import LLM
from phoenix.evals.metrics import HallucinationEvaluator

llm = LLM(model="gpt-4o", provider="openai")
hallucination = HallucinationEvaluator(llm=llm)
hallucination.bind({"input": "query", "output": "response", "context": "reference"})

# let's test on one example
scores = hallucination.evaluate(df.iloc[0].to_dict())
print(scores[0])
>>> Score(name='hallucination', score=1.0, label='factual', explanation='The response correctly identifies the location of the Eiffel Tower as stated in the context.', metadata={'model': 'gpt-4o'}, kind='llm', direction='maximize')
```

For our custom LLM evaluator, we write a prompt template and define label choices. Most LLM-as-a-judge evaluations can be framed as a classification task where the output is one of two or more categorical labels. For our completeness metric, we define three labels: complete, partially complete, or incomplete. Each label then gets mapped to a numeric score.&#x20;

Note: We don't need to bind an `input_mapping` like we did for the hallucination evaluator, since we defined the prompt template with placeholders that match columns in our dataframe.&#x20;

```python
from phoenix.evals import ClassificationEvaluator

completeness_prompt = """
You are an expert at judging the completeness of a response to a query.
Given a query and response, rate the completeness of the response.
A response is complete if it fully answers all parts of the query.
A response is partially complete if it only answers part of the query.
A response is incomplete if it does not answer any part of the query or is not related to the query.

Query: {{query}}
Response: {{response}}

Is the response complete, partially complete, or incomplete?
"""


completeness = ClassificationEvaluator(
    llm=llm, # use the same LLM instance from above
    name="completeness",
    prompt_template=completeness_prompt,
    choices={"complete": 1.0, "partially complete": 0.5, "incomplete": 0.0},
)

# test on one example
scores = completeness.evaluate(df.iloc[0].to_dict())
print(scores[0])
>>> Score(name='completeness', score=1.0, label='complete', explanation='The response directly answers the query by specifying the location of the Eiffel Tower, which was the information requested.', metadata={'model': 'gpt-4o'}, kind='llm', direction='maximize')
```

Now that we have defined and tested our two evaluators, we can run them on our whole dataset.&#x20;

```python
from phoenix.evals import async_evaluate_dataframe

results = await async_evaluate_dataframe(
    df,
    [hallucination, completeness],
    concurrency=10,
)
results.head()
```

The output `results` dataframe is a copy of our original dataframe with added columns for each score:

* `{score_name}_score` contains the JSON serialized score (or None if the evaluation failed)
* `{evaluator_name}_execution_details` contains information about the execution status, duration, and any exceptions that occurred.

## (Optional) Log Results to Phoenix

**Note:** You'll only be able to log evaluations to the Phoenix UI if you used a trace or span dataset exported from Phoenix as your dataset in this quickstart. Provided you started from a trace dataset, you can log your evaluation results to Phoenix using [these instructions](https://arize.com/docs/phoenix/tracing/how-to-tracing/llm-evaluations).

Otherwise, you can upload your dataset as a Phoenix dataset and run experiments using your evaluators. Learn more [about datasets and experiments](broken-reference).&#x20;


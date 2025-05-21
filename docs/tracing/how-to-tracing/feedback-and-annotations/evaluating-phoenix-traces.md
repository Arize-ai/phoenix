---
description: How to use an LLM judge to label and score your application
---

# Running Evals on Traces

This guide will walk you through the process of evaluating traces captured in Phoenix, and exporting the results to the Phoenix UI.

This process is similar to the [evaluation quickstart guide](https://docs.arize.com/phoenix/evaluation/evals), but instead of creating your own dataset or using an existing external one, you'll export a trace dataset from Phoenix and log the evaluation results to Phoenix.

### Install dependencies & Set environment variables

```bash
pip install -q "arize-phoenix>=4.29.0"
pip install -q openai 'httpx<0.28'
```

```python
import os
from getpass import getpass

import dotenv

dotenv.load_dotenv()

if not (openai_api_key := os.getenv("OPENAI_API_KEY")):
    openai_api_key = getpass("🔑 Enter your OpenAI API key: ")

os.environ["OPENAI_API_KEY"] = openai_api_key
```

### Connect to Phoenix

Note: if you're self-hosting Phoenix, swap your collector endpoint variable in the snippet below, and remove the Phoenix Client Headers variable.

```python
import os

PHOENIX_API_KEY = "ADD YOUR API KEY"
os.environ["PHOENIX_CLIENT_HEADERS"] = f"api_key={PHOENIX_API_KEY}"
os.environ["PHOENIX_COLLECTOR_ENDPOINT"] = "https://app.phoenix.arize.com"
```

Now that we have Phoenix configured, we can register that instance with OpenTelemetry, which will allow us to collect traces from our application here.

```python
from phoenix.otel import register

tracer_provider = register(project_name="evaluating_traces_quickstart")
```

### Prepare trace dataset

For the sake of making this guide fully runnable, we'll briefly generate some traces and track them in Phoenix. Typically, you would have already captured traces in Phoenix and would skip to "Download trace dataset from Phoenix"

```
%%bash
pip install -q openinference-instrumentation-openai
```

```python
from openinference.instrumentation.openai import OpenAIInstrumentor

OpenAIInstrumentor().instrument(tracer_provider=tracer_provider)
```

```python
from openai import OpenAI

# Initialize OpenAI client
client = OpenAI()


# Function to generate a joke
def generate_joke():
    response = client.chat.completions.create(
        model="gpt-3.5-turbo",
        messages=[
            {"role": "system", "content": "You are a helpful assistant that generates jokes."},
            {"role": "user", "content": "Tell me a joke."},
        ],
    )
    joke = response.choices[0].message.content
    return joke


# Generate 5 different jokes
jokes = []
for _ in range(5):
    joke = generate_joke()
    jokes.append(joke)
    print(f"Joke {len(jokes)}:\n{joke}\n")

print(f"Generated {len(jokes)} jokes and tracked them in Phoenix.")
```

### Download trace dataset from Phoenix

```python
import phoenix as px

spans_df = px.Client().get_spans_dataframe(project_name="evaluating_traces_quickstart")
spans_df.head()
```

### Generate evaluations

Now that we have our trace dataset, we can generate evaluations for each trace. Evaluations can be generated in many different ways. Ultimately, we want to end up with a set of labels and/or scores for our traces.

You can generate evaluations using:

* Plain code
* Phoenix's [built-in LLM as a Judge evaluators](https://docs.arize.com/phoenix/evaluation/how-to-evals/running-pre-tested-evals)
* Your own [custom LLM as a Judge evaluator](https://docs.arize.com/phoenix/evaluation/how-to-evals/bring-your-own-evaluator)
* Other evaluation packages

As long as you format your evaluation results properly, you can upload them to Phoenix and visualize them in the UI.

Let's start with a simple example of generating evaluations using plain code. OpenAI has a habit of repeating jokes, so we'll generate evaluations to label whether a joke is a repeat of a previous joke.

```python
# Create a new DataFrame with selected columns
eval_df = spans_df[["context.span_id", "attributes.llm.output_messages"]].copy()
eval_df.set_index("context.span_id", inplace=True)

# Create a list to store unique jokes
unique_jokes = set()


# Function to check if a joke is a duplicate
def is_duplicate(joke_data):
    joke = joke_data[0]["message.content"]
    if joke in unique_jokes:
        return True
    else:
        unique_jokes.add(joke)
        return False


# Apply the is_duplicate function to create the new column
eval_df["label"] = eval_df["attributes.llm.output_messages"].apply(is_duplicate)

# Convert boolean to integer (0 for False, 1 for True)
eval_df["label"] = eval_df["label"]

# Reset unique_jokes list to ensure correct results if the cell is run multiple times
unique_jokes.clear()
```

We now have a DataFrame with a column for whether each joke is a repeat of a previous joke. Let's upload this to Phoenix.

### Upload evaluations to Phoenix

Our evals\_df has a column for the span\_id and a column for the evaluation result. The span\_id is what allows us to connect the evaluation to the correct trace in Phoenix. Phoenix will also automatically look for columns named "label" and "score" to display in the UI.

```python
eval_df["score"] = eval_df["score"].astype(int)
eval_df["label"] = eval_df["label"].astype(str)
```

```python
from phoenix.trace import SpanEvaluations

px.Client().log_evaluations(SpanEvaluations(eval_name="Duplicate", dataframe=eval_df))
```

You should now see evaluations in the Phoenix UI!

From here you can continue collecting and evaluating traces, or move on to one of these other guides:

* If you're interested in more complex evaluation and evaluators, start with [how to use LLM as a Judge evaluators](https://docs.arize.com/phoenix/evaluation/how-to-evals/running-pre-tested-evals)
* If you're ready to start testing your application in a more rigorous manner, check out [how to run structured experiments](https://docs.arize.com/phoenix/datasets-and-experiments/how-to-experiments/run-experiments)

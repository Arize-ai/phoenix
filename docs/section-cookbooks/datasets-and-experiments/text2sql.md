# Text2SQL

[![Open In Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/arize-ai/phoenix/blob/main/tutorials/experiments/txt2sql.ipynb)

{% embed url="https://www.youtube.com/watch?v=rzxN-YV_DbE" %}

Let's work through a Text2SQL use case where we are starting from scratch without a nice and clean dataset of questions, SQL queries, or expected responses.

note: this is based on a tutorial originally authored by [Ankur Goyal](https://www.braintrust.dev/docs/cookbook/recipes/Text2SQL-Data)

```shell
pip install 'arize-phoenix>=4.6.0' openai duckdb datasets pyarrow pydantic nest_asyncio openinference-instrumentation-openai --quiet
```

Let's first start a phoenix server. Note that this is not necessary if you have a phoenix server running already.

```python
import phoenix as px

px.launch_app()
```

Let's also setup tracing for OpenAI as we will be using their API to perform the synthesis.

```python
from openinference.instrumentation.openai import OpenAIInstrumentor

from phoenix.otel import register

tracer_provider = register()
OpenAIInstrumentor().instrument(tracer_provider=tracer_provider)
```

Let's make sure we can run async code in the notebook.

```python
import nest_asyncio

nest_asyncio.apply()
```

Lastly, let's make sure we have our openai API key set up.

```python
import os
from getpass import getpass

if not os.getenv("OPENAI_API_KEY"):
    os.environ["OPENAI_API_KEY"] = getpass("🔑 Enter your OpenAI API key: ")
```

### Download Data

We are going to use the NBA dataset that information from 2014 - 2018. We will use DuckDB as our database.

```python
import duckdb
from datasets import load_dataset

data = load_dataset("suzyanil/nba-data")["train"]

conn = duckdb.connect(database=":memory:", read_only=False)
conn.register("nba", data.to_pandas())

conn.query("SELECT * FROM nba LIMIT 5").to_df().to_dict(orient="records")[0]
```

### Implement Text2SQL

Let's start by implementing a simple text2sql logic.

```python
import os

import openai

client = openai.AsyncClient()

columns = conn.query("DESCRIBE nba").to_df().to_dict(orient="records")

# We will use GPT4o to start
TASK_MODEL = "gpt-4o"
CONFIG = {"model": TASK_MODEL}


system_prompt = (
    "You are a SQL expert, and you are given a single table named nba with the following columns:\n"
    f"{",".join(column["column_name"] + ": " + column["column_type"] for column in columns)}\n"
    "Write a SQL query corresponding to the user's request. Return just the query text, "
    "with no formatting (backticks, markdown, etc.)."
)


async def generate_query(input):
    response = await client.chat.completions.create(
        model=TASK_MODEL,
        temperature=0,
        messages=[
            {
                "role": "system",
                "content": system_prompt,
            },
            {
                "role": "user",
                "content": input,
            },
        ],
    )
    return response.choices[0].message.content
```

```python
query = await generate_query("Who won the most games?")
print(query)
```

Awesome, looks like the LLM is producing SQL! let's try running the query and see if we get the expected results.

```python
def execute_query(query):
    return conn.query(query).fetchdf().to_dict(orient="records")


execute_query(query)
```

### Evaluation

Evaluation consists of three parts — data, task, and scores. We'll start with data.

```python
questions = [
    "Which team won the most games?",
    "Which team won the most games in 2015?",
    "Who led the league in 3 point shots?",
    "Which team had the biggest difference in records across two consecutive years?",
    "What is the average number of free throws per year?",
]
```

Let's store the data above as a versioned dataset in phoenix.

```python
import pandas as pd

ds = px.Client().upload_dataset(
    dataset_name="nba-questions",
    dataframe=pd.DataFrame([{"question": question} for question in questions]),
    input_keys=["question"],
    output_keys=[],
)

# If you have already uploaded the dataset, you can fetch it using the following line
# ds = px.Client().get_dataset(name="nba-questions")
```

Next, we'll define the task. The task is to generate SQL queries from natural language questions.

```python
async def text2sql(question):
    query = await generate_query(question)
    results = None
    error = None
    try:
        results = execute_query(query)
    except duckdb.Error as e:
        error = str(e)

    return {
        "query": query,
        "results": results,
        "error": error,
    }
```

Finally, we'll define the scores. We'll use the following simple scoring functions to see if the generated SQL queries are correct.

```python
# Test if there are no sql execution errors
def no_error(output):
    return 1.0 if output.get("error") is None else 0.0


# Test if the query has results
def has_results(output):
    results = output.get("results")
    has_results = results is not None and len(results) > 0
    return 1.0 if has_results else 0.0
```

Now let's run the evaluation experiment.

```python
import phoenix as px
from phoenix.experiments import run_experiment


# Define the task to run text2sql on the input question
def task(input):
    return text2sql(input["question"])


experiment = run_experiment(
    ds, task=task, evaluators=[no_error, has_results], experiment_metadata=CONFIG
)
```

Ok! It looks like 3/5 of our queries are valid.

### Interpreting the results

Now that we ran the initial evaluation, it looks like two of the results are valid, two produce SQL errors, and one is incorrect.

* The incorrect query didn't seem to get the date format correct. That would probably be improved by showing a sample of the data to the model (e.g. few shot example).
* There are is a binder error, which may also have to do with not understanding the data format.

Let's try to improve the prompt with few-shot examples and see if we can get better results.

```python
samples = conn.query("SELECT * FROM nba LIMIT 1").to_df().to_dict(orient="records")[0]
sample_rows = "\n".join(
    f"{column['column_name']} | {column['column_type']} | {samples[column['column_name']]}"
    for column in columns
)
system_prompt = (
    "You are a SQL expert, and you are given a single table named nba with the following columns:\n\n"
    "Column | Type | Example\n"
    "-------|------|--------\n"
    f"{sample_rows}\n"
    "\n"
    "Write a DuckDB SQL query corresponding to the user's request. "
    "Return just the query text, with no formatting (backticks, markdown, etc.)."
)


async def generate_query(input):
    response = await client.chat.completions.create(
        model=TASK_MODEL,
        temperature=0,
        messages=[
            {
                "role": "system",
                "content": system_prompt,
            },
            {
                "role": "user",
                "content": input,
            },
        ],
    )
    return response.choices[0].message.content


print(await generate_query("Which team won the most games in 2015?"))
```

Looking much better! Finally, let's add a scoring function that compares the results, if they exist, with the expected results.

```python
experiment = run_experiment(
    ds, task=task, evaluators=[has_results, no_error], experiment_metadata=CONFIG
)
```

Amazing. It looks like we removed one of the errors, and got a result for the incorrect query. Let's try out using LLM as a judge to see how well it can assess the results.

```python
from phoenix.evals.models import OpenAIModel
from phoenix.experiments import evaluate_experiment
from phoenix.experiments.evaluators.llm_evaluators import LLMCriteriaEvaluator

llm_evaluator = LLMCriteriaEvaluator(
    name="is_sql",
    criteria="is_sql",
    description="the output is a valid SQL query and that it executes without errors",
    model=OpenAIModel(),
)

evaluate_experiment(experiment, evaluators=[llm_evaluator])
```

Sure enough the LLM agrees with our scoring. Pretty neat trick! This can come in useful when it's difficult to define a scoring function.

We now have a simple text2sql pipeline that can be used to generate SQL queries from natural language questions. Since Phoenix has been tracing the entire pipeline, we can now use the Phoenix UI to convert the spans that generated successful queries into examples to use in **Golden Dataset** for regression testing!

![](https://storage.googleapis.com/arize-assets/phoenix/assets/images/golden_dataset.png)

### Generating more data

Now that we have a basic flow in place, let's generate some data. We're going to use the dataset itself to generate expected queries, and have a model describe the queries. This is a slightly more robust method than having it generate queries, because we'd expect a model to describe a query more accurately than generate one from scratch.

```python
import json

from pydantic import BaseModel


class Question(BaseModel):
    sql: str
    question: str


class Questions(BaseModel):
    questions: list[Question]


synthetic_data_prompt = f"""\
You are a SQL expert, and you are given a single table named nba with the following columns:

Column | Type | Example
-------|------|--------
{"\n".join(f"{column['column_name']} | {column['column_type']} | {samples[column['column_name']]}" for column in columns)}

Generate SQL queries that would be interesting to ask about this table. Return the SQL query as a string, as well as the
question that the query answers."""

response = await client.chat.completions.create(
    model="gpt-4o",
    temperature=0,
    messages=[
        {
            "role": "user",
            "content": synthetic_data_prompt,
        }
    ],
    tools=[
        {
            "type": "function",
            "function": {
                "name": "generate_questions",
                "description": "Generate SQL queries that would be interesting to ask about this table.",
                "parameters": Questions.model_json_schema(),
            },
        }
    ],
    tool_choice={"type": "function", "function": {"name": "generate_questions"}},
)

generated_questions = json.loads(response.choices[0].message.tool_calls[0].function.arguments)[
    "questions"
]
generated_questions[0]
```

```python
generated_dataset = []
for q in generated_questions:
    try:
        result = execute_query(q["sql"])
        generated_dataset.append(
            {
                "input": q["question"],
                "expected": {
                    "results": result,
                    "error": None,
                    "query": q["sql"],
                },
                "metadata": {
                    "category": "Generated",
                },
            }
        )
    except duckdb.Error as e:
        print(f"Query failed: {q['sql']}", e)
        print("Skipping...")

generated_dataset[0]
```

Awesome, let's crate a dataset with the new synthetic data.

```python
synthetic_dataset = px.Client().upload_dataset(
    dataset_name="nba-golden-synthetic",
    inputs=[{"question": example["input"]} for example in generated_dataset],
    outputs=[example["expected"] for example in generated_dataset],
);
```

```python
run_experiment(
    synthetic_dataset, task=task, evaluators=[no_error, has_results], experiment_metadata=CONFIG
)
```

Amazing! Now we have a rich dataset to work with and some failures to debug. From here, you could try to investigate whether some of the generated data needs improvement, or try tweaking the prompt to improve accuracy, or maybe even something more adventurous, like feed the errors back to the model and have it iterate on a better query. Most importantly, we have a good workflow in place to iterate on both the application and dataset.

## Trying a smaller model

Just for fun, let's wrap things up by trying out GPT-3.5-turbo. All we need to do is switch the model name, and run our Eval() function again.

```python
TASK_MODEL = "gpt-3.5-turbo"

experiment = run_experiment(
    synthetic_dataset,
    task=task,
    evaluators=[no_error, has_results],
    experiment_metadata={"model": TASK_MODEL},
)
```

Interesting! It looks like the smaller model is able to do decently well but we might want to ensure it follows instructions as well as a larger model. We can actually grab all the LLM spans from our previous GPT40 runs and use them to generate a OpenAI fine-tuning JSONL file!

<figure><img src="https://storage.googleapis.com/arize-assets/phoenix/assets/images/openai_ft.png" alt=""><figcaption></figcaption></figure>

<figure><img src="https://storage.googleapis.com/arize-assets/phoenix/assets/images/fine_tining_nba.png" alt=""><figcaption></figcaption></figure>

### Conclusion

In this example, we walked through the process of building a dataset for a text2sql application. We started with a few handwritten examples, and iterated on the dataset by using an LLM to generate more examples. We used the eval framework to track our progress, and iterated on the model and dataset to improve the results. Finally, we tried out a less powerful model to see if we could save cost or improve latency.

Happy evaluations!

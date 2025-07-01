# Text2SQL

[![Open In Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/arize-ai/phoenix/blob/main/tutorials/experiments/txt2sql.ipynb)

Building effective text-to-SQL systems requires rigorous evaluation and systematic experimentation. This tutorial demonstrates how to build, evaluate, and improve a text-to-SQL system using Phoenix's experimentation framework.

We'll use a movie database to showcase the complete evaluation-driven development process, starting from scratch without pre-existing datasets. Phoenix serves as your scientific laboratory, recording every experiment to help you build better AI systems.

```python
!pip install "arize-phoenix>=11.0.0" openai 'httpx<0.28' duckdb datasets pyarrow "pydantic>=2.0.0" nest_asyncio openinference-instrumentation-openai --quiet
```

## Setup

First, start a Phoenix server to act as your evaluation dashboard and experiment tracker:

Note: This step is not necessary if running against a deployed Phoenix instance.

```python
import phoenix as px

px.launch_app().view()
```

Setup tracing for OpenAI to observe every step of our text-to-SQL pipeline:

```python
from phoenix.otel import register

tracer_provider = register(endpoint="http://localhost:6006/v1/traces", auto_instrument=True, verbose=False) # Instruments all openai calls

tracer = tracer_provider.get_tracer(__name__)
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

## Download Data

We are going to use a movie dataset that contains recent titles and their ratings. We will use DuckDB as our database so that we can run the queries directly in the notebook, but you can imagine that this could be a pre-existing SQL database with business-specific data.

```python
import duckdb
from datasets import load_dataset

data = load_dataset("wykonos/movies")["train"]

conn = duckdb.connect(database=":memory:", read_only=False)
conn.register("movies", data.to_pandas())

# Preview the data
records = conn.query("SELECT * FROM movies LIMIT 5").to_df().to_dict(orient="records")
for record in records:
    print(record)
```

## Implement Text2SQL

Let's create a simple text-to-SQL pipeline:

```python
import openai

client = openai.AsyncClient()
columns = conn.query("DESCRIBE movies").to_df().to_dict(orient="records")

TASK_MODEL = "gpt-4o"
CONFIG = {"model": TASK_MODEL}

system_prompt = (
    "You are a SQL expert, and you are given a single table named movies with the following columns:\n"
    f'{",".join(column["column_name"] + ": " + column["column_type"] for column in columns)}\n'
    "Write a SQL query corresponding to the user's request. Return just the query text, "
    "with no formatting (backticks, markdown, etc.)."
)

@tracer.chain
async def generate_query(input):
    response = await client.chat.completions.create(
        model=TASK_MODEL,
        temperature=0,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": input},
        ],
    )
    return response.choices[0].message.content
```

```python
query = await generate_query("what was the most popular movie?")
print(query)
```

Awesome, looks like the we are producing SQL! let's try running the query and see if we get the expected results.

```python
@tracer.tool
def execute_query(query):
    return conn.query(query).fetchdf().to_dict(orient="records")

execute_query(query)
```

## Evaluation Framework

Effective AI evaluation requires three pillars:

1. **Data**: Curated examples representing real-world use cases
2. **Task**: The actual function being evaluated  
3. **Evaluators**: Quantitative measures of performance

### Create Dataset

Start with a set of movie-related questions:

```python
questions = [
    "Which movie received the most votes?",
    "What is the top grossing movie?",
    "Which movies have the highest ratings?",
    "What are the best sci-fi movies released after 2010?",
    "Which Marvel movie made the most money?",
    "What animated movies were most popular?",
]
```

Let's store the data above as a versioned dataset in phoenix.

```python
import pandas as pd

ds = px.Client().upload_dataset(
    dataset_name="movie-example-questions",
    dataframe=pd.DataFrame([{"question": question} for question in questions]),
    input_keys=["question"],
    output_keys=[],
)

# If you have already uploaded the dataset, you can fetch it using the following line
# ds = px.Client().get_dataset(name="movie-example-questions")
```

Next, we'll define the task. The task is to generate SQL queries from natural language questions.

```python

@tracer.chain
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

Finally, we'll define the evaluation scores. We'll use the following simple scoring functions to see if the generated SQL queries are correct.

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

Great! Let's see how our baseline model performed on the movie questions. We can analyze both successful queries and any failures to understand where improvements are needed.

## Interpreting the results

Now that we ran the initial evaluation, let's analyze what might be causing any failures.

From looking at the query where there are no results, genre-related queries might fail because the model doesn't know how genres are stored (e.g., "Sci-Fi" vs "Science Fiction")

These types of issues would probably be improved by showing a sample of the data to the model (few-shot examples) since the data will show the LLM what is queryable.

Let's try to improve the prompt with few-shot examples and see if we can get better results.

```python
samples = conn.query("SELECT * FROM movies LIMIT 5").to_df().to_dict(orient="records")

example_row = "\n".join(
    f"{column['column_name']} | {column['column_type']} | {samples[0][column['column_name']]}"
    for column in columns
)

column_header = " | ".join(column['column_name'] for column in columns)

few_shot_examples = "\n".join(
    " | ".join(str(sample[column['column_name']]) for column in columns)
    for sample in samples
)

system_prompt = (
    "You are a SQL expert, and you are given a single table named `movies` with the following columns:\n\n"
    "Column | Type | Example\n"
    "-------|------|--------\n"
    f"{example_row}\n"
    "\n"
    "Examples:\n"
    f"{column_header}\n"
    f"{few_shot_examples}\n"
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


print(await generate_query("what are the best sci-fi movies in the 2000s?"))
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
    model=OpenAIModel(model="gpt-4o"),
)

evaluate_experiment(experiment, evaluators=[llm_evaluator])
```

Sure enough the LLM agrees with our scoring. Pretty neat trick! This can come in useful when it's difficult to define a scoring function.

We now have a simple text2sql pipeline that can be used to generate SQL queries from natural language questions. Since Phoenix has been tracing the entire pipeline, we can now use the Phoenix UI to convert the spans that generated successful queries into examples to use in **Golden Dataset** for regression testing!

## Generating more data

Now that we have a basic flow in place, let's generate some data. We're going to use the dataset itself to generate expected queries, and have a model describe the queries. This is a slightly more robust method than having it generate queries, because we'd expect a model to describe a query more accurately than generate one from scratch.

```python
import json
from typing import List

from pydantic import BaseModel


class Question(BaseModel):
    sql: str
    question: str


class Questions(BaseModel):
    questions: List[Question]


sample_rows = "\n".join(
    f"{column['column_name']} | {column['column_type']} | {samples[0][column['column_name']]}"
    for column in columns
)
synthetic_data_prompt = f"""You are a SQL expert, and you are given a single table named movies with the following columns:

Column | Type | Example
-------|------|--------
{sample_rows}

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

assert response.choices[0].message.tool_calls is not None
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
    dataset_name="movies-golden-synthetic",
    inputs=[{"question": example["input"]} for example in generated_dataset],
    outputs=[example["expected"] for example in generated_dataset],
);
```

```python
run_experiment(
    synthetic_dataset, task=task, evaluators=[no_error, has_results], experiment_metadata=CONFIG
)
```

Great! We now have lots of data to work with, including some failed queries that we can fix. You can try a few things to make it better:

- Check if any of the generated data has problems
- Adjust the prompt to get more accurate results
- Try something new, like showing the errors to the model to help it write better queries

The main thing is that we now have a good process to keep improving both our app and our data.

## Conclusion

In this tutorial, we built a text-to-SQL system for querying movie data. We started with basic examples and evaluators, then improved performance by adding few-shot examples and synthetic data generation.

Key takeaways:

- Start with simple evaluators to catch basic issues
- Use few-shot examples to improve accuracy
- Generate more training data using LLMs
- Track progress with Phoenix's experiments

You can further improve this system by adding better evaluators or handling edge cases.

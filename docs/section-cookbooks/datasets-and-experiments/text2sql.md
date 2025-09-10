# Text2SQL

[![Open In Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/arize-ai/phoenix/blob/main/tutorials/experiments/txt2sql.ipynb)

Building effective text-to-SQL systems requires rigorous evaluation and systematic experimentation. In this tutorial, we'll walk through the complete evaluation-driven development process, starting from scratch without pre-existing datasets of questions or expected responses.

We'll use a movie database containing recent titles, ratings, box office performance, and metadata to demonstrate how to build, evaluate, and systematically improve a text-to-SQL system using Phoenix's experimentation framework. Think of Phoenix as your scientific laboratory, meticulously recording every experiment to help you build better AI systems.


```python
!pip install "arize-phoenix>=11.0.0" openai 'httpx<0.28' duckdb datasets pyarrow "pydantic>=2.0.0" nest_asyncio openinference-instrumentation-openai --quiet
```

Let's first start a phoenix server to act as our evaluation dashboard and experiment tracker. This will be our central hub for observing, measuring, and improving our text-to-SQL system.

Note: this step is not necessary if you already have a Phoenix server running.


```python
import phoenix as px

px.launch_app().view()
```

Let's also setup tracing for OpenAI. Tracing is crucial for evaluation-driven development - it allows Phoenix to observe every step of our text-to-SQL pipeline, capturing inputs, outputs, and metrics like latency and cost that we'll use to systematically improve our system.


```python
from phoenix.otel import register

tracer_provider = register(
    endpoint="http://localhost:6006/v1/traces", auto_instrument=True, verbose=False
)  # Instruments all OpenAI calls

tracer = tracer_provider.get_tracer(__name__)
```

Let's make sure we can run async code in the notebook.


```python
import nest_asyncio

nest_asyncio.apply()
```

Lastly, let's make sure we have our OpenAI API key set up.


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

records = conn.query("SELECT * FROM movies LIMIT 5").to_df().to_dict(orient="records")

for record in records:
    print(record)
```

## Implement Text2SQL

Let's start by implementing a simple text2sql logic.


```python
import os

import openai

client = openai.AsyncClient()

columns = conn.query("DESCRIBE movies").to_df().to_dict(orient="records")

# We will use GPT-4o to start
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

## The Three Pillars of Evaluation

Effective AI evaluation rests on three fundamental pillars:

1. **Data**: Curated examples that represent real-world use cases
2. **Task**: The actual function or workflow being evaluated  
3. **Evaluators**: Quantitative measures of performance

Let's start by creating our **data** - a set of movie-related questions that we want our text-to-SQL system to handle correctly.


```python
questions = [
    "Which Brad Pitt movie received the highest rating?",
    "What is the top grossing Marvel movie?",
    "What foreign-language fantasy movie was the most popular?",
    "what are the best sci-fi movies of 2017?",
    "What anime topped the box office in the 2010s?",
    "Recommend a romcom that stars Paul Rudd.",
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

Finally, we'll define the evaluation scores. We'll use the following simple functions to see if the generated SQL queries are correct. Note that `has_results` is a good metric here because we know that all the questions we added to the dataset can be answered via SQL.


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

column_header = " | ".join(column["column_name"] for column in columns)

few_shot_examples = "\n".join(
    " | ".join(str(sample[column["column_name"]]) for column in columns) for sample in samples
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

Amazing. It looks like the LLM is generating a valid query for all questions. Let's try out using LLM as a judge to see how well it can assess the results.


```python
import json

from openai import OpenAI

from phoenix.experiments import evaluate_experiment
from phoenix.experiments.evaluators import create_evaluator
from phoenix.experiments.types import EvaluationResult

openai_client = OpenAI()

judge_instructions = """
You are a judge that determines if a given question can be answered with the provided SQL query and results.
Make sure to ensure that the SQL query maps to the question accurately.

Provide the label `correct` if the SQL query and results accurately answer the question.
Provide the label `invalid` if the SQL query does not map to the question or is not valid.
"""


@create_evaluator(name="qa_correctness", kind="llm")
def qa_correctness(input, output):
    question = input.get("question")
    query = output.get("query")
    results = output.get("results")
    response = openai_client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": judge_instructions},
            {
                "role": "user",
                "content": f"Question: {question}\nSQL Query: {query}\nSQL Results: {results}",
            },
        ],
        tool_choice="required",
        tools=[
            {
                "type": "function",
                "function": {
                    "name": "qa_correctness",
                    "description": "Determine if the SQL query and results accurately answer the question.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "explanation": {
                                "type": "string",
                                "description": "Explain why the label is correct or invalid.",
                            },
                            "label": {"type": "string", "enum": ["correct", "invalid"]},
                        },
                    },
                },
            }
        ],
    )
    if response.choices[0].message.tool_calls is None:
        raise ValueError("No tool call found in response")
    args = json.loads(response.choices[0].message.tool_calls[0].function.arguments)
    label = args["label"]
    explanation = args["explanation"]
    score = 1 if label == "correct" else 0
    return EvaluationResult(score=score, label=label, explanation=explanation)


evaluate_experiment(experiment, evaluators=[qa_correctness])
```

The LLM judge's scoring closely matches our manual evaluation, demonstrating its effectiveness as an automated evaluation method. This approach is particularly valuable when traditional rule-based scoring functions are difficult to implement. 

The LLM judge also shows an advantage in nuanced understanding - for example, it correctly identifies that 'Anime' and 'Animation' are distinct genres, a subtlety our code-based evaluators missed. This highlights why developing custom LLM judges tailored to your specific task requirements is crucial for accurate evaluation.


We now have a simple text2sql pipeline that can be used to generate SQL queries from natural language questions. Since Phoenix has been tracing the entire pipeline, we can now use the Phoenix UI to convert the spans that generated successful queries into examples to use in **Golden Dataset** for regression testing as well.

## Generating more data

Let's generate some training data by having the model describe existing SQL queries from our dataset





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
question that the query answers. Keep the questions bounded so that they are not too broad or too narrow."""

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

print("Generated N questions: ", len(generated_questions))
print("First question: ", generated_questions[0])
```


```python
generated_dataset = []
for q in generated_questions:
    try:
        result = execute_query(q["sql"])
        example =  {
                "input": q["question"],
                "expected": {
                    "results": result or [],
                    "query": q["sql"],
                },
                "metadata": {
                    "category": "Generated",
                },
            }
        print(example)
        generated_dataset.append(example)
    except duckdb.Error as e:
        print(f"Query failed: {q['sql']}", e)
        print("Skipping...")

generated_dataset[0]
```

Awesome, let's create a dataset with the new synthetic data.

```python
synthetic_dataset = px.Client().upload_dataset(
    dataset_name="movies-golden-synthetic",
    inputs=[{"question": example["input"]} for example in generated_dataset],
    outputs=[example["expected"] for example in generated_dataset],
);
```

```python
exp = run_experiment(
    synthetic_dataset, task=task, evaluators=[no_error, has_results], experiment_metadata=CONFIG
)
```

```python
exp.as_dataframe()
```

Great! We now have more data to work with. Here are some ways to improve it:

 - Review the generated data for issues
 - Refine the prompt
 - Show errors to the model

This gives us a process to keep improving our system.

## Conclusion

In this tutorial, we built a text-to-SQL system for querying movie data. We started with basic examples and evaluators, then improved performance by adding few-shot examples as well as using an LLM judge for evaluation.

Key takeaways:
- Start with simple evaluators to catch basic issues
- Use few-shot examples to improve accuracy 
- Generate more training data using LLMs
- Track progress with Phoenix's experiments

You can further improve this system by adding better evaluators or handling edge cases.

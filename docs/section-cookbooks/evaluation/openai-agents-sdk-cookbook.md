# OpenAI Agents SDK Cookbook

{% embed url="https://youtu.be/iOGu7-HYm6s?si=aj-kiSzj7SrOVhEr" %}

This guide shows you how to create and evaluate agents with Phoenix to improve performance. We'll go through the following steps:

* Create an agent using the OpenAI agents SDK
* Trace the agent activity
* Create a dataset to benchmark performance
* Run an experiment to evaluate agent performance using LLM as a judge
* Learn how to evaluate traces in production

{% embed url="https://colab.research.google.com/github/Arize-ai/phoenix/blob/main/tutorials/evals/openai_agents_cookbook.ipynb" %}

## Initial setup

#### Install Libraries

```python
!pip install -q "arize-phoenix>=8.0.0" openinference-instrumentation-openai-agents openinference-instrumentation-openai --upgrade
!pip install -q openai nest_asyncio openai-agents
```

#### Setup Dependencies and Keys

Next you need to connect to Phoenix. The code below will connect you to a Phoenix Cloud instance. You can also [connect to a self-hosted Phoenix instance](https://docs.arize.com/phoenix/deployment) if you'd prefer.

```python
import os

import nest_asyncio

nest_asyncio.apply()

from getpass import getpass

os.environ["PHOENIX_COLLECTOR_ENDPOINT"] = "https://app.phoenix.arize.com"
if not os.environ.get("PHOENIX_CLIENT_HEADERS"):
    os.environ["PHOENIX_CLIENT_HEADERS"] = "api_key=" + getpass("Enter your Phoenix API key: ")

if not os.environ.get("OPENAI_API_KEY"):
    os.environ["OPENAI_API_KEY"] = getpass("Enter your OpenAI API key: ")
```

#### Setup Tracing

```python
from phoenix.otel import register

# Setup Tracing
tracer_provider = register(
    project_name="openai-agents-cookbook",
    endpoint="https://app.phoenix.arize.com/v1/traces",
    auto_instrument=True,
)
```

## Create your first agent with the OpenAI SDK

Here we've setup a basic agent that can solve math problems. We have a function tool that can solve math equations, and an agent that can use this tool.

We'll use the `Runner` class to run the agent and get the final output.

```python
from agents import Runner, function_tool


@function_tool
def solve_equation(equation: str) -> str:
    """Use python to evaluate the math equation, instead of thinking about it yourself.

    Args:
       equation: string which to pass into eval() in python
    """
    return str(eval(equation))
```

```python
from agents import Agent

agent = Agent(
    name="Math Solver",
    instructions="You solve math problems by evaluating them with python and returning the result",
    tools=[solve_equation],
)
```

```python
result = await Runner.run(agent, "what is 15 + 28?")

# Run Result object
print(result)

# Get the final output
print(result.final_output)

# Get the entire list of messages recorded to generate the final output
print(result.to_input_list())
```

Now we have a basic agent, let's evaluate whether the agent responded correctly!

## Evaluating our agent

Agents can go awry for a variety of reasons.

1. Tool call accuracy - did our agent choose the right tool with the right arguments?
2. Tool call results - did the tool respond with the right results?
3. Agent goal accuracy - did our agent accomplish the stated goal and get to the right outcome?

We'll setup a simple evaluator that will check if the agent's response is correct, you can read about different types of agent evals [here](https://docs.arize.com/arize/llm-evaluation-and-annotations/how-does-evaluation-work/agent-evaluation).

Let's setup our evaluation by defining our task function, our evaluator, and our dataset.

```python
import asyncio


# This is our task function. It takes a question and returns the final output and the messages recorded to generate the final output.
async def solve_math_problem(dataset_row: dict):
    result = await Runner.run(agent, dataset_row.get("question"))
    return {
        "final_output": result.final_output,
        "messages": result.to_input_list(),
    }


dataset_row = {"question": "What is 15 + 28?"}

result = asyncio.run(solve_math_problem(dataset_row))
print(result)
```

Next, we create our evaluator.

```python
import pandas as pd

from phoenix.evals import OpenAIModel, llm_classify


def correctness_eval(input, output):
    # Template for evaluating math problem solutions
    MATH_EVAL_TEMPLATE = """
    You are evaluating whether a math problem was solved correctly.

    [BEGIN DATA]
    ************
    [Question]: {question}
    ************
    [Response]: {response}
    [END DATA]

    Assess if the answer to the math problem is correct. First work out the correct answer yourself,
    then compare with the provided response. Consider that there may be different ways to express the same answer
    (e.g., "43" vs "The answer is 43" or "5.0" vs "5").

    Your answer must be a single word, either "correct" or "incorrect"
    """

    # Run the evaluation
    rails = ["correct", "incorrect"]
    eval_df = llm_classify(
        data=pd.DataFrame([{"question": input["question"], "response": output["final_output"]}]),
        template=MATH_EVAL_TEMPLATE,
        model=OpenAIModel(model="gpt-4.1"),
        rails=rails,
        provide_explanation=True,
    )
    label = eval_df["label"][0]
    score = 1 if label == "correct" else 0
    return score
```

## Create synthetic dataset of questions

Using the template below, we're going to generate a dataframe of 25 questions we can use to test our math problem solving agent.

```python
MATH_GEN_TEMPLATE = """
You are an assistant that generates diverse math problems for testing a math solver agent.
The problems should include:

Basic Operations: Simple addition, subtraction, multiplication, division problems.
Complex Arithmetic: Problems with multiple operations and parentheses following order of operations.
Exponents and Roots: Problems involving powers, square roots, and other nth roots.
Percentages: Problems involving calculating percentages of numbers or finding percentage changes.
Fractions: Problems with addition, subtraction, multiplication, or division of fractions.
Algebra: Simple algebraic expressions that can be evaluated with specific values.
Sequences: Finding sums, products, or averages of number sequences.
Word Problems: Converting word problems into mathematical equations.

Do not include any solutions in your generated problems.

Respond with a list, one math problem per line. Do not include any numbering at the beginning of each line.
Generate 25 diverse math problems. Ensure there are no duplicate problems.
"""
```

```python
import nest_asyncio

nest_asyncio.apply()
pd.set_option("display.max_colwidth", 500)

# Initialize the model
model = OpenAIModel(model="gpt-4o", max_tokens=1300)

# Generate math problems
resp = model(MATH_GEN_TEMPLATE)

# Create DataFrame
split_response = resp.strip().split("\n")
math_problems_df = pd.DataFrame(split_response, columns=["question"])
print(math_problems_df.head())
```

## Experiment in Development

During development, experimentation helps iterate quickly by revealing agent failures during evaluation. You can test against datasets to refine prompts, logic, and tool usage before deploying.

In this section, we run our agent against the dataset defined above and evaluate for correctness using LLM as Judge.

### Create an experiment

With our dataset of questions we generated above, we can use our experiment feature to track changes across models, prompts, parameters for our agent.

Let's create this dataset and upload it into the platform.

```python
import uuid

import phoenix as px

unique_id = uuid.uuid4()

dataset_name = "math-questions-" + str(uuid.uuid4())[:5]

# Upload the dataset to Phoenix
dataset = px.Client().upload_dataset(
    dataframe=math_problems_df,
    input_keys=["question"],
    dataset_name=f"math-questions-{unique_id}",
)
print(dataset)
```

```python
from phoenix.experiments import run_experiment

initial_experiment = run_experiment(
    dataset,
    task=solve_math_problem,
    evaluators=[correctness_eval],
    experiment_description="Solve Math Problems",
    experiment_name=f"solve-math-questions-{str(uuid.uuid4())[:5]}",
)
```

### View Traces in Phoenix

![Results](https://storage.googleapis.com/arize-phoenix-assets/assets/gifs/experiment_in_development.gif)

## Evaluating in Production

In production, evaluation provides real-time insights into how agents perform on user data.

This section simulates a live production setting, showing how you can collect traces, model outputs, and evaluation results in real time.

Another option is to pull traces from completed production runs and batch process evaluations on them. You can then log the results of those evaluations in Phoenix.

```python
!pip install openinference-instrumentation
```

```python
from opentelemetry.trace import StatusCode, format_span_id

from phoenix.trace import SpanEvaluations
```

After importing the necessary libraries, we set up a tracer object to enable span creation for tracing our task function.

```python
tracer = tracer_provider.get_tracer(__name__)
```

Next, we update our correctness evaluator to return both a label and an explanation, enabling metadata to be captured during tracing.

We also revise the task function to include `with` clauses that generate structured spans in Phoenix. These spans capture key details such as input values, output values, and the results of the evaluation.

```python
# This is our modified correctness evaluator.
def correctness_eval(input, output):
    # Template for evaluating math problem solutions
    MATH_EVAL_TEMPLATE = """
    You are evaluating whether a math problem was solved correctly.

    [BEGIN DATA]
    ************
    [Question]: {question}
    ************
    [Response]: {response}
    [END DATA]

    Assess if the answer to the math problem is correct. First work out the correct answer yourself,
    then compare with the provided response. Consider that there may be different ways to express the same answer
    (e.g., "43" vs "The answer is 43" or "5.0" vs "5").

    Your answer must be a single word, either "correct" or "incorrect"
    """

    # Run the evaluation
    rails = ["correct", "incorrect"]
    eval_df = llm_classify(
        data=pd.DataFrame([{"question": input["question"], "response": output["final_output"]}]),
        template=MATH_EVAL_TEMPLATE,
        model=OpenAIModel(model="gpt-4.1"),
        rails=rails,
        provide_explanation=True,
    )

    return eval_df
```

```python
# This is our modified task function.
async def solve_math_problem(dataset_row: dict):
    with tracer.start_as_current_span(name="agent", openinference_span_kind="agent") as agent_span:
        question = dataset_row.get("question")
        agent_span.set_input(question)
        agent_span.set_status(StatusCode.OK)

        result = await Runner.run(agent, question)
        agent_span.set_output(result.final_output)

        task_result = {
            "final_output": result.final_output,
            "messages": result.to_input_list(),
        }

        # Evaluation span for correctness
        with tracer.start_as_current_span(
            "correctness-evaluator",
            openinference_span_kind="evaluator",
        ) as eval_span:
            evaluation_result = correctness_eval(dataset_row, task_result)
            eval_span.set_attribute("eval.label", evaluation_result["label"][0])
            eval_span.set_attribute("eval.explanation", evaluation_result["explanation"][0])

        # Logging our evaluation
        span_id = format_span_id(eval_span.get_span_context().span_id)
        score = 1 if evaluation_result["label"][0] == "correct" else 0
        eval_data = {
            "span_id": span_id,
            "label": evaluation_result["label"][0],
            "score": score,
            "explanation": evaluation_result["explanation"][0],
        }
        df = pd.DataFrame([eval_data])
        px.Client().log_evaluations(
            SpanEvaluations(
                dataframe=df,
                eval_name="correctness",
            ),
        )

    return task_result


dataset_row = {"question": "What is 15 + 28?"}

result = asyncio.run(solve_math_problem(dataset_row))
print(result)
```

Finally, we run an experiment to simulate traces in production.

```python
from phoenix.experiments import run_experiment

initial_experiment = run_experiment(
    dataset,
    task=solve_math_problem,
    experiment_description="Solve Math Problems",
    experiment_name=f"solve-math-questions-{str(uuid.uuid4())[:5]}",
)
```

### View Traces and Evaluator Results in Phoenix as Traces Populate

![Results2](https://storage.googleapis.com/arize-phoenix-assets/assets/gifs/evaluating_openai_agents.gif)

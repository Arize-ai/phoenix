---
description: Phoenix Tracing, Evaluating, and Experimentation Walkthrough
---

# Iterative Evaluation & Experimentation Workflow (Python)

This tutorial covers the complete workflow for building a travel planning agent, from initial setup to running experiments and iterating on improvements. In this tutorial, you will:

* Build a travel planning agent using the Agno framework and OpenAI models
* Instrument and trace your agent with Phoenix
* Create a dataset and upload it to Phoenix
* Define LLM-based evaluators to assess agent performance
* Run experiments to measure performance changes
* Iterate on agent prompts and re-run experiments to observe improvements

⚠️ **Prerequisites**: This tutorial requires:

* A free [Arize Phoenix Cloud](https://app.phoenix.arize.com/) account
* A free Tavily API key
* An OpenAI API key

{% embed url="https://colab.research.google.com/github/Arize-ai/phoenix/blob/main/tutorials/llm_ops_overview.ipynb" %}

## Notebook Walkthrough

We will go through key code snippets on this page. To follow the full tutorial, check out the Colab notebook above.

## Install Dependencies and Set Up Keys

First, install the required packages:

```python
!pip install -qqqqq arize-phoenix openai agno openinference-instrumentation-openai openinference-instrumentation-agno httpx
```

Set up your API keys:

```python
import os
from getpass import getpass

os.environ["PHOENIX_COLLECTOR_ENDPOINT"] = globals().get("PHOENIX_COLLECTOR_ENDPOINT") or getpass(
    "🔑 Enter your Phoenix Endpoint: "
)

os.environ["PHOENIX_API_KEY"] = globals().get("PHOENIX_API_KEY") or getpass(
    "🔑 Enter your Phoenix API Key: "
)

os.environ["OPENAI_API_KEY"] = globals().get("OPENAI_API_KEY") or getpass(
    "🔑 Enter your OpenAI API Key: "
)

os.environ["TAVILY_API_KEY"] = globals().get("TAVILY_API_KEY") or getpass(
    "🔑 Enter your Tavily API Key: "
)
```

## Set Up Tracing

The `register` function from `phoenix.otel` sets up instrumentation so your agent will automatically send traces to Phoenix.

```python
from phoenix.otel import register

tracer_provider = register(auto_instrument=True, project_name="python-phoenix-tutorial")
```

Grab the `tracer` object to manually instrument some functions:

```python
from opentelemetry import trace

tracer = trace.get_tracer(__name__)
```

## Define Agent Tools

In this section, we'll build our travel agent. Users will be able to describe their destination, travel dates, and interests, and the agent will generate a customized, budget-conscious itinerary.

### Helper Functions

First, we'll define helper functions to support our agent's tools. We'll use **Tavily Search** to gather general information about destinations and **Open-Meteo** to get weather information.

```python
import httpx

@tracer.chain(name="search-api")
def _search_api(query: str) -> str | None:
    """Try Tavily search first, fall back to None."""
    api_key = os.getenv("TAVILY_API_KEY")

    resp = httpx.post(
        "https://api.tavily.com/search",
        json={
            "api_key": api_key,
            "query": query,
            "max_results": 3,
            "search_depth": "basic",
            "include_answer": True,
        },
        timeout=8,
    )
    data = resp.json()
    answer = data.get("answer", "") or ""
    snippets = [item.get("content", "") for item in data.get("results", [])]

    combined = " ".join([answer] + snippets).strip()
    return combined[:400] if combined else None

@tracer.chain(name="weather-api")
def _weather(dest):
    g = httpx.get(f"https://geocoding-api.open-meteo.com/v1/search?name={dest}")
    if g.status_code != 200 or not g.json().get("results"):
        return ""
    lat, lon = g.json()["results"][0]["latitude"], g.json()["results"][0]["longitude"]
    w = httpx.get(
        f"https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&current_weather=true"
    ).json()
    cw = w.get("current_weather", {})
    return f"Weather now: {cw.get('temperature')}°C, wind {cw.get('windspeed')} km/h."
```

### Agent Tools

Our agent will have access to three tools. Use the stepper below to view each tool description.

{% stepper %}
{% step %}
#### Essential Info Tool

Provides key travel details about the destination, such as weather and general conditions.

```python
from agno.tools import tool

@tool
def essential_info(destination: str) -> str:
    """Get essential info using Search and Weather APIs"""
    parts = []

    q = f"{destination} travel essentials weather best time top attractions etiquette"
    s = _search_api(q)
    if s:
        parts.append(f"{destination} essentials: {s}")
    else:
        parts.append(
            f"{destination} is a popular travel destination. Expect local culture, cuisine, and landmarks worth exploring."
        )

    weather = _weather(destination)
    if weather:
        parts.append(weather)

    return f"{destination} essentials:\n" + "\n".join(parts)
```
{% endstep %}

{% step %}
#### Budget Basics Tool

Offers insights into travel costs and helps plan budgets based on selected activities.

```python
@tool
def budget_basics(destination: str, duration: str) -> str:
    """Summarize travel cost categories."""
    q = f"{destination} travel budget average daily costs {duration}"
    s = _search_api(q)
    if s:
        return f"{destination} budget ({duration}): {s}"
    return f"Budget for {duration} in {destination} depends on lodging, meals, transport, and attractions."
```
{% endstep %}

{% step %}
#### Local Flavor Tool

Recommends unique local experiences and cultural highlights.

```python
@tool
def local_flavor(destination: str, interests: str = "local culture") -> str:
    """Suggest authentic local experiences."""
    q = f"{destination} authentic local experiences {interests}"
    s = _search_api(q)
    if s:
        return f"{destination} {interests}: {s}"
    return f"Explore {destination}'s unique {interests} through markets, neighborhoods, and local eateries."
```
{% endstep %}
{% endstepper %}

## Build the Agent

Next, we'll construct our agent. The Agno framework makes this process straightforward by allowing us to easily define key parameters such as the model, instructions, and tools.

```python
from agno.agent import Agent
from agno.models.openai import OpenAIChat

# --- Main Agent ---
trip_agent = Agent(
    name="TripPlanner",
    role="AI Travel Assistant",
    model=OpenAIChat(id="gpt-4o-mini"),
    instructions=(
        "You are a friendly and knowledgeable travel planner. "
        "Combine multiple tools to create a trip plan including essentials, budget, and local flavor. "
        "Keep the tone natural, clear, and under 1000 words."
    ),
    markdown=True,
    tools=[essential_info, budget_basics, local_flavor],
)
```

## Define & Upload Dataset

In order to experiment with our agent, we first need to define a dataset for it to run on. This provides a standardized way to evaluate the agent's behavior across consistent inputs.

In this example, we'll use a small dataset of ten examples and upload it to Phoenix using the Phoenix Client. Once uploaded, all experiments will be tracked alongside this dataset.

```python
from phoenix.client import Client

client = Client()
```

```python
import pandas as pd

# --- Example queries ---
queries = [
    "Plan a 7-day trip to Italy focused on art, history, and local food. Include essential travel info, a budget estimate, and key attractions in Rome, Florence, and Venice.",
    "Create a 4-day itinerary for Seoul centered on K-pop, fashion districts, and street food. Include transportation tips and a mid-range budget.",
    "Plan a romantic 5-day getaway to Paris with emphasis on museums, wine tasting, and scenic walks. Provide cost estimates and essential travel notes.",
    "Design a 3-day budget trip to Mexico City focusing on food markets, archaeological sites, and nightlife. Include daily cost breakdowns.",
    "Prepare a 6-day itinerary for New Zealand's South Island with a focus on outdoor adventure, hikes, and photography spots. Include travel logistics and gear essentials.",
    "Plan a 10-day trip across Spain, hitting Barcelona, Madrid, and Seville. Focus on architecture, tapas, and cultural festivals. Include a detailed budget.",
    "Create a 5-day family-friendly itinerary for Singapore with theme parks, nature activities, and kid-friendly dining. Include entry fees and transit costs.",
    "Plan a 4-day luxury spa and relaxation trip to Bali. Include premium resorts, wellness activities, and a high-end budget.",
    "Design a 7-day solo backpacking trip through Thailand with hostels, street food, and cultural attractions. Provide safety essentials and budget breakdown.",
    "Create a 3-day weekend itinerary for New York City focusing on art galleries, rooftop restaurants, and iconic attractions. Include estimated costs.",
]

dataset_df = pd.DataFrame(data={"input": queries})

dataset = client.datasets.create_dataset(
    dataframe=dataset_df, name="travel-questions", input_keys=["input"]
)
```

{% embed url="https://storage.googleapis.com/arize-phoenix-assets/assets/images/end-to-end-python-tutorial-dataset.png" %}

## Define Evaluators

Next, we need a way to assess the agent's outputs. This is where Evals come in. Evals provide a structured method for measuring whether an agent's responses meet the requirements defined in a dataset—such as accuracy, relevance, consistency, or safety.

In this tutorial, we will be using LLM-as-a-Judge Evals, which rely on another LLM acting as the evaluator. We define a prompt describing the exact criteria we want to evaluate, and then pass the input and the agent-generated output from each dataset example into that evaluator prompt. The evaluator LLM then returns a score along with a natural-language explanation justifying why the score was assigned.

This allows us to automatically grade the agent's performance across many examples, giving us quantitative metrics as well as qualitative insight into failure cases.

### Answer Relevance Evaluator

```python
ANSWER_RELEVANCE_PROMPT_TEMPLATE = """
You will be given a travel-planning query and an itinerary answer. Your task is to decide whether
the answer correctly follows the user's instructions. An answer is "incorrect" if it contradicts,
ignores, or fails to include required elements from the query (such as trip length, destination,
themes, budget details, or essential info). It is also "incorrect" if it adds irrelevant or
contradictory details.

    [BEGIN DATA]
    ************
    [Query]: {{input}}
    ************
    [Answer]: {{output}}
    ************
    [END DATA]

Explain step-by-step how you determined your judgment. Then provide a final LABEL:
- Use "correct" if the answer follows the query accurately and fully.
- Use "incorrect" if it deviates from the query or omits required information.

Your final output must be only one word: "correct" or "incorrect".
"""
```

After defining the evaluator prompt, we use the Phoenix Evals library to construct an evaluator instance. Notice that the evaluator LLM is separate from the model powering the agent itself.

```python
from phoenix.evals import create_classifier
from phoenix.evals.llm import LLM

llm = LLM(provider="openai", model="gpt-4o")

relevancy_evaluator = create_classifier(
    name="ANSWER RELEVANCE",
    llm=llm,
    prompt_template=ANSWER_RELEVANCE_PROMPT_TEMPLATE,
    choices={"correct": 1.0, "incorrect": 0.0},
)
```

### Budget Consistency Evaluator

```python
BUDGET_CONSISTENCY_PROMPT_TEMPLATE = """
You will be given a travel-planning query and an itinerary answer. Your task is to determine whether
the answer provides a consistent and mathematically coherent budget. An answer is "incorrect" if:
- The summed minimum costs of all listed budget categories exceed the stated minimum total estimate.
- The summed maximum costs of all listed budget categories exceed the stated maximum total estimate.
- The total estimate claims a range that cannot be derived from (or contradicted by) the itemized ranges.
- The answer lists budget items but provides a total that is not numerically aligned with them.
- The answer contradicts itself regarding pricing or cost ranges.

    [BEGIN DATA]
    ************
    [Query]: {{input}}
    ************
    [Answer]: {{output}}
    ************
    [END DATA]

Explain step-by-step how you evaluated the itemized costs and the final total, including whether
the ranges mathematically match. Then provide a final LABEL:
- Use "correct" if the budget totals are consistent with the itemized values.
- Use "incorrect" if the totals contradict or cannot be derived from the itemized values.

Your final output must be only one word: "correct" or "incorrect".
"""
```

```python
llm = LLM(provider="openai", model="gpt-4o")

budget_evaluator = create_classifier(
    name="BUDGET CONSISTENCY",
    llm=llm,
    prompt_template=BUDGET_CONSISTENCY_PROMPT_TEMPLATE,
    choices={"correct": 1.0, "incorrect": 0.0},
)
```

## Run Experiment

The last step before running our experiment is to explicitly define the task. Although we know we are evaluating an agent, we must wrap it in a simple function that takes an input and returns the agent's output. This function becomes the task that the experiment will execute for each example in the dataset.

```python
def agent_task(input):
    query = input["input"]
    response = trip_agent.run(query, stream=False)
    return response.content
```

After defining the task, we construct our experiment by providing the dataset, the evaluators, and any relevant metadata. Once everything is configured, we can run the experiment.

Depending on the size of the dataset, complexity of the task, and the number of evaluators, the run may take a few minutes to complete.

```python
from phoenix.client.experiments import run_experiment

experiment = run_experiment(
    dataset=dataset,
    task=agent_task,
    experiment_name="initial run",
    evaluators=[relevancy_evaluator, budget_evaluator],
)
```

## Analyze Experiment Traces & Results

Now that the experiment has run on each dataset example, you can explore the results in Phoenix. You'll be able to:

* View the full trace emitted by the agent and step through each action it took
* Inspect evaluation outputs for every example, including scores, labels, and explanations
* Examine the evaluation traces themselves (i.e., the LLM-as-a-Judge reasoning)
* Review aggregate evaluation scores across the entire dataset

{% embed url="https://storage.googleapis.com/arize-phoenix-assets/assets/images/end-to-end-python-tutorial-experiment.mp4" %}

### Human Annotations

In addition to Evals, you can also add human annotations to your traces. These allow you to capture strong feedback, flag problematic outputs, highlight exemplary responses, and record insights that automated evaluators may miss. Human annotations get saved as part of the trace, helping you guide future iterations of your application or agent.

## Iterate and Re-Run Experiment

Now that we've spent time analyzing the experiment results, it's time to iterate.

We will update the agent's main prompt to be more intentional about budget calculations, since that area received a lower eval score. You can modify the prompt or make any other adjustments you believe will improve the agent's performance, and then re-run the experiment to see how the outputs improve—or where they may regress.

Iteration is a key part of refining agent behavior, and each experiment provides valuable feedback to guide the next step. Once you reach eval scores and outputs that meet your expectations, you can confidently push those changes to production.

```python
# --- Main Agent with Updated Instructions ---
trip_agent = Agent(
    name="TripPlanner",
    role="AI Travel Assistant",
    model=OpenAIChat(id="gpt-4o-mini"),
    instructions=(
        "You are a friendly and knowledgeable travel planner. "
        "Combine multiple tools to create a trip plan including essentials, budget, and local flavor. "
        "Keep the tone natural, clear, and under 1000 words. "
        "When providing budget details: Ensure the final total budget range is mathematically consistent with the sum of the itemized ranges."
    ),
    markdown=True,
    tools=[essential_info, budget_basics, local_flavor],
)
```

```python
experiment = run_experiment(
    dataset=dataset,
    task=agent_task,
    experiment_name="updated agent prompt to improve budget",
    evaluators=[relevancy_evaluator, budget_evaluator],
)
```

In this case, the budget consistency score may actually decrease, and the answer relevancy may improve. By reviewing the traces and evaluation explanations, we can start to understand why this happened—perhaps the stricter prompt introduced new edge cases, or the agent over-corrected in unexpected ways.

From here, we can continue the iterative process by forming a new hypothesis, applying changes based on what we've learned, and running another experiment. Each cycle helps refine the agent's behavior and moves us closer to outputs that consistently meet the desired criteria.

{% embed url="https://storage.googleapis.com/arize-phoenix-assets/assets/images/end-to-end-python-tutorial-prompt-iteration.png" %}

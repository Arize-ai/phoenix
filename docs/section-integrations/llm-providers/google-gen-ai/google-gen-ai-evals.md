---
description: Evaluate multi-agent systems using Arize Phoenix, Google Evals, and CrewAI
---

# Google Gen AI Evals

## Overview

This guide demonstrates how to evaluate multi-agent systems using Arize Phoenix, [Google Gen AI Evals](https://cloud.google.com/vertex-ai/generative-ai/docs/models/evaluation-overview), and [CrewAI](https://www.crewai.com/). It shows how to:

1. Set up a multi-agent system using CrewAI for collaborative AI agents
2. Instrument the agents with Phoenix for tracing and monitoring
3. Evaluate agent performance and interactions using Google GenAI
4. Analyze the results using Arize Phoenix's observability platform

### Key Technologies <a href="#key-technologies" id="key-technologies"></a>

* **CrewAI**: For orchestrating multi-agent systems
* **Arize Phoenix**: For observability and tracing
* **Google Cloud Vertex AI**: For model hosting and execution
* **OpenAI**: For agent LLM capabilities

We will walk through the key steps in the documentation below. Check out the full tutorial here:

{% embed url="https://colab.research.google.com/github/GoogleCloudPlatform/generative-ai/blob/main/gemini/evaluation/multi_agent_evals_with_arize_and_crewai.ipynb#scrollTo=1561a9f3aa99" %}
Full Tutorial
{% endembed %}

## Define your CrewAI Crew of Agents & Tasks

This crew consists of specialized agents working together to analyze and report on a given topic.&#x20;

```python
from crewai import Agent, Crew, Process, Task

#Define agents here (see full tutorial) 

# Create tasks for your agents with explicit context
    conduct_analysis_task = Task(
        description=f"""Conduct a comprehensive analysis of the latest developments in {topic}.
      Identify key trends, breakthrough technologies, and potential industry impacts.
      Focus on both research breakthroughs and commercial applications.""",
        expected_output="Full analysis report in bullet points with citations to sources",
        agent=researcher,
        context=[],  # Explicitly set empty context
    )

    fact_checking_task = Task(
        description=f"""Review the research findings and verify the accuracy of claims about {topic}.
      Identify any potential ethical concerns or societal implications.
      Highlight areas where hype may exceed reality and provide a balanced assessment.
      Suggest frameworks that should be considered for each major advancement.""",
        expected_output="Fact-checking report with verification status for each major claim",
        agent=fact_checker,
        context=[conduct_analysis_task],  # Set context to previous task
    )

    # Instantiate your crew with a sequential process
    crew = Crew(
        agents=[researcher, fact_checker, writer],
        tasks=[conduct_analysis_task, fact_checking_task, writer_task],
        verbose=False,
        process=Process.sequential,
    )

    return crew
```

## Evaluating Agents using Google Gen AI

Next, you'll built an experiment set to test your CrewAI Crew with Phoenix and Google Gen AI evals.

When run, an **Experiment** will send each row of your **dataset** through your task, then apply each of your **evaluators** to the result.&#x20;

All traces and metrics will then be stored in Phoenix for reference and comparison.

### Create Dataset in Phoenix

```python
phoenix_client = px.Client()
try:
    dataset = phoenix_client.get_dataset(name="crewai-researcher-test-topics")
except ValueError:
    dataset = phoenix_client.upload_dataset(
        dataframe=df,
        dataset_name="crewai-researcher-test-topics",
        input_keys=["topic"],
        output_keys=["reference_trajectory"],
    )
```

### Define your Experiment Task

This method will be run on each row of your test cases dataset:

```python
def call_crew_with_topic(input):
    crew = create_research_crew(topic=input.get("topic"))
    result = crew.kickoff()
    return result
```

### Define your Evaluators

Define as many evaluators as you'd need to evaluate your agent. In this case, you'll use Google Gen AI's eval library to evaluate the crew's trajectory.

```python
from vertexai.preview.evaluation import EvalTask

def eval_trajectory_with_google_gen_ai(
    output, expected, metric_name="trajectory_exact_match"
) -> float:
    eval_dataset = pd.DataFrame(
        {
            "predicted_trajectory": [create_trajectory_from_response(output)],
            "reference_trajectory": [expected.get("reference_trajectory")],
        }
    )
    eval_task = EvalTask(
        dataset=eval_dataset,
        metrics=[metric_name],
    )
    eval_result = eval_task.evaluate()
    metric_value = eval_result.summary_metrics.get(f"{metric_name}/mean")
    if metric_value is None:
        return 0.0
    return metric_value


def trajectory_exact_match(output, expected):
    return eval_trajectory_with_google_gen_ai(
        output, expected, metric_name="trajectory_exact_match"
    )


def trajectory_precision(output, expected):
    return eval_trajectory_with_google_gen_ai(
        output, expected, metric_name="trajectory_precision"
    )


```

## Run your Experiment and Visualize Results in Phoenix

```python
import nest_asyncio
from phoenix.experiments import run_experiment

nest_asyncio.apply()

experiment = run_experiment(
    dataset,
    call_crew_with_topic,
    experiment_name="agent-experiment",
    evaluators=[
        trajectory_exact_match,
        trajectory_precision,
        trajectory_in_order_match,
        trajectory_any_order_match,
        agent_names_match,
    ],
)
```

{% hint style="info" %}
```
Copyright 2024 Google LLC
```

```notebook-python
Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.

See the License for the specific language governing permissions and
limitations under the License.

Getting Started with Vertex AI Python SDK for Gen AI Evaluation Service
```
{% endhint %}

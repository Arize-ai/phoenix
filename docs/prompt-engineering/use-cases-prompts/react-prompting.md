<center>
<p style="text-align:center">
<img alt="phoenix logo" src="https://raw.githubusercontent.com/Arize-ai/phoenix-assets/9e6101d95936f4bd4d390efc9ce646dc6937fb2d/images/socal/github-large-banner-phoenix.jpg" width="1000"/>
<br>
<br>
<a href="https://docs.arize.com/phoenix/">Docs</a>
|
<a href="https://github.com/Arize-ai/phoenix">GitHub</a>
|
<a href="https://arize-ai.slack.com/join/shared_invite/zt-11t1vbu4x-xkBIHmOREQnYnYDH1GDfCg?__hstc=259489365.a667dfafcfa0169c8aee4178d115dc81.1733501603539.1733501603539.1733501603539.1&__hssc=259489365.1.1733501603539&__hsfp=3822854628&submissionGuid=381a0676-8f38-437b-96f2-fc10875658df#/shared-invite/email">Community</a>
</p>
</center>
<h1 align="center">ReAct Prompting Tutorial</h1>

**ReAct (Reasoning + Acting)** is a prompting technique that enables LLMs to think step-by-step before taking action. Unlike traditional prompting, where a model directly provides an answer, ReAct prompts guide the model to reason through a problem first, then decide which tools or actions are necessary to reach the best solution.

ReAct is ideal for situations that require **multi-step problem-solving with external tools**. It also improves **transparency** by clearly showing the reasoning behind each tool choice, making it easier to understand and refine the model's actions.

In this tutorial, you will:
- Learn how to craft prompts, tools, and evaluators in Phoenix
- Refine your prompts to understand the power of ReAct prompting
- Leverage Phoenix and LLM as a Judge techniques to evaluate accuracy at each step, gaining insight into the model's thought process.
- Learn how to apply ReAct prompting in real-world scenarios for improved task execution and problem-solving.

⚠️ You'll need an OpenAI Key for this tutorial.

Let’s get started! 🚀

# **Set up Dependencies and Keys**


```python
!pip install -qqq "arize-phoenix>=8.0.0" datasets openinference-instrumentation-openai
```

Next you need to connect to Phoenix. The code below will connect you to a Phoenix Cloud instance. You can also [connect to a self-hosted Phoenix instance](https://docs.arize.com/phoenix/deployment) if you'd prefer.


```python
import os
from getpass import getpass

os.environ["PHOENIX_COLLECTOR_ENDPOINT"] = "https://app.phoenix.arize.com"
if not os.environ.get("PHOENIX_CLIENT_HEADERS"):
    os.environ["PHOENIX_CLIENT_HEADERS"] = "api_key=" + getpass("Enter your Phoenix API key: ")

if not os.environ.get("OPENAI_API_KEY"):
    os.environ["OPENAI_API_KEY"] = getpass("Enter your OpenAI API key: ")
```


```python
import nest_asyncio
import pandas as pd
from openai import OpenAI
from openai.types.chat.completion_create_params import CompletionCreateParamsBase
from openinference.instrumentation.openai import OpenAIInstrumentor

import phoenix as px
from phoenix.client import Client as PhoenixClient
from phoenix.client.types import PromptVersion
from phoenix.evals import (
    TOOL_CALLING_PROMPT_RAILS_MAP,
    OpenAIModel,
    llm_classify,
)
from phoenix.experiments import run_experiment
from phoenix.otel import register

nest_asyncio.apply()
```

## **Instrument Application**


```python
tracer_provider = register(
    project_name="ReAct-examples", endpoint="https://app.phoenix.arize.com/v1/traces"
)
OpenAIInstrumentor().instrument(tracer_provider=tracer_provider)
```

# **Load Dataset Into Phoenix**

This dataset contains 20 customer service questions that a customer might ask a store's chatbot. As we dive into ReAct prompting, we'll use these questions to guide the LLM in selecting the appropriate tools.

Here, we also import the Phoenix Client, which enables us to create and modify prompts directly within the notebook while seamlessly syncing changes to the Phoenix UI.

After running this cell, the dataset should will be under the Datasets tab in Phoenix.


```python
from datasets import load_dataset

ds = load_dataset("syeddula/customer_questions")["train"]
ds = ds.to_pandas()
ds.head()
import uuid

unique_id = uuid.uuid4()

# Upload the dataset to Phoenix
dataset = px.Client().upload_dataset(
    dataframe=ds,
    input_keys=["Questions"],
    dataset_name=f"customer-questions-{unique_id}",
)
```

# **Define Tools**

Next, let's define the tools available for the LLM to use. We have five tools at our disposal, each serving a specific purpose:
Product Comparison, Product Details, Discounts, Customer Support, and Track Package.

Depending on the customer's question, the LLM will determine the optimal sequence of tools to use.



```python
tools = [
    {
        "type": "function",
        "function": {
            "name": "product_comparison",
            "description": "Compare features of two products.",
            "parameters": {
                "type": "object",
                "properties": {
                    "product_a_id": {
                        "type": "string",
                        "description": "The unique identifier of Product A.",
                    },
                    "product_b_id": {
                        "type": "string",
                        "description": "The unique identifier of Product B.",
                    },
                },
                "required": ["product_a_id", "product_b_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "product_details",
            "description": "Get detailed features on one product.",
            "parameters": {
                "type": "object",
                "properties": {
                    "product_id": {
                        "type": "string",
                        "description": "The unique identifier of the Product.",
                    }
                },
                "required": ["product_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "apply_discount_code",
            "description": "Checks for discounts and promotions. Applies a discount code to an order.",
            "parameters": {
                "type": "object",
                "properties": {
                    "order_id": {
                        "type": "integer",
                        "description": "The unique identifier of the order.",
                    },
                    "discount_code": {
                        "type": "string",
                        "description": "The discount code to apply.",
                    },
                },
                "required": ["order_id", "discount_code"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "customer_support",
            "description": "Get contact information for customer support regarding an issue.",
            "parameters": {
                "type": "object",
                "properties": {
                    "issue_type": {
                        "type": "string",
                        "description": "The type of issue (e.g., billing, technical support).",
                    }
                },
                "required": ["issue_type"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "track_package",
            "description": "Track the status of a package based on the tracking number.",
            "parameters": {
                "type": "object",
                "properties": {
                    "tracking_number": {
                        "type": "integer",
                        "description": "The tracking number of the package.",
                    }
                },
                "required": ["tracking_number"],
            },
        },
    },
]
```

# **Initial Prompt**

Let's start by defining a simple prompt that instructs the system to utilize the available tools to answer the questions. The choice of which tools to use, and how to apply them, is left to the model's discretion based on the context of each customer query.


```python
params = CompletionCreateParamsBase(
    model="gpt-4",
    temperature=0.5,
    tools=tools,
    tool_choice="auto",
    messages=[
        {
            "role": "system",
            "content": """You are a helpful customer service agent.
            Your task is to determine the best tools to use to answer a customer's question.
            Output the tools and pick 3 tools at maximum.
            """,
        },
        {"role": "user", "content": "{{questions}}"},
    ],
)

prompt_identifier = "customer-support"

prompt = PhoenixClient().prompts.create(
    name=prompt_identifier,
    prompt_description="Customer Support",
    version=PromptVersion.from_openai(params),
)
```

At this stage, this initial prompt is now available in Phoenix under the Prompt tab. Any modifications made to the prompt moving forward will be tracked under **Versions**, allowing you to monitor and compare changes over time.

Prompts in Phoenix store more than just text—they also include key details such as the prompt template, model configurations, and response format, ensuring a structured and consistent approach to generating outputs.

![Prompt](https://storage.googleapis.com/arize-phoenix-assets/assets/images/react_prompt1.png)

Next, we will define the Tool Calling Prompt Template. In this step, we use **[LLM as a Judge](https://docs.arize.com/phoenix/evaluation/concepts-evals/llm-as-a-judge)** to evaluate the output. LLM as a Judge is a technique where one LLM assesses the performance of another LLM.

This prompt is provided to the LLM-as-Judge model, which takes in both the user's query and the tools the system has selected. The model then uses reasoning to assess how effectively the chosen tools addressed the query, providing an explanation for its evaluation.


```python
TOOL_CALLING_PROMPT_TEMPLATE = """
You are an evaluation assistant evaluating questions and tool calls to
determine whether the tool called would reasonably help answer the question.
The tool calls have been generated by a separate agent, chosen from the list of
tools provided below. Your job is to decide whether that agent's response was relevant to solving the customer's question.

    [BEGIN DATA]
    ************
    [Question]: {question}
    ************
    [Tool Called]: {tool_calls}
    [END DATA]

Your response must be one of the following:
1. **"correct"** – The chosen tool(s) would sufficiently answer the question.
2. **"mostly_correct"** – The tool(s) are helpful, but a better selection could have been made (at most 1 missing or unnecessary tool).
3. **"incorrect"** – The tool(s) would not meaningfully help answer the question.

Explain why you made your choice.

    [Tool Definitions]:
    product_comparison: Compare features of two products.
    product_details: Get detailed features on one product.
    apply_discount_code: Applies a discount code to an order.
    customer_support: Get contact information for customer support regarding an issue.
    track_package: Track the status of a package based on the tracking number.
"""
```

In the following cells, we will define a task for the experiment.
Then, in the `evaluate_response` function, we define our LLM as a Judge evaluator. Finally, we run our experiment.


```python
def prompt_task(input):
    client = OpenAI()
    resp = client.chat.completions.create(
        **prompt.format(variables={"questions": input["Questions"]})
    )
    return resp


def evaluate_response(input, output):
    response_classifications = llm_classify(
        dataframe=pd.DataFrame([{"question": input["Questions"], "tool_calls": output}]),
        template=TOOL_CALLING_PROMPT_TEMPLATE,
        model=OpenAIModel(model="gpt-3.5-turbo"),
        rails=list(TOOL_CALLING_PROMPT_RAILS_MAP.values()),
        provide_explanation=True,
    )
    score = response_classifications.apply(lambda x: 0 if x["label"] == "incorrect" else 1, axis=1)
    return score
```

### **Experiment**


```python
initial_experiment = run_experiment(
    dataset,
    task=prompt_task,
    evaluators=[evaluate_response],
    experiment_description="Customer Support Prompt",
    experiment_name="initial-prompt",
    experiment_metadata={"prompt": "prompt_id=" + prompt.id},
)
```

After running our experiment and evaluation, we can dive deeper into the results. By clicking into the experiment, we can explore the tools that the LLM selected for the specific input. Next, if we click on the trace for the evaluation, we can see the reasoning behind the score assigned by LLM as a Judge for the output.

![Run 1](https://storage.googleapis.com/arize-phoenix-assets/assets/gifs/react_prompt.gif)

# **ReAct Prompt**

Next, we iterate on our system prompt using **ReAct Prompting** techniques. We emphasize that the model should think through the problem step-by-step, break it down logically, and then determine which tools to use and in what order. The model is instructed to output the relevant tools along with their corresponding parameters.

This approach differs from our initial prompt because it encourages reasoning before action, guiding the model to select the best tools and parameters based on the specific context of the query, rather than simply using predefined actions.


```python
params = CompletionCreateParamsBase(
    model="gpt-4",
    temperature=0.5,
    tools=tools,
    tool_choice="required",
    messages=[
        {
            "role": "system",
            "content": """
              You are a helpful customer service agent. Carefully analyze the customer’s question to fully understand their request.
              Step 1: Think step-by-step. Identify the key pieces of information needed to answer the question. Consider any dependencies between these pieces of information.
              Step 2: Decide which tools to use. Choose up to 3 tools that will best retrieve the required information. If multiple tools are needed, determine the correct order to call them.
              Step 3: Output the chosen tools and any relevant parameters.

            """,
        },
        {"role": "user", "content": "{{questions}}"},
    ],
)

prompt_identifier = "customer-support"

prompt = PhoenixClient().prompts.create(
    name=prompt_identifier,
    prompt_description="Customer Support ReAct Prompt",
    version=PromptVersion.from_openai(params),
)
```

In the Prompts tab, you will see the updated prompt. As you iterate, you can build a version history.

![Prompt 2](https://storage.googleapis.com/arize-phoenix-assets/assets/images/react_prompt2.png)

Just like above, we define our task, construct the evaluator, and run the experiment.


```python
def prompt_task(input):
    client = OpenAI()
    resp = client.chat.completions.create(
        **prompt.format(variables={"questions": input["Questions"]})
    )
    return resp


def evaluate_response(input, output):
    response_classifications = llm_classify(
        dataframe=pd.DataFrame([{"question": input["Questions"], "tool_calls": output}]),
        template=TOOL_CALLING_PROMPT_TEMPLATE,
        model=OpenAIModel(model="gpt-3.5-turbo"),
        rails=list(TOOL_CALLING_PROMPT_RAILS_MAP.values()),
        provide_explanation=True,
    )
    score = response_classifications.apply(lambda x: 0 if x["label"] == "incorrect" else 1, axis=1)
    return score
```

### **Experiment**


```python
initial_experiment = run_experiment(
    dataset,
    task=prompt_task,
    evaluators=[evaluate_response],
    experiment_description="Customer Support Prompt",
    experiment_name="improved-prompt",
    experiment_metadata={"prompt": "prompt_id=" + prompt.id},
)
```

With our updated ReAct prompt, we can observe that the **LLM as a Judge Evaluator** rated more outputs as correct. By clicking into the traces, we can gain insights into the reasons behind this improvement. By prompting our LLM to be more thoughtful and purposeful, we can see the reasoning and acting aspects of ReAct.

You can explore the evaluators outputs to better understand the improvements in detail.

Keep in mind that results may vary due to randomness and the model's non-deterministic behavior.


![Evaluation](https://storage.googleapis.com/arize-phoenix-assets/assets/gifs/react_prompts2.gif)

To refine and test these prompts against other datasets, experiment with alternative techniques like Chain of Thought (CoT) prompting to assess how they complement or contrast with ReAct in your specific use cases. With Phoenix, you can seamlessly integrate this process into your workflow using both the TypeScript and Python Clients.

From here, you can check out more [examples on Phoenix](https://docs.arize.com/phoenix/notebooks), and if you haven't already, [please give us a star on GitHub!](https://github.com/Arize-ai/phoenix) ⭐️


# Experiment with a Customer Support Agent

{% embed url="https://colab.research.google.com/github/Arize-ai/phoenix/blob/main/tutorials/experiments/agents-cookbook.ipynb" %}

This guide shows you how to create and evaluate agents with Phoenix to improve performance. We'll go through the following steps:

* Create a customer support agent using a router template
* Trace the agent activity, including function calling
* Create a dataset to benchmark performance
* Evaluate agent performance using code, human annotation, and LLM as a judge
* Experiment with different prompts and models

***

## Notebook Walkthrough

We will go through key code snippets on this page. To follow the full tutorial, check out the Colab notebook above.

## Customer Support Agent Architecture

We'll be creating a customer support agent using function calling following the architecture below:

{% embed url="https://storage.googleapis.com/arize-phoenix-assets/assets/images/customer-support-agent-cookbook.png" %}

## Create Tools and Agent

We have 6 functions that we will define for our agent:&#x20;

1. product\_comparison
2. product\_search
3. customer\_support
4. track\_package
5. product\_details
6. apply\_discount\_code

_See the notebook for complete tool function definitions._&#x20;

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
    # Continued in notebook
```

We define a function below called `run_prompt`, which uses the chat completion call from OpenAI with functions

```python
def run_prompt(input):
    client = openai.Client()
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        temperature=0,
        tools=tools,
        tool_choice="auto",
        messages=[
            {
                "role": "system",
                "content": " ",
            },
            {
                "role": "user",
                "content": input,
            },
        ],
    )

    if (
        hasattr(response.choices[0].message, "tool_calls")
        and response.choices[0].message.tool_calls is not None
        and len(response.choices[0].message.tool_calls) > 0
    ):
        tool_calls = response.choices[0].message.tool_calls
    else:
        tool_calls = []

    if response.choices[0].message.content is None:
        response.choices[0].message.content = ""
    if response.choices[0].message.content:
        return response.choices[0].message.content
    else:
        return tool_calls
```

## Generate Synthetic Dataset of Questions

Now that we have a basic agent, let's generate a dataset of questions and run the prompt against this dataset! Using the template below, we're going to generate a dataframe of 25 questions we can use to test our customer support agent.

```python
GEN_TEMPLATE = """
You are an assistant that generates complex customer service questions.
The questions should often involve:

Multiple Categories: Questions that could logically fall into more than one category (e.g., combining product details with a discount code).
Vague Details: Questions with limited or vague information that require clarification to categorize correctly.
Mixed Intentions: Queries where the customer’s goal or need is unclear or seems to conflict within the question itself.
Indirect Language: Use of indirect or polite phrasing that obscures the direct need or request (e.g., using "I was wondering if..." or "Perhaps you could help me with...").
For specific categories:

Track Package: Include vague timing references (e.g., "recently" or "a while ago") instead of specific dates.
Product Comparison and Product Search: Include generic descriptors without specific product names or IDs (e.g., "high-end smartphones" or "energy-efficient appliances").
Apply Discount Code: Include questions about discounts that might apply to hypothetical or past situations, or without mentioning if they have made a purchase.
Product Details: Ask for comparisons or details that involve multiple products or categories ambiguously (e.g., "Tell me about your range of electronics that are good for home office setups").

Examples of More Challenging Questions
"There's an issue with one of the items I think I bought last month—what should I do?"
"I need help with something I ordered, or maybe I'm just looking for something new. Can you help?"

Some questions should be straightforward uses of the provided functions

Respond with a list, one question per line. Do not include any numbering at the beginning of each line. Do not include any category headings.
Generate 25 questions. Be sure there are no duplicate questions.
"""

resp = model(GEN_TEMPLATE)
split_response = resp.strip().split("\n")

questions_df = pd.DataFrame(split_response, columns=["question"])
```

Now let's use this dataset and run it against the router prompt above!

```python
response_df = questions_df.copy(deep=True)
response_df["response"] = response_df["question"].apply(run_prompt)
response_df["response"] = response_df["response"].astype(str)
```

## Evaluating your Agent

Now that we have a set of test cases, we can create evaluators to measure performance. This way, we don't have to manually inspect every single trace to see if the LLM is doing the right thing.

Here, we are defining our evaluation templates to judge whether the router selected a function correctly, whether it selected the right function, and whether it filled the arguments correctly.&#x20;

```python
ROUTER_EVAL_TEMPLATE = """ You are comparing a response to a question, and verifying whether that response should have made a function call instead of responding directly. Here is the data:
    [BEGIN DATA]
    ************
    [Question]: {question}
    ************
    [LLM Response]: {response}
    ************
    [END DATA]

Compare the Question above to the response. You must determine whether the reponse
decided to call the correct function.
"""
# See full eval template in the notebook 

FUNCTION_SELECTION_EVAL_TEMPLATE = """You are comparing a function call response to a question and trying to determine if the generated call is correct. Here is the data:
    [BEGIN DATA]
    ************
    [Question]: {question}
    ************
    [LLM Response]: {response}
    ************
    [END DATA]

Compare the Question above to the function call. You must determine whether the function call
will return the answer to the Question. Please focus on whether the very specific
question can be answered by the function call.
"""
# See full eval template in the notebook 

PARAMETER_EXTRACTION_EVAL_TEMPLATE = """ You are comparing a function call response to a question and trying to determine if the generated call has extracted the exact right parameters from the question. Here is the data:
    [BEGIN DATA]
    ************
    [Question]: {question}
    ************
    [LLM Response]: {response}
    ************
    [END DATA]

Compare the parameters in the generated function against the JSON provided below.
The parameters extracted from the question must match the JSON below exactly.
"""
# See full eval template in the notebook 
```

Let's run evaluations using Phoenix's `llm_classify` function for our responses dataframe we generated above!

```python
from phoenix.evals import OpenAIModel, llm_classify

rails = ["incorrect", "correct"]

router_eval_df = llm_classify(
    data=response_df,
    template=ROUTER_EVAL_TEMPLATE,
    model=OpenAIModel(model="gpt-4o"),
    rails=rails,
    provide_explanation=True,
    include_prompt=True,
    concurrency=4,
)

function_selection_eval_df = llm_classify(
    data=response_df,
    template=FUNCTION_SELECTION_EVAL_TEMPLATE,
    model=OpenAIModel(model="gpt-4o"),
    rails=rails,
    provide_explanation=True,
    include_prompt=True,
    concurrency=4,
)

parameter_extraction_eval_df = llm_classify(
    data=response_df,
    template=PARAMETER_EXTRACTION_EVAL_TEMPLATE,
    model=OpenAIModel(model="gpt-4o"),
    rails=rails,
    provide_explanation=True,
    include_prompt=True,
    concurrency=4,
)
```

## Create and Run an Experiment

With our dataset of questions we generated above, we can use our experiments feature to track changes across models, prompts, parameters for our agent.

```python
from uuid import uuid1

client = px.Client()

dataset = client.upload_dataset(
    dataframe=questions_df,
    dataset_name="agents-cookbook-" + str(uuid1()),
    input_keys=["question"],
)
```

```python
def generic_eval(input, output, prompt_template):
    df_in = pd.DataFrame({"question": [str(input["question"])], "response": [str(output)]})
    rails = ["correct", "incorrect"]
    eval_df = llm_classify(
        data=df_in,
        template=prompt_template,
        model=OpenAIModel(model="gpt-4o"),
        rails=rails,
        provide_explanation=True,
    )
    label = eval_df["label"][0]
    score = (
        1 if rails and label == rails[0] else 0
    )  # Choose the 0 item in rails as the correct "1" label
    explanation = eval_df["explanation"][0]
    return EvaluationResult(score=score, label=label, explanation=explanation)


def routing_eval(input, output):
    return generic_eval(input, output, ROUTER_EVAL_TEMPLATE)


def function_call_eval(input, output):
    return generic_eval(input, output, FUNCTION_SELECTION_EVAL_TEMPLATE)


def parameter_extraction_eval(input, output):
    return generic_eval(input, output, PARAMETER_EXTRACTION_EVAL_TEMPLATE)
```

```python
def prompt_gen_task(input):
    return run_prompt(input["question"])


experiment = run_experiment(
    dataset=dataset,
    task=prompt_gen_task,
    evaluators=[routing_eval, function_call_eval, parameter_extraction_eval],
    experiment_name="agents-cookbook",
)
```

## View Results

{% embed url="https://storage.googleapis.com/arize-phoenix-assets/assets/images/experiments-agent-cookbook.png" %}


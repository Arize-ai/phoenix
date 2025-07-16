# Ragas

[Ragas](https://docs.ragas.io/en/stable/) is a library that provides robust evaluation metrics for LLM applications, making it easy to assess quality. When integrated with Phoenix, it enriches your experiments with metrics like goal accuracy and tool call accuracy—helping you evaluate performance more effectively and track improvements over time.

This guide will walk you through the process of creating and evaluating agents using Ragas and Arize Phoenix. We'll cover the following steps:

* Build a customer support agent with the OpenAI Agents SDK
* Trace agent activity to monitor interactions
* Generate a benchmark dataset for performance analysis
* Evaluate agent performance using Ragas

We will walk through the key steps in the documentation below. Check out the full tutorial here:

{% embed url="https://colab.research.google.com/github/Arize-ai/phoenix/blob/main/tutorials/integrations/ragas_agents_cookbook_phoenix.ipynb" %}

## Creating the Agent

Here we've setup a basic agent that can solve math problems. We have a function tool that can solve math equations, and an agent that can use this tool. We'll use the `Runner` class to run the agent and get the final output.

<pre class="language-python"><code class="lang-python"><strong>from agents import Runner, function_tool
</strong>
@function_tool
def solve_equation(equation: str) -> str:
    """Use python to evaluate the math equation, instead of thinking about it yourself.

    Args:"
       equation: string which to pass into eval() in python
    """
    return str(eval(equation))
</code></pre>

```python
from agents import Agent

agent = Agent(
    name="Math Solver",
    instructions="You solve math problems by evaluating them with python and returning the result",
    tools=[solve_equation],
)
     
```

## Evaluating the Agent <a href="#evaluating-our-agent" id="evaluating-our-agent"></a>

Agents can go awry for a variety of reasons. We can use Ragas to evaluate whether the agent responded correctly. Two Ragas measurements help with this:

1. **Tool Call Accuracy** - Did our agent choose the right tool with the right arguments?
2. **Agent Goal Accuracy** - Did our agent accomplish the stated goal and get to the right outcome?

We'll import both metrics we're measuring from Ragas, and use the `multi_turn_ascore(sample)` to get the results. The `AgentGoalAccuracyWithReference` metric compares the final output to the reference to see if the goal was accomplished. The `ToolCallAccuracy` metric compares the tool call to the reference tool call to see if the tool call was made correctly.

In the notebook, we also define the helper function `conversation_to_ragas_sample` which converts the agent messages into a format that Ragas can use.

The following code snippets define our task function and evaluators.

```python
import asyncio

from agents import Runner

async def solve_math_problem(input):
    if isinstance(input, dict):
        input = next(iter(input.values()))
    result = await Runner.run(agent, input)
    return {"final_output": result.final_output, "messages": result.to_input_list()}
```

```python
from langchain_openai import ChatOpenAI
from ragas.llms import LangchainLLMWrapper
from ragas.metrics import AgentGoalAccuracyWithReference, ToolCallAccuracy

async def tool_call_evaluator(input, output):
    sample = conversation_to_ragas_sample(output["messages"], reference_equation=input["question"])
    tool_call_accuracy = ToolCallAccuracy()
    return await tool_call_accuracy.multi_turn_ascore(sample)


async def goal_evaluator(input, output):
    sample = conversation_to_ragas_sample(
        output["messages"], reference_answer=output["final_output"]
    )
    evaluator_llm = LangchainLLMWrapper(ChatOpenAI(model="gpt-4o"))
    goal_accuracy = AgentGoalAccuracyWithReference(llm=evaluator_llm)
    return await goal_accuracy.multi_turn_ascore(sample)

```

## Run the Experiment

Once we've generated a dataset of questions, we can use our experiments feature to track changes across models, prompts, parameters for the agent.

```python
import phoenix as px

dataset_df = pd.DataFrame(
    {
        "question": [conv["question"] for conv in conversations],
        "final_output": [conv["final_output"] for conv in conversations],
    }
)

dataset = px.Client().upload_dataset(
    dataframe=dataset_df,
    dataset_name="math-questions",
    input_keys=["question"],
    output_keys=["final_output"],
)
```

Finally, we run our experiment and view the results in Phoenix.

```python
from phoenix.experiments import run_experiment

experiment = run_experiment(
    dataset, task=solve_math_problem, evaluators=[goal_evaluator, tool_call_evaluator]
)
```

{% embed url="https://storage.googleapis.com/arize-phoenix-assets/assets/gifs/ragas_results.gif" %}

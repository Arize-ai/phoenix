# Agent Reflection

Use this prompt template to evaluate an agent's final response. This is an optional step, which you can use as a gate to retry a set of actions if the response or state of the world is insufficient for the given task.

Read more:

* [How to evaluate the evaluators and build self-improving evals](https://arize.com/blog/techniques-for-self-improving-llm-evals/)
* [Prompt optimization](https://arize.com/course/prompt-optimization/)

## Prompt Template <a href="#prompt-template" id="prompt-template"></a>

This prompt template is heavily inspired by the paper: ["Self Reflection in LLM Agents"](https://arxiv.org/pdf/2405.06682v3).

```
You are an expert in {topic}. I will give you a user query. Your task is to reflect on your provided solution and whether it has solved the problem.
First, explain whether you believe the solution is correct or incorrect.
Second, list the keywords that describe the type of your errors from most general to most specific.
Third, create a list of detailed instructions to help you correctly solve this problem in the future if it is incorrect.

Be concise in your response; however, capture all of the essential information.

Here is the data:
    [BEGIN DATA]
    ************
    [User Query]: {user_query}
    ************
    [Tools]: {tool_definitions}
    ************
    [State]: {current_state}
    ************
    [Provided Solution]: {solution}
    [END DATA]
```

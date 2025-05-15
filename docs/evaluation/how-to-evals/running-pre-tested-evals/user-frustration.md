# User Frustration

Teams that are using conversation bots and assistants desire to know whether a user interacting with the bot is frustrated. The user frustration evaluation can be used on a single back and forth or an entire span to detect whether a user has become frustrated by the conversation.

{% embed url="https://colab.research.google.com/drive/1Av5MGJHqt0xcJziBadEoVgdYqqohm6oT?usp=sharing" %}

## User Frustration Eval Template

```python
  You are given a conversation where between a user and an assistant.
  Here is the conversation:
  [BEGIN DATA]
  *****************
  Conversation:
  {conversation}
  *****************
  [END DATA]

  Examine the conversation and determine whether or not the user got frustrated from the experience.
  Frustration can range from midly frustrated to extremely frustrated. If the user seemed frustrated
  at the beginning of the conversation but seemed satisfied at the end, they should not be deemed
  as frustrated. Focus on how the user left the conversation.

  Your response must be a single word, either "frustrated" or "ok", and should not
  contain any text or characters aside from that word. "frustrated" means the user was left
  frustrated as a result of the conversation. "ok" means that the user did not get frustrated
  from the conversation.
```

{% hint style="info" %}
We are continually iterating our templates, view the most up-to-date template [on GitHub](https://github.com/Arize-ai/phoenix/blob/ecef5242d2f9bb39a2fdf5d96a2b1841191f7944/packages/phoenix-evals/src/phoenix/evals/default_templates.py#L652).
{% endhint %}

The following is an example of code snippet showing how to use the eval above template:

```python
from phoenix.evals import (
    USER_FRUSTRATION_PROMPT_RAILS_MAP,
    USER_FRUSTRATION_PROMPT_TEMPLATE,
    OpenAIModel,
    download_benchmark_dataset,
    llm_classify,
)

model = OpenAIModel(
    model_name="gpt-4",
    temperature=0.0,
)

#The rails is used to hold the output to specific values based on the template
#It will remove text such as ",,," or "..."
#Will ensure the binary value expected from the template is returned
rails = list(USER_FRUSTRATION_PROMPT_RAILS_MAP.values())
relevance_classifications = llm_classify(
    dataframe=df,
    template=USER_FRUSTRATION_PROMPT_TEMPLATE,
    model=model,
    rails=rails,
    provide_explanation=True, #optional to generate explanations for the value produced by the eval LLM
)
```

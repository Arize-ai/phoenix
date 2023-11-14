# Code Generation Eval

## When To Use Code Generation Eval Template

This Eval checks the correctness and readability of the code from a code generation process. The template variables are:

* **query:** The query is the coding question being asked
* **code**: The code is the code that was returned.

## Code Generation Eval Template

{% embed url="https://colab.research.google.com/github/Arize-ai/phoenix/blob/main/tutorials/evals/evaluate_code_readability_classifications.ipynb" %}
Try it out!
{% endembed %}

````
You are a stern but practical senior software engineer who cares a lot about simplicity and
readability of code. Can you review the following code that was written by another engineer?
Focus on readability of the code. Respond with "readable" if you think the code is readable,
or "unreadable" if the code is unreadable or needlessly complex for what it's trying
to accomplish.

ONLY respond with "readable" or "unreadable"

Task Assignment:
```
{query}
```

Implementation to Evaluate:
```
{code}
```
````

{% hint style="info" %}
We are continually iterating our templates, view the most up-to-date template on GitHub. Last updated on 10/12/2023
{% endhint %}

## Benchmark Results

#### GPT-4 Results

<figure><img src="../../.gitbook/assets/Screenshot 2023-09-16 at 5.45.20 PM.png" alt=""><figcaption></figcaption></figure>

#### GPT-3.5 Results

<figure><img src="../../.gitbook/assets/Screenshot 2023-09-16 at 5.49.07 PM (1).png" alt=""><figcaption></figcaption></figure>

## How To Run the Eval

```python
from phoenix.experimental.evals import (
    CODE_READABILITY_PROMPT_RAILS_MAP,
    CODE_READABILITY_PROMPT_TEMPLATE,
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
rails = list(CODE_READABILITY_PROMPT_RAILS_MAP.values())
readability_classifications = llm_classify(
    dataframe=df,
    template=CODE_READABILITY_PROMPT_TEMPLATE,
    model=model,
    rails=rails,
)
```

The above shows how to use the code readability template.

| Code Eval | GPT-4 | GPT-3.5 | GPT-3.5-Instruct | Palm 2 (Text Bison) | Llama 7b (soon) |
| --------- | ----- | ------- | ---------------- | ------------------- | --------------- |
| Precision | 0.93  | 0.76    | 0.67             | 0.77                |                 |
| Recall    | 0.78  | 0.93    | 1                | 0.94                |                 |
| F1        | 0.85  | 0.85    | 0.81             | 0.85                |                 |

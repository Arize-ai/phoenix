# Hallucinations

## When To Use Hallucination Eval Template

This LLM Eval detects if the output of a model is a hallucination based on contextual data.

This Eval is designed specifically designed for hallucinations relative to private or retrieved data, is an answer to a question a hallucination based on a set of contextual data.

## Hallucination Eval Template

{% embed url="https://colab.research.google.com/github/Arize-ai/phoenix/blob/main/tutorials/evals/evaluate_hallucination_classifications.ipynb" %}
Try it out!
{% endembed %}

```
In this task, you will be presented with a query, a reference text and an answer. The answer is
generated to the question based on the reference text. The answer may contain false information, you
must use the reference text to determine if the answer to the question contains false information,
if the answer is a hallucination of facts. Your objective is to determine whether the reference text
contains factual information and is not a hallucination. A 'hallucination' in this context refers to
an answer that is not based on the reference text or assumes information that is not available in
the reference text. Your response should be a single word: either "factual" or "hallucinated", and
it should not include any other text or characters. "hallucinated" indicates that the answer
provides factually inaccurate information to the query based on the reference text. "factual"
indicates that the answer to the question is correct relative to the reference text, and does not
contain made up information. Please read the query and reference text carefully before determining
your response.

    # Query: {query}
    # Reference text: {reference}
    # Answer: {response}
    Is the answer above factual or hallucinated based on the query and reference text?
```

{% hint style="info" %}
We are continually iterating our templates, view the most up-to-date template on GitHub. Last updated on 10/12/2023
{% endhint %}

## Benchmark Results

#### GPT-4 Results

<figure><img src="../../.gitbook/assets/Screenshot 2023-09-16 at 5.18.04 PM.png" alt=""><figcaption><p>Scikit GPT-4</p></figcaption></figure>

#### GPT-3.5 Results

<figure><img src="../../.gitbook/assets/Screenshot 2023-09-16 at 5.18.57 PM.png" alt=""><figcaption></figcaption></figure>

#### Claud v2 Results

<figure><img src="../../.gitbook/assets/claude_v2_hallucination.png" alt=""><figcaption></figcaption></figure>

## How To Run the Eval

```python
from phoenix.experimental.evals import (
    HALLUCINATION_PROMPT_RAILS_MAP,
    HALLUCINATION_PROMPT_TEMPLATE_STR,
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
rails = list(HALLUCINATION_PROMPT_RAILS_MAP.values())
hallucination_classifications = llm_classify(
    dataframe=df, template=HALLUCINATION_PROMPT_TEMPLATE_STR, model=model, rails=rails
)

```

The above Eval shows how to the the hallucination template for Eval detection.

<table><thead><tr><th>Hallu Eval</th><th>GPT-4</th><th>GPT-3.5</th><th width="215">GPT-3.5-turbo-instruct</th><th>Palm 2 (Text Bison)</th><th>Claude V2</th></tr></thead><tbody><tr><td>Precision</td><td><mark style="color:green;">0.93</mark></td><td><mark style="color:green;">0.89</mark></td><td><mark style="color:green;">0.89</mark></td><td><mark style="color:red;">1</mark></td><td><mark style="color:green;">0.80</mark></td></tr><tr><td>Recall</td><td><mark style="color:green;">0.72</mark></td><td><mark style="color:green;">0.65</mark></td><td><mark style="color:green;">0.80</mark></td><td><mark style="color:red;">0.44</mark></td><td><mark style="color:green;">0.95</mark></td></tr><tr><td>F1</td><td><mark style="color:green;">0.82</mark></td><td><mark style="color:green;">0.75</mark></td><td><mark style="color:green;">0.84</mark></td><td><mark style="color:red;">0.61</mark></td><td><mark style="color:green;">0.87</mark></td></tr></tbody></table>

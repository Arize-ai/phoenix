# Hallucinations

## When To Use Hallucination Eval Template

This LLM Eval detects if the output of a model is a hallucination based on contextual data.

This Eval is specifically designed to detect hallucinations in generated answers from private or retrieved data. The Eval detects if an AI answer to a question is a hallucination based on the reference data used to generate the answer.

{% hint style="info" %}
This Eval is designed to check for hallucinations on private data, specifically on data that is fed into the context window from retrieval.

It is not designed to check hallucinations on what the LLM was trained on. It is not useful for random public fact hallucinations. E.g. "What was Michael Jordan's birthday?"
{% endhint %}

## Hallucination Eval Template

```
In this task, you will be presented with a query, a reference text and an answer. The answer is
generated to the question based on the reference text. The answer may contain false information. You
must use the reference text to determine if the answer to the question contains false information,
if the answer is a hallucination of facts. Your objective is to determine whether the answer text
contains factual information and is not a hallucination. A 'hallucination' refers to
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
We are continually iterating our templates, view the most up-to-date template [on GitHub](https://github.com/Arize-ai/phoenix/blob/ecef5242d2f9bb39a2fdf5d96a2b1841191f7944/packages/phoenix-evals/src/phoenix/evals/span_templates.py#L7).
{% endhint %}

## How To Run the Hallucination Eval

```python
from phoenix.evals import (
    HALLUCINATION_PROMPT_RAILS_MAP,
    HALLUCINATION_PROMPT_TEMPLATE,
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
    dataframe=df, 
    template=HALLUCINATION_PROMPT_TEMPLATE, 
    model=model, 
    rails=rails,
    provide_explanation=True, #optional to generate explanations for the value produced by the eval LLM
)

```

The above Eval shows how to the the hallucination template for Eval detection.

## Benchmark Results

This benchmark was obtained using notebook below. It was run using the [HaluEval QA Dataset](https://github.com/RUCAIBox/HaluEval/blob/main/data/qa_data.json) as a ground truth dataset. Each example in the dataset was evaluating using the `HALLUCINATION_PROMPT_TEMPLATE` above, then the resulting labels were compared against the `is_hallucination` label in the HaluEval dataset to generate the confusion matrices below.

{% embed url="https://colab.research.google.com/github/Arize-ai/phoenix/blob/main/tutorials/evals/evaluate_hallucination_classifications.ipynb" %}

#### GPT-4 Results

<figure><img src="../../../.gitbook/assets/Screenshot 2023-09-16 at 5.18.04 PM.png" alt=""><figcaption><p>Scikit GPT-4</p></figcaption></figure>

<table><thead><tr><th width="117">Eval</th><th>GPT-4</th></tr></thead><tbody><tr><td>Precision</td><td><mark style="color:green;">0.93</mark></td></tr><tr><td>Recall</td><td><mark style="color:green;">0.72</mark></td></tr><tr><td>F1</td><td><mark style="color:green;">0.82</mark></td></tr></tbody></table>

| Throughput  | GPT-4   |
| ----------- | ------- |
| 100 Samples | 105 sec |

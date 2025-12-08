# Q\&A on Retrieved Data

## When To Use Q\&A Eval Template

This Eval evaluates whether a question was correctly answered by the system based on the retrieved data. In contrast to retrieval Evals that are checks on chunks of data returned, this check is a system level check of a correct Q\&A.

* **question**: This is the question the Q\&A system is running against
* **sampled\_answer**: This is the answer from the Q\&A system.
* **context**: This is the context to be used to answer the question, and is what Q\&A Eval must use to check the correct answer

## Q\&A Eval Template

```
You are given a question, an answer and reference text. You must determine whether the
given answer correctly answers the question based on the reference text. Here is the data:
    [BEGIN DATA]
    ************
    [Question]: {question}
    ************
    [Reference]: {context}
    ************
    [Answer]: {sampled_answer}
    [END DATA]
Your response must be a single word, either "correct" or "incorrect",
and should not contain any text or characters aside from that word.
"correct" means that the question is correctly and fully answered by the answer.
"incorrect" means that the question is not correctly or only partially answered by the
answer.
```

{% hint style="info" %}
We are continually iterating our templates, view the most up-to-date template [on GitHub](https://github.com/Arize-ai/phoenix/blob/ecef5242d2f9bb39a2fdf5d96a2b1841191f7944/packages/phoenix-evals/src/phoenix/evals/span_templates.py#L104).
{% endhint %}

## How To Run the Q\&A Eval

```python
import phoenix.evals.templates.default_templates as templates
from phoenix.evals import (
    OpenAIModel,
    download_benchmark_dataset,
    llm_classify,
)

model = OpenAIModel(
    model_name="gpt-4",
    temperature=0.0,
)

#The rails fore the output to specific values of the template
#It will remove text such as ",,," or "...", anything not the
#binary value expected from the template
rails = list(templates.QA_PROMPT_RAILS_MAP.values())
Q_and_A_classifications = llm_classify(
    dataframe=df_sample,
    template=templates.QA_PROMPT_TEMPLATE,
    model=model,
    rails=rails,
    provide_explanation=True, #optional to generate explanations for the value produced by the eval LLM
)
```

The above Eval uses the QA template for Q\&A analysis on retrieved data.

## Benchmark Results

The [benchmarking dataset](https://storage.googleapis.com/arize-phoenix-assets/evals/qa-classification/qa_generated_dataset.jsonl.zip) used was created based on:

* Squad 2: The 2.0 version of the large-scale dataset Stanford Question Answering Dataset (SQuAD 2.0) allows researchers to design AI models for reading comprehension tasks under challenging constraints. [https://web.stanford.edu/class/archive/cs/cs224n/cs224n.1194/reports/default/15785042.pdf](https://www.google.com/url?q=https%3A%2F%2Fweb.stanford.edu%2Fclass%2Farchive%2Fcs%2Fcs224n%2Fcs224n.1194%2Freports%2Fdefault%2F15785042.pdf)
* Supplemental Data to Squad 2: In order to check the case of detecting incorrect answers, we created wrong answers based on the context data. The wrong answers are intermixed with right answers.

Each example in the dataset was evaluating using the `QA_PROMPT_TEMPLATE` above, then the resulting labels were compared against the ground truth in the benchmarking dataset.

{% embed url="https://colab.research.google.com/github/Arize-ai/tutorials/blob/main/python/cookbooks/phoenix_evals_examples/evaluate_QA_classifications.ipynb" %}

#### GPT-4 Results

<figure><img src="../../.gitbook/assets/Screenshot 2023-09-16 at 5.25.14 PM.png" alt=""><figcaption></figcaption></figure>

<table><thead><tr><th width="116">Q&#x26;A Eval</th><th>GPT-4o</th><th>GPT-4</th></tr></thead><tbody><tr><td>Precision</td><td><mark style="color:green;">1</mark></td><td><mark style="color:green;">1</mark></td></tr><tr><td>Recall</td><td><mark style="color:green;">0.89</mark></td><td><mark style="color:green;">0.92</mark></td></tr><tr><td>F1</td><td><mark style="color:green;">0.94</mark></td><td><mark style="color:green;">0.96</mark></td></tr></tbody></table>

| Throughput  | GPT-4   |
| ----------- | ------- |
| 100 Samples | 124 Sec |

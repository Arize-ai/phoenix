---
description: >-
  This LLM evaluation is used to compare AI answers to Human answers. Its very
  useful in RAG system benchmarking to compare the human generated groundtruth.
---

# AI vs Human (Groundtruth)

{% embed url="https://colab.research.google.com/github/Arize-ai/tutorials/blob/main/python/cookbooks/phoenix_evals_examples/evaluate_human_vs_ai_classifications.ipynb" %}

A workflow we see for high quality RAG deployments is generating a golden dataset of questions and a high quality set of answers. These can be in the range of 100-200 but provide a strong check for the AI generated answers. This Eval checks that the human ground truth matches the AI generated answer. Its designed to catch missing data in "half" answers and differences of substance.

### Example Human vs AI on Arize AX Docs:

_**Question:**_

What Evals are supported for LLMs on generative models?

_**Human:**_

Arize AX supports a suite of Evals available from the Phoenix Evals library, they include both pre-tested Evals and the ability to configure cusotm Evals. Some of the pre-tested LLM Evals are listed below:

Retrieval Relevance, Question and Answer, Toxicity, Human Groundtruth vs AI, Citation Reference Link Relevancy, Code Readability, Code Execution, Hallucination Detection and Summarizaiton

**AI:**

Arize AX supports LLM Evals.

**Eval:**

Incorrect

**Explanation of Eval:**

The AI answer is very brief and lacks the specific details that are present in the human ground truth answer. While the AI answer is not incorrect in stating that Arize AX supports LLM Evals, it fails to mention the specific types of Evals that are supported, such as Retrieval Relevance, Question and Answer, Toxicity, Human Groundtruth vs AI, Citation Reference Link Relevancy, Code Readability, Hallucination Detection, and Summarization. Therefore, the AI answer does not fully capture the substance of the human answer.

Overview of template:

{% hint style="info" %}
We are continually iterating our templates, view the most up-to-date template [on GitHub](https://github.com/Arize-ai/phoenix/blob/ecef5242d2f9bb39a2fdf5d96a2b1841191f7944/packages/phoenix-evals/src/phoenix/evals/default_templates.py#L433).
{% endhint %}

```python
print(HUMAN_VS_AI_PROMPT_TEMPLATE)

You are comparing a human ground truth answer from an expert to an answer from an AI model.
Your goal is to determine if the AI answer correctly matches, in substance, the human answer.
    [BEGIN DATA]
    ************
    [Question]: {question}
    ************
    [Human Ground Truth Answer]: {correct_answer}
    ************
    [AI Answer]: {ai_generated_answer}
    ************
    [END DATA]
Compare the AI answer to the human ground truth answer, if the AI correctly answers the question,
then the AI answer is "correct". If the AI answer is longer but contains the main idea of the
Human answer please answer "correct". If the AI answer diverges or does not contain the main
idea of the human answer, please answer "incorrect".
```

## How to run the Human vs AI Eval:

```python
from phoenix.evals import (
    HUMAN_VS_AI_PROMPT_RAILS_MAP,
    HUMAN_VS_AI_PROMPT_TEMPLATE,
    OpenAIModel,
    llm_classify,
)

model = OpenAIModel(
    model_name="gpt-4",
    temperature=0.0,
)

# The rails are used to hold the output to specific values based on the template
# It will remove text such as ",,," or "..."
# Will ensure the binary value expected from the template is returned
rails = list(HUMAN_VS_AI_PROMPT_RAILS_MAP.values())
relevance_classifications = llm_classify(
    dataframe=df,
    template=HUMAN_VS_AI_PROMPT_TEMPLATE,
    model=model,
    rails=rails,
    verbose=False,
    provide_explanation=True
)
```

## Benchmark Results:

The follow benchmarking data was gathered by comparing various model results to ground truth data. The ground truth data used was a handcrafted dataset consisting of questions about the Arize AX platform. That[ dataset is availabe here](https://storage.googleapis.com/arize-phoenix-assets/evals/human_vs_ai/human_vs_ai_classifications.csv).

**GPT-4 Results**

<figure><img src="../../.gitbook/assets/human_vs_ai_gpt-4.png" alt=""><figcaption></figcaption></figure>

|           | GPT-4o                                 | GPT-4                                  |
| --------- | -------------------------------------- | -------------------------------------- |
| Precision | <mark style="color:green;">0.90</mark> | <mark style="color:green;">0.92</mark> |
| Recall    | <mark style="color:green;">0.56</mark> | <mark style="color:green;">0.74</mark> |
| F1        | <mark style="color:green;">0.69</mark> | <mark style="color:green;">0.82</mark> |

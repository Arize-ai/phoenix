# Summarization Eval

## When To Use Summarization Eval Template

This Eval helps evaluate the summarization results of a summarization task. The template variables are:

* **document**: The document text to summarize
* **summary**: The summary of the document

## Summarization Eval Template

{% embed url="https://colab.research.google.com/github/Arize-ai/phoenix/blob/main/tutorials/evals/evaluate_summarization_classifications.ipynb" %}
Try it out!
{% endembed %}

```
    You are comparing the summary text and it's original document and trying to determine
    if the summary is good. Here is the data:
    [BEGIN DATA]
    ************
    [Summary]: {summary}
    ************
    [Original Document]: {document}
    [END DATA]
    Compare the Summary above to the Original Document and determine if the Summary is
    comprehensive, concise, coherent, and independent relative to the Original Document.
    Your response must be a string, either good or bad, and should not contain any text
    or characters aside from that. The string bad means that the Summary is not comprehensive, concise,
    coherent, and independent relative to the Original Document. The string good means the Summary
    is comprehensive, concise, coherent, and independent relative to the Original Document.
```

{% hint style="info" %}
We are continually iterating our templates, view the most up-to-date template on GitHub. Last updated on 10/12/2023
{% endhint %}

## Benchmark Results

#### GPT-4 Results

<div align="left">

<figure><img src="../../.gitbook/assets/Screenshot 2023-09-18 at 12.04.55 PM.png" alt=""><figcaption></figcaption></figure>

</div>

#### GPT-3.5 Results

<figure><img src="../../.gitbook/assets/Screenshot 2023-09-18 at 12.05.02 PM (2).png" alt=""><figcaption></figcaption></figure>

#### Claud V2 Results

<figure><img src="../../.gitbook/assets/Screenshot 2023-10-28 at 9.58.08 AM.png" alt=""><figcaption></figcaption></figure>

## How To Run the Eval

```python
import phoenix.experimental.evals.templates.default_templates as templates
from phoenix.experimental.evals import (
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
rails = list(templates.SUMMARIZATION_PROMPT_RAILS_MAP.values())
summarization_classifications = llm_classify(
    dataframe=df_sample,
    template=templates.SUMMARIZATION_PROMPT_TEMPLATE_STR,
    model=model,
    rails=rails,
)
```

The above shows how to use the summarization Eval template.

| Eval Summary | GPT-4 | GPT-3.5 | GPT-3.5 Instruct | Palm 2 (Text Bison) | Claud V2 | Llama 7b (soon) |
| ------------ | ----- | ------- | ---------------- | ------------------- | -------- | --------------- |
| Precision    | 0.79  | 1       | 1                | 0.57                | 0.75     |                 |
| Recall       | 0.88  | 0.1     | 0.16             | 0.7                 | 0.61     |                 |
| F1           | 0.83  | 0.18    | 0.280            | 0.63                | 0.67     |                 |

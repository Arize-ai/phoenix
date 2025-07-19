# Summarization

## When To Use Summarization Eval Template

This Eval helps evaluate the summarization results of a summarization task. The template variables are:

* **document**: The document text to summarize
* **summary**: The summary of the document

## Summarization Eval Template

```
You are comparing the summary text and it's original document and trying to determine
if the summary is good. Here is the data:
    [BEGIN DATA]
    ************
    [Summary]: {output}
    ************
    [Original Document]: {input}
    [END DATA]
Compare the Summary above to the Original Document and determine if the Summary is
comprehensive, concise, coherent, and independent relative to the Original Document.
Your response must be a single word, either "good" or "bad", and should not contain any text
or characters aside from that. "bad" means that the Summary is not comprehensive,
concise, coherent, and independent relative to the Original Document. "good" means the
Summary is comprehensive, concise, coherent, and independent relative to the Original Document.
```

{% hint style="info" %}
We are continually iterating our templates, view the most up-to-date template [on GitHub](https://github.com/Arize-ai/phoenix/blob/ecef5242d2f9bb39a2fdf5d96a2b1841191f7944/packages/phoenix-evals/src/phoenix/evals/default_templates.py#L289).
{% endhint %}

## How To Run the Summarization Eval

```python
import phoenix.evals.default_templates as templates
from phoenix.evals import (
    OpenAIModel,
    download_benchmark_dataset,
    llm_classify,
)

model = OpenAIModel(
    model_name="gpt-4",
    temperature=0.0,
)

#The rails are used to hold the output to specific values based on the template
#It will remove text such as ",,," or "..."
#Will ensure the binary value expected from the template is returned 
rails = list(templates.SUMMARIZATION_PROMPT_RAILS_MAP.values())
summarization_classifications = llm_classify(
    dataframe=df_sample,
    template=templates.SUMMARIZATION_PROMPT_TEMPLATE,
    model=model,
    rails=rails,
    provide_explanation=True, #optional to generate explanations for the value produced by the eval LLM
)
```

The above shows how to use the summarization Eval template.

## Benchmark Results

This benchmark was obtained using notebook below. It was run using a [Daily Mail CNN summarization dataset](https://storage.googleapis.com/arize-phoenix-assets/evals/summarization-classification/summarization-test.jsonl.zip) as a ground truth dataset. Each example in the dataset was evaluating using the `SUMMARIZATION_PROMPT_TEMPLATE` above, then the resulting labels were compared against the ground truth label in the summarization dataset to generate the confusion matrices below.

{% embed url="https://colab.research.google.com/github/Arize-ai/phoenix/blob/main/tutorials/evals/evaluate_summarization_classifications.ipynb" %}
Try it out!
{% endembed %}

#### GPT-4 Results

<div align="left"><figure><img src="../../../.gitbook/assets/Screenshot 2023-09-18 at 12.04.55 PM.png" alt=""><figcaption></figcaption></figure></div>

<table><thead><tr><th width="122">Eval</th><th>GPT-4o</th><th>GPT-4</th></tr></thead><tbody><tr><td>Precision</td><td><mark style="color:green;">0.87</mark></td><td><mark style="color:green;">0.79</mark></td></tr><tr><td>Recall</td><td><mark style="color:green;">0.63</mark></td><td><mark style="color:green;">0.88</mark></td></tr><tr><td>F1</td><td><mark style="color:green;">0.73</mark></td><td><mark style="color:green;">0.83</mark></td></tr></tbody></table>

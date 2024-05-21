# Summarization

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

<figure><img src="../../../.gitbook/assets/Screenshot 2023-09-18 at 12.04.55 PM.png" alt=""><figcaption></figcaption></figure>

</div>

#### GPT-3.5 Results

<figure><img src="../../../.gitbook/assets/Screenshot 2023-09-18 at 12.05.02 PM (2).png" alt=""><figcaption></figcaption></figure>

#### Claud V2 Results

<figure><img src="../../../.gitbook/assets/Screenshot 2023-10-28 at 9.58.08 AM.png" alt=""><figcaption></figcaption></figure>

#### GPT-4 Turbo

<figure><img src="../../../.gitbook/assets/GPT-4 Turbo Summarization.png" alt=""><figcaption></figcaption></figure>

## How To Run the Eval

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

#The rails is used to hold the output to specific values based on the template
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

<table><thead><tr><th width="122">Eval</th><th>GPT-4</th><th>GPT-4 Turbo</th><th>Gemini Pro</th><th>GPT-3.5</th><th>GPT-3.5 Instruct</th><th width="75">Palm 2 (Text Bison)</th><th>Claud V2</th><th>Llama 7b (soon)</th></tr></thead><tbody><tr><td>Precision</td><td><mark style="color:green;">0.79</mark></td><td><mark style="color:green;">0.94</mark></td><td><mark style="color:green;">0.61</mark></td><td><mark style="color:red;">1</mark></td><td><mark style="color:red;">1</mark></td><td><mark style="color:red;">0.57</mark></td><td><mark style="color:purple;">0.75</mark></td><td></td></tr><tr><td>Recall</td><td><mark style="color:green;">0.88</mark></td><td><mark style="color:green;">0.641</mark></td><td><mark style="color:green;">1.0</mark></td><td><mark style="color:red;">0.1</mark></td><td><mark style="color:red;">0.16</mark></td><td><mark style="color:red;">0.7</mark></td><td><mark style="color:purple;">0.61</mark></td><td></td></tr><tr><td>F1</td><td><mark style="color:green;">0.83</mark></td><td><mark style="color:green;">0.76</mark></td><td><mark style="color:green;">0.76</mark></td><td><mark style="color:red;">0.18</mark></td><td><mark style="color:red;">0.280</mark></td><td><mark style="color:red;">0.63</mark></td><td><mark style="color:purple;">0.67</mark></td><td></td></tr></tbody></table>

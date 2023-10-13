# Hallucinations

{% embed url="https://colab.research.google.com/github/Arize-ai/phoenix/blob/main/tutorials/evals/evaluate_hallucination_classifications.ipynb" %}

This LLM Eval detects if the output of a model is a hallucination based on contextual data. This Eval is designed specifically designed for hallucinations relative to private or retrieved data, is an answer to a a question an hallucination based on a set of contextual data.

```python
from phoenix.experimental.evals import (
    HALLUCINATION_PROMPT_RAILS_MAP,
    HALLUCINATION_PROMPT_TEMPLATE_STR,
    OpenAIModel,
    download_benchmark_dataset,
    llm_eval_binary,
)

model = OpenAIModel(
    model_name="gpt-4",
    temperature=0.0,
)

#The rails is used to hold the output to specific values based on the template
#It will remove text such as ",,," or "..."
#Will ensure the binary value expected from the template is returned 
rails = list(HALLUCINATION_PROMPT_RAILS_MAP.values())
hallucination_classifications = llm_eval_binary(
    dataframe=df, template=HALLUCINATION_PROMPT_TEMPLATE_STR, model=model, rails=rails
)

```

The above Eval shows how to the the hallucination template for Eval detection.&#x20;

<table><thead><tr><th>Hallu Eval</th><th>GPT-4</th><th>GPT-3.5</th><th width="215">GPT-3.5-turbo-instruct</th><th>Palm 2 (Text Bison)</th><th>Llama 7b (soon)</th></tr></thead><tbody><tr><td>Precision</td><td>0.93</td><td>0.89</td><td>0.89</td><td>1</td><td></td></tr><tr><td>Recall</td><td>0.72</td><td>0.65</td><td>0.80</td><td>0.44</td><td></td></tr><tr><td>F1</td><td>0.82</td><td>0.75</td><td>0.84</td><td>0.61</td><td></td></tr></tbody></table>

## GPT-4 Results

<figure><img src="../../.gitbook/assets/Screenshot 2023-09-16 at 5.18.04 PM.png" alt=""><figcaption><p>Scikit GPT-4</p></figcaption></figure>

## GPT-3.5 Results

<figure><img src="../../.gitbook/assets/Screenshot 2023-09-16 at 5.18.57 PM.png" alt=""><figcaption></figcaption></figure>

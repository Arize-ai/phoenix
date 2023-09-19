# Toxicity

{% embed url="https://colab.research.google.com/github/Arize-ai/phoenix/blob/main/tutorials/evals/evaluate_toxicity_classifications.ipynb" %}

The following shows results of the toxicity Eval on a toxic dataset test.&#x20;

The template variables are:

* **text:** the text to be classified

```python
from phoenix.experimental.evals import (
    TOXICITY_PROMPT_RAILS_MAP,
    TOXICITY_PROMPT_TEMPLATE_STR,
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
rails = list(TOXICITY_PROMPT_RAILS_MAP.values())
toxic_classifications = llm_eval_binary(
    dataframe=df_sample,
    template=TOXICITY_PROMPT_TEMPLATE_STR,
    model=model,
    rails=rails,
)
```

The above is the use of the RAG relevancy template.&#x20;



| Toxicity Eval | GPT-4 | GPT-3.5 | Palm 2 (soon) | Llama 7b (soon) |
| ------------- | ----- | ------- | ------------- | --------------- |
| Precision     | 0.91  | 0.93    |               |                 |
| Recall        | 0.91  | 0.83    |               |                 |
| F1            | 0.91  | 0.87    |               |                 |

## GPT-4 Results

<figure><img src="../../.gitbook/assets/Screenshot 2023-09-16 at 5.41.55 PM (1).png" alt=""><figcaption></figcaption></figure>

## GPT-3.5 Results

<figure><img src="../../.gitbook/assets/Screenshot 2023-09-16 at 5.42.56 PM.png" alt=""><figcaption></figcaption></figure>

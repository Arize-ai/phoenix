# Summarization Eval

This Eval helps evaluate the summarization results of a summarization task.

Eval template variables:

* **document** : The document text to summarize
* **summary** : The summary of the document

```python
import phoenix.experimental.evals.templates.default_templates as templates
from phoenix.experimental.evals import (
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
rails = list(templates.SUMMARIZATION_PROMPT_RAILS_MAP.values())
summarization_classifications = llm_eval_binary(
    dataframe=df_sample,
    template=templates.SUMMARIZATION_PROMPT_TEMPLATE_STR,
    model=model,
    rails=rails,
)
```

The above shows how to use the summarization Eval template.



| Eval Summary | GPT-4 | GPT-3.5 | Palm 2 (soon) | Llama 7b (soon) |
| ------------ | ----- | ------- | ------------- | --------------- |
| Precision    | 0.79  | 1       |               |                 |
| Recall       | 0.88  | 0.1     |               |                 |
| F1           | 0.83  | .18     |               |                 |

## GPT-4 Results



<figure><img src="../../.gitbook/assets/Screenshot 2023-09-18 at 12.04.55 PM.png" alt=""><figcaption></figcaption></figure>

## GPT-3.5 Results

<figure><img src="../../.gitbook/assets/Screenshot 2023-09-18 at 12.05.02 PM (2).png" alt=""><figcaption></figcaption></figure>


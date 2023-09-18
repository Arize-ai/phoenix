# Code Generation Eval

This Eval checks the readability of the code from a code generation process.

* **query** : The query is the coding question being asked
* **code** : The code is the code that was returned.

```python
from phoenix.experimental.evals import (
    CODE_READABILITY_PROMPT_RAILS_MAP,
    CODE_READABILITY_PROMPT_TEMPLATE_STR,
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
rails = list(CODE_READABILITY_PROMPT_RAILS_MAP.values())
readability_classifications = llm_eval_binary(
    dataframe=df,
    template=CODE_READABILITY_PROMPT_TEMPLATE_STR,
    model=model,
    rails=rails,
)
```

The above shows how to use the code readability template.

| Code Eval | GPT-4 | GPT-3.5 | Palm 2 (soon) | Llama 7b. ( |
| --------- | ----- | ------- | ------------- | ----------- |
| Precision | 0.93  | 0.76    |               |             |
| Recall    | 0.78  | 0.93    |               |             |
| F1        | 0.85  | 0.85    |               |             |

## GPT-4 Results

<figure><img src="../../.gitbook/assets/Screenshot 2023-09-16 at 5.45.20 PM.png" alt=""><figcaption></figcaption></figure>

## GPT 3.5 Results

<figure><img src="../../.gitbook/assets/Screenshot 2023-09-16 at 5.49.07 PM (1).png" alt=""><figcaption></figcaption></figure>

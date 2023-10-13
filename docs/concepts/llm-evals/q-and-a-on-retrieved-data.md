# Q\&A on Retrieved Data

{% embed url="https://colab.research.google.com/github/Arize-ai/phoenix/blob/main/tutorials/evals/evaluate_QA_classifications.ipynb" %}

This Eval evaluates whether a question was correctly answered by the system based on the retrieved data. In contrast to retrieval Evals that are checks on chunks of data returned, this check is a system level check of a correct Q\&A.

* **question**: This is the question the Q\&A system is running against
* **sampled\_answer**: This is the answer from the Q\&A system.&#x20;
* **context**: This is the context to be used to answer the question, and is what Q\&A Eval must use to check the correct answer

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

#The rails fore the output to specific values of the template
#It will remove text such as ",,," or "...", anything not the
#binary value expected from the template
rails = list(templates.QA_PROMPT_RAILS_MAP.values())
Q_and_A_classifications = llm_eval_binary(
    dataframe=df_sample,
    template=templates.QA_PROMPT_TEMPLATE_STR,
    model=model,
    rails=rails,
)
```

The above Eval uses the QA template for Q\&A analysis on retrieved data.&#x20;

| Q\&A Eval | GPT-4 | GPT-3.5 | GPT-3.5-turbo-instruct | Palm (Text Bison) |
| --------- | ----- | ------- | ---------------------- | ----------------- |
| Precision | 1     | 0.99    | 0.42                   | 1                 |
| Recall    | 0.92  | 0.83    | 1                      | 0.94              |
| Precision | 0.96  | 0.90    | 0.59                   | 0.97              |

## GPT-4 Results

<figure><img src="../../.gitbook/assets/Screenshot 2023-09-16 at 5.25.14 PM.png" alt=""><figcaption></figcaption></figure>

## GPT-3.5 Results

<figure><img src="../../.gitbook/assets/Screenshot 2023-09-16 at 5.38.50 PM.png" alt=""><figcaption></figcaption></figure>

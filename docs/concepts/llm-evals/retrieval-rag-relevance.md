# Retrieval (RAG) Relevance

{% embed url="https://colab.research.google.com/github/Arize-ai/phoenix/blob/main/tutorials/evals/evaluate_relevance_classifications.ipynb" %}

This Eval evaluates whether a retrieved chunk contains an answer to the query. Its extremely useful for evaluating retrieval systems.

```python
from phoenix.experimental.evals import (
    RAG_RELEVANCY_PROMPT_RAILS_MAP,
    RAG_RELEVANCY_PROMPT_TEMPLATE_STR,
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
rails = list(RAG_RELEVANCY_PROMPT_RAILS_MAP.values())
relevance_classifications = llm_eval_binary(
    dataframe=df,
    template=RAG_RELEVANCY_PROMPT_TEMPLATE_STR,
    model=model,
    rails=rails,
)
```

The above runs the RAG relevancy LLM template against the dataframe df.



| RAG Eval  | GPT-4 | GPT-3.5 | Palm 2 (soon) | Llama 7b (soon) |
| --------- | ----- | ------- | ------------- | --------------- |
| Precision | 0.70  | 0.70    |               |                 |
| Recall    | 0.88  | 0.88    |               |                 |
| F1        | 0.78  | 0.78    |               |                 |

### GPT-4 Result

<figure><img src="../../.gitbook/assets/Screenshot 2023-09-16 at 5.09.34 PM.png" alt=""><figcaption><p>Scikit GPT-4</p></figcaption></figure>

### GPT-3.5 Results

<figure><img src="../../.gitbook/assets/Screenshot 2023-09-16 at 5.20.06 PM.png" alt=""><figcaption></figcaption></figure>

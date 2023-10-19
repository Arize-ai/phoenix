# Retrieval (RAG) Relevance

## When To Use RAG Eval Template

This Eval evaluates whether a retrieved chunk contains an answer to the query. It's extremely useful for evaluating retrieval systems.

## RAG Eval Template

{% embed url="https://colab.research.google.com/github/Arize-ai/phoenix/blob/main/tutorials/evals/evaluate_relevance_classifications.ipynb" %}
Try it out!&#x20;
{% endembed %}

```python
You are comparing a reference text to a question and trying to determine if the reference text
contains information relevant to answering the question. Here is the data:
    [BEGIN DATA]
    ************
    [Question]: {query}
    ************
    [Reference text]: {reference}
    [END DATA]

Compare the Question above to the Reference text. You must determine whether the Reference text
contains information that can answer the Question. Please focus on whether the very specific
question can be answered by the information in the Reference text.
Your response must be single word, either "relevant" or "irrelevant",
and should not contain any text or characters aside from that word.
"irrelevant" means that the reference text does not contain an answer to the Question.
"relevant" means the reference text contains an answer to the Question.
```

{% hint style="info" %}
We are continually iterating our templates, view the most up-to-date template on GitHub. Last updated on 10/12/2023
{% endhint %}

## Benchmark Results&#x20;

#### GPT-4 Result

<figure><img src="../../.gitbook/assets/Screenshot 2023-09-16 at 5.09.34 PM.png" alt=""><figcaption><p>Scikit GPT-4</p></figcaption></figure>

#### GPT-3.5 Results

<figure><img src="../../.gitbook/assets/Screenshot 2023-09-16 at 5.20.06 PM.png" alt=""><figcaption></figcaption></figure>

## How To Run the Eval&#x20;

<pre class="language-python"><code class="lang-python"><strong>from phoenix.experimental.evals import (
</strong>    RAG_RELEVANCY_PROMPT_RAILS_MAP,
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
</code></pre>

The above runs the RAG relevancy LLM template against the dataframe df.

<table><thead><tr><th>RAG Eval</th><th>GPT-4</th><th>GPT-3.5</th><th width="262">GPT-3.5-turbo-instruct</th><th>Palm (Text Bison)</th></tr></thead><tbody><tr><td>Precision</td><td>0.70</td><td>0.70</td><td>0.42</td><td>0.53</td></tr><tr><td>Recall</td><td>0.88</td><td>0.88</td><td>1</td><td>1</td></tr><tr><td>F1</td><td>0.78</td><td>0.78</td><td>0.59</td><td>0.69</td></tr></tbody></table>

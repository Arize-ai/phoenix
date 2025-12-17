# Retrieval (RAG) Relevance

## When To Use RAG Eval Template

This Eval evaluates whether a retrieved chunk contains an answer to the query. It's extremely useful for evaluating retrieval systems.

## RAG Eval Template

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
Your response must be single word, either "relevant" or "unrelated",
and should not contain any text or characters aside from that word.
"unrelated" means that the reference text does not contain an answer to the Question.
"relevant" means the reference text contains an answer to the Question.
```

{% hint style="info" %}
We are continually iterating our templates, view the most up-to-date template [on GitHub](https://github.com/Arize-ai/phoenix/blob/ecef5242d2f9bb39a2fdf5d96a2b1841191f7944/packages/phoenix-evals/src/phoenix/evals/default_templates.py#L12).
{% endhint %}

## How To Run the RAG Relevance Eval

<pre class="language-python"><code class="lang-python"><strong>from phoenix.evals import (
</strong>    RAG_RELEVANCY_PROMPT_RAILS_MAP,
    RAG_RELEVANCY_PROMPT_TEMPLATE,
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
rails = list(RAG_RELEVANCY_PROMPT_RAILS_MAP.values())
relevance_classifications = llm_classify(
    dataframe=df,
    template=RAG_RELEVANCY_PROMPT_TEMPLATE,
    model=model,
    rails=rails,
    provide_explanation=True, #optional to generate explanations for the value produced by the eval LLM
)
</code></pre>

The above runs the RAG relevancy LLM template against the dataframe df.

## Benchmark Results

This benchmark was obtained using notebook below. It was run using the [WikiQA dataset](https://storage.googleapis.com/arize-phoenix-assets/evals/binary-relevance-classification/wiki_qa-train.jsonl.zip) as a ground truth dataset. Each example in the dataset was evaluating using the `RAG_RELEVANCY_PROMPT_TEMPLATE` above, then the resulting labels were compared against the ground truth label in the WikiQA dataset to generate the confusion matrices below.

{% embed url="https://colab.research.google.com/github/Arize-ai/phoenix/blob/main/tutorials/evals/evaluate_relevance_classifications.ipynb" %}
Try it out!
{% endembed %}

#### GPT-4 Result

<figure><img src="../../../.gitbook/assets/Screenshot 2023-09-16 at 5.09.34 PM.png" alt=""><figcaption><p>Scikit GPT-4</p></figcaption></figure>

<table><thead><tr><th width="116">RAG Eval</th><th>GPT-4o</th><th>GPT-4</th><th data-hidden>GPT-3.5-turbo-instruct</th></tr></thead><tbody><tr><td>Precision</td><td><mark style="color:green;">0.60</mark></td><td><mark style="color:green;">0.70</mark></td><td><mark style="color:red;">0.42</mark></td></tr><tr><td>Recall</td><td><mark style="color:green;">0.77</mark></td><td><mark style="color:green;">0.88</mark></td><td><mark style="color:red;">1</mark></td></tr><tr><td>F1</td><td><mark style="color:green;">0.67</mark></td><td><mark style="color:green;">0.78</mark></td><td><mark style="color:red;">0.59</mark></td></tr></tbody></table>

| Throughput  | GPT-4   |
| ----------- | ------- |
| 100 Samples | 113 Sec |

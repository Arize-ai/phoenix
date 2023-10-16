# Running Pre-Tested Evals

The following are simple functions on top of the LLM Evals building blocks that are pre-tested with benchmark datasets.

{% hint style="info" %}
All evals templates are tested against golden datasets that are available as part of the LLM eval library's [benchmarked datasets](./#how-we-benchmark-pre-tested-evals) and target precision at 70-90% and F1 at 70-85%.&#x20;
{% endhint %}

<table data-view="cards"><thead><tr><th align="center"></th><th align="center"></th><th align="center"></th><th align="center"></th><th data-hidden data-card-target data-type="content-ref"></th></tr></thead><tbody><tr><td align="center"><strong>Retrieval Eval</strong></td><td align="center"><a href="retrieval-rag-relevance.md">RAG individual retrieval</a></td><td align="center"><em>Tested on:</em></td><td align="center">MS Marco, WikiQA</td><td><a href="retrieval-rag-relevance.md">retrieval-rag-relevance.md</a></td></tr><tr><td align="center"><strong>Hallucination Eval</strong></td><td align="center"><a href="hallucinations.md">Hallucinations on answers to public and private data</a></td><td align="center"><em>Tested on:</em> </td><td align="center">Hallucination QA Dataset, Hallucination RAG Dataset</td><td><a href="hallucinations.md">hallucinations.md</a></td></tr><tr><td align="center"><strong>Toxicity Eval</strong></td><td align="center"><a href="toxicity.md">Is the AI response racist, biased or toxic</a></td><td align="center">T<em>ested on:</em></td><td align="center">WikiToxic</td><td><a href="toxicity.md">toxicity.md</a></td></tr><tr><td align="center"><strong>Q&#x26;A Eval</strong></td><td align="center"><a href="q-and-a-on-retrieved-data.md">Private data Q&#x26;A Eval</a></td><td align="center"><em>Tested on:</em></td><td align="center">WikiQA</td><td><a href="q-and-a-on-retrieved-data.md">q-and-a-on-retrieved-data.md</a></td></tr><tr><td align="center"><strong>Summarization Eval</strong></td><td align="center"><a href="summarization-eval.md">Summarization performance</a></td><td align="center"><em>Tested on:</em></td><td align="center">GigaWorld, CNNDM, Xsum</td><td><a href="summarization-eval.md">summarization-eval.md</a></td></tr><tr><td align="center"><strong>Code Generation Eval</strong></td><td align="center"><a href="code-generation-eval.md">Code writing correctness and readability</a></td><td align="center"><em>Tested on:</em> </td><td align="center">WikiSQL, HumanEval, CodeXGlu</td><td><a href="code-generation-eval.md">code-generation-eval.md</a></td></tr></tbody></table>

## Supported Models.

The models are instantiated and usable in the LLM Eval function. The models are also directly callable with strings.

```python
model = OpenAIModel(model_name="gpt-4",temperature=0.6)
model("What is the largest costal city in France?")
```

We currently support a growing set of models for LLM Evals, please check out the [API section for usage](../../api/evaluation-models.md).&#x20;

<table data-full-width="false"><thead><tr><th width="357">Model</th><th>Support </th></tr></thead><tbody><tr><td>GPT-4 </td><td>✔</td></tr><tr><td>GPT-3.5 Turbo</td><td>✔</td></tr><tr><td>GPT-3.5 Instruct</td><td>✔</td></tr><tr><td>Azure Hosted Open AI </td><td>✔</td></tr><tr><td>Palm 2 Vertex</td><td>✔</td></tr><tr><td>AWS Bedrock</td><td>✔</td></tr><tr><td>Litellm</td><td>(coming soon)</td></tr><tr><td>Huggingface Llama7B</td><td>(coming soon)</td></tr><tr><td>Anthropic</td><td>(coming soon)</td></tr><tr><td>Cohere</td><td>(coming soon)</td></tr></tbody></table>

## How we benchmark pre-tested evals&#x20;

The above diagram shows examples of different environments the Eval harness is desinged to run. The benchmarking environment is designed to enable the testing of the Eval model & Eval template performance against a designed set of datasets.

The above approach allows us to compare models easily in an understandable format:

<table><thead><tr><th width="296">Hallucination Eval</th><th width="246">GPT-4</th><th width="99">GPT-3.5</th></tr></thead><tbody><tr><td>Precision</td><td>0.94</td><td>0.94</td></tr><tr><td>Recall</td><td>0.75</td><td>0.71</td></tr><tr><td>F1</td><td>0.83</td><td>0.81</td></tr></tbody></table>

---
max_turns: 8
timeout_seconds: 300
allowed_tools: [Skill, Write]
runs: 3
tags: [phoenix-evals]
---
I upgraded `arize-phoenix-evals` to the latest version and this relevance-eval script of mine stopped working — the imports fail now. Can you get it running again? I run it over an exported dataframe `df` that has `input` and `output` columns, and I want the per-label counts at the end like before.

```python
from phoenix.evals import OpenAIModel, llm_classify
from phoenix.evals.default_templates import RAG_RELEVANCY_PROMPT_TEMPLATE

model = OpenAIModel(model="gpt-4")

results = llm_classify(
    dataframe=df,
    template=RAG_RELEVANCY_PROMPT_TEMPLATE,
    model=model,
    rails=["relevant", "irrelevant"],
    provide_explanation=True,
)

print(results["label"].value_counts())
```

Save the fixed version as `relevance_eval.py`.

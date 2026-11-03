import pandas as pd
from phoenix.evals import OpenAIModel, llm_classify
from phoenix.evals.default_templates import RAG_RELEVANCY_PROMPT_TEMPLATE

df = pd.read_parquet("exported_spans.parquet")
model = OpenAIModel(model="gpt-4")

results = llm_classify(
    dataframe=df,
    template=RAG_RELEVANCY_PROMPT_TEMPLATE,
    model=model,
    rails=["relevant", "irrelevant"],
    provide_explanation=True,
)

print(results["label"].value_counts())

# Quickstart Retrieval Evals

In order to run retrieval Evals the following code can be used for quick analysis of common frameworks of LangChain and LlamaIndex.

Independent of the framework you are instrumenting, Phoenix traces allow you to get retrieval data in a common dataframe format that follows the [OpenInference](../../tracing/instrumentation/open-inference.md) specification.

```python
# Get traces from Phoenix into dataframe 

spans_df = px.active_session().get_spans_dataframe()
spans_df[["name", "span_kind", "attributes.input.value", "attributes.retrieval.documents"]].head()

from phoenix.session.evaluation import get_qa_with_reference, get_retrieved_documents

retrieved_documents_df = get_retrieved_documents(px.active_session())
queries_df = get_qa_with_reference(px.active_session())

```

Once the data is in a dataframe, evaluations can be run on the data. Evaluations can be run on on different spans of data. In the below example we run on the top level spans that represent a single trace.

### Q\&A and Hallucination Evals

This example shows how to run Q\&A and Hallucnation Evals with OpenAI (many other [models](../../api/evaluation-models.md) are available including Anthropic, Mixtral/Mistral, Gemini, OpenAI Azure, Bedrock, etc...)

```python
from phoenix.trace import SpanEvaluations, DocumentEvaluations
from phoenix.experimental.evals import (
  HALLUCINATION_PROMPT_RAILS_MAP,
  HALLUCINATION_PROMPT_TEMPLATE,
  QA_PROMPT_RAILS_MAP,
  QA_PROMPT_TEMPLATE,
  OpenAIModel,
  llm_classify,
)

# Creating Hallucination Eval which checks if the application hallucinated
hallucination_eval = llm_classify(
  dataframe=queries_df,
  model=OpenAIModel("gpt-4-turbo-preview", temperature=0.0),
  template=HALLUCINATION_PROMPT_TEMPLATE,
  rails=list(HALLUCINATION_PROMPT_RAILS_MAP.values()),
  provide_explanation=True,  # Makes the LLM explain its reasoning
  concurrency=4,
)
hallucination_eval["score"] = (
  hallucination_eval.label[~hallucination_eval.label.isna()] == "factual"
).astype(int)

# Creating Q&A Eval which checks if the application answered the question correctly
qa_correctness_eval = llm_classify(
  dataframe=queries_df,
  model=OpenAIModel("gpt-4-turbo-preview", temperature=0.0),
  template=QA_PROMPT_TEMPLATE,
  rails=list(QA_PROMPT_RAILS_MAP.values()),
  provide_explanation=True,  # Makes the LLM explain its reasoning
  concurrency=4,
)

qa_correctness_eval["score"] = (
  hallucination_eval.label[~qa_correctness_eval.label.isna()] == "correct"
).astype(int)

# Logs the Evaluations back to the Phoenix User Interface (Optional)
px.Client().log_evaluations(
  SpanEvaluations(eval_name="Hallucination", dataframe=hallucination_eval),
  SpanEvaluations(eval_name="QA Correctness", dataframe=qa_correctness_eval),
)

```

The Evals are available in dataframe locally and can be materilazed back to the Phoenix UI, the Evals are attached to the referenced SpanIDs.

<figure><img src="../../.gitbook/assets/databricks_notebook_eval2.png" alt=""><figcaption><p>Evals in Phoenix UI</p></figcaption></figure>

The snipit of code above links the Evals back to the spans they were generated against.

### Retrieval Chunk Evals

[Retrieval Evals](../running-pre-tested-evals/retrieval-rag-relevance.md) are run on the individual chunks returned on retrieval. In addition to calculating chunk level metrics, Phoenix also calculates MRR and NDCG for the retrieved span.

```python

from phoenix.experimental.evals import (
    RAG_RELEVANCY_PROMPT_RAILS_MAP,
    RAG_RELEVANCY_PROMPT_TEMPLATE,
    OpenAIModel,
    llm_classify,
)

retrieved_documents_eval = llm_classify(
    dataframe=retrieved_documents_df,
    model=OpenAIModel("gpt-4-turbo-preview", temperature=0.0),
    template=RAG_RELEVANCY_PROMPT_TEMPLATE,
    rails=list(RAG_RELEVANCY_PROMPT_RAILS_MAP.values()),
    provide_explanation=True,
)

retrieved_documents_eval["score"] = (
    retrieved_documents_eval.label[~retrieved_documents_eval.label.isna()] == "relevant"
).astype(int)

px.Client().log_evaluations(DocumentEvaluations(eval_name="Relevance", dataframe=retrieved_documents_eval))

```

The calculation is done using the LLM Eval on all chunks returned for the span and the log\_evaluations connects the Evals back to the original spans.

<figure><img src="../../.gitbook/assets/databricks_notebook_retriever_eval.png" alt=""><figcaption><p>Retrieval Evals</p></figcaption></figure>

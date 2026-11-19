# Evaluate retrieval-augmented generation

A RAG app fails in two places, and the fixes differ:

- **Retrieval.** The retriever returned documents that don't help with the request.
  Score each retrieved document on the retriever span.
- **Generation.** The answer says something the documents don't support, or ignores
  them. Score the answer against the documents it was given.

Score both, then cross them per trace:

| | Answer grounded | Answer ungrounded |
| --- | --- | --- |
| **At least one relevant document** | working | generation failure |
| **No relevant document** | abstained or answered from nothing claimable | retrieval failure, plus a failure to abstain |

Report the retrieval miss rate and, separately, the ungrounded rate among traces
whose retrieval found something relevant. That tells the reader which part to fix.

## Retrieval: one annotation per document

`RetrievalRelevanceEvaluator` (`createRetrievalRelevanceEvaluator`) judges one
`context` against one `input`. Pass a single document to score it, or all documents
joined to score the retrieval step as a whole. `input` should be the user's request,
not a rewritten search query, unless the rewritten query is what you're testing.

```python
from phoenix.client import Client
from phoenix.client.helpers.spans import get_retrieved_documents
from phoenix.evals import LLM, async_evaluate_dataframe, bind_evaluator
from phoenix.evals.metrics import RetrievalRelevanceEvaluator
from phoenix.evals.utils import to_annotation_dataframe

client = Client()

# One row per retrieved document, indexed by (context.span_id, document_position).
documents_df = get_retrieved_documents(client, project_identifier="my-app")

relevance = bind_evaluator(
    evaluator=RetrievalRelevanceEvaluator(llm=LLM(provider="openai", model="gpt-4o")),
    input_mapping={"input": "input", "context": "document"},
)
results_df = await async_evaluate_dataframe(dataframe=documents_df, evaluators=[relevance])

# Move the (span ID, position) index into columns. to_annotation_dataframe keeps the
# span ID column, one row per document in the same order, so copy the position across.
# Name the score: the documents frame also has a document_score column.
results_df = results_df.reset_index()
annotations_df = to_annotation_dataframe(dataframe=results_df, score_names=["retrieval_relevance"])
annotations_df["document_position"] = results_df["document_position"].to_numpy()
client.spans.log_document_annotations_dataframe(dataframe=annotations_df, sync=True)
```

Both helpers read at most 1,000 spans with a 5-second timeout and take no `limit`; for
larger projects, call them per time window with `start_time` and `end_time`.

`documents_df["input"]` is the retriever span's input. When that's a rewritten query,
join the root span's input by `context.trace_id` and map `input` to it.

In TypeScript, read retriever spans with `getSpans({ spanKind: "RETRIEVER" })`, take
each document from the `retrieval.documents` attribute, and log results with
`logDocumentAnnotations({ documentAnnotations: [{ spanId, documentPosition, name,
label, score }] })` from `@arizeai/phoenix-client/spans`. `documentPosition` is the
document's 0-based index in the span.

When you have relevance labels for query-document pairs, compute recall@k or
precision@k in code instead of using a judge.

## Generation: one annotation per answer

`FaithfulnessEvaluator` (`createFaithfulnessEvaluator`) checks that every claim in
`output` is supported by `context`. `get_input_output_context` builds the rows: one
per trace, with the root span's input and output and the trace's retrieved documents
joined into `context`.

```python
from phoenix.client.helpers.spans import get_input_output_context
from phoenix.evals.metrics import FaithfulnessEvaluator

qa_df = get_input_output_context(client, project_identifier="my-app")
if qa_df is not None:
    faithfulness = FaithfulnessEvaluator(llm=LLM(provider="openai", model="gpt-4o"))
    results_df = await async_evaluate_dataframe(dataframe=qa_df, evaluators=[faithfulness])
    client.spans.log_span_annotations_dataframe(
        dataframe=to_annotation_dataframe(dataframe=results_df), sync=True
    )
```

The rows are indexed by the root span's ID, so the annotations land on the root
span. Use `HallucinationEvaluator` instead when the source of truth is the
conversation itself (prior turns and tool results), not retrieved documents.

## Common failures to check

| Part | Failure |
| ---- | ------- |
| Retrieval | no relevant document returned; the right document but the wrong chunk; relevant documents ranked below irrelevant ones |
| Generation | a claim not in the documents; an answer that ignores the documents; an answer that misses information the documents contain |

When retrieval misses, the generator should say it doesn't know rather than answer;
count an ungrounded answer on a miss against both parts.

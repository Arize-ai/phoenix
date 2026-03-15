# Evaluation tutorials

This directory contains small, end-to-end examples that show how to run
evaluation flows on LLM applications, including RAG-style workloads.

## RAG failure-mode diagnostics with a WFGY-style checklist

The file [`rag_failure_modes_wfgy.py`](./rag_failure_modes_wfgy.py) shows a
minimal, self-contained example of scoring a single RAG run with an
incident-style checklist.

The script:

- builds a tiny FAQ-style knowledge base that represents the RAG "documents"
- uses a simple retriever that always returns the same FAQs so the failure
  mode is easy to reproduce
- calls an OpenAI chat model to generate an answer using only the retrieved
  context
- calls the model again to score that run on two axes  
  `retrieval_relevance` and `answer_hallucination`, both on a 0–3 scale
- prints a one-row `pandas` dataframe as a Markdown table that summarizes
  the query, retrieved IDs, answer text, scores, and a short comment

The scoring rubric is adapted from the open-source
[WFGY 16-problem ProblemMap](https://github.com/onestardao/WFGY/blob/main/ProblemMap/README.md)
(MIT licensed), which catalogs common RAG failure modes and encourages users
to treat retrieval incidents as repeatable patterns rather than one-off bugs.

You can run the script directly with:

```bash
python rag_failure_modes_wfgy.py
````

It will ask for an OpenAI API key at runtime and then print the diagnostic
summary to standard output.

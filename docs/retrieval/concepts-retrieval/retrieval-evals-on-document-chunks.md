# Retrieval Evals on Document Chunks

Retrieval Evals are designed to evaluate the effectiveness of retrieval systems. The retrieval systems typically return list of chunks of length _k_ ordered by relevancy. The most common retrieval systems in the LLM ecosystem are vector DBs.

The retrieval Eval is designed to asses the relevance of each chunk and its ability to answer the question. More information on the Retrieval Eval can be found here

{% embed url="https://storage.googleapis.com/arize-phoenix-assets/assets/images/RAG_retrieval_overview_diagram.png" %}

The picture above shows a single query returning chunks as a list. The retrieval Eval runs across each chunk returning a value of relevance in a list highlighting its relevance for the specific chunk. Phoenix provides helper functions that take in a dataframe, with query column that has lists of chunks and produces a column that is a list of equal length with an Eval for each chunk.

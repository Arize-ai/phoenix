---
description: Building a RAG pipeline and evaluating it with Phoenix Evals.
---

# Evaluate RAG with Evals

{% embed url="https://colab.research.google.com/github/Arize-ai/phoenix/blob/main/tutorials/evals/evaluate_rag.ipynb" %}

{% embed url="https://www.youtube.com/watch?v=LrMguHcbpO8" %}

In this tutorial we will look into building a RAG pipeline and evaluating it with Phoenix Evals.

It has the the following sections:

1. Understanding Retrieval Augmented Generation (RAG).
2. Building RAG (with the help of a framework such as LlamaIndex).
3. Evaluating RAG with Phoenix Evals.

## Retrieval Augmented Generation (RAG)

LLMs are trained on vast datasets, but these will not include your specific data (things like company knowledge bases and documentation). Retrieval-Augmented Generation (RAG) addresses this by dynamically incorporating your data as context during the generation process. This is done not by altering the training data of the LLMs but by allowing the model to access and utilize your data in real-time to provide more tailored and contextually relevant responses.

In RAG, your data is loaded and prepared for queries. This process is called indexing. User queries act on this index, which filters your data down to the most relevant context. This context and your query then are sent to the LLM along with a prompt, and the LLM provides a response.

RAG is a critical component for building applications such a chatbots or agents and you will want to know RAG techniques on how to get data into your application.

<figure><img src="https://storage.googleapis.com/arize-assets/phoenix/assets/images/RAG_Pipeline.png" alt=""><figcaption></figcaption></figure>

## Stages within RAG

There are five key stages within RAG, which will in turn be a part of any larger RAG application.

* **Loading**: This refers to getting your data from where it lives - whether it's text files, PDFs, another website, a database or an API - into your pipeline.
* **Indexing**: This means creating a data structure that allows for querying the data. For LLMs this nearly always means creating vector embeddings, numerical representations of the meaning of your data, as well as numerous other metadata strategies to make it easy to accurately find contextually relevant data.
* **Storing**: Once your data is indexed, you will want to store your index, along with any other metadata, to avoid the need to re-index it.
* **Querying**: For any given indexing strategy there are many ways you can utilize LLMs and data structures to query, including sub-queries, multi-step queries, and hybrid strategies.
* **Evaluation**: A critical step in any pipeline is checking how effective it is relative to other strategies, or when you make changes. Evaluation provides objective measures on how accurate, faithful, and fast your responses to queries are.

## Build a RAG system

Now that we have understood the stages of RAG, let's build a pipeline. We will use [LlamaIndex](https://www.llamaindex.ai/) for RAG and [Phoenix Evals](https://docs.arize.com/phoenix/llm-evals/llm-evals) for evaluation.

```python
!pip install -qq "arize-phoenix[experimental,llama-index]>=2.0"
```

```python
# The nest_asyncio module enables the nesting of asynchronous functions within an already running async loop.
# This is necessary because Jupyter notebooks inherently operate in an asynchronous loop.
# By applying nest_asyncio, we can run additional async functions within this existing loop without conflicts.
import nest_asyncio

nest_asyncio.apply()

import os
from getpass import getpass

import pandas as pd
import phoenix as px
from llama_index import SimpleDirectoryReader, VectorStoreIndex, set_global_handler
from llama_index.llms import OpenAI
from llama_index.node_parser import SimpleNodeParser
```

During this tutorial, we will capture all the data we need to evaluate our RAG pipeline using Phoenix Tracing. To enable this, simply start the phoenix application and instrument LlamaIndex.

```python
px.launch_app()
```

```python
set_global_handler("arize_phoenix")
```

For this tutorial we will be using OpenAI for creating synthetic data as well as for evaluation.

```python
if not (openai_api_key := os.getenv("OPENAI_API_KEY")):
    openai_api_key = getpass("🔑 Enter your OpenAI API key: ")
os.environ["OPENAI_API_KEY"] = openai_api_key
```

Let's use an [essay by Paul Graham](https://www.paulgraham.com/worked.html) to build our RAG pipeline.

```python
!mkdir -p 'data/paul_graham/'
!curl 'https://raw.githubusercontent.com/Arize-ai/phoenix-assets/main/data/paul_graham/paul_graham_essay.txt' -o 'data/paul_graham/paul_graham_essay.txt'
```

### Load Data and Build an Index

```python
documents = SimpleDirectoryReader("./data/paul_graham/").load_data()

# Define an LLM
llm = OpenAI(model="gpt-4")

# Build index with a chunk_size of 512
node_parser = SimpleNodeParser.from_defaults(chunk_size=512)
nodes = node_parser.get_nodes_from_documents(documents)
vector_index = VectorStoreIndex(nodes)
```

Build a QueryEngine and start querying.

```python
query_engine = vector_index.as_query_engine()
```

```python
response_vector = query_engine.query("What did the author do growing up?")
```

Check the response that you get from the query.

```python
response_vector.response
```

```
'The author wrote short stories and worked on programming, specifically on an IBM 1401 computer in 9th grade.'
```

By default LlamaIndex retrieves two similar nodes/ chunks. You can modify that in `vector_index.as_query_engine(similarity_top_k=k)`.

Let's check the text in each of these retrieved nodes.

```python
# First retrieved node
response_vector.source_nodes[0].get_text()
```

```
'What I Worked On\n\nFebruary 2021\n\nBefore college the two main things I worked on, outside of school, were writing and programming. I didn\'t write essays. I wrote what beginning writers were supposed to write then, and probably still are: short stories. My stories were awful. They had hardly any plot, just characters with strong feelings, which I imagined made them deep.\n\nThe first programs I tried writing were on the IBM 1401 that our school district used for what was then called "data processing." This was in 9th grade, so I was 13 or 14. The school district\'s 1401 happened to be in the basement of our junior high school, and my friend Rich Draves and I got permission to use it. It was like a mini Bond villain\'s lair down there, with all these alien-looking machines — CPU, disk drives, printer, card reader — sitting up on a raised floor under bright fluorescent lights.\n\nThe language we used was an early version of Fortran. You had to type programs on punch cards, then stack them in the card reader and press a button to load the program into memory and run it. The result would ordinarily be to print something on the spectacularly loud printer.\n\nI was puzzled by the 1401. I couldn\'t figure out what to do with it. And in retrospect there\'s not much I could have done with it. The only form of input to programs was data stored on punched cards, and I didn\'t have any data stored on punched cards. The only other option was to do things that didn\'t rely on any input, like calculate approximations of pi, but I didn\'t know enough math to do anything interesting of that type. So I\'m not surprised I can\'t remember any programs I wrote, because they can\'t have done much. My clearest memory is of the moment I learned it was possible for programs not to terminate, when one of mine didn\'t. On a machine without time-sharing, this was a social as well as a technical error, as the data center manager\'s expression made clear.\n\nWith microcomputers, everything changed.'
```

```python
# Second retrieved node
response_vector.source_nodes[1].get_text()
```

```
"It felt like I was doing life right. I remember that because I was slightly dismayed at how novel it felt. The good news is that I had more moments like this over the next few years.\n\nIn the summer of 2016 we moved to England. We wanted our kids to see what it was like living in another country, and since I was a British citizen by birth, that seemed the obvious choice. We only meant to stay for a year, but we liked it so much that we still live there. So most of Bel was written in England.\n\nIn the fall of 2019, Bel was finally finished. Like McCarthy's original Lisp, it's a spec rather than an implementation, although like McCarthy's Lisp it's a spec expressed as code.\n\nNow that I could write essays again, I wrote a bunch about topics I'd had stacked up. I kept writing essays through 2020, but I also started to think about other things I could work on. How should I choose what to do? Well, how had I chosen what to work on in the past? I wrote an essay for myself to answer that question, and I was surprised how long and messy the answer turned out to be. If this surprised me, who'd lived it, then I thought perhaps it would be interesting to other people, and encouraging to those with similarly messy lives. So I wrote a more detailed version for others to read, and this is the last sentence of it.\n\n\n\n\n\n\n\n\n\nNotes\n\n[1] My experience skipped a step in the evolution of computers: time-sharing machines with interactive OSes. I went straight from batch processing to microcomputers, which made microcomputers seem all the more exciting.\n\n[2] Italian words for abstract concepts can nearly always be predicted from their English cognates (except for occasional traps like polluzione). It's the everyday words that differ. So if you string together a lot of abstract concepts with a few simple verbs, you can make a little Italian go a long way.\n\n[3] I lived at Piazza San Felice 4, so my walk to the Accademia went straight down the spine of old Florence: past the Pitti, across the bridge, past Orsanmichele, between the Duomo and the Baptistery, and then up Via Ricasoli to Piazza San Marco."
```

Remember that we are using Phoenix Tracing to capture all the data we need to evaluate our RAG pipeline. You can view the traces in the phoenix application.

```python
print("phoenix URL", px.active_session().url)
```

We can access the traces by directly pulling the spans from the phoenix session.

```python
spans_df = px.active_session().get_spans_dataframe()
```

```python
spans_df[["name", "span_kind", "attributes.input.value", "attributes.retrieval.documents"]].head()
```

|                                      | name       | span\_kind | attributes.input.value             | attributes.retrieval.documents                                |
| ------------------------------------ | ---------- | ---------- | ---------------------------------- | ------------------------------------------------------------- |
| context.span\_id                     |            |            |                                    |                                                               |
| 6aba9eee-91c9-4ee2-81e9-1bdae2eb435d | llm        | LLM        | NaN                                | NaN                                                           |
| cc9feb6a-30ba-4f32-af8d-8c62dd1b1b23 | synthesize | CHAIN      | What did the author do growing up? | NaN                                                           |
| 8202dbe5-d17e-4939-abd8-153cad08bdca | embedding  | EMBEDDING  | NaN                                | NaN                                                           |
| aeadad73-485f-400b-bd9d-842abfaa460b | retrieve   | RETRIEVER  | What did the author do growing up? | <p>[{'document.content': 'What I Worked On</p><p>Febru...</p> |
| 9e25c528-5e2f-4719-899a-8248bab290ec | query      | CHAIN      | What did the author do growing up? | NaN                                                           |

Note that the traces have captured the documents that were retrieved by the query engine. This is nice because it means we can introspect the documents without having to keep track of them ourselves.

```python
spans_with_docs_df = spans_df[spans_df["attributes.retrieval.documents"].notnull()]
```

```python
spans_with_docs_df[["attributes.input.value", "attributes.retrieval.documents"]].head()
```

|                                      | attributes.input.value             | attributes.retrieval.documents                                |
| ------------------------------------ | ---------------------------------- | ------------------------------------------------------------- |
| context.span\_id                     |                                    |                                                               |
| aeadad73-485f-400b-bd9d-842abfaa460b | What did the author do growing up? | <p>[{'document.content': 'What I Worked On</p><p>Febru...</p> |

We have built a RAG pipeline and also have instrumented it using Phoenix Tracing. We now need to evaluate it's performance. We can assess our RAG system/query engine using Phoenix's LLM Evals. Let's examine how to leverage these tools to quantify the quality of our retrieval-augmented generation system.

## Evaluation

Evaluation should serve as the primary metric for assessing your RAG application. It determines whether the pipeline will produce accurate responses based on the data sources and range of queries.

While it's beneficial to examine individual queries and responses, this approach is impractical as the volume of edge-cases and failures increases. Instead, it's more effective to establish a suite of metrics and automated evaluations. These tools can provide insights into overall system performance and can identify specific areas that may require scrutiny.

In a RAG system, evaluation focuses on two critical aspects:

* **Retrieval Evaluation**: To assess the accuracy and relevance of the documents that were retrieved
* **Response Evaluation**: Measure the appropriateness of the response generated by the system when the context was provided.

### Generate Question Context Pairs

For the evaluation of a RAG system, it's essential to have queries that can fetch the correct context and subsequently generate an appropriate response.

For this tutorial, let's use Phoenix's `llm_generate` to help us create the question-context pairs.

First, let's create a dataframe of all the document chunks that we have indexed.

```python
# Let's construct a dataframe of just the documents that are in our index
document_chunks_df = pd.DataFrame({"text": [node.get_text() for node in nodes]})
document_chunks_df.head()
```

|   | text                                              |
| - | ------------------------------------------------- |
| 0 | What I Worked On\n\nFebruary 2021\n\nBefore co... |
| 1 | I was puzzled by the 1401. I couldn't figure o... |
| 2 | I remember vividly how impressed and envious I... |
| 3 | I couldn't have put this into words when I was... |
| 4 | This was more like it; this was what I had exp... |

Now that we have the document chunks, let's prompt an LLM to generate us 3 questions per chunk. Note that you could manually solicit questions from your team or customers, but this is a quick and easy way to generate a large number of questions.

```python
generate_questions_template = """\
Context information is below.

---------------------
{text}
---------------------

Given the context information and not prior knowledge.
generate only questions based on the below query.

You are a Teacher/ Professor. Your task is to setup \
3 questions for an upcoming \
quiz/examination. The questions should be diverse in nature \
across the document. Restrict the questions to the \
context information provided."

Output the questions in JSON format with the keys question_1, question_2, question_3.
"""
```

```python
import json

from phoenix.experimental.evals import OpenAIModel, llm_generate


def output_parser(response: str, index: int):
    try:
        return json.loads(response)
    except json.JSONDecodeError as e:
        return {"__error__": str(e)}


questions_df = llm_generate(
    dataframe=document_chunks_df,
    template=generate_questions_template,
    model=OpenAIModel(
        model_name="gpt-3.5-turbo",
    ),
    output_parser=output_parser,
    concurrency=20,
)
```

```python
questions_df.head()
```

|   | question\_1                                       | question\_2                                       | question\_3                                       |
| - | ------------------------------------------------- | ------------------------------------------------- | ------------------------------------------------- |
| 0 | What were the two main things the author worke... | What was the language the author used to write... | What was the author's clearest memory regardin... |
| 1 | What were the limitations of the 1401 computer... | How did microcomputers change the author's exp... | Why did the author's father buy a TRS-80 compu... |
| 2 | What was the author's first experience with co... | Why did the author decide to switch from study... | What were the two things that influenced the a... |
| 3 | What were the two things that inspired the aut... | What programming language did the author learn... | What was the author's undergraduate thesis about? |
| 4 | What was the author's undergraduate thesis about? | Which three grad schools did the author apply to? | What realization did the author have during th... |

```python
# Construct a dataframe of the questions and the document chunks
questions_with_document_chunk_df = pd.concat([questions_df, document_chunks_df], axis=1)
questions_with_document_chunk_df = questions_with_document_chunk_df.melt(
    id_vars=["text"], value_name="question"
).drop("variable", axis=1)
# If the above step was interrupted, there might be questions missing. Let's run this to clean up the dataframe.
questions_with_document_chunk_df = questions_with_document_chunk_df[
    questions_with_document_chunk_df["question"].notnull()
]
```

The LLM has generated three questions per chunk. Let's take a quick look.

```python
questions_with_document_chunk_df.head(10)
```

|   | text                                              | question                                          |
| - | ------------------------------------------------- | ------------------------------------------------- |
| 0 | What I Worked On\n\nFebruary 2021\n\nBefore co... | What were the two main things the author worke... |
| 1 | I was puzzled by the 1401. I couldn't figure o... | What were the limitations of the 1401 computer... |
| 2 | I remember vividly how impressed and envious I... | What was the author's first experience with co... |
| 3 | I couldn't have put this into words when I was... | What were the two things that inspired the aut... |
| 4 | This was more like it; this was what I had exp... | What was the author's undergraduate thesis about? |
| 5 | Only Harvard accepted me, so that was where I ... | What realization did the author have during th... |
| 6 | So I decided to focus on Lisp. In fact, I deci... | What motivated the author to write a book abou... |
| 7 | Anyone who wanted one to play around with coul... | What realization did the author have while vis... |
| 8 | I knew intellectually that people made art — t... | What was the author's initial perception of pe... |
| 9 | Then one day in April 1990 a crack appeared in... | What was the author's initial plan for their d... |

### Retrieval Evaluation

We are now prepared to perform our retrieval evaluations. We will execute the queries we generated in the previous step and verify whether or not that the correct context is retrieved.

```python
# First things first, let's reset phoenix
px.close_app()
px.launch_app()
```

```
🌍 To view the Phoenix app in your browser, visit http://localhost:6006/
📺 To view the Phoenix app in a notebook, run `px.active_session().view()`
📖 For more information on how to use Phoenix, check out https://docs.arize.com/phoenix





<phoenix.session.session.ThreadSession at 0x2c6c785b0>
```

```python
# loop over the questions and generate the answers
for _, row in questions_with_document_chunk_df.iterrows():
    question = row["question"]
    response_vector = query_engine.query(question)
    print(f"Question: {question}\nAnswer: {response_vector.response}\n")
```

Now that we have executed the queries, we can start validating whether or not the RAG system was able to retrieve the correct context. Let's extract all the retrieved documents from the traces logged to phoenix. (For an in-depth explanation of how to export trace data from the phoenix runtime, consult the [docs](https://docs.arize.com/phoenix/how-to/extract-data-from-spans)).

```python
from phoenix.session.evaluation import get_retrieved_documents

retrieved_documents_df = get_retrieved_documents(px.active_session())
retrieved_documents_df
```

|                                      |                                      | context.trace\_id                                 | input                                             | reference                                         | document\_score |
| ------------------------------------ | ------------------------------------ | ------------------------------------------------- | ------------------------------------------------- | ------------------------------------------------- | --------------- |
| context.span\_id                     | document\_position                   |                                                   |                                                   |                                                   |                 |
| b375be95-8e5e-4817-a29f-e18f7aaa3e98 | 0                                    | 20e0f915-e089-4e8e-8314-b68ffdffd7d1              | How does leaving YC affect the author's relati... | On one of them I realized I was ready to hand ... | 0.820411        |
| 1                                    | 20e0f915-e089-4e8e-8314-b68ffdffd7d1 | How does leaving YC affect the author's relati... | That was what it took for Rtm to offer unsolic... | 0.815969                                          |                 |
| e4e68b51-dbc9-4154-85a4-5cc69382050d | 0                                    | 4ad14fd2-0950-4b3f-9613-e1be5e51b5a4              | Why did YC become a fund for a couple of years... | For example, one thing Julian had done for us ... | 0.860981        |
| 1                                    | 4ad14fd2-0950-4b3f-9613-e1be5e51b5a4 | Why did YC become a fund for a couple of years... | They were an impressive group. That first batc... | 0.849695                                          |                 |
| 27ba6b6f-828b-4732-bfcc-3262775cd71f | 0                                    | d62fb8e8-4247-40ac-8808-818861bfb059              | Why did the author choose the name 'Y Combinat... | Screw the VCs who were taking so long to make ... | 0.868981        |
| ...                                  | ...                                  | ...                                               | ...                                               | ...                                               | ...             |
| 353f152c-44ce-4f3e-a323-0caa90f4c078 | 1                                    | 6b7bebf6-bed3-45fd-828a-0730d8f358ba              | What was the author's first experience with co... | What I Worked On\n\nFebruary 2021\n\nBefore co... | 0.877719        |
| 16de2060-dd9b-4622-92a1-9be080564a40 | 0                                    | 6ce5800d-7186-414e-a1cf-1efb8d39c8d4              | What were the limitations of the 1401 computer... | I was puzzled by the 1401. I couldn't figure o... | 0.847688        |
| 1                                    | 6ce5800d-7186-414e-a1cf-1efb8d39c8d4 | What were the limitations of the 1401 computer... | I remember vividly how impressed and envious I... | 0.836979                                          |                 |
| e996c90f-4ea9-4f7c-b145-cf461de7d09b | 0                                    | a328a85a-aadd-44f5-b49a-2748d0bd4d2f              | What were the two main things the author worke... | What I Worked On\n\nFebruary 2021\n\nBefore co... | 0.843280        |
| 1                                    | a328a85a-aadd-44f5-b49a-2748d0bd4d2f | What were the two main things the author worke... | Then one day in April 1990 a crack appeared in... | 0.822055                                          |                 |

348 rows × 4 columns

Let's now use Phoenix's LLM Evals to evaluate the relevance of the retrieved documents with regards to the query. Note, we've turned on `explanations` which prompts the LLM to explain it's reasoning. This can be useful for debugging and for figuring out potential corrective actions.

```python
from phoenix.experimental.evals import (
    RelevanceEvaluator,
    run_evals,
)

relevance_evaluator = RelevanceEvaluator(OpenAIModel(model_name="gpt-4-1106-preview"))

retrieved_documents_relevance_df = run_evals(
    evaluators=[relevance_evaluator],
    dataframe=retrieved_documents_df,
    provide_explanation=True,
    concurrency=20,
)[0]
```

```python
retrieved_documents_relevance_df.head()
```

We can now combine the documents with the relevance evaluations to compute retrieval metrics. These metrics will help us understand how well the RAG system is performing.

```python
documents_with_relevance_df = pd.concat(
    [retrieved_documents_df, retrieved_documents_relevance_df.add_prefix("eval_")], axis=1
)
documents_with_relevance_df
```

348 rows × 7 columns

Let's compute Normalized Discounted Cumulative Gain [NCDG](https://en.wikipedia.org/wiki/Discounted\_cumulative\_gain) at 2 for all our retrieval steps. In information retrieval, this metric is often used to measure effectiveness of search engine algorithms and related applications.

```python
import numpy as np
from sklearn.metrics import ndcg_score


def _compute_ndcg(df: pd.DataFrame, k: int):
    """Compute NDCG@k in the presence of missing values"""
    n = max(2, len(df))
    eval_scores = np.zeros(n)
    doc_scores = np.zeros(n)
    eval_scores[: len(df)] = df.eval_score
    doc_scores[: len(df)] = df.document_score
    try:
        return ndcg_score([eval_scores], [doc_scores], k=k)
    except ValueError:
        return np.nan


ndcg_at_2 = pd.DataFrame(
    {"score": documents_with_relevance_df.groupby("context.span_id").apply(_compute_ndcg, k=2)}
)
```

```python
ndcg_at_2
```

174 rows × 1 columns

Let's also compute precision at 2 for all our retrieval steps.

```python
precision_at_2 = pd.DataFrame(
    {
        "score": documents_with_relevance_df.groupby("context.span_id").apply(
            lambda x: x.eval_score[:2].sum(skipna=False) / 2
        )
    }
)
```

```python
precision_at_2
```

174 rows × 1 columns

Lastly, let's compute whether or not a correct document was retrieved at all for each query (e.g. a hit)

```python
hit = pd.DataFrame(
    {
        "hit": documents_with_relevance_df.groupby("context.span_id").apply(
            lambda x: x.eval_score[:2].sum(skipna=False) > 0
        )
    }
)
```

Let's now view the results in a combined dataframe.

```python
retrievals_df = px.active_session().get_spans_dataframe("span_kind == 'RETRIEVER'")
rag_evaluation_dataframe = pd.concat(
    [
        retrievals_df["attributes.input.value"],
        ndcg_at_2.add_prefix("ncdg@2_"),
        precision_at_2.add_prefix("precision@2_"),
        hit,
    ],
    axis=1,
)
rag_evaluation_dataframe
```

174 rows × 4 columns

### Observations

Let's now take our results and aggregate them to get a sense of how well our RAG system is performing.

```python
# Aggregate the scores across the retrievals
results = rag_evaluation_dataframe.mean(numeric_only=True)
results
```

```
ncdg@2_score         0.913450
precision@2_score    0.804598
hit                  0.936782
dtype: float64
```

As we can see from the above numbers, our RAG system is not perfect, there are times when it fails to retrieve the correct context within the first two documents. At other times the correct context is included in the top 2 results but non-relevant information is also included in the context. This is an indication that we need to improve our retrieval strategy. One possible solution could be to increase the number of documents retrieved and then use a more sophisticated ranking strategy (such as a reranker) to select the correct context.

We have now evaluated our RAG system's retrieval performance. Let's send these evaluations to Phoenix for visualization. By sending the evaluations to Phoenix, you will be able to view the evaluations alongside the traces that were captured earlier.

```python
from phoenix.trace import DocumentEvaluations, SpanEvaluations

px.log_evaluations(
    SpanEvaluations(dataframe=ndcg_at_2, eval_name="ndcg@2"),
    SpanEvaluations(dataframe=precision_at_2, eval_name="precision@2"),
    DocumentEvaluations(dataframe=retrieved_documents_relevance_df, eval_name="relevance"),
)
```

### Response Evaluation

The retrieval evaluations demonstrates that our RAG system is not perfect. However, it's possible that the LLM is able to generate the correct response even when the context is incorrect. Let's evaluate the responses generated by the LLM.

```python
from phoenix.session.evaluation import get_qa_with_reference

qa_with_reference_df = get_qa_with_reference(px.active_session())
qa_with_reference_df
```

174 rows × 3 columns

Now that we have a dataset of the question, context, and response (input, reference, and output), we now can measure how well the LLM is responding to the queries. For details on the QA correctness evaluation, see the [LLM Evals documentation](https://docs.arize.com/phoenix/llm-evals/running-pre-tested-evals/q-and-a-on-retrieved-data).

```python
from phoenix.experimental.evals import (
    HallucinationEvaluator,
    OpenAIModel,
    QAEvaluator,
    run_evals,
)

qa_evaluator = QAEvaluator(OpenAIModel(model_name="gpt-4-1106-preview"))
hallucination_evaluator = HallucinationEvaluator(OpenAIModel(model_name="gpt-4-1106-preview"))

qa_correctness_eval_df, hallucination_eval_df = run_evals(
    evaluators=[qa_evaluator, hallucination_evaluator],
    dataframe=qa_with_reference_df,
    provide_explanation=True,
    concurrency=20,
)
```

```python
qa_correctness_eval_df.head()
```

```python
hallucination_eval_df.head()
```

#### Observations

Let's now take our results and aggregate them to get a sense of how well the LLM is answering the questions given the context.

```python
qa_correctness_eval_df.mean(numeric_only=True)
```

```
score    0.931034
dtype: float64
```

```python
hallucination_eval_df.mean(numeric_only=True)
```

```
score    0.051724
dtype: float64
```

Our QA Correctness score of `0.91` and a Hallucinations score `0.05` signifies that the generated answers are correct \~91% of the time and that the responses contain hallucinations 5% of the time - there is room for improvement. This could be due to the retrieval strategy or the LLM itself. We will need to investigate further to determine the root cause.

Since we have evaluated our RAG system's QA performance and Hallucinations performance, let's send these evaluations to Phoenix for visualization.

```python
from phoenix.trace import SpanEvaluations

px.log_evaluations(
    SpanEvaluations(dataframe=qa_correctness_eval_df, eval_name="Q&A Correctness"),
    SpanEvaluations(dataframe=hallucination_eval_df, eval_name="Hallucination"),
)
```

```
Sending Evaluations: 100%|██████████| 348/348 [00:00<00:00, 415.37it/s]
```

We now have sent all our evaluations to Phoenix. Let's go to the Phoenix application and view the results! Since we've sent all the evals to Phoenix, we can analyze the results together to make a determination on whether or not poor retrieval or irrelevant context has an effect on the LLM's ability to generate the correct response.

```python
print("phoenix URL", px.active_session().url)
```

```
phoenix URL http://localhost:6006/
```

## Conclusion

We have explored how to build and evaluate a RAG pipeline using LlamaIndex and Phoenix, with a specific focus on evaluating the retrieval system and generated responses within the pipelines.

Phoenix offers a variety of other evaluations that can be used to assess the performance of your LLM Application. For more details, see the [LLM Evals](https://docs.arize.com/phoenix/llm-evals/llm-evals) documentation.

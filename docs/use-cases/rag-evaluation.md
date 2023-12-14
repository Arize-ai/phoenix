---
description: Building a RAG pipeline and evaluating it with Phoenix Evals.
---

# Evaluate RAG with LLM Evals

{% embed url="https://colab.research.google.com/github/Arize-ai/phoenix/blob/main/tutorials/evals/evaluate_rag.ipynb" %}

In this tutorial we will look into building a RAG pipeline and evaluating it with Phoenix Evals.

It has the the following sections:

1. Understanding Retrieval Augmented Generation (RAG).
2. Building RAG (with the help of a framework such as LlamaIndex).
3. Evaluating RAG with Phoenix Evals.

## Retrieval Augmented Generation (RAG)

LLMs are trained on vast datasets, but these will not include your specific data (things like company knowledge bases and documentation). Retrieval-Augmented Generation (RAG) addresses this by dynamically incorporating your data as context during the generation process. This is done not by altering the training data of the LLMs but by allowing the model to access and utilize your data in real-time to provide more tailored and contextually relevant responses.

In RAG, your data is loaded and prepared for queries. This process is called indexing. User queries act on this index, which filters your data down to the most relevant context. This context and your query then are sent to the LLM along with a prompt, and the LLM provides a response.

RAG is a critical component for building applications such a chatbots or agents and you will want to know RAG techniques on how to get data into your application.

<figure><img src="https://storage.googleapis.com/arize-assets/phoenix/assets/images/RAG_Pipeline.png" alt=""><figcaption><p>RAG application flow</p></figcaption></figure>

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
!pip install -qq "arize-phoenix[experimental,llama_index]"
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

```
🌍 To view the Phoenix app in your browser, visit http://127.0.0.1:6006/
📺 To view the Phoenix app in a notebook, run `px.active_session().view()`
📖 For more information on how to use Phoenix, check out https://docs.arize.com/phoenix
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
'The author, growing up, worked on writing and programming. They wrote short stories and also tried writing programs on an IBM 1401 computer.'
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

```
phoenix URL http://127.0.0.1:6006/
```

We can access the traces by directly pulling the spans from the phoenix session.

```python
spans_df = px.active_session().get_spans_dataframe()
```

```python
spans_df[["name", "span_kind", "attributes.input.value", "attributes.retrieval.documents"]].head()
```

|                                      | name       | span\_kind | attributes.input.value             | attributes.retrieval.documents                     |
| ------------------------------------ | ---------- | ---------- | ---------------------------------- | -------------------------------------------------- |
| context.span\_id                     |            |            |                                    |                                                    |
| 36dad34e-403a-4534-8fa9-c7cbf0fed2b4 | llm        | LLM        | NaN                                | NaN                                                |
| cb7237e3-5fa4-4875-98fe-a766d107f82d | synthesize | CHAIN      | What did the author do growing up? | NaN                                                |
| b95cc499-c2b8-4971-9895-af9d92f3fdf3 | retrieve   | RETRIEVER  | What did the author do growing up? | \[{'document.id': 'defe422b-681b-4123-84e7-3d1b... |
| 22249d72-7914-4e6a-9456-068cbf89130d | query      | CHAIN      | What did the author do growing up? | NaN                                                |
| 708a8fca-4202-4a23-ba17-6316a4afdb60 | embedding  | EMBEDDING  | NaN                                | NaN                                                |

Note that the traces have captured the documents that were retrieved by the query engine. This is nice because it means we can introspect the documents without having to keep track of them ourselves.

```python
spans_with_docs_df = spans_df[spans_df["attributes.retrieval.documents"].notnull()]
```

```python
spans_with_docs_df[["attributes.input.value", "attributes.retrieval.documents"]].head()
```

|                                      | attributes.input.value             | attributes.retrieval.documents                     |
| ------------------------------------ | ---------------------------------- | -------------------------------------------------- |
| context.span\_id                     |                                    |                                                    |
| b95cc499-c2b8-4971-9895-af9d92f3fdf3 | What did the author do growing up? | \[{'document.id': 'defe422b-681b-4123-84e7-3d1b... |

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


def output_parser(response: str):
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
)
```

```python
questions_df.head()
```

|   | question\_1                                       | question\_2                                       | question\_3                                       |
| - | ------------------------------------------------- | ------------------------------------------------- | ------------------------------------------------- |
| 0 | What were the two main things the author worke... | What was the language the author used to write... | What was the author's clearest memory regardin... |
| 1 | What were the limitations of the 1401 computer... | How did microcomputers change the way people i... | Why did the author choose to buy a TRS-80 comp... |
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
| 7 | Anyone who wanted one to play around with coul... | What was the author's initial hesitation in ge... |
| 8 | I knew intellectually that people made art — t... | What was the author's initial perception of pe... |
| 9 | Then one day in April 1990 a crack appeared in... | What was the author's initial plan for their d... |

### Retrieval Evaluation

We are now prepared to perform our retrieval evaluations. We will execute the queries we generated in the previous step and verify whether or not that the correct context is retrieved.

```python
# First things first, let's reset phoenix
px.close_app()
px.launch_app()
```

```python
# loop over the questions and generate the answers
for _, row in questions_with_document_chunk_df.iterrows():
    question = row["question"]
    response_vector = query_engine.query(question)
    print(f"Question: {question}\nAnswer: {response_vector.response}\n")
```

Now that we have executed the queries, we can start validating whether or not the RAG system was able to retrieve the correct context.

```python
from phoenix.session.evaluation import get_retrieved_documents

retrieved_documents = get_retrieved_documents(px.active_session())
retrieved_documents
```

|                                      |                                                   | input                                             | reference                                         | document\_score                      | context.trace\_id                    |
| ------------------------------------ | ------------------------------------------------- | ------------------------------------------------- | ------------------------------------------------- | ------------------------------------ | ------------------------------------ |
| context.span\_id                     | document\_position                                |                                                   |                                                   |                                      |                                      |
| 768c6284-b297-4105-a0e2-1b3227a64008 | 0                                                 | How does leaving YC affect the author's relati... | On one of them I realized I was ready to hand ... | 0.820411                             | 8b3d05c8-b788-46ea-b800-8a85094d685d |
| 1                                    | How does leaving YC affect the author's relati... | That was what it took for Rtm to offer unsolic... | 0.815969                                          | 8b3d05c8-b788-46ea-b800-8a85094d685d |                                      |
| 0feb3ff4-be23-4e6b-b867-f5e7278292f3 | 0                                                 | Why did YC become a fund for a couple of years... | For example, one thing Julian had done for us ... | 0.860933                             | 16a74332-d846-4102-a55f-4b6306079e97 |
| 1                                    | Why did YC become a fund for a couple of years... | They were an impressive group. That first batc... | 0.849662                                          | 16a74332-d846-4102-a55f-4b6306079e97 |                                      |
| a5dad91c-2964-48cc-aa4f-6faee639a9a3 | 0                                                 | Why did the author choose the name 'Y Combinat... | Screw the VCs who were taking so long to make ... | 0.868981                             | 02d3d9e8-ea78-40dc-aec3-89f0f24d8518 |
| ...                                  | ...                                               | ...                                               | ...                                               | ...                                  | ...                                  |
| 16a2a884-9dfe-499f-a990-cc58866e3394 | 1                                                 | What was the author's first experience with co... | What I Worked On\n\nFebruary 2021\n\nBefore co... | 0.877719                             | c39ee984-fe76-4120-8d8a-193a689e8132 |
| 52edbfe3-2731-490d-a654-0288a71a6efd | 0                                                 | What were the limitations of the 1401 computer... | I was puzzled by the 1401. I couldn't figure o... | 0.847688                             | 5f6806c5-ecf0-412a-b410-a962c6e4737e |
| 1                                    | What were the limitations of the 1401 computer... | I remember vividly how impressed and envious I... | 0.836979                                          | 5f6806c5-ecf0-412a-b410-a962c6e4737e |                                      |
| afae8162-4e87-40e9-8d21-ef6d08796663 | 0                                                 | What were the two main things the author worke... | What I Worked On\n\nFebruary 2021\n\nBefore co... | 0.843280                             | c14ad2de-8d07-4016-ba99-bcf595270a13 |
| 1                                    | What were the two main things the author worke... | Then one day in April 1990 a crack appeared in... | 0.822055                                          | c14ad2de-8d07-4016-ba99-bcf595270a13 |                                      |

348 rows × 4 columns

Let's now use Phoenix's LLM Evals to evaluate the relevance of the retrieved documents with regards to the query. Note, we've turned on `explanations` which prompts the LLM to explain it's reasoning. This can be useful for debugging and for figuring out potential corrective actions.

```python
from phoenix.experimental.evals import (
    RAG_RELEVANCY_PROMPT_RAILS_MAP,
    RAG_RELEVANCY_PROMPT_TEMPLATE,
    llm_classify,
)

retrieved_documents_relevance = llm_classify(
    retrieved_documents,
    OpenAIModel(model_name="gpt-4-1106-preview"),
    RAG_RELEVANCY_PROMPT_TEMPLATE,
    list(RAG_RELEVANCY_PROMPT_RAILS_MAP.values()),
    provide_explanation=True,
)
retrieved_documents_relevance["score"] = (
    retrieved_documents_relevance.label[~retrieved_documents_relevance.label.isna()] == "relevant"
).astype(int)
```

```python
retrieved_documents_relevance.head()
```

|                                      |                    | label                                             | explanation                                       | score |
| ------------------------------------ | ------------------ | ------------------------------------------------- | ------------------------------------------------- | ----- |
| context.span\_id                     | document\_position |                                                   |                                                   |       |
| 768c6284-b297-4105-a0e2-1b3227a64008 | 0                  | irrelevant                                        | The question asks about the impact on the auth... | 0     |
| 1                                    | relevant           | The question asks about the author's relations... | 1                                                 |       |
| 0feb3ff4-be23-4e6b-b867-f5e7278292f3 | 0                  | irrelevant                                        | The reference text provides information about ... | 0     |
| 1                                    | irrelevant         | The question asks for the specific reason why ... | 0                                                 |       |
| a5dad91c-2964-48cc-aa4f-6faee639a9a3 | 0                  | irrelevant                                        | The reference text provides a detailed account... | 0     |

We can now combine the documents with the relevance evaluations to compute retrieval metrics. These metrics will help us understand how well the RAG system is performing.

```python
documents_with_relevance = pd.concat(
    [retrieved_documents, retrieved_documents_relevance.add_prefix("eval_")], axis=1
)
documents_with_relevance
```

|                                      |                                                   | input                                             | reference                                         | document\_score                      | context.trace\_id                    | eval\_label                                       | eval\_explanation                                 | eval\_score |
| ------------------------------------ | ------------------------------------------------- | ------------------------------------------------- | ------------------------------------------------- | ------------------------------------ | ------------------------------------ | ------------------------------------------------- | ------------------------------------------------- | ----------- |
| context.span\_id                     | document\_position                                |                                                   |                                                   |                                      |                                      |                                                   |                                                   |             |
| 768c6284-b297-4105-a0e2-1b3227a64008 | 0                                                 | How does leaving YC affect the author's relati... | On one of them I realized I was ready to hand ... | 0.820411                             | 8b3d05c8-b788-46ea-b800-8a85094d685d | irrelevant                                        | The question asks about the impact on the auth... | 0           |
| 1                                    | How does leaving YC affect the author's relati... | That was what it took for Rtm to offer unsolic... | 0.815969                                          | 8b3d05c8-b788-46ea-b800-8a85094d685d | relevant                             | The question asks about the author's relations... | 1                                                 |             |
| 0feb3ff4-be23-4e6b-b867-f5e7278292f3 | 0                                                 | Why did YC become a fund for a couple of years... | For example, one thing Julian had done for us ... | 0.860933                             | 16a74332-d846-4102-a55f-4b6306079e97 | irrelevant                                        | The reference text provides information about ... | 0           |
| 1                                    | Why did YC become a fund for a couple of years... | They were an impressive group. That first batc... | 0.849662                                          | 16a74332-d846-4102-a55f-4b6306079e97 | irrelevant                           | The question asks for the specific reason why ... | 0                                                 |             |
| a5dad91c-2964-48cc-aa4f-6faee639a9a3 | 0                                                 | Why did the author choose the name 'Y Combinat... | Screw the VCs who were taking so long to make ... | 0.868981                             | 02d3d9e8-ea78-40dc-aec3-89f0f24d8518 | irrelevant                                        | The reference text provides a detailed account... | 0           |
| ...                                  | ...                                               | ...                                               | ...                                               | ...                                  | ...                                  | ...                                               | ...                                               | ...         |
| 16a2a884-9dfe-499f-a990-cc58866e3394 | 1                                                 | What was the author's first experience with co... | What I Worked On\n\nFebruary 2021\n\nBefore co... | 0.877719                             | c39ee984-fe76-4120-8d8a-193a689e8132 | relevant                                          | The question asks for the author's first exper... | 1           |
| 52edbfe3-2731-490d-a654-0288a71a6efd | 0                                                 | What were the limitations of the 1401 computer... | I was puzzled by the 1401. I couldn't figure o... | 0.847688                             | 5f6806c5-ecf0-412a-b410-a962c6e4737e | relevant                                          | The reference text directly addresses the limi... | 1           |
| 1                                    | What were the limitations of the 1401 computer... | I remember vividly how impressed and envious I... | 0.836979                                          | 5f6806c5-ecf0-412a-b410-a962c6e4737e | irrelevant                           | The question asks about the limitations of the... | 0                                                 |             |
| afae8162-4e87-40e9-8d21-ef6d08796663 | 0                                                 | What were the two main things the author worke... | What I Worked On\n\nFebruary 2021\n\nBefore co... | 0.843280                             | c14ad2de-8d07-4016-ba99-bcf595270a13 | relevant                                          | The question asks for the two main activities ... | 1           |
| 1                                    | What were the two main things the author worke... | Then one day in April 1990 a crack appeared in... | 0.822055                                          | c14ad2de-8d07-4016-ba99-bcf595270a13 | relevant                             | The question asks for the two main things the ... | 1                                                 |             |

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
    {"score": documents_with_relevance.groupby("context.span_id").apply(_compute_ndcg, k=2)}
)
```

```python
ndcg_at_2
```

|                                      | score   |
| ------------------------------------ | ------- |
| context.span\_id                     |         |
| 011eefbd-6d5e-49ce-83bd-b2af98fe5ec1 | 1.00000 |
| 02d0a2df-7679-4d43-b717-e441db2f7141 | 1.00000 |
| 02d3995e-d054-49e4-982f-573815abdeb3 | 1.00000 |
| 0833f975-cada-4cde-8a63-8a285e6ab9b1 | 0.00000 |
| 0a6007d8-74fa-4485-8a86-f5e0abd867f4 | 0.00000 |
| ...                                  | ...     |
| faa6ba02-c87c-4a83-bcc2-993f33d87b33 | 0.63093 |
| fbc8031a-3a18-441f-9b2b-89615a70f079 | 1.00000 |
| fd4d5852-e610-404a-b873-55a743efc972 | 1.00000 |
| fed8bf72-72ee-4d7f-9a6b-47fb082aa766 | 1.00000 |
| ff6c6aaa-d5b7-4eb2-bbc6-9775d41016ea | 1.00000 |

174 rows × 1 columns

Let's also compute precision at 2 for all our retrieval steps.

```python
precision_at_2 = pd.DataFrame(
    {
        "score": documents_with_relevance.groupby("context.span_id").apply(
            lambda x: x.eval_score[:2].sum(skipna=False) / 2
        )
    }
)
```

```python
precision_at_2
```

|                                      | score |
| ------------------------------------ | ----- |
| context.span\_id                     |       |
| 011eefbd-6d5e-49ce-83bd-b2af98fe5ec1 | 1.0   |
| 02d0a2df-7679-4d43-b717-e441db2f7141 | 1.0   |
| 02d3995e-d054-49e4-982f-573815abdeb3 | 1.0   |
| 0833f975-cada-4cde-8a63-8a285e6ab9b1 | 0.0   |
| 0a6007d8-74fa-4485-8a86-f5e0abd867f4 | 0.0   |
| ...                                  | ...   |
| faa6ba02-c87c-4a83-bcc2-993f33d87b33 | 0.5   |
| fbc8031a-3a18-441f-9b2b-89615a70f079 | 1.0   |
| fd4d5852-e610-404a-b873-55a743efc972 | 0.5   |
| fed8bf72-72ee-4d7f-9a6b-47fb082aa766 | 1.0   |
| ff6c6aaa-d5b7-4eb2-bbc6-9775d41016ea | 0.5   |

174 rows × 1 columns

Let's now view the results in a combined dataframe.

```python
retrievals_df = px.active_session().get_spans_dataframe("span_kind == 'RETRIEVER'")
rag_evaluation_dataframe = pd.concat(
    [
        retrievals_df["attributes.input.value"],
        ndcg_at_2.add_prefix("ncdg@2_"),
        precision_at_2.add_prefix("precision@2_"),
    ],
    axis=1,
)
rag_evaluation_dataframe
```

|                                      | attributes.input.value                            | ncdg@2\_score | precision@2\_score |
| ------------------------------------ | ------------------------------------------------- | ------------- | ------------------ |
| context.span\_id                     |                                                   |               |                    |
| 768c6284-b297-4105-a0e2-1b3227a64008 | How does leaving YC affect the author's relati... | 0.63093       | 0.5                |
| 0feb3ff4-be23-4e6b-b867-f5e7278292f3 | Why did YC become a fund for a couple of years... | 0.00000       | 0.0                |
| a5dad91c-2964-48cc-aa4f-6faee639a9a3 | Why did the author choose the name 'Y Combinat... | 0.63093       | 0.5                |
| 6bcfb3c6-6955-4798-b00f-e1a5cde9522d | Why did the software for an online store build... | 0.00000       | 0.0                |
| faa6ba02-c87c-4a83-bcc2-993f33d87b33 | Describe the author's route from their residen... | 0.63093       | 0.5                |
| ...                                  | ...                                               | ...           | ...                |
| e1f8f2ac-86a6-4b61-99e5-7d9117e10384 | What was the author's undergraduate thesis about? | 0.00000       | 0.0                |
| bf141035-d68f-499d-9d8c-df1482a751ef | What were the two things that inspired the aut... | 0.63093       | 0.5                |
| 16a2a884-9dfe-499f-a990-cc58866e3394 | What was the author's first experience with co... | 1.00000       | 1.0                |
| 52edbfe3-2731-490d-a654-0288a71a6efd | What were the limitations of the 1401 computer... | 1.00000       | 0.5                |
| afae8162-4e87-40e9-8d21-ef6d08796663 | What were the two main things the author worke... | 1.00000       | 1.0                |

174 rows × 3 columns

### Observations

Let's now take our results and aggregate them to get a sense of how well our RAG system is performing.

```python
# Aggregate the scores across the retrievals
results = rag_evaluation_dataframe.mean(numeric_only=True)
results
```

```
ncdg@2_score         0.896208
precision@2_score    0.793103
dtype: float64
```

As we can see from the above numbers, our RAG system is not perfect, there are times when it fails to retrieve the correct context within the first two documents. At other times the correct context is included in the top 2 results but non-relevant information is also included in the context. This is an indication that we need to improve our retrieval strategy. One possible solution could be to increase the number of documents retrieved and then use a more sophisticated ranking strategy (such as a reranker) to select the correct context.

We have now evaluated our RAG system's retrieval performance. Let's send these evaluations to Phoenix for visualization. By sending the evaluations to Phoenix, you will be able to view the evaluations alongside the traces that were captured earlier.

```python
from phoenix.trace import DocumentEvaluations, SpanEvaluations

px.log_evaluations(
    SpanEvaluations(ndcg_at_2, "ndcg@2"),
    DocumentEvaluations(retrieved_documents_relevance, "relevance"),
)
```

### Response Evaluation

The retrieval evaluations demonstrates that our RAG system is not perfect. However, it's possible that the LLM is able to generate the correct response even when the context is incorrect. Let's evaluate the responses generated by the LLM.

```python
# Construct a dataframe of query and context
question_and_answer_df = (
    px.active_session()
    .get_spans_dataframe("output.value is not None", root_spans_only=True)
    .set_index("context.trace_id")[
        ["attributes.input.value", "attributes.output.value", "context.span_id"]
    ]
    .rename({"attributes.input.value": "input", "attributes.output.value": "output"}, axis=1)
)
question_and_answer_df["reference"] = retrieved_documents.groupby("context.trace_id").apply(
    lambda x: "\n\n".join(x.reference)
)
question_and_answer_df.set_index("context.span_id", inplace=True)
question_and_answer_df
```

|                                      | input                                             | output                                            | reference                                          |
| ------------------------------------ | ------------------------------------------------- | ------------------------------------------------- | -------------------------------------------------- |
| context.span\_id                     |                                                   |                                                   |                                                    |
| 50615bfc-eaff-47b1-b64c-98af5aea14c1 | How does leaving YC affect the author's relati... | Leaving YC does not have a direct impact on th... | On one of them I realized I was ready to hand ...  |
| 5699c9b6-72cb-49af-9dac-c6199fbd571e | Why did YC become a fund for a couple of years... | YC became a fund for a couple of years startin... | For example, one thing Julian had done for us ...  |
| 682379b8-5405-42f8-a98e-d3aa238570c5 | Why did the author choose the name 'Y Combinat... | The author chose the name 'Y Combinator' for t... | Screw the VCs who were taking so long to make ...  |
| 54b7dc21-aa5f-4319-8121-9c2b841b4214 | Why did the software for an online store build... | The software for the online store builder need... | \[8]\n\nThere were three main parts to the soft... |
| 57580be5-e1b5-4093-84b8-24a4056a36a7 | Describe the author's route from their residen... | The author's route from their residence to the... | This was not as strange as it sounds, because ...  |
| ...                                  | ...                                               | ...                                               | ...                                                |
| 6a778fa8-9f95-4149-81e1-0fab5cff19e0 | What was the author's undergraduate thesis about? | The context information does not provide any i... | I knew intellectually that people made art — t...  |
| 32991f14-884e-4c99-84ee-bad704de2c25 | What were the two things that inspired the aut... | The two things that inspired the author to wor... | Only Harvard accepted me, so that was where I ...  |
| e1f2c9ef-8a45-4515-92bf-a11d58321c0a | What was the author's first experience with co... | The author's first experience with computers a... | I remember vividly how impressed and envious I...  |
| 6c33ada6-bcdd-4294-aa26-392771ce0bca | What were the limitations of the 1401 computer... | The author mentions that the only form of inpu... | I was puzzled by the 1401. I couldn't figure o...  |
| 6deb5e71-b550-456b-b9ff-51a062f890c6 | What were the two main things the author worke... | Before college, the author worked on writing a... | What I Worked On\n\nFebruary 2021\n\nBefore co...  |

174 rows × 3 columns

Now that we have a dataset of the question, context, and response (input, reference, and output), we now can measure how well the LLM is responding to the queries. For details on the QA correctness evaluation, see the [LLM Evals documentation](https://docs.arize.com/phoenix/llm-evals/running-pre-tested-evals/q-and-a-on-retrieved-data).

```python
from phoenix.experimental.evals.templates.default_templates import (
    QA_PROMPT_RAILS_MAP,
    QA_PROMPT_TEMPLATE,
)

qa_correctness_eval = llm_classify(
    question_and_answer_df,
    OpenAIModel(model_name="gpt-4-1106-preview"),
    QA_PROMPT_TEMPLATE,
    list(QA_PROMPT_RAILS_MAP.values()),
    provide_explanation=True,
)

qa_correctness_eval["score"] = (
    qa_correctness_eval.label[~qa_correctness_eval.label.isna()] == "correct"
).astype(int)
```

```python
qa_correctness_eval.head()
```

|                                      | label     | explanation                                       | score |
| ------------------------------------ | --------- | ------------------------------------------------- | ----- |
| context.span\_id                     |           |                                                   |       |
| 50615bfc-eaff-47b1-b64c-98af5aea14c1 | correct   | To determine if the answer is correct or incor... | 1     |
| 5699c9b6-72cb-49af-9dac-c6199fbd571e | correct   | The reference text explains that YC was not or... | 1     |
| 682379b8-5405-42f8-a98e-d3aa238570c5 | correct   | To determine if the answer is correct, we need... | 1     |
| 54b7dc21-aa5f-4319-8121-9c2b841b4214 | incorrect | To determine if the answer is correct, we must... | 0     |
| 57580be5-e1b5-4093-84b8-24a4056a36a7 | correct   | To determine if the answer is correct, we need... | 1     |

#### Observations

Let's now take our results and aggregate them to get a sense of how well the LLM is answering the questions given the context.

```python
qa_correctness_eval.mean(numeric_only=True)
```

```
score    0.91954
dtype: float64
```

Our QA Correctness score of `0.91` signifies that the generated answers are correct 91% of the time - there is room for improvement. This could be due to the retrieval strategy or the LLM itself. We will need to investigate further to determine the root cause.

Since we have evaluated our RAG system's QA performance, let's send these evaluations to Phoenix for visualization.

```python
from phoenix.trace import DocumentEvaluations, SpanEvaluations

px.log_evaluations(
    SpanEvaluations(qa_correctness_eval, "Q&A Correctness"),
)
```

We now have sent all our evaluations to Phoenix. Let's go to the Phoenix application and view the results! Since we've sent all the evals to Phoenix, we can analyze the results together to make a determination on whether or not poor retrieval or irrelevant context has an effect on the LLM's ability to generate the correct response.

```python
print("phoenix URL", px.active_session().url)
```

## Conclusion

We have explored how to build and evaluate a RAG pipeline using LlamaIndex and Phoenix, with a specific focus on evaluating the retrieval system and generated responses within the pipelines.

Phoenix offers a variety of other evaluations that can be used to assess the performance of your LLM Application. For more details, see the LLM Evals documentation.

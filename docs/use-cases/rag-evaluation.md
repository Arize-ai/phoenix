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

<img src="https://storage.googleapis.com/arize-assets/phoenix/assets/images/RAG_Pipeline.png">

## Stages within RAG

There are five key stages within RAG, which will in turn be a part of any larger RAG application.

-   **Loading**: This refers to getting your data from where it lives - whether it's text files, PDFs, another website, a database or an API - into your pipeline.
-   **Indexing**: This means creating a data structure that allows for querying the data. For LLMs this nearly always means creating vector embeddings, numerical representations of the meaning of your data, as well as numerous other metadata strategies to make it easy to accurately find contextually relevant data.
-   **Storing**: Once your data is indexed, you will want to store your index, along with any other metadata, to avoid the need to re-index it.

-   **Querying**: For any given indexing strategy there are many ways you can utilize LLMs and data structures to query, including sub-queries, multi-step queries, and hybrid strategies.
-   **Evaluation**: A critical step in any pipeline is checking how effective it is relative to other strategies, or when you make changes. Evaluation provides objective measures on how accurate, faithful, and fast your responses to queries are.

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

    'The author wrote short stories and worked on programming, specifically on an IBM 1401 computer in 9th grade.'

By default LlamaIndex retrieves two similar nodes/ chunks. You can modify that in `vector_index.as_query_engine(similarity_top_k=k)`.

Let's check the text in each of these retrieved nodes.

```python
# First retrieved node
response_vector.source_nodes[0].get_text()
```

    'What I Worked On\n\nFebruary 2021\n\nBefore college the two main things I worked on, outside of school, were writing and programming. I didn\'t write essays. I wrote what beginning writers were supposed to write then, and probably still are: short stories. My stories were awful. They had hardly any plot, just characters with strong feelings, which I imagined made them deep.\n\nThe first programs I tried writing were on the IBM 1401 that our school district used for what was then called "data processing." This was in 9th grade, so I was 13 or 14. The school district\'s 1401 happened to be in the basement of our junior high school, and my friend Rich Draves and I got permission to use it. It was like a mini Bond villain\'s lair down there, with all these alien-looking machines — CPU, disk drives, printer, card reader — sitting up on a raised floor under bright fluorescent lights.\n\nThe language we used was an early version of Fortran. You had to type programs on punch cards, then stack them in the card reader and press a button to load the program into memory and run it. The result would ordinarily be to print something on the spectacularly loud printer.\n\nI was puzzled by the 1401. I couldn\'t figure out what to do with it. And in retrospect there\'s not much I could have done with it. The only form of input to programs was data stored on punched cards, and I didn\'t have any data stored on punched cards. The only other option was to do things that didn\'t rely on any input, like calculate approximations of pi, but I didn\'t know enough math to do anything interesting of that type. So I\'m not surprised I can\'t remember any programs I wrote, because they can\'t have done much. My clearest memory is of the moment I learned it was possible for programs not to terminate, when one of mine didn\'t. On a machine without time-sharing, this was a social as well as a technical error, as the data center manager\'s expression made clear.\n\nWith microcomputers, everything changed.'

```python
# Second retrieved node
response_vector.source_nodes[1].get_text()
```

    "It felt like I was doing life right. I remember that because I was slightly dismayed at how novel it felt. The good news is that I had more moments like this over the next few years.\n\nIn the summer of 2016 we moved to England. We wanted our kids to see what it was like living in another country, and since I was a British citizen by birth, that seemed the obvious choice. We only meant to stay for a year, but we liked it so much that we still live there. So most of Bel was written in England.\n\nIn the fall of 2019, Bel was finally finished. Like McCarthy's original Lisp, it's a spec rather than an implementation, although like McCarthy's Lisp it's a spec expressed as code.\n\nNow that I could write essays again, I wrote a bunch about topics I'd had stacked up. I kept writing essays through 2020, but I also started to think about other things I could work on. How should I choose what to do? Well, how had I chosen what to work on in the past? I wrote an essay for myself to answer that question, and I was surprised how long and messy the answer turned out to be. If this surprised me, who'd lived it, then I thought perhaps it would be interesting to other people, and encouraging to those with similarly messy lives. So I wrote a more detailed version for others to read, and this is the last sentence of it.\n\n\n\n\n\n\n\n\n\nNotes\n\n[1] My experience skipped a step in the evolution of computers: time-sharing machines with interactive OSes. I went straight from batch processing to microcomputers, which made microcomputers seem all the more exciting.\n\n[2] Italian words for abstract concepts can nearly always be predicted from their English cognates (except for occasional traps like polluzione). It's the everyday words that differ. So if you string together a lot of abstract concepts with a few simple verbs, you can make a little Italian go a long way.\n\n[3] I lived at Piazza San Felice 4, so my walk to the Accademia went straight down the spine of old Florence: past the Pitti, across the bridge, past Orsanmichele, between the Duomo and the Baptistery, and then up Via Ricasoli to Piazza San Marco."

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

<div>
<style scoped>
    .dataframe tbody tr th:only-of-type {
        vertical-align: middle;
    }

    .dataframe tbody tr th {
        vertical-align: top;
    }

    .dataframe thead th {
        text-align: right;
    }

</style>
<table border="1" class="dataframe">
  <thead>
    <tr style="text-align: right;">
      <th></th>
      <th>name</th>
      <th>span_kind</th>
      <th>attributes.input.value</th>
      <th>attributes.retrieval.documents</th>
    </tr>
    <tr>
      <th>context.span_id</th>
      <th></th>
      <th></th>
      <th></th>
      <th></th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>6aba9eee-91c9-4ee2-81e9-1bdae2eb435d</th>
      <td>llm</td>
      <td>LLM</td>
      <td>NaN</td>
      <td>NaN</td>
    </tr>
    <tr>
      <th>cc9feb6a-30ba-4f32-af8d-8c62dd1b1b23</th>
      <td>synthesize</td>
      <td>CHAIN</td>
      <td>What did the author do growing up?</td>
      <td>NaN</td>
    </tr>
    <tr>
      <th>8202dbe5-d17e-4939-abd8-153cad08bdca</th>
      <td>embedding</td>
      <td>EMBEDDING</td>
      <td>NaN</td>
      <td>NaN</td>
    </tr>
    <tr>
      <th>aeadad73-485f-400b-bd9d-842abfaa460b</th>
      <td>retrieve</td>
      <td>RETRIEVER</td>
      <td>What did the author do growing up?</td>
      <td>[{'document.content': 'What I Worked On

Febru...</td>

</tr>
<tr>
<th>9e25c528-5e2f-4719-899a-8248bab290ec</th>
<td>query</td>
<td>CHAIN</td>
<td>What did the author do growing up?</td>
<td>NaN</td>
</tr>

  </tbody>
</table>
</div>

Note that the traces have captured the documents that were retrieved by the query engine. This is nice because it means we can introspect the documents without having to keep track of them ourselves.

```python
spans_with_docs_df = spans_df[spans_df["attributes.retrieval.documents"].notnull()]
```

```python
spans_with_docs_df[["attributes.input.value", "attributes.retrieval.documents"]].head()
```

<div>
<style scoped>
    .dataframe tbody tr th:only-of-type {
        vertical-align: middle;
    }

    .dataframe tbody tr th {
        vertical-align: top;
    }

    .dataframe thead th {
        text-align: right;
    }

</style>
<table border="1" class="dataframe">
  <thead>
    <tr style="text-align: right;">
      <th></th>
      <th>attributes.input.value</th>
      <th>attributes.retrieval.documents</th>
    </tr>
    <tr>
      <th>context.span_id</th>
      <th></th>
      <th></th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>aeadad73-485f-400b-bd9d-842abfaa460b</th>
      <td>What did the author do growing up?</td>
      <td>[{'document.content': 'What I Worked On

Febru...</td>

</tr>

  </tbody>
</table>
</div>

We have built a RAG pipeline and also have instrumented it using Phoenix Tracing. We now need to evaluate it's performance. We can assess our RAG system/query engine using Phoenix's LLM Evals. Let's examine how to leverage these tools to quantify the quality of our retrieval-augmented generation system.

## Evaluation

Evaluation should serve as the primary metric for assessing your RAG application. It determines whether the pipeline will produce accurate responses based on the data sources and range of queries.

While it's beneficial to examine individual queries and responses, this approach is impractical as the volume of edge-cases and failures increases. Instead, it's more effective to establish a suite of metrics and automated evaluations. These tools can provide insights into overall system performance and can identify specific areas that may require scrutiny.

In a RAG system, evaluation focuses on two critical aspects:

-   **Retrieval Evaluation**: To assess the accuracy and relevance of the documents that were retrieved
-   **Response Evaluation**: Measure the appropriateness of the response generated by the system when the context was provided.

### Generate Question Context Pairs

For the evaluation of a RAG system, it's essential to have queries that can fetch the correct context and subsequently generate an appropriate response.

For this tutorial, let's use Phoenix's `llm_generate` to help us create the question-context pairs.

First, let's create a dataframe of all the document chunks that we have indexed.

```python
# Let's construct a dataframe of just the documents that are in our index
document_chunks_df = pd.DataFrame({"text": [node.get_text() for node in nodes]})
document_chunks_df.head()
```

<div>
<style scoped>
    .dataframe tbody tr th:only-of-type {
        vertical-align: middle;
    }

    .dataframe tbody tr th {
        vertical-align: top;
    }

    .dataframe thead th {
        text-align: right;
    }

</style>
<table border="1" class="dataframe">
  <thead>
    <tr style="text-align: right;">
      <th></th>
      <th>text</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>0</th>
      <td>What I Worked On\n\nFebruary 2021\n\nBefore co...</td>
    </tr>
    <tr>
      <th>1</th>
      <td>I was puzzled by the 1401. I couldn't figure o...</td>
    </tr>
    <tr>
      <th>2</th>
      <td>I remember vividly how impressed and envious I...</td>
    </tr>
    <tr>
      <th>3</th>
      <td>I couldn't have put this into words when I was...</td>
    </tr>
    <tr>
      <th>4</th>
      <td>This was more like it; this was what I had exp...</td>
    </tr>
  </tbody>
</table>
</div>

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

    llm_generate |          | 0/58 (0.0%) | ⏳ 00:00<? | ?it/s

```python
questions_df.head()
```

<div>
<style scoped>
    .dataframe tbody tr th:only-of-type {
        vertical-align: middle;
    }

    .dataframe tbody tr th {
        vertical-align: top;
    }

    .dataframe thead th {
        text-align: right;
    }

</style>
<table border="1" class="dataframe">
  <thead>
    <tr style="text-align: right;">
      <th></th>
      <th>question_1</th>
      <th>question_2</th>
      <th>question_3</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>0</th>
      <td>What were the two main things the author worke...</td>
      <td>What was the language the author used to write...</td>
      <td>What was the author's clearest memory regardin...</td>
    </tr>
    <tr>
      <th>1</th>
      <td>What were the limitations of the 1401 computer...</td>
      <td>How did microcomputers change the author's exp...</td>
      <td>Why did the author's father buy a TRS-80 compu...</td>
    </tr>
    <tr>
      <th>2</th>
      <td>What was the author's first experience with co...</td>
      <td>Why did the author decide to switch from study...</td>
      <td>What were the two things that influenced the a...</td>
    </tr>
    <tr>
      <th>3</th>
      <td>What were the two things that inspired the aut...</td>
      <td>What programming language did the author learn...</td>
      <td>What was the author's undergraduate thesis about?</td>
    </tr>
    <tr>
      <th>4</th>
      <td>What was the author's undergraduate thesis about?</td>
      <td>Which three grad schools did the author apply to?</td>
      <td>What realization did the author have during th...</td>
    </tr>
  </tbody>
</table>
</div>

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

<div>
<style scoped>
    .dataframe tbody tr th:only-of-type {
        vertical-align: middle;
    }

    .dataframe tbody tr th {
        vertical-align: top;
    }

    .dataframe thead th {
        text-align: right;
    }

</style>
<table border="1" class="dataframe">
  <thead>
    <tr style="text-align: right;">
      <th></th>
      <th>text</th>
      <th>question</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>0</th>
      <td>What I Worked On\n\nFebruary 2021\n\nBefore co...</td>
      <td>What were the two main things the author worke...</td>
    </tr>
    <tr>
      <th>1</th>
      <td>I was puzzled by the 1401. I couldn't figure o...</td>
      <td>What were the limitations of the 1401 computer...</td>
    </tr>
    <tr>
      <th>2</th>
      <td>I remember vividly how impressed and envious I...</td>
      <td>What was the author's first experience with co...</td>
    </tr>
    <tr>
      <th>3</th>
      <td>I couldn't have put this into words when I was...</td>
      <td>What were the two things that inspired the aut...</td>
    </tr>
    <tr>
      <th>4</th>
      <td>This was more like it; this was what I had exp...</td>
      <td>What was the author's undergraduate thesis about?</td>
    </tr>
    <tr>
      <th>5</th>
      <td>Only Harvard accepted me, so that was where I ...</td>
      <td>What realization did the author have during th...</td>
    </tr>
    <tr>
      <th>6</th>
      <td>So I decided to focus on Lisp. In fact, I deci...</td>
      <td>What motivated the author to write a book abou...</td>
    </tr>
    <tr>
      <th>7</th>
      <td>Anyone who wanted one to play around with coul...</td>
      <td>What realization did the author have while vis...</td>
    </tr>
    <tr>
      <th>8</th>
      <td>I knew intellectually that people made art — t...</td>
      <td>What was the author's initial perception of pe...</td>
    </tr>
    <tr>
      <th>9</th>
      <td>Then one day in April 1990 a crack appeared in...</td>
      <td>What was the author's initial plan for their d...</td>
    </tr>
  </tbody>
</table>
</div>

### Retrieval Evaluation

We are now prepared to perform our retrieval evaluations. We will execute the queries we generated in the previous step and verify whether or not that the correct context is retrieved.

```python
# First things first, let's reset phoenix
px.close_app()
px.launch_app()
```

    🌍 To view the Phoenix app in your browser, visit http://localhost:6006/
    📺 To view the Phoenix app in a notebook, run `px.active_session().view()`
    📖 For more information on how to use Phoenix, check out https://docs.arize.com/phoenix





    <phoenix.session.session.ThreadSession at 0x2c6c785b0>

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

<div>
<style scoped>
    .dataframe tbody tr th:only-of-type {
        vertical-align: middle;
    }

    .dataframe tbody tr th {
        vertical-align: top;
    }

    .dataframe thead th {
        text-align: right;
    }

</style>
<table border="1" class="dataframe">
  <thead>
    <tr style="text-align: right;">
      <th></th>
      <th></th>
      <th>context.trace_id</th>
      <th>input</th>
      <th>reference</th>
      <th>document_score</th>
    </tr>
    <tr>
      <th>context.span_id</th>
      <th>document_position</th>
      <th></th>
      <th></th>
      <th></th>
      <th></th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th rowspan="2" valign="top">b375be95-8e5e-4817-a29f-e18f7aaa3e98</th>
      <th>0</th>
      <td>20e0f915-e089-4e8e-8314-b68ffdffd7d1</td>
      <td>How does leaving YC affect the author's relati...</td>
      <td>On one of them I realized I was ready to hand ...</td>
      <td>0.820411</td>
    </tr>
    <tr>
      <th>1</th>
      <td>20e0f915-e089-4e8e-8314-b68ffdffd7d1</td>
      <td>How does leaving YC affect the author's relati...</td>
      <td>That was what it took for Rtm to offer unsolic...</td>
      <td>0.815969</td>
    </tr>
    <tr>
      <th rowspan="2" valign="top">e4e68b51-dbc9-4154-85a4-5cc69382050d</th>
      <th>0</th>
      <td>4ad14fd2-0950-4b3f-9613-e1be5e51b5a4</td>
      <td>Why did YC become a fund for a couple of years...</td>
      <td>For example, one thing Julian had done for us ...</td>
      <td>0.860981</td>
    </tr>
    <tr>
      <th>1</th>
      <td>4ad14fd2-0950-4b3f-9613-e1be5e51b5a4</td>
      <td>Why did YC become a fund for a couple of years...</td>
      <td>They were an impressive group. That first batc...</td>
      <td>0.849695</td>
    </tr>
    <tr>
      <th>27ba6b6f-828b-4732-bfcc-3262775cd71f</th>
      <th>0</th>
      <td>d62fb8e8-4247-40ac-8808-818861bfb059</td>
      <td>Why did the author choose the name 'Y Combinat...</td>
      <td>Screw the VCs who were taking so long to make ...</td>
      <td>0.868981</td>
    </tr>
    <tr>
      <th>...</th>
      <th>...</th>
      <td>...</td>
      <td>...</td>
      <td>...</td>
      <td>...</td>
    </tr>
    <tr>
      <th>353f152c-44ce-4f3e-a323-0caa90f4c078</th>
      <th>1</th>
      <td>6b7bebf6-bed3-45fd-828a-0730d8f358ba</td>
      <td>What was the author's first experience with co...</td>
      <td>What I Worked On\n\nFebruary 2021\n\nBefore co...</td>
      <td>0.877719</td>
    </tr>
    <tr>
      <th rowspan="2" valign="top">16de2060-dd9b-4622-92a1-9be080564a40</th>
      <th>0</th>
      <td>6ce5800d-7186-414e-a1cf-1efb8d39c8d4</td>
      <td>What were the limitations of the 1401 computer...</td>
      <td>I was puzzled by the 1401. I couldn't figure o...</td>
      <td>0.847688</td>
    </tr>
    <tr>
      <th>1</th>
      <td>6ce5800d-7186-414e-a1cf-1efb8d39c8d4</td>
      <td>What were the limitations of the 1401 computer...</td>
      <td>I remember vividly how impressed and envious I...</td>
      <td>0.836979</td>
    </tr>
    <tr>
      <th rowspan="2" valign="top">e996c90f-4ea9-4f7c-b145-cf461de7d09b</th>
      <th>0</th>
      <td>a328a85a-aadd-44f5-b49a-2748d0bd4d2f</td>
      <td>What were the two main things the author worke...</td>
      <td>What I Worked On\n\nFebruary 2021\n\nBefore co...</td>
      <td>0.843280</td>
    </tr>
    <tr>
      <th>1</th>
      <td>a328a85a-aadd-44f5-b49a-2748d0bd4d2f</td>
      <td>What were the two main things the author worke...</td>
      <td>Then one day in April 1990 a crack appeared in...</td>
      <td>0.822055</td>
    </tr>
  </tbody>
</table>
<p>348 rows × 4 columns</p>
</div>

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

    run_evals |          | 0/348 (0.0%) | ⏳ 00:00<? | ?it/s


    Worker timeout, requeuing

```python
retrieved_documents_relevance_df.head()
```

<div>
<style scoped>
    .dataframe tbody tr th:only-of-type {
        vertical-align: middle;
    }

    .dataframe tbody tr th {
        vertical-align: top;
    }

    .dataframe thead th {
        text-align: right;
    }

</style>
<table border="1" class="dataframe">
  <thead>
    <tr style="text-align: right;">
      <th></th>
      <th></th>
      <th>label</th>
      <th>score</th>
      <th>explanation</th>
    </tr>
    <tr>
      <th>context.span_id</th>
      <th>document_position</th>
      <th></th>
      <th></th>
      <th></th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th rowspan="2" valign="top">b375be95-8e5e-4817-a29f-e18f7aaa3e98</th>
      <th>0</th>
      <td>unrelated</td>
      <td>0</td>
      <td>The question asks about the effect on the auth...</td>
    </tr>
    <tr>
      <th>1</th>
      <td>relevant</td>
      <td>1</td>
      <td>The question asks about the effect of leaving ...</td>
    </tr>
    <tr>
      <th rowspan="2" valign="top">e4e68b51-dbc9-4154-85a4-5cc69382050d</th>
      <th>0</th>
      <td>unrelated</td>
      <td>0</td>
      <td>The question asks why Y Combinator (YC) became...</td>
    </tr>
    <tr>
      <th>1</th>
      <td>unrelated</td>
      <td>0</td>
      <td>The question asks for the reason why Y Combina...</td>
    </tr>
    <tr>
      <th>27ba6b6f-828b-4732-bfcc-3262775cd71f</th>
      <th>0</th>
      <td>unrelated</td>
      <td>0</td>
      <td>The reference text provides a detailed account...</td>
    </tr>
  </tbody>
</table>
</div>

We can now combine the documents with the relevance evaluations to compute retrieval metrics. These metrics will help us understand how well the RAG system is performing.

```python
documents_with_relevance_df = pd.concat(
    [retrieved_documents_df, retrieved_documents_relevance_df.add_prefix("eval_")], axis=1
)
documents_with_relevance_df
```

<div>
<style scoped>
    .dataframe tbody tr th:only-of-type {
        vertical-align: middle;
    }

    .dataframe tbody tr th {
        vertical-align: top;
    }

    .dataframe thead th {
        text-align: right;
    }

</style>
<table border="1" class="dataframe">
  <thead>
    <tr style="text-align: right;">
      <th></th>
      <th></th>
      <th>context.trace_id</th>
      <th>input</th>
      <th>reference</th>
      <th>document_score</th>
      <th>eval_label</th>
      <th>eval_score</th>
      <th>eval_explanation</th>
    </tr>
    <tr>
      <th>context.span_id</th>
      <th>document_position</th>
      <th></th>
      <th></th>
      <th></th>
      <th></th>
      <th></th>
      <th></th>
      <th></th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th rowspan="2" valign="top">b375be95-8e5e-4817-a29f-e18f7aaa3e98</th>
      <th>0</th>
      <td>20e0f915-e089-4e8e-8314-b68ffdffd7d1</td>
      <td>How does leaving YC affect the author's relati...</td>
      <td>On one of them I realized I was ready to hand ...</td>
      <td>0.820411</td>
      <td>unrelated</td>
      <td>0</td>
      <td>The question asks about the effect on the auth...</td>
    </tr>
    <tr>
      <th>1</th>
      <td>20e0f915-e089-4e8e-8314-b68ffdffd7d1</td>
      <td>How does leaving YC affect the author's relati...</td>
      <td>That was what it took for Rtm to offer unsolic...</td>
      <td>0.815969</td>
      <td>relevant</td>
      <td>1</td>
      <td>The question asks about the effect of leaving ...</td>
    </tr>
    <tr>
      <th rowspan="2" valign="top">e4e68b51-dbc9-4154-85a4-5cc69382050d</th>
      <th>0</th>
      <td>4ad14fd2-0950-4b3f-9613-e1be5e51b5a4</td>
      <td>Why did YC become a fund for a couple of years...</td>
      <td>For example, one thing Julian had done for us ...</td>
      <td>0.860981</td>
      <td>unrelated</td>
      <td>0</td>
      <td>The question asks why Y Combinator (YC) became...</td>
    </tr>
    <tr>
      <th>1</th>
      <td>4ad14fd2-0950-4b3f-9613-e1be5e51b5a4</td>
      <td>Why did YC become a fund for a couple of years...</td>
      <td>They were an impressive group. That first batc...</td>
      <td>0.849695</td>
      <td>unrelated</td>
      <td>0</td>
      <td>The question asks for the reason why Y Combina...</td>
    </tr>
    <tr>
      <th>27ba6b6f-828b-4732-bfcc-3262775cd71f</th>
      <th>0</th>
      <td>d62fb8e8-4247-40ac-8808-818861bfb059</td>
      <td>Why did the author choose the name 'Y Combinat...</td>
      <td>Screw the VCs who were taking so long to make ...</td>
      <td>0.868981</td>
      <td>unrelated</td>
      <td>0</td>
      <td>The reference text provides a detailed account...</td>
    </tr>
    <tr>
      <th>...</th>
      <th>...</th>
      <td>...</td>
      <td>...</td>
      <td>...</td>
      <td>...</td>
      <td>...</td>
      <td>...</td>
      <td>...</td>
    </tr>
    <tr>
      <th>353f152c-44ce-4f3e-a323-0caa90f4c078</th>
      <th>1</th>
      <td>6b7bebf6-bed3-45fd-828a-0730d8f358ba</td>
      <td>What was the author's first experience with co...</td>
      <td>What I Worked On\n\nFebruary 2021\n\nBefore co...</td>
      <td>0.877719</td>
      <td>relevant</td>
      <td>1</td>
      <td>The question asks for the author's first exper...</td>
    </tr>
    <tr>
      <th rowspan="2" valign="top">16de2060-dd9b-4622-92a1-9be080564a40</th>
      <th>0</th>
      <td>6ce5800d-7186-414e-a1cf-1efb8d39c8d4</td>
      <td>What were the limitations of the 1401 computer...</td>
      <td>I was puzzled by the 1401. I couldn't figure o...</td>
      <td>0.847688</td>
      <td>relevant</td>
      <td>1</td>
      <td>The reference text directly addresses the limi...</td>
    </tr>
    <tr>
      <th>1</th>
      <td>6ce5800d-7186-414e-a1cf-1efb8d39c8d4</td>
      <td>What were the limitations of the 1401 computer...</td>
      <td>I remember vividly how impressed and envious I...</td>
      <td>0.836979</td>
      <td>unrelated</td>
      <td>0</td>
      <td>The question asks about the limitations of the...</td>
    </tr>
    <tr>
      <th rowspan="2" valign="top">e996c90f-4ea9-4f7c-b145-cf461de7d09b</th>
      <th>0</th>
      <td>a328a85a-aadd-44f5-b49a-2748d0bd4d2f</td>
      <td>What were the two main things the author worke...</td>
      <td>What I Worked On\n\nFebruary 2021\n\nBefore co...</td>
      <td>0.843280</td>
      <td>relevant</td>
      <td>1</td>
      <td>The question asks for the two main activities ...</td>
    </tr>
    <tr>
      <th>1</th>
      <td>a328a85a-aadd-44f5-b49a-2748d0bd4d2f</td>
      <td>What were the two main things the author worke...</td>
      <td>Then one day in April 1990 a crack appeared in...</td>
      <td>0.822055</td>
      <td>relevant</td>
      <td>1</td>
      <td>The question asks for the two main things the ...</td>
    </tr>
  </tbody>
</table>
<p>348 rows × 7 columns</p>
</div>

Let's compute Normalized Discounted Cumulative Gain [NCDG](https://en.wikipedia.org/wiki/Discounted_cumulative_gain) at 2 for all our retrieval steps. In information retrieval, this metric is often used to measure effectiveness of search engine algorithms and related applications.

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

<div>
<style scoped>
    .dataframe tbody tr th:only-of-type {
        vertical-align: middle;
    }

    .dataframe tbody tr th {
        vertical-align: top;
    }

    .dataframe thead th {
        text-align: right;
    }

</style>
<table border="1" class="dataframe">
  <thead>
    <tr style="text-align: right;">
      <th></th>
      <th>score</th>
    </tr>
    <tr>
      <th>context.span_id</th>
      <th></th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>00f650c1-62e5-4261-bbbb-34c6c00679b0</th>
      <td>1.00000</td>
    </tr>
    <tr>
      <th>0190a1be-3e18-4d5f-9cf9-c402940e114d</th>
      <td>1.00000</td>
    </tr>
    <tr>
      <th>04840726-accb-4a57-85c8-0e0eb12879de</th>
      <td>0.63093</td>
    </tr>
    <tr>
      <th>08e28b63-3b76-4d48-bd6a-4bd8a5f6f673</th>
      <td>1.00000</td>
    </tr>
    <tr>
      <th>0a56dad9-31b0-43b7-ab8c-d8fae83a8d0f</th>
      <td>1.00000</td>
    </tr>
    <tr>
      <th>...</th>
      <td>...</td>
    </tr>
    <tr>
      <th>f5d826cb-0c48-4732-8d2f-32c4d925e511</th>
      <td>1.00000</td>
    </tr>
    <tr>
      <th>f8ef5104-6421-475d-8ad8-d6998d44bd62</th>
      <td>1.00000</td>
    </tr>
    <tr>
      <th>fd661bc9-d2a0-4138-a483-fa2ccc15c6b1</th>
      <td>1.00000</td>
    </tr>
    <tr>
      <th>fd697407-6ec4-4d00-96e9-39377d5c3809</th>
      <td>1.00000</td>
    </tr>
    <tr>
      <th>ff22b769-6e36-475f-8c10-3674e13b08bd</th>
      <td>1.00000</td>
    </tr>
  </tbody>
</table>
<p>174 rows × 1 columns</p>
</div>

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

<div>
<style scoped>
    .dataframe tbody tr th:only-of-type {
        vertical-align: middle;
    }

    .dataframe tbody tr th {
        vertical-align: top;
    }

    .dataframe thead th {
        text-align: right;
    }

</style>
<table border="1" class="dataframe">
  <thead>
    <tr style="text-align: right;">
      <th></th>
      <th>score</th>
    </tr>
    <tr>
      <th>context.span_id</th>
      <th></th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>00f650c1-62e5-4261-bbbb-34c6c00679b0</th>
      <td>1.0</td>
    </tr>
    <tr>
      <th>0190a1be-3e18-4d5f-9cf9-c402940e114d</th>
      <td>1.0</td>
    </tr>
    <tr>
      <th>04840726-accb-4a57-85c8-0e0eb12879de</th>
      <td>0.5</td>
    </tr>
    <tr>
      <th>08e28b63-3b76-4d48-bd6a-4bd8a5f6f673</th>
      <td>1.0</td>
    </tr>
    <tr>
      <th>0a56dad9-31b0-43b7-ab8c-d8fae83a8d0f</th>
      <td>1.0</td>
    </tr>
    <tr>
      <th>...</th>
      <td>...</td>
    </tr>
    <tr>
      <th>f5d826cb-0c48-4732-8d2f-32c4d925e511</th>
      <td>0.5</td>
    </tr>
    <tr>
      <th>f8ef5104-6421-475d-8ad8-d6998d44bd62</th>
      <td>1.0</td>
    </tr>
    <tr>
      <th>fd661bc9-d2a0-4138-a483-fa2ccc15c6b1</th>
      <td>1.0</td>
    </tr>
    <tr>
      <th>fd697407-6ec4-4d00-96e9-39377d5c3809</th>
      <td>1.0</td>
    </tr>
    <tr>
      <th>ff22b769-6e36-475f-8c10-3674e13b08bd</th>
      <td>1.0</td>
    </tr>
  </tbody>
</table>
<p>174 rows × 1 columns</p>
</div>

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

<div>
<style scoped>
    .dataframe tbody tr th:only-of-type {
        vertical-align: middle;
    }

    .dataframe tbody tr th {
        vertical-align: top;
    }

    .dataframe thead th {
        text-align: right;
    }

</style>
<table border="1" class="dataframe">
  <thead>
    <tr style="text-align: right;">
      <th></th>
      <th>attributes.input.value</th>
      <th>ncdg@2_score</th>
      <th>precision@2_score</th>
      <th>hit</th>
    </tr>
    <tr>
      <th>context.span_id</th>
      <th></th>
      <th></th>
      <th></th>
      <th></th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>b375be95-8e5e-4817-a29f-e18f7aaa3e98</th>
      <td>How does leaving YC affect the author's relati...</td>
      <td>0.63093</td>
      <td>0.5</td>
      <td>True</td>
    </tr>
    <tr>
      <th>e4e68b51-dbc9-4154-85a4-5cc69382050d</th>
      <td>Why did YC become a fund for a couple of years...</td>
      <td>0.00000</td>
      <td>0.0</td>
      <td>False</td>
    </tr>
    <tr>
      <th>27ba6b6f-828b-4732-bfcc-3262775cd71f</th>
      <td>Why did the author choose the name 'Y Combinat...</td>
      <td>0.63093</td>
      <td>0.5</td>
      <td>True</td>
    </tr>
    <tr>
      <th>1f667f08-a4ad-4d49-adf0-a47d448e08e5</th>
      <td>Why did the author need to recruit an initial ...</td>
      <td>1.00000</td>
      <td>1.0</td>
      <td>True</td>
    </tr>
    <tr>
      <th>340e8561-233d-4a5a-8768-c5fb78826761</th>
      <td>Describe the author's route from their residen...</td>
      <td>0.63093</td>
      <td>0.5</td>
      <td>True</td>
    </tr>
    <tr>
      <th>...</th>
      <td>...</td>
      <td>...</td>
      <td>...</td>
      <td>...</td>
    </tr>
    <tr>
      <th>c31b717f-d260-4095-b2bc-c20153c14a0b</th>
      <td>What was the author's undergraduate thesis about?</td>
      <td>0.00000</td>
      <td>0.0</td>
      <td>False</td>
    </tr>
    <tr>
      <th>38072bab-05bf-4a24-b595-fce58432cb97</th>
      <td>What were the two things that inspired the aut...</td>
      <td>0.63093</td>
      <td>0.5</td>
      <td>True</td>
    </tr>
    <tr>
      <th>353f152c-44ce-4f3e-a323-0caa90f4c078</th>
      <td>What was the author's first experience with co...</td>
      <td>1.00000</td>
      <td>1.0</td>
      <td>True</td>
    </tr>
    <tr>
      <th>16de2060-dd9b-4622-92a1-9be080564a40</th>
      <td>What were the limitations of the 1401 computer...</td>
      <td>1.00000</td>
      <td>0.5</td>
      <td>True</td>
    </tr>
    <tr>
      <th>e996c90f-4ea9-4f7c-b145-cf461de7d09b</th>
      <td>What were the two main things the author worke...</td>
      <td>1.00000</td>
      <td>1.0</td>
      <td>True</td>
    </tr>
  </tbody>
</table>
<p>174 rows × 4 columns</p>
</div>

### Observations

Let's now take our results and aggregate them to get a sense of how well our RAG system is performing.

```python
# Aggregate the scores across the retrievals
results = rag_evaluation_dataframe.mean(numeric_only=True)
results
```

    ncdg@2_score         0.913450
    precision@2_score    0.804598
    hit                  0.936782
    dtype: float64

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

    Sending Evaluations: 100%|██████████| 696/696 [00:01<00:00, 487.47it/s]

### Response Evaluation

The retrieval evaluations demonstrates that our RAG system is not perfect. However, it's possible that the LLM is able to generate the correct response even when the context is incorrect. Let's evaluate the responses generated by the LLM.

```python
from phoenix.session.evaluation import get_qa_with_reference

qa_with_reference_df = get_qa_with_reference(px.active_session())
qa_with_reference_df
```

<div>
<style scoped>
    .dataframe tbody tr th:only-of-type {
        vertical-align: middle;
    }

    .dataframe tbody tr th {
        vertical-align: top;
    }

    .dataframe thead th {
        text-align: right;
    }

</style>
<table border="1" class="dataframe">
  <thead>
    <tr style="text-align: right;">
      <th></th>
      <th>input</th>
      <th>output</th>
      <th>reference</th>
    </tr>
    <tr>
      <th>context.span_id</th>
      <th></th>
      <th></th>
      <th></th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>34511e7d-70a6-468d-bd2e-692a0b1c3346</th>
      <td>How does leaving YC affect the author's relati...</td>
      <td>Leaving YC does not have a direct impact on th...</td>
      <td>On one of them I realized I was ready to hand ...</td>
    </tr>
    <tr>
      <th>981155f6-a193-418a-88b5-3ba2e7a989c8</th>
      <td>Why did YC become a fund for a couple of years...</td>
      <td>YC became a fund for a couple of years startin...</td>
      <td>For example, one thing Julian had done for us ...</td>
    </tr>
    <tr>
      <th>f0c01fab-63c7-4156-9f40-c0df0975ef4d</th>
      <td>Why did the author choose the name 'Y Combinat...</td>
      <td>The author chose the name 'Y Combinator' for t...</td>
      <td>Screw the VCs who were taking so long to make ...</td>
    </tr>
    <tr>
      <th>31fae5dd-cdd9-4e43-8d56-16200abb0e78</th>
      <td>Why did the author need to recruit an initial ...</td>
      <td>The author needed to recruit an initial set of...</td>
      <td>We had no idea what businesses paid for things...</td>
    </tr>
    <tr>
      <th>beaa88f2-a1dd-4d2a-a8ab-8aa5509daf39</th>
      <td>Describe the author's route from their residen...</td>
      <td>The author's route from their residence to the...</td>
      <td>This was not as strange as it sounds, because ...</td>
    </tr>
    <tr>
      <th>...</th>
      <td>...</td>
      <td>...</td>
      <td>...</td>
    </tr>
    <tr>
      <th>f166b1df-ab5b-4382-99fd-85eccc323d27</th>
      <td>What was the author's undergraduate thesis about?</td>
      <td>The context information does not provide any i...</td>
      <td>I knew intellectually that people made art — t...</td>
    </tr>
    <tr>
      <th>3ed0b273-6e5b-4832-a639-5c1f95906e41</th>
      <td>What were the two things that inspired the aut...</td>
      <td>The two things that inspired the author to wor...</td>
      <td>Only Harvard accepted me, so that was where I ...</td>
    </tr>
    <tr>
      <th>ad1edf7b-ddaf-4c1e-8da5-0860ff66e3d2</th>
      <td>What was the author's first experience with co...</td>
      <td>The author's first experience with computers a...</td>
      <td>I remember vividly how impressed and envious I...</td>
    </tr>
    <tr>
      <th>f68a23eb-9f3c-463c-92ed-f3bf2ea05fbc</th>
      <td>What were the limitations of the 1401 computer...</td>
      <td>The author mentions that the 1401 computer had...</td>
      <td>I was puzzled by the 1401. I couldn't figure o...</td>
    </tr>
    <tr>
      <th>c88b8eaa-c665-404d-9e0d-4a3e1b94cc39</th>
      <td>What were the two main things the author worke...</td>
      <td>The author worked on writing and programming b...</td>
      <td>What I Worked On\n\nFebruary 2021\n\nBefore co...</td>
    </tr>
  </tbody>
</table>
<p>174 rows × 3 columns</p>
</div>

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

    run_evals |          | 0/348 (0.0%) | ⏳ 00:00<? | ?it/s

```python
qa_correctness_eval_df.head()
```

<div>
<style scoped>
    .dataframe tbody tr th:only-of-type {
        vertical-align: middle;
    }

    .dataframe tbody tr th {
        vertical-align: top;
    }

    .dataframe thead th {
        text-align: right;
    }

</style>
<table border="1" class="dataframe">
  <thead>
    <tr style="text-align: right;">
      <th></th>
      <th>label</th>
      <th>score</th>
      <th>explanation</th>
    </tr>
    <tr>
      <th>context.span_id</th>
      <th></th>
      <th></th>
      <th></th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>34511e7d-70a6-468d-bd2e-692a0b1c3346</th>
      <td>correct</td>
      <td>1.0</td>
      <td>The reference text discusses the process of th...</td>
    </tr>
    <tr>
      <th>981155f6-a193-418a-88b5-3ba2e7a989c8</th>
      <td>incorrect</td>
      <td>0.0</td>
      <td>The reference text does not explicitly state t...</td>
    </tr>
    <tr>
      <th>f0c01fab-63c7-4156-9f40-c0df0975ef4d</th>
      <td>correct</td>
      <td>1.0</td>
      <td>To determine if the answer is correct, we need...</td>
    </tr>
    <tr>
      <th>31fae5dd-cdd9-4e43-8d56-16200abb0e78</th>
      <td>correct</td>
      <td>1.0</td>
      <td>To determine if the answer is correct, we need...</td>
    </tr>
    <tr>
      <th>beaa88f2-a1dd-4d2a-a8ab-8aa5509daf39</th>
      <td>correct</td>
      <td>1.0</td>
      <td>To determine if the answer is correct, we need...</td>
    </tr>
  </tbody>
</table>
</div>

```python
hallucination_eval_df.head()
```

<div>
<style scoped>
    .dataframe tbody tr th:only-of-type {
        vertical-align: middle;
    }

    .dataframe tbody tr th {
        vertical-align: top;
    }

    .dataframe thead th {
        text-align: right;
    }

</style>
<table border="1" class="dataframe">
  <thead>
    <tr style="text-align: right;">
      <th></th>
      <th>label</th>
      <th>score</th>
      <th>explanation</th>
    </tr>
    <tr>
      <th>context.span_id</th>
      <th></th>
      <th></th>
      <th></th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>34511e7d-70a6-468d-bd2e-692a0b1c3346</th>
      <td>hallucinated</td>
      <td>1.0</td>
      <td>The reference text does not provide any specif...</td>
    </tr>
    <tr>
      <th>981155f6-a193-418a-88b5-3ba2e7a989c8</th>
      <td>factual</td>
      <td>0.0</td>
      <td>The reference text explicitly states that YC w...</td>
    </tr>
    <tr>
      <th>f0c01fab-63c7-4156-9f40-c0df0975ef4d</th>
      <td>factual</td>
      <td>0.0</td>
      <td>The reference text explicitly states the reaso...</td>
    </tr>
    <tr>
      <th>31fae5dd-cdd9-4e43-8d56-16200abb0e78</th>
      <td>factual</td>
      <td>0.0</td>
      <td>To determine if the answer is factual or hallu...</td>
    </tr>
    <tr>
      <th>beaa88f2-a1dd-4d2a-a8ab-8aa5509daf39</th>
      <td>factual</td>
      <td>0.0</td>
      <td>The answer provided can be directly verified b...</td>
    </tr>
  </tbody>
</table>
</div>

#### Observations

Let's now take our results and aggregate them to get a sense of how well the LLM is answering the questions given the context.

```python
qa_correctness_eval_df.mean(numeric_only=True)
```

    score    0.931034
    dtype: float64

```python
hallucination_eval_df.mean(numeric_only=True)
```

    score    0.051724
    dtype: float64

Our QA Correctness score of `0.91` and a Hallucinations score `0.05` signifies that the generated answers are correct ~91% of the time and that the responses contain hallucinations 5% of the time - there is room for improvement. This could be due to the retrieval strategy or the LLM itself. We will need to investigate further to determine the root cause.

Since we have evaluated our RAG system's QA performance and Hallucinations performance, let's send these evaluations to Phoenix for visualization.

```python
from phoenix.trace import SpanEvaluations

px.log_evaluations(
    SpanEvaluations(dataframe=qa_correctness_eval_df, eval_name="Q&A Correctness"),
    SpanEvaluations(dataframe=hallucination_eval_df, eval_name="Hallucination"),
)
```

    Sending Evaluations: 100%|██████████| 348/348 [00:00<00:00, 415.37it/s]

We now have sent all our evaluations to Phoenix. Let's go to the Phoenix application and view the results! Since we've sent all the evals to Phoenix, we can analyze the results together to make a determination on whether or not poor retrieval or irrelevant context has an effect on the LLM's ability to generate the correct response.

```python
print("phoenix URL", px.active_session().url)
```

    phoenix URL http://localhost:6006/

## Conclusion

We have explored how to build and evaluate a RAG pipeline using LlamaIndex and Phoenix, with a specific focus on evaluating the retrieval system and generated responses within the pipelines.

Phoenix offers a variety of other evaluations that can be used to assess the performance of your LLM Application. For more details, see the [LLM Evals](https://docs.arize.com/phoenix/llm-evals/llm-evals) documentation.

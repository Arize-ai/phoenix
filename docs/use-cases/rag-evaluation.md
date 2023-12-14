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

    🌍 To view the Phoenix app in your browser, visit http://127.0.0.1:6006/
    📺 To view the Phoenix app in a notebook, run `px.active_session().view()`
    📖 For more information on how to use Phoenix, check out https://docs.arize.com/phoenix

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

    'The author, growing up, worked on writing and programming. They wrote short stories and also tried writing programs on an IBM 1401 computer.'

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

    phoenix URL http://127.0.0.1:6006/

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
      <th>36dad34e-403a-4534-8fa9-c7cbf0fed2b4</th>
      <td>llm</td>
      <td>LLM</td>
      <td>NaN</td>
      <td>NaN</td>
    </tr>
    <tr>
      <th>cb7237e3-5fa4-4875-98fe-a766d107f82d</th>
      <td>synthesize</td>
      <td>CHAIN</td>
      <td>What did the author do growing up?</td>
      <td>NaN</td>
    </tr>
    <tr>
      <th>b95cc499-c2b8-4971-9895-af9d92f3fdf3</th>
      <td>retrieve</td>
      <td>RETRIEVER</td>
      <td>What did the author do growing up?</td>
      <td>[{'document.id': 'defe422b-681b-4123-84e7-3d1b...</td>
    </tr>
    <tr>
      <th>22249d72-7914-4e6a-9456-068cbf89130d</th>
      <td>query</td>
      <td>CHAIN</td>
      <td>What did the author do growing up?</td>
      <td>NaN</td>
    </tr>
    <tr>
      <th>708a8fca-4202-4a23-ba17-6316a4afdb60</th>
      <td>embedding</td>
      <td>EMBEDDING</td>
      <td>NaN</td>
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
      <th>b95cc499-c2b8-4971-9895-af9d92f3fdf3</th>
      <td>What did the author do growing up?</td>
      <td>[{'document.id': 'defe422b-681b-4123-84e7-3d1b...</td>
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
      <td>How did microcomputers change the way people i...</td>
      <td>Why did the author choose to buy a TRS-80 comp...</td>
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
      <td>What was the author's initial hesitation in ge...</td>
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

```python
# loop over the questions and generate the answers
for _, row in questions_with_document_chunk_df.iterrows():
    question = row["question"]
    response_vector = query_engine.query(question)
    print(f"Question: {question}\nAnswer: {response_vector.response}\n")
```

    Question: What were the two main things the author worked on before college?
    Answer: Before college, the author worked on writing and programming.

    Question: What were the limitations of the 1401 computer in terms of input and program capabilities?
    Answer: The 1401 computer had limitations in terms of input and program capabilities. The only form of input to programs was data stored on punched cards, and the user did not have any data stored on punched cards. The only other option was to do things that didn't rely on any input, like calculate approximations of pi. Additionally, the user mentioned not knowing enough math to do anything interesting with the computer. Therefore, the limitations of the 1401 computer were the lack of available input data and the user's limited mathematical knowledge for programming purposes.

    Question: What was the author's first experience with computers and programming?
    Answer: The author's first experience with computers and programming was in 9th grade when they had access to an IBM 1401 computer in the basement of their junior high school. They used an early version of Fortran and had to type programs on punch cards. However, they were puzzled by the 1401 and didn't know what to do with it, as they didn't have any data stored on punched cards. They couldn't remember any programs they wrote on that machine.

    Question: What were the two things that inspired the author to work on AI?
    Answer: The two things that inspired the author to work on AI were a novel by Heinlein called The Moon is a Harsh Mistress, which featured an intelligent computer called Mike, and a PBS documentary that showed Terry Winograd using SHRDLU.

    Question: What was the author's undergraduate thesis about?
    Answer: The context information does not provide any information about the author's undergraduate thesis.

    Question: What realization did the author have during their first year of grad school regarding AI?
    Answer: The author realized that the way AI was being practiced at the time, with programs translating natural language into formal representations, was not effective in actually understanding natural language. They recognized that there was an unbridgeable gap between what these programs could do and true understanding of natural language. The author concluded that the approach of using explicit data structures to represent concepts in AI was not going to work.

    Question: What motivated the author to write a book about Lisp hacking?
    Answer: The author was motivated to write a book about Lisp hacking because they wanted to learn more about it. They believed that writing a book about something would help them learn it.

    Question: What was the author's initial hesitation in getting a computer?
    Answer: The author's initial hesitation in getting a computer was that he couldn't figure out what to do with it. He didn't have any data stored on punched cards, which was the only form of input to programs at the time. Additionally, he didn't know enough math to do anything interesting with the computer.

    Question: What was the author's initial perception of people who made art?
    Answer: The author initially perceived people who made art as either living long ago or being mysterious geniuses doing strange things in profiles in Life magazine. The idea of actually being able to make art seemed almost miraculous to the author.

    Question: What was the author's initial plan for their dissertation topic?
    Answer: The author's initial plan for their dissertation topic was to write about applications of continuations.

    Question: What is the purpose of the foundation classes that the author had to take at RISD?
    Answer: The purpose of the foundation classes at RISD is to provide fundamental instruction in subjects like drawing, color, and design.

    Question: What arrangement had the students and faculty in the painting department at the Accademia arrived at?
    Answer: The students and faculty in the painting department at the Accademia had arrived at an arrangement whereby the students wouldn't require the faculty to teach anything, and in return the faculty wouldn't require the students to learn anything.

    Question: What is the difference between painting still lives and painting people?
    Answer: Painting still lives and painting people differ in terms of the subject's ability to move. Still lives, as the name suggests, are objects that cannot move, allowing the artist to closely observe and potentially copy them pixel by pixel. On the other hand, people can only sit for a limited amount of time and tend to move, making it necessary for the artist to have a generic understanding of how to paint a person and then modify it to match the specific individual being painted.

    Question: What is the purpose of low-level processes in visual perception?
    Answer: The purpose of low-level processes in visual perception is to identify and categorize objects or elements in the environment without providing detailed information about their specific characteristics or attributes.

    Question: What was the main difference between Interleaf's software and Microsoft Word?
    Answer: The main difference between Interleaf's software and Microsoft Word was that Interleaf's software had a scripting language, inspired by Emacs and based on Lisp, while Microsoft Word did not have this feature.

    Question: What did the author learn about technology companies while working at Interleaf?
    Answer: The author learned several things about technology companies while working at Interleaf. They learned that it is better for technology companies to be run by product people rather than sales people. They also learned that it leads to bugs when code is edited by too many people, and that cheap office space is not worth it if it is depressing. Additionally, the author learned that planned meetings are inferior to corridor conversations, that big bureaucratic customers can be a dangerous source of money, and that there is not much overlap between conventional office hours and the optimal time for hacking.

    Question: According to the author, why is it advantageous to be the 'entry level' option?
    Answer: Being the 'entry level' option is advantageous because if you're not, someone else will be, and they will surpass you and limit your growth potential. Additionally, being the 'entry level' option allows you to cater to a larger market and gain more customers.

    Question: What is the purpose of a signature style in painting?
    Answer: The purpose of a signature style in painting is to create a visual identity that immediately distinguishes the work as belonging to a specific artist. It serves as a unique and recognizable characteristic that sets the artist's work apart from others. This can be beneficial for artists as it can increase the value and desirability of their work, leading to higher prices and demand from buyers.

    Question: What motivated the author to drop out of RISD in 1993?
    Answer: The context information does not provide any information about the author dropping out of RISD in 1993.

    Question: What was the author's motivation for writing another book on Lisp?
    Answer: The author's motivation for writing another book on Lisp was to further his own learning and understanding of Lisp hacking. Writing a book about something is a way to learn it, and the author wanted to deepen their knowledge and expertise in Lisp.

    Question: What was the initial startup idea of the author and why did it fail?
    Answer: The initial startup idea of the author was to start an investment firm with his friend Jessica and two other partners. They wanted to implement their ideas about venture capital, such as making a larger number of smaller investments, funding younger and more technical founders, and allowing the founders to remain as CEO. However, it is not mentioned in the context whether this startup idea failed or not.

    Question: What was the initial plan for building online stores in the summer of 1995?
    Answer: The initial plan for building online stores in the summer of 1995 was to develop normal desktop software, specifically Windows software. However, the individuals involved in the project were not familiar with writing Windows software and preferred to work in the Unix world. As a result, they decided to create a prototype store builder on Unix instead.

    Question: What is a web app and why was it considered groundbreaking at the time?
    Answer: A web app is a type of software that can be accessed and used through a web browser, without the need for any additional client software or command line input. It was considered groundbreaking at the time because it was not clear that it was even possible to build a whole store or application through a browser without the need for traditional software installation or server-side command line input. This new approach eliminated the need for versions, ports, and other complexities associated with traditional software development and deployment. It opened up the possibility of updating software directly on the server, making it easier to maintain and update. This concept of building and accessing applications through a browser was seen as a major innovation and a glimpse into the future of software development.

    Question: What was the significance of the deal mentioned in the context information for Y Combinator?
    Answer: The deal mentioned in the context information for Y Combinator was significant because it provided funding for startups in return for a percentage of equity. This deal allowed Y Combinator to scale startup funding by investing in batches of startups, which was more convenient for Y Combinator and provided a supportive community for the founders. Additionally, the deal created a network effect among the startups, as they became each other's customers and supported one another.

    Question: Who did Robert recommend as a programmer to recruit?
    Answer: Robert recommended Trevor Blackwell as a programmer to recruit.

    Question: What were the three main parts of the software mentioned in the context?
    Answer: The three main parts of the software mentioned in the context were the editor, the shopping cart, and the manager.

    Question: What is the significance of 'doing things that don't scale' in the context of the startup?
    Answer: The significance of 'doing things that don't scale' in the context of the startup is that it helped the startup to acquire users and grow, even though these actions were not sustainable in the long term. By building stores for users and taking desperate measures to attract users, the startup was able to understand the retail industry, improve their software, and gain valuable insights into user needs and preferences. This hands-on approach to acquiring users and solving immediate problems was crucial for the startup's growth, even though it may not have been a scalable strategy in the long run.

    Question: What is the ultimate test of a startup's success according to the author?
    Answer: The ultimate test of a startup's success, according to the author, is its growth rate.

    Question: Why did the author feel relieved when Yahoo bought their company?
    Answer: The author felt relieved when Yahoo bought their company because it provided a sense of financial security. The author mentions that their Viaweb stock was valuable in principle, but they were not sure how to value a business. Additionally, the author was constantly aware of the near-death experiences the company faced. Therefore, when Yahoo bought the company, it felt like going from a state of financial uncertainty to a state of wealth and stability.

    Question: Why did the author leave Yahoo after their options vested?
    Answer: The author left Yahoo after their options vested because they had initially joined the company with the goal of getting rich so they could pursue their passion for painting. Now that they had become rich, they decided it was time to leave and focus on their artistic pursuits.

    Question: Why did the author advise founders who sell their companies to take a vacation?
    Answer: The author advises founders who sell their companies to take a vacation because the author regrets not taking a break after leaving Yahoo to pursue painting. The author believes that taking a vacation would have been beneficial to recharge and relax before starting a new venture.

    Question: What new ability did the narrator gain that made their daily life easier?
    Answer: The narrator gained the ability to easily hail a taxi when they were tired of walking, which made their daily life easier.

    Question: What services could be run on the servers that these applications could use?
    Answer: The services that could be run on the servers that these applications could use include making and receiving phone calls, manipulating images, and taking credit card payments.

    Question: What was the original name for the kind of company Viaweb was?
    Answer: The original name for the kind of company Viaweb was an "application service provider" or ASP.

    Question: What was the new dialect of Lisp that the author and Dan worked on?
    Answer: The new dialect of Lisp that the author and Dan worked on was called Arc.

    Question: What was the channel for publishing essays like in the print era?
    Answer: In the print era, the channel for publishing essays was vanishingly small. Only a few officially anointed thinkers who went to the right parties in New York and specialists writing about their specialties were allowed to publish essays. This limited access meant that many essays that could have been written were not published due to the lack of a way to publish them.

    Question: What is the significance of Lisp in the author's writing and how does it compare to Latin?
    Answer: The author finds Lisp significant because of its origins as a model of computation and its power and elegance as a programming language. The author was attracted to Lisp in college, although they didn't fully understand why at the time. Lisp's core is a language defined by writing an interpreter in itself, which sets it apart from other programming languages. In comparison, Latin is not mentioned in the given context, so there is no information to suggest a comparison between Lisp and Latin.

    Question: Who came up with the idea of hosting a big party at the narrator's house?
    Answer: Maria Daniels came up with the idea of hosting a big party at the narrator's house.

    Question: What was the author's trick for writing essays?
    Answer: The author's trick for writing essays was to publish them online.

    Question: What were the reasons for the individuals in the context to start their own investment firm?
    Answer: The individuals in the context decided to start their own investment firm because they were frustrated with the slow decision-making process of venture capitalists (VCs). They wanted to implement their own ideas and have more control over the investments they made. Additionally, they believed that existing VC firms and angel investors were not providing enough support to founders in the early stages of their startups, and they wanted to fill that gap by offering comprehensive assistance to startups.

    Question: What was one thing Julian did for the author that seemed like magic?
    Answer: One thing Julian did for the author that seemed like magic was to get them set up as a company, including the process of incorporation with bylaws and stock.

    Question: What was the purpose of organizing a summer program for undergrads to start startups?
    Answer: The purpose of organizing a summer program for undergrads to start startups was to provide them with a more interesting summer experience than working at companies like Microsoft. Additionally, it allowed the organizers to practice being investors and gain experience in the startup ecosystem.

    Question: Who were some of the notable individuals in the first batch of the Summer Founders Program?
    Answer: Some of the notable individuals in the first batch of the Summer Founders Program were reddit, Justin Kan and Emmett Shear (who went on to found Twitch), Aaron Swartz (who had already helped write the RSS spec and would later become a martyr for open access), and Sam Altman (who would later become the second president of YC).

    Question: What are some advantages of scale that YC noticed as it grew?
    Answer: YC noticed several advantages of scale as it grew. One advantage was that the alumni became a tight community, dedicated to helping one another, especially the current batch. Another advantage was that the startups in the program started to become each other's customers. YC also noticed that many startups were getting their initial set of customers almost entirely from among their batchmates.

    Question: Why did the author change the name of the platform to Hacker News?
    Answer: The author changed the name of the platform to Hacker News because they wanted to reach future startup founders, not just current startup founders. They believed that the name "Hacker News" would be more appealing and engaging to those with intellectual curiosity, which was their target audience.

    Question: What made YC different from other kinds of work the author had done?
    Answer: The problems came to the author instead of them deciding what to work on. Every 6 months, there was a new batch of startups with their own problems, which became the author's problems. This made the work engaging and allowed the author to learn a lot about startups in a short amount of time.

    Question: Why did Rtm offer unsolicited advice to the author?
    Answer: Rtm offered unsolicited advice to the author because he wanted to make sure that Y Combinator wasn't the last cool thing the author did.

    Question: Why did the founders of YC decide to recruit Sam Altman as the new president?
    Answer: The founders of YC decided to recruit Sam Altman as the new president because they wanted YC to last for a long time and believed that it couldn't be controlled by the founders. They wanted to make a complete changing of the guard and allow Sam Altman to reorganize YC. Initially, Sam Altman said no to the offer as he wanted to start a startup to make nuclear reactors, but after persistent persuasion, he finally agreed in October 2013.

    Question: What did the author decide to do after stopping work on YC?
    Answer: After stopping work on YC, the author decided to start painting. They wanted to see how good they could get at painting if they really focused on it. They spent most of the rest of 2014 painting, and although they got better, they felt they were not good enough. However, in November, they ran out of steam and stopped working on their painting. They then started writing essays again and eventually started working on Lisp.

    Question: What is the distinctive feature of Lisp that sets it apart from other programming languages?
    Answer: Lisp is distinctive because its core is a language defined by writing an interpreter in itself. It was originally intended as a formal model of computation, rather than a programming language in the ordinary sense. This feature gives Lisp a power and elegance that other languages cannot match.

    Question: What was the reason why McCarthy's original axiomatic approach couldn't be used to define the added features?
    Answer: The reason why McCarthy's original axiomatic approach couldn't be used to define the added features is because it wouldn't have been feasible at the time. McCarthy tested his interpreter by hand-simulating the execution of programs, but as the interpreter became more complex, it reached the limit of what could be tested in that way. To test a more complicated interpreter, it would have been necessary to run it on computers, which were not powerful enough at the time.

    Question: What challenges did the author face while working on Bel?
    Answer: The author faced challenges while working on Bel, particularly in keeping track of what was happening at different levels and deciphering errors that could become difficult to understand. Additionally, the problem itself was described as convoluted, making it challenging to work on an interpreter written in itself.

    Question: What was the reason for the author's move to England in the summer of 2016?
    Answer: The reason for the author's move to England in the summer of 2016 was to give their children the experience of living in another country.

    Question: What was the author's experience with computers like, and how did it shape their perception of microcomputers?
    Answer: The author's experience with computers was initially limited due to the high cost and limited accessibility of computers in those days. They had to convince their father to buy a TRS-80, which was not as advanced as the Apple II but still allowed them to start programming. They wrote simple games, a program to predict rocket flights, and even a word processor. However, their experience with computers was restricted by the limited memory capacity of the TRS-80. Despite this, the author found the experience of programming on a microcomputer to be transformative. They were impressed and envious when they saw their friend typing programs right into the computer, and they were excited about the possibilities that microcomputers offered, such as immediate response to keystrokes. This positive experience shaped the author's perception of microcomputers and their potential for personal use and programming.

    Question: What was the impact of the exponential growth in the power of commodity processors on high-end, special-purpose hardware and software companies in the 1990s?
    Answer: The exponential growth in the power of commodity processors in the 1990s had a significant impact on high-end, special-purpose hardware and software companies. It rolled up these companies like a bulldozer, implying that they were greatly affected and potentially overshadowed by the increasing power and capabilities of commodity processors, such as those produced by Intel.

    Question: Why did the author receive negative comments when claiming that Lisp was better than other languages?
    Answer: The author received negative comments when claiming that Lisp was better than other languages because some people dislike being told things they don't already know.

    Question: What was the reason behind renaming Cambridge Seed to Y Combinator?
    Answer: The reason behind renaming Cambridge Seed to Y Combinator was to avoid having a regional name in case someone copied them in Silicon Valley.

Now that we have executed the queries, we can start validating whether or not the RAG system was able to retrieve the correct context.

```python
from phoenix.session.evaluation import get_retrieved_documents

retrieved_documents = get_retrieved_documents(px.active_session())
retrieved_documents
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
      <th>input</th>
      <th>reference</th>
      <th>document_score</th>
      <th>context.trace_id</th>
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
      <th rowspan="2" valign="top">768c6284-b297-4105-a0e2-1b3227a64008</th>
      <th>0</th>
      <td>How does leaving YC affect the author's relati...</td>
      <td>On one of them I realized I was ready to hand ...</td>
      <td>0.820411</td>
      <td>8b3d05c8-b788-46ea-b800-8a85094d685d</td>
    </tr>
    <tr>
      <th>1</th>
      <td>How does leaving YC affect the author's relati...</td>
      <td>That was what it took for Rtm to offer unsolic...</td>
      <td>0.815969</td>
      <td>8b3d05c8-b788-46ea-b800-8a85094d685d</td>
    </tr>
    <tr>
      <th rowspan="2" valign="top">0feb3ff4-be23-4e6b-b867-f5e7278292f3</th>
      <th>0</th>
      <td>Why did YC become a fund for a couple of years...</td>
      <td>For example, one thing Julian had done for us ...</td>
      <td>0.860933</td>
      <td>16a74332-d846-4102-a55f-4b6306079e97</td>
    </tr>
    <tr>
      <th>1</th>
      <td>Why did YC become a fund for a couple of years...</td>
      <td>They were an impressive group. That first batc...</td>
      <td>0.849662</td>
      <td>16a74332-d846-4102-a55f-4b6306079e97</td>
    </tr>
    <tr>
      <th>a5dad91c-2964-48cc-aa4f-6faee639a9a3</th>
      <th>0</th>
      <td>Why did the author choose the name 'Y Combinat...</td>
      <td>Screw the VCs who were taking so long to make ...</td>
      <td>0.868981</td>
      <td>02d3d9e8-ea78-40dc-aec3-89f0f24d8518</td>
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
      <th>16a2a884-9dfe-499f-a990-cc58866e3394</th>
      <th>1</th>
      <td>What was the author's first experience with co...</td>
      <td>What I Worked On\n\nFebruary 2021\n\nBefore co...</td>
      <td>0.877719</td>
      <td>c39ee984-fe76-4120-8d8a-193a689e8132</td>
    </tr>
    <tr>
      <th rowspan="2" valign="top">52edbfe3-2731-490d-a654-0288a71a6efd</th>
      <th>0</th>
      <td>What were the limitations of the 1401 computer...</td>
      <td>I was puzzled by the 1401. I couldn't figure o...</td>
      <td>0.847688</td>
      <td>5f6806c5-ecf0-412a-b410-a962c6e4737e</td>
    </tr>
    <tr>
      <th>1</th>
      <td>What were the limitations of the 1401 computer...</td>
      <td>I remember vividly how impressed and envious I...</td>
      <td>0.836979</td>
      <td>5f6806c5-ecf0-412a-b410-a962c6e4737e</td>
    </tr>
    <tr>
      <th rowspan="2" valign="top">afae8162-4e87-40e9-8d21-ef6d08796663</th>
      <th>0</th>
      <td>What were the two main things the author worke...</td>
      <td>What I Worked On\n\nFebruary 2021\n\nBefore co...</td>
      <td>0.843280</td>
      <td>c14ad2de-8d07-4016-ba99-bcf595270a13</td>
    </tr>
    <tr>
      <th>1</th>
      <td>What were the two main things the author worke...</td>
      <td>Then one day in April 1990 a crack appeared in...</td>
      <td>0.822055</td>
      <td>c14ad2de-8d07-4016-ba99-bcf595270a13</td>
    </tr>
  </tbody>
</table>
<p>348 rows × 4 columns</p>
</div>

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
      <th>explanation</th>
      <th>score</th>
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
      <th rowspan="2" valign="top">768c6284-b297-4105-a0e2-1b3227a64008</th>
      <th>0</th>
      <td>irrelevant</td>
      <td>The question asks about the impact on the auth...</td>
      <td>0</td>
    </tr>
    <tr>
      <th>1</th>
      <td>relevant</td>
      <td>The question asks about the author's relations...</td>
      <td>1</td>
    </tr>
    <tr>
      <th rowspan="2" valign="top">0feb3ff4-be23-4e6b-b867-f5e7278292f3</th>
      <th>0</th>
      <td>irrelevant</td>
      <td>The reference text provides information about ...</td>
      <td>0</td>
    </tr>
    <tr>
      <th>1</th>
      <td>irrelevant</td>
      <td>The question asks for the specific reason why ...</td>
      <td>0</td>
    </tr>
    <tr>
      <th>a5dad91c-2964-48cc-aa4f-6faee639a9a3</th>
      <th>0</th>
      <td>irrelevant</td>
      <td>The reference text provides a detailed account...</td>
      <td>0</td>
    </tr>
  </tbody>
</table>
</div>

We can now combine the documents with the relevance evaluations to compute retrieval metrics. These metrics will help us understand how well the RAG system is performing.

```python
documents_with_relevance = pd.concat(
    [retrieved_documents, retrieved_documents_relevance.add_prefix("eval_")], axis=1
)
documents_with_relevance
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
      <th>input</th>
      <th>reference</th>
      <th>document_score</th>
      <th>context.trace_id</th>
      <th>eval_label</th>
      <th>eval_explanation</th>
      <th>eval_score</th>
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
      <th rowspan="2" valign="top">768c6284-b297-4105-a0e2-1b3227a64008</th>
      <th>0</th>
      <td>How does leaving YC affect the author's relati...</td>
      <td>On one of them I realized I was ready to hand ...</td>
      <td>0.820411</td>
      <td>8b3d05c8-b788-46ea-b800-8a85094d685d</td>
      <td>irrelevant</td>
      <td>The question asks about the impact on the auth...</td>
      <td>0</td>
    </tr>
    <tr>
      <th>1</th>
      <td>How does leaving YC affect the author's relati...</td>
      <td>That was what it took for Rtm to offer unsolic...</td>
      <td>0.815969</td>
      <td>8b3d05c8-b788-46ea-b800-8a85094d685d</td>
      <td>relevant</td>
      <td>The question asks about the author's relations...</td>
      <td>1</td>
    </tr>
    <tr>
      <th rowspan="2" valign="top">0feb3ff4-be23-4e6b-b867-f5e7278292f3</th>
      <th>0</th>
      <td>Why did YC become a fund for a couple of years...</td>
      <td>For example, one thing Julian had done for us ...</td>
      <td>0.860933</td>
      <td>16a74332-d846-4102-a55f-4b6306079e97</td>
      <td>irrelevant</td>
      <td>The reference text provides information about ...</td>
      <td>0</td>
    </tr>
    <tr>
      <th>1</th>
      <td>Why did YC become a fund for a couple of years...</td>
      <td>They were an impressive group. That first batc...</td>
      <td>0.849662</td>
      <td>16a74332-d846-4102-a55f-4b6306079e97</td>
      <td>irrelevant</td>
      <td>The question asks for the specific reason why ...</td>
      <td>0</td>
    </tr>
    <tr>
      <th>a5dad91c-2964-48cc-aa4f-6faee639a9a3</th>
      <th>0</th>
      <td>Why did the author choose the name 'Y Combinat...</td>
      <td>Screw the VCs who were taking so long to make ...</td>
      <td>0.868981</td>
      <td>02d3d9e8-ea78-40dc-aec3-89f0f24d8518</td>
      <td>irrelevant</td>
      <td>The reference text provides a detailed account...</td>
      <td>0</td>
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
      <th>16a2a884-9dfe-499f-a990-cc58866e3394</th>
      <th>1</th>
      <td>What was the author's first experience with co...</td>
      <td>What I Worked On\n\nFebruary 2021\n\nBefore co...</td>
      <td>0.877719</td>
      <td>c39ee984-fe76-4120-8d8a-193a689e8132</td>
      <td>relevant</td>
      <td>The question asks for the author's first exper...</td>
      <td>1</td>
    </tr>
    <tr>
      <th rowspan="2" valign="top">52edbfe3-2731-490d-a654-0288a71a6efd</th>
      <th>0</th>
      <td>What were the limitations of the 1401 computer...</td>
      <td>I was puzzled by the 1401. I couldn't figure o...</td>
      <td>0.847688</td>
      <td>5f6806c5-ecf0-412a-b410-a962c6e4737e</td>
      <td>relevant</td>
      <td>The reference text directly addresses the limi...</td>
      <td>1</td>
    </tr>
    <tr>
      <th>1</th>
      <td>What were the limitations of the 1401 computer...</td>
      <td>I remember vividly how impressed and envious I...</td>
      <td>0.836979</td>
      <td>5f6806c5-ecf0-412a-b410-a962c6e4737e</td>
      <td>irrelevant</td>
      <td>The question asks about the limitations of the...</td>
      <td>0</td>
    </tr>
    <tr>
      <th rowspan="2" valign="top">afae8162-4e87-40e9-8d21-ef6d08796663</th>
      <th>0</th>
      <td>What were the two main things the author worke...</td>
      <td>What I Worked On\n\nFebruary 2021\n\nBefore co...</td>
      <td>0.843280</td>
      <td>c14ad2de-8d07-4016-ba99-bcf595270a13</td>
      <td>relevant</td>
      <td>The question asks for the two main activities ...</td>
      <td>1</td>
    </tr>
    <tr>
      <th>1</th>
      <td>What were the two main things the author worke...</td>
      <td>Then one day in April 1990 a crack appeared in...</td>
      <td>0.822055</td>
      <td>c14ad2de-8d07-4016-ba99-bcf595270a13</td>
      <td>relevant</td>
      <td>The question asks for the two main things the ...</td>
      <td>1</td>
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
    {"score": documents_with_relevance.groupby("context.span_id").apply(_compute_ndcg, k=2)}
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
      <th>011eefbd-6d5e-49ce-83bd-b2af98fe5ec1</th>
      <td>1.00000</td>
    </tr>
    <tr>
      <th>02d0a2df-7679-4d43-b717-e441db2f7141</th>
      <td>1.00000</td>
    </tr>
    <tr>
      <th>02d3995e-d054-49e4-982f-573815abdeb3</th>
      <td>1.00000</td>
    </tr>
    <tr>
      <th>0833f975-cada-4cde-8a63-8a285e6ab9b1</th>
      <td>0.00000</td>
    </tr>
    <tr>
      <th>0a6007d8-74fa-4485-8a86-f5e0abd867f4</th>
      <td>0.00000</td>
    </tr>
    <tr>
      <th>...</th>
      <td>...</td>
    </tr>
    <tr>
      <th>faa6ba02-c87c-4a83-bcc2-993f33d87b33</th>
      <td>0.63093</td>
    </tr>
    <tr>
      <th>fbc8031a-3a18-441f-9b2b-89615a70f079</th>
      <td>1.00000</td>
    </tr>
    <tr>
      <th>fd4d5852-e610-404a-b873-55a743efc972</th>
      <td>1.00000</td>
    </tr>
    <tr>
      <th>fed8bf72-72ee-4d7f-9a6b-47fb082aa766</th>
      <td>1.00000</td>
    </tr>
    <tr>
      <th>ff6c6aaa-d5b7-4eb2-bbc6-9775d41016ea</th>
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
        "score": documents_with_relevance.groupby("context.span_id").apply(
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
      <th>011eefbd-6d5e-49ce-83bd-b2af98fe5ec1</th>
      <td>1.0</td>
    </tr>
    <tr>
      <th>02d0a2df-7679-4d43-b717-e441db2f7141</th>
      <td>1.0</td>
    </tr>
    <tr>
      <th>02d3995e-d054-49e4-982f-573815abdeb3</th>
      <td>1.0</td>
    </tr>
    <tr>
      <th>0833f975-cada-4cde-8a63-8a285e6ab9b1</th>
      <td>0.0</td>
    </tr>
    <tr>
      <th>0a6007d8-74fa-4485-8a86-f5e0abd867f4</th>
      <td>0.0</td>
    </tr>
    <tr>
      <th>...</th>
      <td>...</td>
    </tr>
    <tr>
      <th>faa6ba02-c87c-4a83-bcc2-993f33d87b33</th>
      <td>0.5</td>
    </tr>
    <tr>
      <th>fbc8031a-3a18-441f-9b2b-89615a70f079</th>
      <td>1.0</td>
    </tr>
    <tr>
      <th>fd4d5852-e610-404a-b873-55a743efc972</th>
      <td>0.5</td>
    </tr>
    <tr>
      <th>fed8bf72-72ee-4d7f-9a6b-47fb082aa766</th>
      <td>1.0</td>
    </tr>
    <tr>
      <th>ff6c6aaa-d5b7-4eb2-bbc6-9775d41016ea</th>
      <td>0.5</td>
    </tr>
  </tbody>
</table>
<p>174 rows × 1 columns</p>
</div>

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
      <th>768c6284-b297-4105-a0e2-1b3227a64008</th>
      <td>How does leaving YC affect the author's relati...</td>
      <td>0.63093</td>
      <td>0.5</td>
    </tr>
    <tr>
      <th>0feb3ff4-be23-4e6b-b867-f5e7278292f3</th>
      <td>Why did YC become a fund for a couple of years...</td>
      <td>0.00000</td>
      <td>0.0</td>
    </tr>
    <tr>
      <th>a5dad91c-2964-48cc-aa4f-6faee639a9a3</th>
      <td>Why did the author choose the name 'Y Combinat...</td>
      <td>0.63093</td>
      <td>0.5</td>
    </tr>
    <tr>
      <th>6bcfb3c6-6955-4798-b00f-e1a5cde9522d</th>
      <td>Why did the software for an online store build...</td>
      <td>0.00000</td>
      <td>0.0</td>
    </tr>
    <tr>
      <th>faa6ba02-c87c-4a83-bcc2-993f33d87b33</th>
      <td>Describe the author's route from their residen...</td>
      <td>0.63093</td>
      <td>0.5</td>
    </tr>
    <tr>
      <th>...</th>
      <td>...</td>
      <td>...</td>
      <td>...</td>
    </tr>
    <tr>
      <th>e1f8f2ac-86a6-4b61-99e5-7d9117e10384</th>
      <td>What was the author's undergraduate thesis about?</td>
      <td>0.00000</td>
      <td>0.0</td>
    </tr>
    <tr>
      <th>bf141035-d68f-499d-9d8c-df1482a751ef</th>
      <td>What were the two things that inspired the aut...</td>
      <td>0.63093</td>
      <td>0.5</td>
    </tr>
    <tr>
      <th>16a2a884-9dfe-499f-a990-cc58866e3394</th>
      <td>What was the author's first experience with co...</td>
      <td>1.00000</td>
      <td>1.0</td>
    </tr>
    <tr>
      <th>52edbfe3-2731-490d-a654-0288a71a6efd</th>
      <td>What were the limitations of the 1401 computer...</td>
      <td>1.00000</td>
      <td>0.5</td>
    </tr>
    <tr>
      <th>afae8162-4e87-40e9-8d21-ef6d08796663</th>
      <td>What were the two main things the author worke...</td>
      <td>1.00000</td>
      <td>1.0</td>
    </tr>
  </tbody>
</table>
<p>174 rows × 3 columns</p>
</div>

### Observations

Let's now take our results and aggregate them to get a sense of how well our RAG system is performing.

```python
# Aggregate the scores across the retrievals
results = rag_evaluation_dataframe.mean(numeric_only=True)
results
```

    ncdg@2_score         0.896208
    precision@2_score    0.793103
    dtype: float64

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
      <th>50615bfc-eaff-47b1-b64c-98af5aea14c1</th>
      <td>How does leaving YC affect the author's relati...</td>
      <td>Leaving YC does not have a direct impact on th...</td>
      <td>On one of them I realized I was ready to hand ...</td>
    </tr>
    <tr>
      <th>5699c9b6-72cb-49af-9dac-c6199fbd571e</th>
      <td>Why did YC become a fund for a couple of years...</td>
      <td>YC became a fund for a couple of years startin...</td>
      <td>For example, one thing Julian had done for us ...</td>
    </tr>
    <tr>
      <th>682379b8-5405-42f8-a98e-d3aa238570c5</th>
      <td>Why did the author choose the name 'Y Combinat...</td>
      <td>The author chose the name 'Y Combinator' for t...</td>
      <td>Screw the VCs who were taking so long to make ...</td>
    </tr>
    <tr>
      <th>54b7dc21-aa5f-4319-8121-9c2b841b4214</th>
      <td>Why did the software for an online store build...</td>
      <td>The software for the online store builder need...</td>
      <td>[8]\n\nThere were three main parts to the soft...</td>
    </tr>
    <tr>
      <th>57580be5-e1b5-4093-84b8-24a4056a36a7</th>
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
      <th>6a778fa8-9f95-4149-81e1-0fab5cff19e0</th>
      <td>What was the author's undergraduate thesis about?</td>
      <td>The context information does not provide any i...</td>
      <td>I knew intellectually that people made art — t...</td>
    </tr>
    <tr>
      <th>32991f14-884e-4c99-84ee-bad704de2c25</th>
      <td>What were the two things that inspired the aut...</td>
      <td>The two things that inspired the author to wor...</td>
      <td>Only Harvard accepted me, so that was where I ...</td>
    </tr>
    <tr>
      <th>e1f2c9ef-8a45-4515-92bf-a11d58321c0a</th>
      <td>What was the author's first experience with co...</td>
      <td>The author's first experience with computers a...</td>
      <td>I remember vividly how impressed and envious I...</td>
    </tr>
    <tr>
      <th>6c33ada6-bcdd-4294-aa26-392771ce0bca</th>
      <td>What were the limitations of the 1401 computer...</td>
      <td>The author mentions that the only form of inpu...</td>
      <td>I was puzzled by the 1401. I couldn't figure o...</td>
    </tr>
    <tr>
      <th>6deb5e71-b550-456b-b9ff-51a062f890c6</th>
      <td>What were the two main things the author worke...</td>
      <td>Before college, the author worked on writing a...</td>
      <td>What I Worked On\n\nFebruary 2021\n\nBefore co...</td>
    </tr>
  </tbody>
</table>
<p>174 rows × 3 columns</p>
</div>

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
      <th>explanation</th>
      <th>score</th>
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
      <th>50615bfc-eaff-47b1-b64c-98af5aea14c1</th>
      <td>correct</td>
      <td>To determine if the answer is correct or incor...</td>
      <td>1</td>
    </tr>
    <tr>
      <th>5699c9b6-72cb-49af-9dac-c6199fbd571e</th>
      <td>correct</td>
      <td>The reference text explains that YC was not or...</td>
      <td>1</td>
    </tr>
    <tr>
      <th>682379b8-5405-42f8-a98e-d3aa238570c5</th>
      <td>correct</td>
      <td>To determine if the answer is correct, we need...</td>
      <td>1</td>
    </tr>
    <tr>
      <th>54b7dc21-aa5f-4319-8121-9c2b841b4214</th>
      <td>incorrect</td>
      <td>To determine if the answer is correct, we must...</td>
      <td>0</td>
    </tr>
    <tr>
      <th>57580be5-e1b5-4093-84b8-24a4056a36a7</th>
      <td>correct</td>
      <td>To determine if the answer is correct, we need...</td>
      <td>1</td>
    </tr>
  </tbody>
</table>
</div>

#### Observations

Let's now take our results and aggregate them to get a sense of how well the LLM is answering the questions given the context.

```python
qa_correctness_eval.mean(numeric_only=True)
```

    score    0.91954
    dtype: float64

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

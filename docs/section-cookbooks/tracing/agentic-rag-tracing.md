---
description: >-
  This tutorial demonstrates building an agentic RAG system using LlamaIndex's
  ReAct agent framework combined with vector and SQL query tools.
---

# Agentic RAG Tracing

{% embed url="https://colab.research.google.com/github/arize-ai/phoenix/blob/main/tutorials/tracing/agentic_rag_tracing.ipynb" %}

Agentic RAG (Retrieval Augmented Generation) combines the power of traditional RAG systems with autonomous agents that can make decisions and take actions. While traditional RAG simply retrieves relevant context and generates responses, agentic RAG adds a layer of agency - the ability to break down complex queries into sub-tasks, choose appropriate tools and actions, reason about information from multiple sources, and make decisions about what information is relevant.

In this tutorial, you will:

* Build an agentic RAG app using LlamaIndex's ReAct agent framework
* Instrument and trace the agentic RAG app with Phoenix
* Inspect the trace data in Phoenix to understand the agent's decision-making process

## Notebook Walkthrough

&#x20;We will go through key code snippets on this page. To follow the full tutorial, check out the notebook above.&#x20;

## Build Query Engine Tools using Chroma

Create the two databases that your agent will use to answer questions using Chroma, a vector database that will store the company policies and employees.

### Company Policies Database

```python
openai_ef = embedding_functions.OpenAIEmbeddingFunction(
    api_key=os.environ["OPENAI_API_KEY"], model_name="text-embedding-3-small"
)

chroma_client = chromadb.Client()
chroma_collection = chroma_client.get_or_create_collection(
    "agentic-rag-demo-company-policies", embedding_function=openai_ef
)

chroma_collection.add(
    ids=["1", "2", "3"],
    documents=[
        "The travel policy is: Employees must book travel through the company portal. Economy class flights and standard hotel rooms are covered. Meals during travel are reimbursed up to $75/day. All expenses require receipts.",
        "The pto policy is: Full-time employees receive 20 days of paid time off per year, accrued monthly. PTO requests must be submitted at least 2 weeks in advance through the HR portal. Unused PTO can carry over up to 5 days into the next year.",
        "The dress code is: Business casual attire is required in the office. This includes collared shirts, slacks or knee-length skirts, and closed-toe shoes. Jeans are permitted on Fridays. No athletic wear or overly casual clothing.",
    ],
)

vector_store = ChromaVectorStore(chroma_collection=chroma_collection)

chroma_index = VectorStoreIndex.from_vector_store(vector_store=vector_store)
chroma_engine_policy = chroma_index.as_query_engine(similarity_top_k=1)
```

### Employees Database

```python
chroma_client = chromadb.Client()
chroma_collection = chroma_client.get_or_create_collection(
    "agentic-rag-demo-company-employees", embedding_function=openai_ef
)

chroma_collection.add(
    ids=["1", "2", "3"],
    documents=[
        "John Smith is a Software Engineer in the Engineering department who started on 2023-01-15",
        "Sarah Johnson is a Marketing Manager in the Marketing department who started on 2022-08-01",
        "Michael Williams is a Sales Director in the Sales department who started on 2021-03-22",
    ],
)

vector_store = ChromaVectorStore(chroma_collection=chroma_collection)

chroma_index = VectorStoreIndex.from_vector_store(vector_store=vector_store)
chroma_engine_employees = chroma_index.as_query_engine(similarity_top_k=1)
```

### Add as Tools

LlamaIndex's ReAct agent framework allows you to add tools to the agent. Here you'll add the two tools that will be used to answer questions.

```python
query_engine_tools = [
    QueryEngineTool(
        query_engine=chroma_engine_employees,
        metadata=ToolMetadata(
            name="ChromaEmployees",
            description=(
                "Provides information about an employee's department, start date, and name from a relational database."
                "Use a detailed plain text question as input to the tool."
            ),
        ),
    ),
    QueryEngineTool(
        query_engine=chroma_engine_policy,
        metadata=ToolMetadata(
            name="ChromaPolicy",
            description=(
                "Provides information about company policies and procedures. Use this to get more detailed information about company policies."
                "Use a detailed plain text statement about a specific policy as input to the tool."
            ),
        ),
    ),
]
```

## Create ReAct Agent

LlamaIndex provides a ReAct agent framework that allows you to create an agent that can use tools to answer questions. Here you'll create an agent that can use the two tools you created earlier to answer questions.

```python
CONTEXT = """
You are a chatbot designed to answer questions about the company's employees and policies.
You have access to a Chroma database with information about the company's employees and their departmental information.
You also have access to a Chroma database with information about the company's policies. Use provided context to help answer
the question. Make sure that you have all the context required to answer the question and if you don't, check if there are
other tools that can help you answer the question. If you still can't answer the question, ask the user for more information and
apologize that you can't answer.
"""

llm = OpenAI(model="gpt-3.5-turbo")

agent = ReActAgent.from_tools(query_engine_tools, llm=llm, verbose=True, context=CONTEXT)
```

## Test Your Agent

Now you can test your agent with various queries and see how it uses the tools to gather information and provide comprehensive answers.

```python
response = agent.chat("What department is Sarah in?")
print(str(response))
```

```python
response = agent.chat("What is the pto policy for the ML Solutions team?")
print(str(response))
```

## View Traces in Phoenix

After running your agent, you can inspect the trace data in Phoenix to understand:

* How the agent broke down complex queries into sub-tasks
* Which tools were used and in what order
* The reasoning process behind the agent's decisions
* The quality and relevance of retrieved information
* Performance metrics and latency

The trace data will show you the complete flow of the agentic RAG system, from initial query processing to final response generation, giving you insights into the agent's decision-making process and opportunities for optimization.

As next steps, you can:

* Expand the agent's capabilities by adding more tools (e.g., SQL databases, external APIs)
* Implement more sophisticated reasoning patterns
* Add evaluation metrics to measure the agent's performance
* Scale the system to handle more complex queries and larger datasets
* Analyze the trace data to optimize the agent's decision-making process

"""
LangGraph RAG Agent with Manual Phoenix Instrumentation and Evaluation

This example demonstrates:
1. Building a LangGraph agent that performs RAG with web search and vector retrieval
2. Manual tracing with Phoenix using OpenInference patterns
3. Evaluating the agent's responses using Phoenix evals via trace extraction
4. Using Firestore for message history (with fallback to default messages)
5. Web crawling with GoogleSearchAPIWrapper and Firecrawl API
6. Vector search with Pinecone
"""

import asyncio
import os
from getpass import getpass
from typing import Annotated, Any, Dict, List, Tuple, TypedDict

import nest_asyncio
import pandas as pd
import requests
from langchain_core.messages import AIMessage, HumanMessage
from langchain_core.prompts import ChatPromptTemplate
from langchain_google_community import GoogleSearchAPIWrapper
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from langchain_pinecone import PineconeVectorStore

# Core LangGraph and LangChain imports
from langgraph.graph import END, START, StateGraph
from langgraph.graph.message import AnyMessage, add_messages
from opentelemetry.trace import Status, StatusCode

import phoenix as px
from phoenix.evals import (
    HallucinationEvaluator,
    OpenAIModel,
    QAEvaluator,
    RelevanceEvaluator,
    run_evals,
)

# Phoenix tracing and evaluation imports
from phoenix.otel import register
from phoenix.session.evaluation import get_qa_with_reference, get_retrieved_documents
from phoenix.trace import DocumentEvaluations

nest_asyncio.apply()

PHOENIX_PROJECT_NAME = "langgraph-rag-agent-manual"


# Environment setup
def setup_environment():
    """Setup API keys and environment variables"""

    def _set_env(key: str):
        if key not in os.environ:
            os.environ[key] = getpass(f"🔑 Enter your {key}: ")

    # Required API keys
    _set_env("OPENAI_API_KEY")
    _set_env("PINECONE_API_KEY")
    _set_env("FIRECRAWL_API_KEY")
    _set_env("GOOGLE_CSE_ID")
    _set_env("GOOGLE_API_KEY")

    # Optional Phoenix API key (for hosted Phoenix)
    if "PHOENIX_API_KEY" not in os.environ:
        use_hosted = input("Use hosted Phoenix? (y/n): ").lower().strip() == "y"
        if use_hosted:
            _set_env("PHOENIX_API_KEY")
            _set_env("PHOENIX_COLLECTOR_ENDPOINT")


# Global tracer (will be initialized in main)
tracer = None


# State definition for the agent
class AgentState(TypedDict):
    messages: Annotated[List[AnyMessage], add_messages]
    context_documents: List[Dict[str, Any]]
    search_results: List[Dict[str, Any]]
    current_query: str


# Firestore message history management
class MessageHistory:
    def __init__(self, collection_name: str = "chat_sessions"):
        self.collection_name = collection_name
        self.firestore_enabled = False

    def get_message_history(self, session_id: str = "default") -> List[Dict[str, Any]]:
        """Default conversation messages for demonstration"""
        return [
            {"role": "user", "content": "What is Avengers: Endgame about?"},
            {
                "role": "user",
                "content": ("What is the main plot of Star Wars: Episode VIII - The Last Jedi?"),
            },
            {
                "role": "user",
                "content": (
                    "What is retrieval augmented generation and how does it improve AI responses?"
                ),
            },
        ]


# Web search and crawling tools with manual instrumentation
class WebSearchCrawler:
    def __init__(self):
        self.search = GoogleSearchAPIWrapper()
        self.firecrawl_api_key = os.getenv("FIRECRAWL_API_KEY")

    def search_web(self, query: str, num_results: int = 5) -> List[Dict[str, Any]]:
        """Search the web using Google Search API with manual tracing"""
        with tracer.start_as_current_span(
            "web_search", openinference_span_kind="retriever"
        ) as span:
            span.set_input(query)

            try:
                results = self.search.results(query, num_results)

                # Set retrieval documents for Phoenix evaluation
                for i, result in enumerate(results):
                    span.set_attribute(
                        f"retrieval.documents.{i}.document.id", result.get("link", "")
                    )
                    span.set_attribute(
                        f"retrieval.documents.{i}.document.content",
                        result.get("snippet", ""),
                    )
                    span.set_attribute(
                        f"retrieval.documents.{i}.document.metadata",
                        str({"title": result.get("title", ""), "source": "web_search"}),
                    )

                span.set_output(results)
                return results

            except Exception as e:
                span.set_attribute("error.message", str(e))
                print(f"Search error: {e}")
                return []

    def crawl_url_with_firecrawl(self, url: str) -> str:
        """Crawl a URL using Firecrawl API with manual tracing"""
        with tracer.start_as_current_span(
            "firecrawl_scrape", openinference_span_kind="chain"
        ) as span:
            span.set_input(url)

            try:
                headers = {
                    "Authorization": f"Bearer {self.firecrawl_api_key}",
                    "Content-Type": "application/json",
                }

                payload = {
                    "url": url,
                    "formats": ["markdown"],
                    "onlyMainContent": True,
                    "includeTags": ["h1", "h2", "h3", "p", "article"],
                    "excludeTags": ["nav", "footer", "header", "script", "style"],
                }

                response = requests.post(
                    "https://api.firecrawl.dev/v1/scrape",
                    headers=headers,
                    json=payload,
                    timeout=30,
                )

                if response.status_code == 200:
                    result = response.json()
                    content = result.get("data", {}).get("markdown", "")
                    span.set_output(content)
                    span.set_status(Status(StatusCode.OK))
                    return content
                else:
                    error_msg = f"Firecrawl error: {response.status_code} - {response.text}"
                    print(error_msg)
                    span.set_status(Status(StatusCode.ERROR))
                    span.set_output(error_msg)
                    return ""

            except Exception as e:
                print(f"Crawling error for {url}: {e}")
                span.set_status(Status(StatusCode.ERROR))
                span.set_output(f"Crawling error for {url}: {e}")
                return ""


# Vector store setup
def setup_pinecone_vectorstore(
    index_name: str = "sample-movies",
) -> PineconeVectorStore:
    """Setup Pinecone vector store with OpenAI embeddings"""
    embedding = OpenAIEmbeddings(model="text-embedding-3-small", dimensions=1024)
    vectorstore = PineconeVectorStore(
        index_name=index_name, embedding=embedding, text_key="summary"
    )
    return vectorstore


# Manually instrumented vector search function
def search_vector_store_traced(query: str) -> str:
    """Search the vector store for relevant documents with manual tracing"""
    with tracer.start_as_current_span(
        "vector_store_search", openinference_span_kind="retriever"
    ) as span:
        span.set_input(query)

        try:
            vectorstore = setup_pinecone_vectorstore()
            docs = vectorstore.similarity_search(query, k=3)

            if docs:
                results = []
                # Set retrieval documents for Phoenix evaluation
                for i, doc in enumerate(docs):
                    span.set_attribute(f"retrieval.documents.{i}.document.id", str(i))
                    span.set_attribute(
                        f"retrieval.documents.{i}.document.content",
                        doc.page_content[:1000],
                    )
                    span.set_attribute(
                        f"retrieval.documents.{i}.document.metadata",
                        str({"source": "vector_store", **doc.metadata}),
                    )
                    results.append(f"Document {i + 1}: {doc.page_content[:1000]}")

                result_text = "\n\n".join(results)
                span.set_output(result_text)
                span.set_status(Status(StatusCode.OK))
                return result_text
            else:
                result = "No relevant documents found in vector store."
                span.set_output(result)
                span.set_status(Status(StatusCode.ERROR))
                return result

        except Exception as e:
            error_msg = f"Vector search error: {str(e)}"
            span.set_attribute("error.message", error_msg)
            span.set_status(Status(StatusCode.ERROR))
            span.set_output(error_msg)
            return error_msg


# Manually instrumented web search function
def search_and_crawl_traced(query: str) -> str:
    """Search the web and crawl relevant pages with manual tracing"""
    with tracer.start_as_current_span(
        "web_search_and_crawl", openinference_span_kind="chain"
    ) as span:
        span.set_input(query)

        crawler = WebSearchCrawler()

        # Search for relevant URLs
        search_results = crawler.search_web(query, num_results=3)

        crawled_content = []
        for result in search_results:
            url = result.get("link", "")
            title = result.get("title", "")

            if url:
                content = crawler.crawl_url_with_firecrawl(url)
                if content:
                    crawled_content.append(
                        {
                            "url": url,
                            "title": title,
                            "content": content[:2000],  # Limit content length
                        }
                    )

        # Format the results
        formatted_results = "\n\n".join(
            [
                f"Source: {item['title']}\nURL: {item['url']}\nContent: {item['content']}"
                for item in crawled_content
            ]
        )

        result = formatted_results or "No relevant content found."
        span.set_output(result)
        span.set_status(Status(StatusCode.OK))
        return result


# Manually instrumented LLM call
def call_llm(prompt: str, context: str) -> str:
    with tracer.start_as_current_span("call_llm", openinference_span_kind="llm") as span:
        span.set_input({"query": context, "prompt": prompt})
        span.set_attribute("llm.model_name", "gpt-4o")
        span.set_attribute("llm.provider", "openai")
        span.set_attribute("llm.system", prompt.format(context=context))
        span.set_attribute("llm.invocation_params", {"model": "gpt-4o", "temperature": 0.1})

        try:
            llm = ChatOpenAI(model="gpt-4o", temperature=0.1)

            # Create synthesis prompt
            synthesis_prompt = ChatPromptTemplate.from_messages(
                [("system", prompt.format(context=context)), ("user", "{query}")]
            )

            chain = synthesis_prompt | llm
            response = chain.invoke({"query": context})

            span.set_output(response.content)
            span.set_status(Status(StatusCode.OK))
            return response.content

        except Exception as e:
            span.set_output(f"LLM error: {str(e)}")
            span.set_status(Status(StatusCode.ERROR))
            return f"LLM error: {str(e)}"


# Agent nodes with manual instrumentation
def web_search_node(state: AgentState) -> Dict[str, Any]:
    with tracer.start_as_current_span("web_search_node", openinference_span_kind="chain") as span:
        span.set_input(state["current_query"])

        """Node that performs web search and crawling with tracing"""
        current_query = state["current_query"]

        # Use the traced search function
        search_results = search_and_crawl_traced(current_query)

        result = {
            "search_results": [{"source": "web", "content": search_results}],
            "messages": [AIMessage(content=f"Found web information for: {current_query}")],
        }

        span.set_output(str(result))
        span.set_status(Status(StatusCode.OK))
        return result


def vector_search_node(state: AgentState) -> Dict[str, Any]:
    """Node that searches the vector store with tracing"""
    with tracer.start_as_current_span(
        "vector_search_node", openinference_span_kind="chain"
    ) as span:
        span.set_input(state["current_query"])

        current_query = state["current_query"]

        # Use the traced vector search function
        vector_results = search_vector_store_traced(current_query)

        result = {
            "context_documents": [{"source": "vector_store", "content": vector_results}],
            "messages": [AIMessage(content=f"Found vector store information for: {current_query}")],
        }

        span.set_output(str(result))
        span.set_status(Status(StatusCode.OK))
        return result


def synthesize_response_node(state: AgentState) -> Dict[str, Any]:
    """Node that synthesizes a response with tracing"""
    with tracer.start_as_current_span(
        "synthesize_response_node", openinference_span_kind="chain"
    ) as span:
        span.set_input(state["current_query"])

        # Combine all context
        all_context = []
        for doc in state.get("context_documents", []):
            all_context.append(doc["content"])
        for result in state.get("search_results", []):
            all_context.append(result["content"])

        current_query = state["current_query"]

        # System prompt
        system_prompt = """You are a helpful AI assistant that provides accurate,
        comprehensive answers based on the provided context.

        Use the following context to answer the user's question. Be sure to:
        1. Provide a clear, well-structured response
        2. Cite sources when possible
        3. Acknowledge if information is limited
        4. Be factual and avoid speculation

        Context:
        {context}"""

        # Generate response using traced LLM call
        response_content = call_llm(system_prompt, current_query)

        response = AIMessage(content=response_content)
        result = {"messages": [response]}

        span.set_output(str(result))
        span.set_status(Status(StatusCode.OK))
        return result


def extract_query_node(state: AgentState) -> Dict[str, Any]:
    """Extract the current query from the latest user message"""
    with tracer.start_as_current_span("extract_query", openinference_span_kind="chain") as span:
        messages = state["messages"]
        latest_user_message = None

        # Find the latest user message
        for msg in reversed(messages):
            if isinstance(msg, HumanMessage):
                latest_user_message = msg.content
                break

        result = {"current_query": latest_user_message or "No query found"}

        span.set_input(str(messages))
        span.set_output(str(result))

        return result


# Build the agent graph
def create_rag_agent() -> StateGraph:
    """Create the RAG agent workflow"""

    workflow = StateGraph(AgentState)

    # Add nodes
    workflow.add_node("extract_query", extract_query_node)
    workflow.add_node("web_search", web_search_node)
    workflow.add_node("vector_search", vector_search_node)
    workflow.add_node("synthesize", synthesize_response_node)

    # Define the flow
    workflow.add_edge(START, "extract_query")
    workflow.add_edge("extract_query", "web_search")
    workflow.add_edge("extract_query", "vector_search")
    workflow.add_edge("web_search", "synthesize")
    workflow.add_edge("vector_search", "synthesize")
    workflow.add_edge("synthesize", END)

    # Compile the graph
    return workflow.compile()


# Phoenix evaluation functions
def extract_retrieval_evaluations(phoenix_client) -> Dict[str, pd.DataFrame]:
    """Extract retrieval evaluation data from Phoenix traces"""

    print("📋 Extracting retrieval documents from Phoenix traces...")

    try:
        # Extract retrieved documents from traces
        retrieved_documents_df = get_retrieved_documents(
            phoenix_client, project_name=PHOENIX_PROJECT_NAME
        )

        if retrieved_documents_df.empty:
            print("⚠️  No retrieved documents found in traces")
            return {}

        print(f"Found {len(retrieved_documents_df)} retrieved document interactions")

        # Run relevance evaluation on retrieved documents
        print("🧮 Running relevance evaluation on retrieved documents...")
        relevance_evaluator = RelevanceEvaluator(OpenAIModel(model="gpt-4o"))

        relevance_results = run_evals(
            evaluators=[relevance_evaluator],
            dataframe=retrieved_documents_df,
            provide_explanation=True,
            concurrency=5,
        )[0]

        return {
            "retrieved_documents": retrieved_documents_df,
            "retrieval_relevance": relevance_results,
        }

    except Exception as e:
        print(f"Error extracting retrieval evaluations: {e}")
        return {}


def extract_qa_evaluations(phoenix_client) -> Dict[str, pd.DataFrame]:
    """Extract Q&A evaluation data from Phoenix traces"""

    print("📋 Extracting Q&A data from Phoenix traces...")

    try:
        # Extract Q&A with reference from traces
        qa_with_reference_df = get_qa_with_reference(
            phoenix_client, project_name=PHOENIX_PROJECT_NAME
        )

        if qa_with_reference_df.empty:
            print("⚠️  No Q&A interactions found in traces")
            return {}

        print(f"Found {len(qa_with_reference_df)} Q&A interactions")

        # Run Q&A and hallucination evaluations
        print("🧮 Running Q&A correctness and hallucination evaluations...")
        qa_evaluator = QAEvaluator(OpenAIModel(model="gpt-4o"))
        hallucination_evaluator = HallucinationEvaluator(OpenAIModel(model="gpt-4o"))

        qa_results, hallucination_results = run_evals(
            evaluators=[qa_evaluator, hallucination_evaluator],
            dataframe=qa_with_reference_df,
            provide_explanation=True,
            concurrency=5,
        )

        return {
            "qa_with_reference": qa_with_reference_df,
            "qa_correctness": qa_results,
            "hallucination": hallucination_results,
        }

    except Exception as e:
        print(f"Error extracting Q&A evaluations: {e}")
        return {}


async def run_phoenix_evaluations(
    phoenix_client,
) -> Tuple[Dict[str, pd.DataFrame], Dict[str, pd.DataFrame]]:
    """Run comprehensive Phoenix evaluations using trace extraction"""

    print("\n🔍 Starting Phoenix evaluation pipeline...")

    # Extract and evaluate retrieval performance
    retrieval_results = extract_retrieval_evaluations(phoenix_client)

    # Extract and evaluate Q&A performance
    qa_results = extract_qa_evaluations(phoenix_client)

    return retrieval_results, qa_results


# Main execution
async def main():
    """Main execution function"""

    global tracer

    print("🚀 Setting up LangGraph RAG Agent with Manual Phoenix Instrumentation")
    print("=" * 70)

    # Setup environment
    setup_environment()

    # Setup Phoenix tracing (manual instrumentation)
    print("\n📊 Setting up Phoenix manual tracing...")
    phoenix_client = None

    if "PHOENIX_API_KEY" in os.environ:
        tracer_provider = register(project_name=PHOENIX_PROJECT_NAME)
        phoenix_client = px.Client()
    else:
        # Use local Phoenix
        tracer_provider = register(
            endpoint="http://127.0.0.1:6006/v1/traces",
            project_name=PHOENIX_PROJECT_NAME,
        )
        phoenix_client = px.Client(endpoint="http://127.0.0.1:6006")

    # Get tracer for manual instrumentation
    tracer = tracer_provider.get_tracer(__name__)

    # Initialize message history
    print("\n💬 Initializing message history...")
    message_history = MessageHistory()

    # Create the RAG agent
    print("\n🤖 Creating RAG agent...")
    agent = create_rag_agent()

    # Get conversation history
    messages = message_history.get_message_history()
    print(f"Loaded {len(messages)} messages from history")

    # Convert to LangChain message objects
    langchain_messages = []
    for msg in messages:
        if msg["role"] == "user":
            langchain_messages.append(HumanMessage(content=msg["content"]))
        elif msg["role"] == "assistant":
            langchain_messages.append(AIMessage(content=msg["content"]))

    # Process each query through the agent
    print(f"\n🔍 Processing {len(langchain_messages)} queries through RAG agent...")

    for i, message in enumerate(langchain_messages):
        if isinstance(message, HumanMessage):
            print(f"\nProcessing query {i + 1}: {message.content[:100]}...")

            # Run the agent with a top-level span
            with tracer.start_as_current_span(
                "rag_agent_query", openinference_span_kind="chain"
            ) as span:
                span.set_input(message.content)

                result = agent.invoke(
                    {
                        "messages": [message],
                        "context_documents": [],
                        "search_results": [],
                        "current_query": "",
                    }
                )

                # Get the final response
                final_response = (
                    result["messages"][-1].content if result["messages"] else "No response"
                )
                span.set_output(final_response)
                span.set_status(Status(StatusCode.OK))

            print(f"✅ Completed query {i + 1}")

    print("\n✅ Processed all queries through the RAG agent.")
    print("⏳ Waiting for traces to be processed by Phoenix...")

    # Wait a moment for traces to be processed
    await asyncio.sleep(5)

    # Run evaluations using Phoenix trace extraction
    print("\n🧮 Running Phoenix evaluations using trace extraction...")
    retrieval_results, qa_results = await run_phoenix_evaluations(phoenix_client)

    # Log evaluations back to Phoenix
    print("\n📤 Logging evaluation results back to Phoenix...")
    if retrieval_results and "retrieval_relevance" in retrieval_results:
        px.Client().log_evaluations(
            DocumentEvaluations(
                eval_name="Retrieval Relevance",
                dataframe=retrieval_results["retrieval_relevance"],
            )
        )
        print("✅ Logged retrieval relevance evaluations")

    if qa_results:
        from phoenix.client import Client

        px_client = Client()
        if "qa_correctness" in qa_results:
            px_client.spans.log_span_annotations_dataframe(
                dataframe=qa_results["qa_correctness"],
                annotation_name="Q&A Correctness",
                annotator_kind="LLM",
            )
            print("✅ Logged Q&A correctness evaluations")
        if "hallucination" in qa_results:
            px_client.spans.log_span_annotations_dataframe(
                dataframe=qa_results["hallucination"],
                annotation_name="Hallucination",
                annotator_kind="LLM",
            )
            print("✅ Logged hallucination evaluations")

    print("\n🎉 LangGraph RAG Agent with manual instrumentation complete!")
    print("\n📈 Check the Phoenix UI for detailed tracing information:")
    if "PHOENIX_API_KEY" in os.environ:
        print("   🌐 Hosted Phoenix: https://app.phoenix.arize.com")
    else:
        print("   🏠 Local Phoenix: http://127.0.0.1:6006")


if __name__ == "__main__":
    asyncio.run(main())

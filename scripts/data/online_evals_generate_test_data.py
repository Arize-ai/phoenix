#This file generates test data for the periodically_get_spans.py script

import os
from getpass import getpass

import pandas as pd
import phoenix as px

from phoenix.session.evaluation import get_qa_with_reference, get_retrieved_documents
from phoenix.trace import DocumentEvaluations, SpanEvaluations
from phoenix.trace.langchain import LangChainInstrumentor
from phoenix.experimental.evals import (
    HallucinationEvaluator,
    OpenAIModel,
    QAEvaluator,
    RelevanceEvaluator,
    run_evals,
)
# LangChain imports
from langchain.chains import RetrievalQA
from langchain_community.document_loaders import GitbookLoader
from langchain_community.embeddings import OpenAIEmbeddings
from langchain.callbacks import StdOutCallbackHandler
from langchain_openai import ChatOpenAI
from langchain_community.vectorstores import Qdrant
from phoenix.trace import TraceDataset

def create_session():
    session = px.launch_app()
    return session

def lookup_traces(session, selected_date):
    # Get traces into a dataframe
    spans_df = px.Client(endpoint=str(session.url)).get_spans_dataframe("span_kind == 'RETRIEVER'")

    trace_df = px.Client(endpoint=str(session.url)).get_trace_dataset()
    evals = trace_df.evaluations
    evaluation_dfs = []
    for eval in evals:
        eval_dict = eval.__dict__
        eval_df = eval_dict["dataframe"]
        # all dataframes have a tuple index where index[0] is uuid, we'll use this to look for them in spans_df
        evaluation_dfs.append(eval_df)

    if spans_df is None:
        return None
    # Convert any datetime columns to date for comparison (assuming 'timestamp' column exists and is the relevant one)
    spans_df['date'] = pd.to_datetime(spans_df['end_time']).dt.date

    # Filter for today's evaluations
    selected_date_spans_df = spans_df[spans_df['date'] == selected_date]

    return selected_date_spans_df, evaluation_dfs

def load_gitbook_docs(docs_url):
    """
    Loads documentation from a Gitbook URL.
    """

    loader = GitbookLoader(
        docs_url,
        load_all_paths=True,
    )
    return loader.load()


def build_langchain_chain(docs):
    model_name = 'text-embedding-ada-002'

    embeddings = OpenAIEmbeddings(
        model=model_name,
        openai_api_key=os.environ["OPENAI_API_KEY"]
    )
    qdrant = Qdrant.from_documents(
        docs,
        embeddings,
        location=":memory:",
        collection_name="my_documents",
    )
    handler = StdOutCallbackHandler()

    num_retrieved_documents = 2
    retriever = qdrant.as_retriever(search_type="mmr",
                                    search_kwargs={"k": num_retrieved_documents},
                                    enable_limit=True)
    chain_type = "stuff"  # stuff, refine, map_reduce, and map_rerank
    chat_model_name = "gpt-4-turbo-preview"
    llm = ChatOpenAI(model_name=chat_model_name, temperature=0.0)
    chain = RetrievalQA.from_chain_type(
        llm=llm,
        chain_type=chain_type,
        retriever=retriever,
        metadata={"application_type": "question_answering"},
        callbacks=[handler]
    )

    return chain


def run_tests(generate_queries=False):
    docs_url = "https://docs.arize.com/arize/"
    docs = load_gitbook_docs(docs_url)
    chain = build_langchain_chain(docs)
    query_df = pd.read_parquet(
        "http://storage.googleapis.com/arize-phoenix-assets/datasets/unstructured/llm/context-retrieval/langchain-pinecone/langchain_pinecone_query_dataframe_with_user_feedbackv2.parquet"
    )
    for i in range(10):
        row = query_df.iloc[i]
        response = chain.invoke(row['text'])
        print(response)

    queries_df = get_qa_with_reference(px.Client())
    retrieved_documents_df = get_retrieved_documents(px.Client())
    eval_model = OpenAIModel(
        model_name="gpt-4-turbo-preview",
    )
    hallucination_evaluator = HallucinationEvaluator(eval_model)
    qa_correctness_evaluator = QAEvaluator(eval_model)
    relevance_evaluator = RelevanceEvaluator(eval_model)

    hallucination_eval_df, qa_correctness_eval_df = run_evals(
        dataframe=queries_df,
        evaluators=[hallucination_evaluator, qa_correctness_evaluator],
        provide_explanation=True,
    )
    relevance_eval_df = run_evals(
        dataframe=retrieved_documents_df,
        evaluators=[relevance_evaluator],
        provide_explanation=True,
    )[0]

    px.Client().log_evaluations(
        SpanEvaluations(eval_name="Hallucination", dataframe=hallucination_eval_df),
        SpanEvaluations(eval_name="QA Correctness", dataframe=qa_correctness_eval_df),
        DocumentEvaluations(eval_name="Relevance", dataframe=relevance_eval_df),
    )

    if generate_queries:
        for i in range(15, 25):
            row = query_df.iloc[i]
            chain.invoke(row['text'])



if __name__ == "__main__":
    if os.environ.get("OPENAI_API_KEY") is None:
        openai_api_key = getpass("🔑 Enter your OpenAI API key: ")
        os.environ["OPENAI_API_KEY"] = openai_api_key
    LangChainInstrumentor().instrument()
    try:
        tds = TraceDataset.load("b4165a34-2020-4e9b-98ec-26c5d7e954d4")
        print("Dataset Reloaded")
        px.launch_app(trace=tds)
        session = px.active_session()
    except Exception:
        print("No Dataset Found")
        tds = None
        px.launch_app()
        session = px.active_session()
    run_tests(generate_queries=True)
    tds = px.Client().get_trace_dataset()
    tds._id = "b4165a34-2020-4e9b-98ec-26c5d7e954d4"
    tds.save()   
    print("Save this tds id for loading it in later: " + str(tds._id))

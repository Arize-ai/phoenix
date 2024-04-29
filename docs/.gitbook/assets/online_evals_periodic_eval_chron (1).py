from datetime import datetime
import os
from getpass import getpass

import pandas as pd
import phoenix as px

from phoenix.session.evaluation import get_qa_with_reference, get_retrieved_documents
from phoenix.trace import DocumentEvaluations, SpanEvaluations
from phoenix.evals import (
    HallucinationEvaluator,
    OpenAIModel,
    QAEvaluator,
    RelevanceEvaluator,
    run_evals,
)
from phoenix.trace import TraceDataset
from datetime import datetime, timedelta


# Optional but speeds up Evals by 10x
import nest_asyncio

nest_asyncio.apply()


def lookup_traces(session):
    # Get traces into a dataframe
    # spans_df = session.get_spans_dataframe("span_kind == 'RETRIEVER'")
    spans_df = session.get_spans_dataframe()  # all spans
    trace_df = session.get_trace_dataset()
    if not trace_df:
        return None, None
    evals = trace_df.evaluations
    evaluation_dfs = []
    for eval in evals:
        eval_dict = eval.__dict__
        eval_df = eval_dict["dataframe"]
        # all dataframes have a tuple index where index[0] is uuid, we'll use this to look for them in spans_df
        evaluation_dfs.append(eval_df)

    if spans_df is None:
        return None
    spans_df["date"] = pd.to_datetime(spans_df["end_time"]).dt.date

    # Get today's date
    today_date = datetime.now().date() + timedelta(days=1)
    # Calculate yesterday's date
    yesterday_date = today_date - timedelta(days=1)
    # Filter for entries from the last day (i.e., yesterday and today)
    selected_date_spans_df = spans_df[
        (spans_df["date"] == today_date) | (spans_df["date"] == yesterday_date)
    ]
    return selected_date_spans_df, evaluation_dfs


if __name__ == "__main__":
    if os.environ.get("OPENAI_API_KEY") is None:
        openai_api_key = getpass("🔑 Enter your OpenAI API key: ")
        os.environ["OPENAI_API_KEY"] = openai_api_key
    # We need to choose an arbitrary UUID to persist the dataset and reload it
    TRACE_DATA_UUID = "b4165a34-2020-4e9b-98ec-26c5d7e954d4"

    has_active_session = px.active_session() is not None
    if has_active_session:
        # Used only in a python runtime
        session = px.active_session()
    else:
        # The most common path from clean Script run, No session will be Live
        try:
            tds = TraceDataset.load(HARD_CODE_UUID)
            print("Dataset Reloaded")
            px.launch_app(trace=tds)
            session = px.active_session()
        except Exception:
            print("No Dataset Found")
            tds = None
            px.launch_app()
            session = px.active_session()

    px_client = px.Client(endpoint=str(session.url))  # Client based on URL & port of the session
    spans, evaluation_dfs = lookup_traces(session=session, selected_date=datetime.now().date())
    if spans is not None:
        with_eval = set()
        for eval_df in evaluation_dfs:
            for index in eval_df.index:
                if isinstance(index, tuple):
                    with_eval.add(index[0])
                else:
                    with_eval.add(index)
        # If a single span in a trace has an evaluation, the entire trace is considered to have an evaluation "eval processed"
        trace_with_evals_id_set = set(
            spans[spans["context.span_id"].isin(with_eval)]["context.trace_id"].unique()
        )
        all_traces_id_set = set(spans["context.trace_id"].unique())
        # Get trace IDs without evaluations
        traces_without_evals_id_set = all_traces_id_set - trace_with_evals_id_set
        spans_without_evals_df = spans[~spans["context.span_id"].isin(with_eval)]
        # Get span IDs without evaluations
        spans_without_evals_id_set = set(spans_without_evals_df["context.span_id"].unique())
        queries_df = get_qa_with_reference(px_client)
        # Grab Q&A spans without evaluations
        queries_no_evals = queries_df[queries_df.index.isin(spans_without_evals_id_set)]
        retrieved_documents_df = get_retrieved_documents(px_client)
        # Grab retireved documents without evaluations, based on trace ID
        retrieved_documents_no_evals = retrieved_documents_df[
            retrieved_documents_df["context.trace_id"].isin(traces_without_evals_id_set)
        ]
        eval_model = OpenAIModel(
            model_name="gpt-4-turbo-preview",
        )
        hallucination_evaluator = HallucinationEvaluator(eval_model)
        qa_correctness_evaluator = QAEvaluator(eval_model)
        relevance_evaluator = RelevanceEvaluator(eval_model)

        hallucination_eval_df, qa_correctness_eval_df = run_evals(
            dataframe=queries_no_evals,
            evaluators=[hallucination_evaluator, qa_correctness_evaluator],
            provide_explanation=True,
            concurrency=10,
        )
        relevance_eval_df = run_evals(
            dataframe=retrieved_documents_no_evals,
            evaluators=[relevance_evaluator],
            provide_explanation=True,
            concurrency=10,
        )[0]

        px_client.log_evaluations(
            SpanEvaluations(eval_name="Hallucination", dataframe=hallucination_eval_df),
            SpanEvaluations(eval_name="QA Correctness", dataframe=qa_correctness_eval_df),
            DocumentEvaluations(eval_name="Relevance", dataframe=relevance_eval_df),
        )

        tds = px_client.get_trace_dataset()
        tds._id = TRACE_DATA_UUID
        tds.save()

# type: ignore
"""
Queries Phoenix for spans within the last minute. Computes and logs evaluations
back to Phoenix. This script is intended to run once a minute as a cron job.
"""

from datetime import datetime, timedelta

import phoenix as px
from phoenix.client.helpers.spans import get_input_output_context, get_retrieved_documents
from phoenix.evals import ClassificationEvaluator, evaluate_dataframe
from phoenix.evals.llm import LLM
from phoenix.trace import DocumentEvaluations, SpanEvaluations

phoenix_client = px.Client()
last_eval_run_time = datetime.now() - timedelta(
    minutes=1, seconds=10
)  # add a few seconds to ensure all spans are captured
qa_df = get_input_output_context(phoenix_client, start_time=last_eval_run_time)
retriever_spans_df = get_retrieved_documents(phoenix_client, start_time=last_eval_run_time)

eval_model = LLM(provider="openai", model="gpt-4-turbo-preview")

HALLUCINATION_TEMPLATE = """You are evaluating whether an AI response is based on the provided context.
    [BEGIN DATA]
    ************
    [Question]: {input}
    ************
    [Context]: {context}
    ************
    [Response]: {output}
    [END DATA]
"hallucinated" means the response contains information not supported by the context.
"factual" means the response is fully supported by the context."""

QA_TEMPLATE = """You are given a question, an answer and reference text. You must determine whether the
given answer correctly answers the question based on the reference text.
    [BEGIN DATA]
    ************
    [Question]: {input}
    ************
    [Reference]: {context}
    ************
    [Answer]: {output}
    [END DATA]
"correct" means that the question is correctly and fully answered by the answer.
"incorrect" means that the question is not correctly or only partially answered by the answer."""

RAG_RELEVANCY_TEMPLATE = """You are comparing a reference text to a question and trying to determine if the reference text
contains information relevant to answering the question.
    [BEGIN DATA]
    ************
    [Question]: {input}
    ************
    [Reference text]: {reference}
    [END DATA]
"unrelated" means that the reference text does not contain an answer to the Question.
"relevant" means the reference text contains an answer to the Question."""

hallucination_evaluator = ClassificationEvaluator(
    name="Hallucination",
    prompt_template=HALLUCINATION_TEMPLATE,
    model=eval_model,
    choices={"hallucinated": 0, "factual": 1},
)

qa_correctness_evaluator = ClassificationEvaluator(
    name="QA Correctness",
    prompt_template=QA_TEMPLATE,
    model=eval_model,
    choices={"incorrect": 0, "correct": 1},
)

relevance_evaluator = ClassificationEvaluator(
    name="Relevance",
    prompt_template=RAG_RELEVANCY_TEMPLATE,
    model=eval_model,
    choices={"unrelated": 0, "relevant": 1},
)

if qa_df is not None:
    qa_results_df = evaluate_dataframe(
        dataframe=qa_df,
        evaluators=[hallucination_evaluator, qa_correctness_evaluator],
    )
    phoenix_client.log_evaluations(
        SpanEvaluations(eval_name="Hallucination", dataframe=qa_results_df),
        SpanEvaluations(eval_name="QA Correctness", dataframe=qa_results_df),
    )

if retriever_spans_df is not None:
    relevance_results_df = evaluate_dataframe(
        dataframe=retriever_spans_df,
        evaluators=[relevance_evaluator],
    )
    phoenix_client.log_evaluations(
        DocumentEvaluations(eval_name="Relevance", dataframe=relevance_results_df),
    )

print("Evaluations logged to Phoenix")

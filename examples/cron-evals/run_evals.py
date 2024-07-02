# type: ignore
"""
Queries Phoenix for spans within the last minute. Computes and logs evaluations
back to Phoenix. This script is intended to run once a minute as a cron job.
"""

from datetime import datetime, timedelta

import phoenix as px
from phoenix.evals import (
    HallucinationEvaluator,
    OpenAIModel,
    QAEvaluator,
    RelevanceEvaluator,
    run_evals,
)
from phoenix.session.evaluation import get_qa_with_reference, get_retrieved_documents
from phoenix.trace import DocumentEvaluations, SpanEvaluations

phoenix_client = px.Client()
last_eval_run_time = datetime.now() - timedelta(
    minutes=1, seconds=10
)  # add a few seconds to ensure all spans are captured
qa_spans_df = get_qa_with_reference(phoenix_client, start_time=last_eval_run_time)
retriever_spans_df = get_retrieved_documents(phoenix_client, start_time=last_eval_run_time)
eval_model = OpenAIModel(
    model_name="gpt-4-turbo-preview",
)
hallucination_evaluator = HallucinationEvaluator(eval_model)
qa_correctness_evaluator = QAEvaluator(eval_model)
relevance_evaluator = RelevanceEvaluator(eval_model)
[hallucination_evals_df, qa_correctness_evals_df] = run_evals(
    qa_spans_df,
    [hallucination_evaluator, qa_correctness_evaluator],
)
relevance_evals_df = run_evals(
    retriever_spans_df,
    [relevance_evaluator],
)[0]
phoenix_client.log_evaluations(
    SpanEvaluations(eval_name="Hallucination", dataframe=hallucination_evals_df),
    SpanEvaluations(eval_name="QA Correctness", dataframe=qa_correctness_evals_df),
    DocumentEvaluations(eval_name="Relevance", dataframe=relevance_evals_df),
)
print("Evaluations logged to Phoenix")

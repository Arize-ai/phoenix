# type: ignore
"""
Queries Phoenix for spans within the last minute. Computes and logs evaluations
back to Phoenix. This script is intended to run once a minute as a cron job.
"""

from datetime import datetime, timedelta

from phoenix.client import Client
from phoenix.client.helpers.spans import get_input_output_context, get_retrieved_documents
from phoenix.evals import (
    HallucinationEvaluator,
    OpenAIModel,
    QAEvaluator,
    RelevanceEvaluator,
    run_evals,
)

phoenix_client = Client()
last_eval_run_time = datetime.now() - timedelta(
    minutes=1, seconds=10
)  # add a few seconds to ensure all spans are captured
qa_spans_df = get_input_output_context(phoenix_client, start_time=last_eval_run_time)
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
phoenix_client.spans.log_span_annotations_dataframe(
    dataframe=hallucination_evals_df, annotation_name="Hallucination", annotator_kind="LLM"
)
phoenix_client.spans.log_span_annotations_dataframe(
    dataframe=qa_correctness_evals_df, annotation_name="QA Correctness", annotator_kind="LLM"
)
phoenix_client.spans.log_document_annotations_dataframe(
    dataframe=relevance_evals_df, annotation_name="Relevance", annotator_kind="LLM"
)
print("Evaluations logged to Phoenix")

# type: ignore
"""
Queries Phoenix for spans within the last minute. Computes and logs evaluations
back to Phoenix. This script is intended to run once a minute as a cron job.
"""

import json
from datetime import datetime, timedelta

import pandas as pd
from phoenix.client.helpers.spans import get_input_output_context, get_retrieved_documents
from phoenix.evals import bind_evaluator, evaluate_dataframe
from phoenix.evals.llm import LLM
from phoenix.evals.metrics import (
    CorrectnessEvaluator,
    DocumentRelevanceEvaluator,
    FaithfulnessEvaluator,
)

import phoenix as px
from phoenix.trace import DocumentEvaluations, SpanEvaluations

phoenix_client = px.Client()
last_eval_run_time = datetime.now() - timedelta(
    minutes=1, seconds=10
)  # add a few seconds to ensure all spans are captured
qa_df = get_input_output_context(phoenix_client, start_time=last_eval_run_time)
retriever_spans_df = get_retrieved_documents(phoenix_client, start_time=last_eval_run_time)

eval_model = LLM(provider="openai", model="gpt-4-turbo-preview")

faithfulness_evaluator = FaithfulnessEvaluator(llm=eval_model)
correctness_evaluator = CorrectnessEvaluator(llm=eval_model)
document_relevance_evaluator = bind_evaluator(
    evaluator=DocumentRelevanceEvaluator(llm=eval_model),
    input_mapping={"document_text": "document"},
)


def _score_dataframe(results_df: pd.DataFrame, score_name: str) -> pd.DataFrame:
    score_column = f"{score_name}_score"
    parsed = results_df[score_column].apply(
        lambda value: json.loads(value) if isinstance(value, str) else (value or {})
    )
    return pd.DataFrame(
        {
            "score": parsed.apply(lambda score: score.get("score")),
            "label": parsed.apply(lambda score: score.get("label")),
            "explanation": parsed.apply(lambda score: score.get("explanation")),
        },
        index=results_df.index,
    )


if qa_df is not None:
    qa_results_df = evaluate_dataframe(
        dataframe=qa_df,
        evaluators=[faithfulness_evaluator, correctness_evaluator],
    )
    phoenix_client.log_evaluations(
        SpanEvaluations(
            eval_name="Hallucination",
            dataframe=_score_dataframe(qa_results_df, score_name="faithfulness"),
        ),
        SpanEvaluations(
            eval_name="QA Correctness",
            dataframe=_score_dataframe(qa_results_df, score_name="correctness"),
        ),
    )

if retriever_spans_df is not None:
    relevance_results_df = evaluate_dataframe(
        dataframe=retriever_spans_df,
        evaluators=[document_relevance_evaluator],
    )
    phoenix_client.log_evaluations(
        DocumentEvaluations(
            eval_name="Relevance",
            dataframe=_score_dataframe(relevance_results_df, score_name="document_relevance"),
        ),
    )

print("Evaluations logged to Phoenix")

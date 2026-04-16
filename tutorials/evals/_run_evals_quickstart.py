# ruff: noqa: E402
# mypy: ignore-errors
"""
Auto-generated script from evals_quickstart.ipynb.
Skips: pip installs, getpass, px.launch_app(), cloud auth.
Points at localhost:6006.
"""

import asyncio
import os

os.environ["PHOENIX_COLLECTOR_ENDPOINT"] = "http://localhost:6006"

from urllib.request import urlopen

from phoenix.client import AsyncClient, Client
from phoenix.client.helpers.spans import get_input_output_context, get_retrieved_documents
from phoenix.evals.evaluators import async_evaluate_dataframe
from phoenix.evals.llm import LLM
from phoenix.evals.metrics import (  # type: ignore[attr-defined]
    CorrectnessEvaluator,
    DocumentRelevanceEvaluator,
    FaithfulnessEvaluator,
)
from phoenix.evals.utils import to_annotation_dataframe

from phoenix.trace.trace_dataset import TraceDataset
from phoenix.trace.utils import json_lines_to_df

# ── Cell 2: Download pre-existing trace data ──
print("=== Cell 2: Downloading trace data ===")

traces_url = "https://storage.googleapis.com/arize-phoenix-assets/datasets/unstructured/llm/context-retrieval/trace.jsonl"
with urlopen(traces_url) as response:
    lines = [line.decode("utf-8") for line in response.readlines()]
trace_ds = TraceDataset(json_lines_to_df(lines))
print(f"Loaded trace dataset with {len(trace_ds.dataframe)} spans")

# ── Cell 4: (skipped) px.launch_app() ──
print("=== Cell 4: Skipped (px.launch_app) ===")

# ── Cell 7: Export retrieved documents and queries ──
print("=== Cell 7: Exporting retrieved documents and queries ===")

retrieved_documents_df = get_retrieved_documents(Client())
queries_df = get_input_output_context(Client())
print(f"Retrieved documents shape: {retrieved_documents_df.shape}")  # type: ignore[union-attr]
print(f"Queries shape: {queries_df.shape}")  # type: ignore[union-attr]

# ── Cell 9: Instantiate eval model ──
print("=== Cell 9: Instantiating eval model ===")

api_key = None  # uses OPENAI_API_KEY env var
eval_model = LLM(provider="openai", model="gpt-4o-mini", api_key=api_key)
print("Eval model created")

# ── Cell 11: Define evaluators ──
print("=== Cell 11: Defining evaluators ===")

faithfulness_evaluator = FaithfulnessEvaluator(eval_model)
qa_correctness_evaluator = CorrectnessEvaluator(eval_model)
relevance_evaluator = DocumentRelevanceEvaluator(eval_model)
print("Evaluators created")

# ── Cell 13: Run evaluations ──
print("=== Cell 13: Running evaluations ===")


async def run_evals():  # type: ignore[no-untyped-def]
    faithfulness_and_qa_df = await async_evaluate_dataframe(
        dataframe=queries_df,
        evaluators=[faithfulness_evaluator, qa_correctness_evaluator],
    )
    print(f"Faithfulness & QA eval shape: {faithfulness_and_qa_df.shape}")
    print(faithfulness_and_qa_df.head())

    relevance_eval_df = await async_evaluate_dataframe(
        dataframe=retrieved_documents_df,
        evaluators=[relevance_evaluator],
    )
    print(f"Relevance eval shape: {relevance_eval_df.shape}")
    print(relevance_eval_df.head())

    return faithfulness_and_qa_df, relevance_eval_df


faithfulness_and_qa_df, relevance_eval_df = asyncio.run(run_evals())  # type: ignore[no-untyped-call]

# ── Cell 15: Log evaluations to Phoenix ──
print("=== Cell 15: Logging evaluations to Phoenix ===")


async def log_evals() -> None:
    px_client = AsyncClient()

    faithfulness_and_qa_annotations = to_annotation_dataframe(faithfulness_and_qa_df)
    print(f"Faithfulness & QA annotations shape: {faithfulness_and_qa_annotations.shape}")

    await px_client.spans.log_span_annotations_dataframe(
        dataframe=faithfulness_and_qa_annotations,
        annotator_kind="LLM",
    )
    print("Logged faithfulness & QA annotations")

    relevance_annotations = to_annotation_dataframe(relevance_eval_df)
    print(f"Relevance annotations shape: {relevance_annotations.shape}")

    await px_client.spans.log_span_annotations_dataframe(
        dataframe=relevance_annotations,
        annotator_kind="LLM",
    )
    print("Logged relevance annotations")


asyncio.run(log_evals())

# ── Cell 17: (skipped) session.url reference ──
print("=== Cell 17: Skipped (session.url) ===")
print("=== Done ===")

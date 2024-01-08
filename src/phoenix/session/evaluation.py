"""
A set of **highly experimental** helper functions to
  - extract spans from Phoenix for evaluation
    - explode retrieved documents from (horizontal) lists to a (vertical) series
      indexed by `context.span_id` and `document_position`
  - ingest evaluation results into Phoenix via HttpExporter
"""
import math
from time import sleep
from typing import (
    Any,
    Optional,
    Sequence,
    Tuple,
    Union,
    cast,
)

import pandas as pd
from google.protobuf.wrappers_pb2 import DoubleValue, StringValue
from tqdm import tqdm

import phoenix.trace.v1 as pb
from phoenix.trace.dsl.helpers import get_qa_with_reference, get_retrieved_documents
from phoenix.trace.exporter import HttpExporter

__all__ = [
    "get_retrieved_documents",
    "get_qa_with_reference",
    "add_evaluations",
]

from phoenix.trace.span_evaluations import Evaluations


def add_evaluations(
    exporter: HttpExporter,
    evaluations: pd.DataFrame,
    evaluation_name: str,
) -> None:
    index_names = evaluations.index.names
    for index, row in evaluations.iterrows():
        subject_id = _extract_subject_id_from_index(
            index_names,
            cast(Union[str, Tuple[Any]], index),
        )
        if (result := _extract_result(row)) is None:
            continue
        evaluation = pb.Evaluation(
            name=evaluation_name,
            result=result,
            subject_id=subject_id,
        )
        exporter.export(evaluation)


def _extract_subject_id_from_index(
    names: Sequence[str],
    value: Union[str, Sequence[Any]],
) -> pb.Evaluation.SubjectId:
    """
    (**Highly Experimental**)
    Returns `SubjectId` given the format of `index_names`. Allowed formats are:
        - DocumentRetrievalId
            - index_names=["context.span_id", "document_position"]
            - index_names=["span_id", "document_position"]
            - index_names=["document_position", "context.span_id"]
            - index_names=["document_position", "span_id"]
        - SpanId
            - index_names=["span_id"]
            - index_names=["context.span_id"]
        - TraceId
            - index_names=["context.span_id"]
            - index_names=["trace_id"]
    """
    assert isinstance(names, Sequence)
    if len(names) == 2:
        assert isinstance(value, Sequence) and len(value) == 2
        if "document_position" in names:
            document_position = value[names.index("document_position")]
            assert isinstance(document_position, int)
            if "context.span_id" in names:
                span_id = value[names.index("context.span_id")]
            elif "span_id" in names:
                span_id = value[names.index("span_id")]
            else:
                raise ValueError(f"Unexpected index names: {names}")
            assert isinstance(span_id, str)
            return pb.Evaluation.SubjectId(
                document_retrieval_id=pb.Evaluation.SubjectId.DocumentRetrievalId(
                    document_position=document_position,
                    span_id=span_id,
                ),
            )
    elif len(names) == 1:
        assert isinstance(value, str)
        if names[0] in ("context.span_id", "span_id"):
            return pb.Evaluation.SubjectId(span_id=value)
        if names[0] in ("context.trace_id", "trace_id"):
            return pb.Evaluation.SubjectId(trace_id=value)
    raise ValueError(f"Unexpected index names: {names}")


def _extract_result(row: "pd.Series[Any]") -> Optional[pb.Evaluation.Result]:
    score = cast(Optional[float], row.get("score"))
    if isinstance(score, float) and math.isnan(score):
        score = None
    label = cast(Optional[str], row.get("label"))
    if isinstance(label, float) and math.isnan(label):
        label = None
    explanation = cast(Optional[str], row.get("explanation"))
    if isinstance(explanation, float) and math.isnan(explanation):
        explanation = None
    if score is None and not label and not explanation:
        return None
    return pb.Evaluation.Result(
        score=DoubleValue(value=score) if score is not None else None,
        label=StringValue(value=label) if label else None,
        explanation=StringValue(value=explanation) if explanation else None,
    )


def log_evaluations(
    *evals: Evaluations,
    endpoint: Optional[str] = None,
    host: Optional[str] = None,
    port: Optional[int] = None,
) -> None:
    if not (n := sum(map(len, evals))):
        return
    exporter = HttpExporter(endpoint=endpoint, host=host, port=port)
    for eval in filter(bool, evals):
        add_evaluations(exporter, eval.dataframe, eval.eval_name)
    with tqdm(total=n, desc="Sending Evaluations") as pbar:
        while n:
            sleep(0.1)
            n_left = exporter._queue.qsize()
            n, diff = n_left, n - n_left
            pbar.update(diff)

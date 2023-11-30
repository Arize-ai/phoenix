"""
A set of **highly experimental** helper functions to
  - extract spans from Phoenix for evaluation
    - explode retrieved documents from (horizontal) lists to a (vertical) series
      indexed by `context.span_id` and `document_position`
  - ingest evaluation results into Phoenix via HttpExporter
"""
import math
from typing import (
    Any,
    Iterable,
    List,
    Mapping,
    Optional,
    Sequence,
    Tuple,
    Union,
    cast,
)

import pandas as pd
from google.protobuf.wrappers_pb2 import DoubleValue, StringValue

import phoenix.trace.v1 as pb
from phoenix.core.traces import TRACE_ID
from phoenix.session.session import Session
from phoenix.trace.exporter import HttpExporter
from phoenix.trace.schemas import ATTRIBUTE_PREFIX
from phoenix.trace.semantic_conventions import (
    DOCUMENT_CONTENT,
    DOCUMENT_SCORE,
    INPUT_VALUE,
    RETRIEVAL_DOCUMENTS,
)


def get_retrieved_documents(session: Session) -> pd.DataFrame:
    data: List[Mapping[str, Any]] = []
    if (df := session.get_spans_dataframe("span_kind == 'RETRIEVER'")) is not None:
        for span_id, query, documents, trace_id in df.loc[
            :,
            [
                ATTRIBUTE_PREFIX + INPUT_VALUE,
                ATTRIBUTE_PREFIX + RETRIEVAL_DOCUMENTS,
                TRACE_ID,
            ],
        ].itertuples():
            if not isinstance(documents, Iterable):
                continue
            for position, document in enumerate(documents):
                if not hasattr(document, "get"):
                    continue
                data.append(
                    {
                        "context.trace_id": trace_id,
                        "context.span_id": span_id,
                        "input": query,
                        "document_position": position,
                        "reference": document.get(DOCUMENT_CONTENT),
                        "document_score": document.get(DOCUMENT_SCORE),
                    }
                )
    index = ["context.span_id", "document_position"]
    columns = [
        "context.span_id",
        "document_position",
        "input",
        "reference",
        "document_score",
        "context.trace_id",
    ]
    return pd.DataFrame(data=data, columns=columns).set_index(index)


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
    label = cast(Optional[str], row.get("label"))
    explanation = cast(Optional[str], row.get("explanation"))
    if (
        (score is None or isinstance(score, float) and math.isnan(score))
        and not label
        and not explanation
    ):
        return None
    return pb.Evaluation.Result(
        score=DoubleValue(value=score) if score is not None else None,
        label=StringValue(value=label) if label else None,
        explanation=StringValue(value=explanation) if explanation else None,
    )

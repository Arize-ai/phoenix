from typing import Any, Iterable, List, Mapping, Optional, Tuple, Union, cast

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
            [ATTRIBUTE_PREFIX + INPUT_VALUE, ATTRIBUTE_PREFIX + RETRIEVAL_DOCUMENTS, TRACE_ID],
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
                        "query": query,
                        "document_position": position,
                        "document_content": document.get(DOCUMENT_CONTENT),
                        "document_score": document.get(DOCUMENT_SCORE),
                    }
                )
    index = ["context.span_id", "document_position"]
    columns = [
        "context.span_id",
        "document_position",
        "query",
        "document_content",
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
        subject_id = _extract_subject_id(cast(Union[str, Tuple[str]], index), index_names)
        result = _extract_result(row)
        evaluation = pb.Evaluation(
            name=evaluation_name,
            result=result,
            subject_id=subject_id,
        )
        exporter.export(evaluation)


def _extract_subject_id(
    index: Union[str, Tuple[str]], index_names: List[str]
) -> pb.Evaluation.SubjectID:
    if index_names and index_names[0].endswith("span_id"):
        if len(index_names) == 2 and index_names[1].endswith("document_position"):
            span_id, document_position = cast(Tuple[str, int], index)
            assert isinstance(span_id, str)
            assert isinstance(document_position, int)
            return pb.Evaluation.SubjectID(
                document_retrieval_id=pb.Evaluation.SubjectID.DocumentRetrievalID(
                    document_position=document_position,
                    span_id=span_id,
                ),
            )
        span_id = cast(str, index)
        assert isinstance(span_id, str)
        return pb.Evaluation.SubjectID(span_id=span_id)
    elif index_names and index_names[0].endswith("trace_id"):
        trace_id = cast(str, index)
        assert isinstance(trace_id, str)
        return pb.Evaluation.SubjectID(trace_id=trace_id)
    raise ValueError(f"Unexpected index names: {index_names}")


def _extract_result(row: "pd.Series[Any]") -> pb.Evaluation.Result:
    score = cast(Optional[float], row.get("score"))
    label = cast(Optional[str], row.get("label"))
    explanation = cast(Optional[str], row.get("explanation"))
    return pb.Evaluation.Result(
        score=DoubleValue(value=score) if score is not None else None,
        label=StringValue(value=label) if label else None,
        explanation=StringValue(value=explanation) if explanation else None,
    )

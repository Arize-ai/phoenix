from typing import List, Optional, Protocol, Union, cast

import pandas as pd
from openinference.semconv.trace import DocumentAttributes, SpanAttributes

from phoenix.trace.dsl import SpanQuery

DOCUMENT_CONTENT = DocumentAttributes.DOCUMENT_CONTENT
DOCUMENT_SCORE = DocumentAttributes.DOCUMENT_SCORE
INPUT_VALUE = SpanAttributes.INPUT_VALUE
OUTPUT_VALUE = SpanAttributes.OUTPUT_VALUE
RETRIEVAL_DOCUMENTS = SpanAttributes.RETRIEVAL_DOCUMENTS

INPUT = {"input": INPUT_VALUE}
OUTPUT = {"output": OUTPUT_VALUE}
IO = {**INPUT, **OUTPUT}

IS_ROOT = "parent_id is None"
IS_LLM = "span_kind == 'LLM'"
IS_RETRIEVER = "span_kind == 'RETRIEVER'"


class CanQuerySpans(Protocol):
    def query_spans(
        self, *query: SpanQuery
    ) -> Optional[Union[pd.DataFrame, List[pd.DataFrame]]]: ...


def get_retrieved_documents(obj: CanQuerySpans) -> pd.DataFrame:
    return cast(
        pd.DataFrame,
        obj.query_spans(
            SpanQuery()
            .where(IS_RETRIEVER)
            .select("trace_id", **INPUT)
            .explode(
                RETRIEVAL_DOCUMENTS,
                reference=DOCUMENT_CONTENT,
                document_score=DOCUMENT_SCORE,
            )
        ),
    )


def get_qa_with_reference(obj: CanQuerySpans) -> pd.DataFrame:
    return pd.concat(
        cast(
            List[pd.DataFrame],
            obj.query_spans(
                SpanQuery().select(**IO).where(IS_ROOT),
                SpanQuery()
                .where(IS_RETRIEVER)
                .select(span_id="parent_id")
                .concat(
                    RETRIEVAL_DOCUMENTS,
                    reference=DOCUMENT_CONTENT,
                ),
            ),
        ),
        axis=1,
        join="inner",
    )

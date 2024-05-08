import warnings
from datetime import datetime
from typing import List, Optional, Protocol, Union, cast

import pandas as pd
from openinference.semconv.trace import DocumentAttributes, SpanAttributes

from phoenix.config import get_env_project_name
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
    # Implemented by phoenix.session.client.Client
    def query_spans(
        self,
        *query: SpanQuery,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        project_name: Optional[str] = None,
    ) -> Optional[Union[pd.DataFrame, List[pd.DataFrame]]]: ...


def get_retrieved_documents(
    obj: CanQuerySpans,
    start_time: Optional[datetime] = None,
    end_time: Optional[datetime] = None,
    project_name: Optional[str] = None,
    # Deprecated
    stop_time: Optional[datetime] = None,
) -> pd.DataFrame:
    project_name = project_name or get_env_project_name()
    if stop_time is not None:
        # Deprecated. Raise a warning
        warnings.warn(
            "stop_time is deprecated. Use end_time instead.",
            DeprecationWarning,
        )
        end_time = end_time or stop_time
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
            ),
            start_time=start_time,
            end_time=end_time,
            project_name=project_name,
        ),
    )


def get_qa_with_reference(
    obj: CanQuerySpans,
    start_time: Optional[datetime] = None,
    end_time: Optional[datetime] = None,
    project_name: Optional[str] = None,
    # Deprecated
    stop_time: Optional[datetime] = None,
) -> pd.DataFrame:
    project_name = project_name or get_env_project_name()
    if stop_time:
        # Deprecated. Raise a warning
        warnings.warn(
            "stop_time is deprecated. Use end_time instead.",
            DeprecationWarning,
        )
        end_time = end_time or stop_time
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
                start_time=start_time,
                end_time=end_time,
                project_name=project_name,
            ),
        ),
        axis=1,
        join="inner",
    )

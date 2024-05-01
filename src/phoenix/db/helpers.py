from typing import Literal

from openinference.semconv.trace import (
    OpenInferenceSpanKindValues,
    RerankerAttributes,
    SpanAttributes,
)
from sqlalchemy import Integer, SQLColumnExpression, case, func
from typing_extensions import assert_never

from phoenix.db import models

# Supported dialects
SQLITE: Literal["sqlite"] = "sqlite"
POSTGRESQL: Literal["postgresql"] = "postgresql"
SUPPORTED_DIALECTS = Literal["sqlite", "postgresql"]


def num_docs_col(dialect: SUPPORTED_DIALECTS) -> SQLColumnExpression[Integer]:
    if dialect == POSTGRESQL:
        array_length = func.jsonb_array_length
    elif dialect == SQLITE:
        array_length = func.json_array_length
    else:
        assert_never(dialect)
    retrieval_docs = models.Span.attributes[_RETRIEVAL_DOCUMENTS]
    num_retrieval_docs = array_length(retrieval_docs)
    reranker_docs = models.Span.attributes[_RERANKER_OUTPUT_DOCUMENTS]
    num_reranker_docs = array_length(reranker_docs)
    return case(
        (
            func.upper(models.Span.span_kind) == OpenInferenceSpanKindValues.RERANKER.value.upper(),
            num_reranker_docs,
        ),
        else_=num_retrieval_docs,
    ).label("num_docs")


_RETRIEVAL_DOCUMENTS = SpanAttributes.RETRIEVAL_DOCUMENTS.split(".")
_RERANKER_OUTPUT_DOCUMENTS = RerankerAttributes.RERANKER_OUTPUT_DOCUMENTS.split(".")

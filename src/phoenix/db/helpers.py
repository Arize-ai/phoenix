from enum import Enum
from typing import Any, Callable, Hashable, Iterable, List, Optional, Set, Tuple, TypeVar

from openinference.semconv.trace import (
    OpenInferenceSpanKindValues,
    RerankerAttributes,
    SpanAttributes,
)
from sqlalchemy import Integer, Select, SQLColumnExpression, case, distinct, func, select
from typing_extensions import assert_never

from phoenix.db import models


class SupportedSQLDialect(Enum):
    SQLITE = "sqlite"
    POSTGRESQL = "postgresql"

    @classmethod
    def _missing_(cls, v: Any) -> "SupportedSQLDialect":
        if isinstance(v, str) and v and v.isascii() and not v.islower():
            return cls(v.lower())
        raise ValueError(f"`{v}` is not a supported SQL backend/dialect.")


def num_docs_col(dialect: SupportedSQLDialect) -> SQLColumnExpression[Integer]:
    if dialect is SupportedSQLDialect.POSTGRESQL:
        array_length = func.jsonb_array_length
    elif dialect is SupportedSQLDialect.SQLITE:
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


def get_eval_trace_ids_for_datasets(*dataset_ids: int) -> Select[Tuple[Optional[str]]]:
    return (
        select(distinct(models.ExperimentRunAnnotation.trace_id))
        .join(models.ExperimentRun)
        .join_from(models.ExperimentRun, models.Experiment)
        .where(models.Experiment.dataset_id.in_(set(dataset_ids)))
        .where(models.ExperimentRunAnnotation.trace_id.isnot(None))
    )


def get_project_names_for_datasets(*dataset_ids: int) -> Select[Tuple[Optional[str]]]:
    return (
        select(distinct(models.Experiment.project_name))
        .where(models.Experiment.dataset_id.in_(set(dataset_ids)))
        .where(models.Experiment.project_name.isnot(None))
    )


def get_eval_trace_ids_for_experiments(*experiment_ids: int) -> Select[Tuple[Optional[str]]]:
    return (
        select(distinct(models.ExperimentRunAnnotation.trace_id))
        .join(models.ExperimentRun)
        .where(models.ExperimentRun.experiment_id.in_(set(experiment_ids)))
        .where(models.ExperimentRunAnnotation.trace_id.isnot(None))
    )


def get_project_names_for_experiments(*experiment_ids: int) -> Select[Tuple[Optional[str]]]:
    return (
        select(distinct(models.Experiment.project_name))
        .where(models.Experiment.id.in_(set(experiment_ids)))
        .where(models.Experiment.project_name.isnot(None))
    )


_AnyT = TypeVar("_AnyT")
_KeyT = TypeVar("_KeyT", bound=Hashable)


def dedup(
    items: Iterable[_AnyT],
    key: Callable[[_AnyT], _KeyT],
) -> List[_AnyT]:
    """
    Discard subsequent duplicates after the first appearance in `items`.
    """
    ans = []
    seen: Set[_KeyT] = set()
    for item in items:
        if (k := key(item)) in seen:
            continue
        else:
            ans.append(item)
            seen.add(k)
    return ans

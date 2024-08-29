from collections import defaultdict
from typing import (
    DefaultDict,
    Dict,
    List,
    Optional,
    Set,
    Tuple,
)

import numpy as np
from aioitertools.itertools import groupby
from sqlalchemy import select
from strawberry.dataloader import DataLoader
from typing_extensions import TypeAlias

from phoenix.db import models
from phoenix.metrics.retrieval_metrics import RetrievalMetrics
from phoenix.server.api.types.DocumentRetrievalMetrics import DocumentRetrievalMetrics
from phoenix.server.types import DbSessionFactory

RowId: TypeAlias = int
NumDocs: TypeAlias = int
EvalName: TypeAlias = Optional[str]

Key: TypeAlias = Tuple[RowId, EvalName, NumDocs]
Result: TypeAlias = List[DocumentRetrievalMetrics]


class DocumentRetrievalMetricsDataLoader(DataLoader[Key, Result]):
    def __init__(self, db: DbSessionFactory) -> None:
        super().__init__(load_fn=self._load_fn)
        self._db = db

    async def _load_fn(self, keys: List[Key]) -> List[Result]:
        mda = models.DocumentAnnotation
        stmt = (
            select(
                mda.span_rowid,
                mda.name,
                mda.score,
                mda.document_position,
            )
            .where(mda.score != None)  # noqa: E711
            .where(mda.annotator_kind == "LLM")
            .where(mda.document_position >= 0)
            .order_by(mda.span_rowid, mda.name)
        )
        # Using CTE with VALUES clause is possible in SQLite, but not in
        # SQLAlchemy v2.0.29, hence the workaround below with over-fetching.
        # We could use CTE with VALUES for postgresql, but for now we'll keep
        # it simple and just use one approach for all backends.
        all_row_ids = {row_id for row_id, _, _ in keys}
        stmt = stmt.where(mda.span_rowid.in_(all_row_ids))
        all_eval_names = {eval_name for _, eval_name, _ in keys}
        if None not in all_eval_names:
            stmt = stmt.where(mda.name.in_(all_eval_names))
        max_position = max(num_docs for _, _, num_docs in keys)
        stmt = stmt.where(mda.document_position < max_position)
        results: Dict[Key, Result] = {key: [] for key in keys}
        requested_num_docs: DefaultDict[Tuple[RowId, EvalName], Set[NumDocs]] = defaultdict(set)
        for row_id, eval_name, num_docs in results.keys():
            requested_num_docs[(row_id, eval_name)].add(num_docs)
        async with self._db() as session:
            data = await session.stream(stmt)
            async for (span_rowid, name), group in groupby(data, lambda r: (r.span_rowid, r.name)):
                # We need to fulfill two types of potential requests: 1. when it
                # specifies an evaluation name, and 2. when it doesn't care about
                # the evaluation name by specifying None.
                max_requested_num_docs = max(
                    (
                        num_docs
                        for eval_name in (name, None)
                        for num_docs in (requested_num_docs.get((span_rowid, eval_name)) or ())
                    ),
                    default=0,
                )
                if max_requested_num_docs <= 0:
                    # We have over-fetched. Skip this group.
                    continue
                scores = [np.nan] * max_requested_num_docs
                for row in group:
                    # Length check is necessary due to over-fetching.
                    if row.document_position < len(scores):
                        scores[row.document_position] = row.score
                for eval_name in (name, None):
                    for num_docs in requested_num_docs.get((span_rowid, eval_name)) or ():
                        metrics = RetrievalMetrics(scores[:num_docs])
                        doc_metrics = DocumentRetrievalMetrics(
                            evaluation_name=name, metrics=metrics
                        )
                        key = (span_rowid, eval_name, num_docs)
                        results[key].append(doc_metrics)
        # Make sure to copy the result, so we don't return the same list
        # object to two different requesters.
        return [results[key].copy() for key in keys]

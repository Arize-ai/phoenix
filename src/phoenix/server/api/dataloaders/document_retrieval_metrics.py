from collections import defaultdict
from itertools import groupby
from typing import (
    AsyncContextManager,
    Callable,
    DefaultDict,
    Dict,
    List,
    Optional,
    Set,
    Tuple,
)

import numpy as np
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from strawberry.dataloader import DataLoader
from typing_extensions import TypeAlias

from phoenix.db import models
from phoenix.metrics.retrieval_metrics import RetrievalMetrics
from phoenix.server.api.types.DocumentRetrievalMetrics import DocumentRetrievalMetrics

RowId: TypeAlias = int
NumDocs: TypeAlias = int
EvalName: TypeAlias = Optional[str]
Key: TypeAlias = Tuple[RowId, NumDocs, EvalName]


class DocumentRetrievalMetricsDataLoader(DataLoader[Key, List[DocumentRetrievalMetrics]]):
    def __init__(self, db: Callable[[], AsyncContextManager[AsyncSession]]) -> None:
        super().__init__(load_fn=self._load_fn)
        self._db = db

    async def _load_fn(self, keys: List[Key]) -> List[List[DocumentRetrievalMetrics]]:
        results: Dict[Key, List[DocumentRetrievalMetrics]] = {key: [] for key in keys}
        requests: DefaultDict[RowId, DefaultDict[NumDocs, Set[EvalName]]] = defaultdict(
            lambda: defaultdict(set)
        )
        for row_id, num_docs, eval_name in results.keys():
            requests[row_id][num_docs].add(eval_name)
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
        max_pos: int = max(key[1] for key in keys)
        stmt = stmt.where(mda.document_position < max_pos)
        all_row_ids: Set[RowId] = {key[0] for key in keys}
        stmt = stmt.where(mda.span_rowid.in_(all_row_ids))
        all_eval_names: Set[EvalName] = {key[2] for key in keys}
        if None not in all_eval_names:
            stmt = stmt.where(mda.name.in_(all_eval_names))
        async with self._db() as session:
            data = await session.execute(stmt)
        if not data:
            return [[] for _ in keys]
        for (span_rowid, name), group in groupby(data, lambda r: (r.span_rowid, r.name)):
            rows = list(group)
            req_num_and_names: DefaultDict[NumDocs, Set[EvalName]] = requests[span_rowid]
            for req_num, req_names in req_num_and_names.items():
                # We need to fulfill two types of potential requests: 1. when it
                # specifies an evaluation name, and 2. when it doesn't care about
                # the evaluation name by specifying None.
                if not (None in req_names or name in req_names):
                    # We over-fetched and got the wrong name.
                    continue
                scores: List[float] = [np.nan] * req_num
                for row in rows:
                    scores[row.document_position] = row.score
                drm = DocumentRetrievalMetrics(
                    evaluation_name=name,
                    metrics=RetrievalMetrics(scores),
                )
                for req_name in req_names:
                    if req_name is None or req_name == name:
                        key = (span_rowid, req_num, req_name)
                        results[key].append(drm)
        # Make sure to copy the result, so we don't return the same list
        # object to two different requesters.
        return [results[key].copy() for key in keys]

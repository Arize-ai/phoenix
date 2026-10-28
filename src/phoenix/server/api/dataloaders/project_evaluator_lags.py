from collections import defaultdict
from datetime import datetime
from typing import Iterable, Optional

from strawberry.dataloader import DataLoader
from typing_extensions import TypeAlias

from phoenix.server.online_eval.evaluation_activity import EvaluationLag, load_evaluation_lags
from phoenix.server.types import DbSessionFactory

Key: TypeAlias = tuple[int, datetime, datetime]


class ProjectEvaluatorLagsDataLoader(DataLoader[Key, Optional[EvaluationLag]]):
    """Lag of project evaluators' evaluations completed within a time range. Keys are
    ``(project_evaluator_id, start, end)``, start-inclusive and end-exclusive; one read per
    distinct range in a batch."""

    def __init__(self, db: DbSessionFactory) -> None:
        super().__init__(load_fn=self._load_fn)
        self._db = db

    async def _load_fn(self, keys: Iterable[Key]) -> list[Optional[EvaluationLag]]:
        keys = list(keys)
        ids_by_range: dict[tuple[datetime, datetime], set[int]] = defaultdict(set)
        for project_evaluator_id, start, end in keys:
            ids_by_range[(start, end)].add(project_evaluator_id)
        lags: dict[Key, EvaluationLag] = {}
        for (start, end), ids in ids_by_range.items():
            for project_evaluator_id, lag in (
                await load_evaluation_lags(self._db, sorted(ids), start, end)
            ).items():
                lags[(project_evaluator_id, start, end)] = lag
        return [lags.get(key) for key in keys]

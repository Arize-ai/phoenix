from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Iterable, Optional

from strawberry.dataloader import DataLoader
from typing_extensions import TypeAlias

from phoenix.server.online_eval.evaluation_activity import EvaluationLag, load_evaluation_lags
from phoenix.server.types import DbSessionFactory

DEFAULT_LAG_WINDOW = timedelta(hours=1)

Key: TypeAlias = tuple[int, Optional[datetime], Optional[datetime]]
_Range: TypeAlias = tuple[datetime, datetime]


class ProjectEvaluatorLagsDataLoader(DataLoader[Key, Optional[EvaluationLag]]):
    """Lag of project evaluators' evaluations completed within a time range. Keys are
    ``(project_evaluator_id, start, end)`` as the caller gave them, start-inclusive and
    end-exclusive. A missing end means now and a missing start means an hour before the end;
    both are resolved once per batch, so evaluators sharing a range share one read."""

    def __init__(self, db: DbSessionFactory) -> None:
        super().__init__(load_fn=self._load_fn)
        self._db = db

    async def _load_fn(self, keys: Iterable[Key]) -> list[Optional[EvaluationLag]]:
        keys = list(keys)
        now = datetime.now(timezone.utc)
        ranges = [_resolve_range(start, end, now) for _, start, end in keys]
        ids_by_range: dict[_Range, set[int]] = defaultdict(set)
        for (project_evaluator_id, _, _), resolved in zip(keys, ranges):
            ids_by_range[resolved].add(project_evaluator_id)
        lags: dict[tuple[int, _Range], EvaluationLag] = {}
        for resolved, ids in ids_by_range.items():
            start, end = resolved
            for project_evaluator_id, lag in (
                await load_evaluation_lags(self._db, sorted(ids), start, end)
            ).items():
                lags[(project_evaluator_id, resolved)] = lag
        return [
            lags.get((project_evaluator_id, resolved))
            for (project_evaluator_id, _, _), resolved in zip(keys, ranges)
        ]


def _resolve_range(start: Optional[datetime], end: Optional[datetime], now: datetime) -> _Range:
    resolved_end = end or now
    return (start or resolved_end - DEFAULT_LAG_WINDOW, resolved_end)

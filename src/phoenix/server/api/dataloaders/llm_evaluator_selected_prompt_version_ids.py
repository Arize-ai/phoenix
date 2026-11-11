from typing import Optional

from sqlalchemy import select
from strawberry.dataloader import DataLoader
from typing_extensions import TypeAlias

from phoenix.db import models
from phoenix.server.types import DbSessionFactory

LLMEvaluatorId: TypeAlias = int
Key: TypeAlias = LLMEvaluatorId
Result: TypeAlias = Optional[int]


class LLMEvaluatorSelectedPromptVersionIdDataLoader(DataLoader[Key, Result]):
    """The id of the prompt version each LLM evaluator runs
    (`LLMEvaluator.selected_prompt_version`)."""

    def __init__(self, db: DbSessionFactory) -> None:
        super().__init__(load_fn=self._load_fn)
        self._db = db

    async def _load_fn(self, keys: list[Key]) -> list[Result]:
        stmt = (
            select(models.LLMEvaluator.id, models.PromptVersion.id)
            .join(models.LLMEvaluator.selected_prompt_version)
            .where(models.LLMEvaluator.id.in_(set(keys)))
        )
        async with self._db.read() as session:
            result = {
                evaluator_id: prompt_version_id
                async for evaluator_id, prompt_version_id in await session.stream(stmt)
            }
        return [result.get(key) for key in keys]

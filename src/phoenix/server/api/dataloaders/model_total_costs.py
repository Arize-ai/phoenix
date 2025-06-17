from dataclasses import dataclass
from typing import Optional

from sqlalchemy import func, select
from strawberry.dataloader import DataLoader
from typing_extensions import TypeAlias

from phoenix.db import models
from phoenix.server.types import DbSessionFactory


@dataclass
class ModelTotalCost:
    model_id: int
    total_input_token_cost: Optional[float]
    total_output_token_cost: Optional[float]
    total_cache_read_token_cost: Optional[float]
    total_cache_write_token_cost: Optional[float]
    total_prompt_audio_token_cost: Optional[float]
    total_completion_audio_token_cost: Optional[float]
    total_reasoning_token_cost: Optional[float]
    total_token_cost: Optional[float]


ModelID: TypeAlias = int
Key: TypeAlias = ModelID
Result: TypeAlias = Optional[ModelTotalCost]


class ModelTotalCostsDataLoader(DataLoader[Key, Result]):
    def __init__(self, db: DbSessionFactory) -> None:
        super().__init__(load_fn=self._load_fn)
        self._db = db

    async def _load_fn(self, keys: list[Key]) -> list[Result]:
        model_ids = list(set(keys))
        async with self._db() as session:
            stmt = (
                select(
                    models.SpanCost.generative_model_id,
                    func.sum(models.SpanCost.input_token_cost).label("total_input_token_cost"),
                    func.sum(models.SpanCost.output_token_cost).label("total_output_token_cost"),
                    func.sum(models.SpanCost.cache_read_token_cost).label(
                        "total_cache_read_token_cost"
                    ),
                    func.sum(models.SpanCost.cache_write_token_cost).label(
                        "total_cache_write_token_cost"
                    ),
                    func.sum(models.SpanCost.prompt_audio_token_cost).label(
                        "total_prompt_audio_token_cost"
                    ),
                    func.sum(models.SpanCost.completion_audio_token_cost).label(
                        "total_completion_audio_token_cost"
                    ),
                    func.sum(models.SpanCost.reasoning_token_cost).label(
                        "total_reasoning_token_cost"
                    ),
                    func.sum(models.SpanCost.total_token_cost).label("total_token_cost"),
                )
                .where(models.SpanCost.generative_model_id.in_(model_ids))
                .group_by(models.SpanCost.generative_model_id)
            )
            costs_by_model_id = {
                row.model_id: ModelTotalCost(**row._asdict())
                async for row in await session.stream(stmt)
            }
        return [costs_by_model_id.get(model_id) for model_id in keys]

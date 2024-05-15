from typing import Any, Dict
from dataclasses import dataclass
from datetime import datetime

from phoenix.db import models
from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession


@dataclass
class Dataset:
    id: int
    name: str
    description: str
    created_at: datetime
    modified_at: datetime
    metadata: Dict[str, Any]

    @classmethod
    def from_model(cls, model):
        return cls(
            id=model.id,
            name=model.name,
            description=model.description,
            metadata=model.metadata_,
        )

    async def count_active_records(self, session: AsyncSession) -> int:
        result = await session.execute(
            select(
                func.sum(
                    case(
                        (models.DatasetExampleRevision.revision_kind == "CREATE", 1),
                        (models.DatasetExampleRevision.revision_kind == "DELETE", -1),
                        else_=0,
                    )
                )
            )
            .select_from(models.DatasetExampleRevision)
            .join(
                models.DatasetExample,
                models.DatasetExample.id == models.DatasetExampleRevision.dataset_example_id,
            )
            .filter(models.DatasetExample.dataset_id == self.id)
        )
        active_count = result.scalar()
        return active_count if active_count is not None else 0

    async def serialize(self, session):
        active_records = await self.count_active_records(session)
        return {
            "name": self.name,
            "description": self.description,
            "id": self.id,
            "metadata": self.metadata,
            "record_count": active_records,
        }

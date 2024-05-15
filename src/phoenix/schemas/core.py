from dataclasses import dataclass
from datetime import datetime
from typing import Any, Dict

from phoenix.db import models
from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession


@dataclass
class Dataset:
    id: int
    name: str
    description: str
    created_at: datetime
    updated_at: datetime
    metadata: Dict[str, Any]

    @classmethod
    def from_model(cls, model: models.Dataset) -> "Dataset":
        return cls(
            id=model.id,
            name=model.name,
            description=model.description,
            created_at=model.created_at,
            updated_at=model.updated_at,
            metadata=model.metadata_,
        )

    async def count_active_examples(self, session: AsyncSession) -> int:
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

    async def serialize(self, session: AsyncSession) -> Dict[str, Any]:
        active_examples = await self.count_active_examples(session)
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "metadata": self.metadata,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
            "example_count": active_examples,
        }

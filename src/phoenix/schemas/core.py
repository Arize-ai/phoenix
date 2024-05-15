from dataclasses import dataclass
from datetime import datetime
from typing import Any, Dict, Optional

from phoenix.db import models


@dataclass
class Dataset:
    id: int
    name: str
    description: Optional[str]
    created_at: datetime
    updated_at: datetime
    metadata: Dict[str, Any]
    example_count: int

    @classmethod
    async def from_model(cls, model: models.Dataset, session) -> "Dataset":
        return cls(
            id=model.id,
            name=model.name,
            description=model.description,
            created_at=model.created_at,
            updated_at=model.updated_at,
            metadata=model.metadata_,
            example_count=await model.load_example_count(session),
        )

    async def serialize(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "metadata": self.metadata,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
            "example_count": self.example_count,
        }

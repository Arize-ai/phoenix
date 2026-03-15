from __future__ import annotations

from typing import TYPE_CHECKING

import strawberry
from strawberry.scalars import JSON

from phoenix.db.types.db_helper_types import UNDEFINED

if TYPE_CHECKING:
    from phoenix.server.api.helpers.prompts import models


@strawberry.type
class PromptResponseFormatJSONSchemaDefinition:
    name: str
    description: str | None
    schema: JSON | None
    strict: bool | None

    @classmethod
    def from_orm(
        cls, d: models.PromptResponseFormatJSONSchemaDefinition
    ) -> PromptResponseFormatJSONSchemaDefinition:
        return cls(
            name=d.name,
            description=d.description if d.description is not UNDEFINED else None,
            schema=d.schema_ if d.schema_ is not UNDEFINED else None,
            strict=d.strict if isinstance(d.strict, bool) else None,
        )


@strawberry.type
class PromptResponseFormatJSONSchema:
    json_schema: PromptResponseFormatJSONSchemaDefinition

    @classmethod
    def from_orm(cls, rf: models.PromptResponseFormatJSONSchema) -> PromptResponseFormatJSONSchema:
        return cls(json_schema=PromptResponseFormatJSONSchemaDefinition.from_orm(rf.json_schema))

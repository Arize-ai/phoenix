"""Base models for vendored data-stream-protocol types.

Source: pydantic_ai/ui/vercel_ai/_models.py from pydantic-ai-slim==2.4.0.
Keep this module in sync when bumping pydantic-ai.
"""

from abc import ABC

from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class CamelBaseModel(BaseModel, ABC):
    """Base model with camelCase aliases."""

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, extra="forbid")

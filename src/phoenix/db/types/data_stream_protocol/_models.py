# Vendored from pydantic-ai v2.9.0: https://github.com/pydantic/pydantic-ai
# Copyright (c) Pydantic Services Inc. 2024 to present
# SPDX-License-Identifier: MIT

"""Models for Vercel AI protocol."""

from abc import ABC

from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class CamelBaseModel(BaseModel, ABC):
    """Base model with camelCase aliases."""

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, extra="forbid")

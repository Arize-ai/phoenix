# Vendored from pydantic-ai v2.26.0:
# https://github.com/pydantic/pydantic-ai/tree/v2.26.0/pydantic_ai_slim/pydantic_ai/ui/vercel_ai
# Copyright (c) Pydantic Services Inc. 2024 to present
# SPDX-License-Identifier: MIT
#
# The tag records where this copy was taken, not how current it is:
# tests/unit/db/types/test_data_stream_protocol_compatibility.py compares this file against
# the *installed* pydantic-ai on every run, so drift fails CI rather than going unnoticed.

"""Models for Vercel AI protocol."""

from abc import ABC

from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class CamelBaseModel(BaseModel, ABC):
    """Base model with camelCase aliases."""

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, extra="forbid")

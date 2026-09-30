"""Where an LLM evaluator's pinned prompt version comes from.

An LLM evaluator runs the prompt version its tag pins. Callers name that version by a
source: content for a new evaluator-owned prompt, an existing version to start from, or,
on update, edits to the evaluator's current prompt. Content identical to its starting
version pins that version; content that differs is appended to the starting version's
prompt and pinned.
"""

from dataclasses import dataclass
from typing import Optional, Union

from sqlalchemy.ext.asyncio import AsyncSession
from strawberry.relay import GlobalID

from phoenix.db import models
from phoenix.server.api.exceptions import NotFound
from phoenix.server.api.types.node import from_global_id_with_expected_type


@dataclass(frozen=True)
class NewPrompt:
    """Store the content as the first version of a new evaluator-owned prompt."""

    content: models.PromptVersion


@dataclass(frozen=True)
class FromPromptVersion:
    """Start from an existing version; content that differs is appended to its prompt."""

    prompt_version_id: GlobalID
    content: models.PromptVersion


@dataclass(frozen=True)
class EditCurrentPrompt:
    """Start from the version the evaluator's tag pins; differing content is appended."""

    content: models.PromptVersion


CreatePromptSource = Union[NewPrompt, FromPromptVersion]
UpdatePromptSource = Union[EditCurrentPrompt, FromPromptVersion]


async def get_prompt_version(
    session: AsyncSession, prompt_version_id: GlobalID
) -> models.PromptVersion:
    version = await session.get(
        models.PromptVersion,
        from_global_id_with_expected_type(prompt_version_id, "PromptVersion"),
    )
    if version is None:
        raise NotFound(f"Prompt version not found: {prompt_version_id}")
    return version


async def pin_prompt_version(
    session: AsyncSession,
    *,
    base: Optional[models.PromptVersion],
    content: models.PromptVersion,
    prompt_id: int,
) -> models.PromptVersion:
    """Return base when the content is identical to it; otherwise append the content to
    the prompt and return it."""
    if base is not None and base.has_identical_content(content):
        return base
    content.prompt_id = prompt_id
    session.add(content)
    await session.flush()
    return content
